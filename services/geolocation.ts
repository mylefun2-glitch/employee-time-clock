/**
 * 地理位置服務
 * 提供位置獲取、距離計算和範圍驗證功能
 */

export interface GeolocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
}

export interface CompanyLocation {
    id?: string;
    name?: string;
    latitude: number;
    longitude: number;
    radius_meters: number; // 允許範圍（公尺）
    is_active?: boolean;
    description?: string;
}

// 預設公司位置（台北 101 範例座標）
// 請在實際使用時修改為真實公司座標
export const DEFAULT_COMPANY_LOCATION: CompanyLocation = {
    name: '預設地點',
    latitude: 25.0330,
    longitude: 121.5654,
    radius_meters: 100 // 100 公尺範圍
};

/**
 * 獲取當前位置
 */
export const getCurrentPosition = (): Promise<GeolocationData> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('您的瀏覽器不支援定位功能'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                let errorMessage = '定位失敗';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '您拒絕了定位權限請求';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '無法取得位置資訊';
                        break;
                    case error.TIMEOUT:
                        errorMessage = '定位請求逾時';
                        break;
                }
                reject(new Error(errorMessage));
            },
            {
                enableHighAccuracy: true, // 使用高精度定位
                timeout: 10000,           // 10 秒逾時
                maximumAge: 0             // 不使用快取位置
            }
        );
    });
};

/**
 * 獲取高精度當前位置（透過持續監測 2 秒，取精確度最優值）
 * 解決 GPS 剛開啟或定位未穩定時的偏移問題
 */
export interface AccuratePositionResult {
    position: GeolocationData | null;
    error?: string;
    errorCode?: number;
}

export const getAccurateCurrentPosition = (
    timeoutMs: number = 2000,
    accuracyThresholdMeters: number = 100
): Promise<AccuratePositionResult> => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ position: null, error: '您的瀏覽器不支援定位功能' });
            return;
        }

        let bestPosition: GeolocationData | null = null;
        let watchId: number | null = null;
        let lastError: string | undefined;
        let lastErrorCode: number | undefined;

        const cleanup = () => {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
        };

        const timer = setTimeout(() => {
            cleanup();
            resolve({ position: bestPosition, error: lastError, errorCode: lastErrorCode });
        }, timeoutMs);

        // 先執行一次 getCurrentPosition 以在某些瀏覽器（如 Safari）中更可靠地觸發權限提示
        navigator.geolocation.getCurrentPosition(
            () => { /* 成功則交給 watch處理 */ },
            (error) => {
                lastError = error.message;
                lastErrorCode = error.code;
            },
            { enableHighAccuracy: true, timeout: timeoutMs }
        );

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const currentData: GeolocationData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };

                // 如果還沒有最佳位置，或者當前精確度更好，則更新
                if (!bestPosition || currentData.accuracy < bestPosition.accuracy) {
                    bestPosition = currentData;
                }

                // 如果達到準確度閾值，則提前結束
                if (currentData.accuracy <= accuracyThresholdMeters) {
                    clearTimeout(timer);
                    cleanup();
                    resolve({ position: currentData });
                }
            },
            (error) => {
                console.warn('Geolocation watch error:', error);
                lastErrorCode = error.code;

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        lastError = '您已拒絕定位權限。請點擊網址列旁的「設定」圖示並將定位權限改為「詢問」或「允許」。';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        lastError = '無法取得位置資訊。請確認您的系統設定（iOS/macOS 的「隱私權與安全性」）中已開啟「定位服務」。';
                        break;
                    case error.TIMEOUT:
                        lastError = '定位請求逾時。請移動到收訊較佳的地方後再試一次。';
                        break;
                    default:
                        lastError = error.message;
                }

                // 如果是權限被拒絕，立即結束並告知
                if (error.code === error.PERMISSION_DENIED) {
                    clearTimeout(timer);
                    cleanup();
                    resolve({ position: null, error: lastError, errorCode: error.code });
                }
            },
            {
                enableHighAccuracy: true,
                timeout: timeoutMs,
                maximumAge: 0
            }
        );
    });
};

/**
 * 計算兩點之間的距離（公尺）
 * 使用 Haversine 公式
 */
export const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
    const R = 6371e3; // 地球半徑（公尺）
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c); // 回傳整數公尺
};

/**
 * 尋找最近的公司地點
 */
export const findNearestLocation = (
    userLat: number,
    userLon: number,
    locations: CompanyLocation[]
): { location: CompanyLocation; distance: number } | null => {
    if (locations.length === 0) return null;

    let nearestLocation = locations[0];
    let minDistance = calculateDistance(
        userLat,
        userLon,
        nearestLocation.latitude,
        nearestLocation.longitude
    );

    for (let i = 1; i < locations.length; i++) {
        const distance = calculateDistance(
            userLat,
            userLon,
            locations[i].latitude,
            locations[i].longitude
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearestLocation = locations[i];
        }
    }

    return {
        location: nearestLocation,
        distance: minDistance
    };
};

/**
 * 檢查是否在允許範圍內（支援多地點）
 */
export const isWithinRange = (
    userLat: number,
    userLon: number,
    companyLocation: CompanyLocation = DEFAULT_COMPANY_LOCATION
): { withinRange: boolean; distance: number } => {
    const distance = calculateDistance(
        userLat,
        userLon,
        companyLocation.latitude,
        companyLocation.longitude
    );

    return {
        withinRange: distance <= companyLocation.radius_meters,
        distance
    };
};

/**
 * 檢查是否在任一公司地點範圍內
 */
export const isWithinAnyLocation = (
    userLat: number,
    userLon: number,
    locations: CompanyLocation[]
): {
    withinRange: boolean;
    nearestLocation: CompanyLocation | null;
    distance: number;
} => {
    if (locations.length === 0) {
        // 如果沒有設定地點，使用預設地點
        const result = isWithinRange(userLat, userLon);
        return {
            ...result,
            nearestLocation: DEFAULT_COMPANY_LOCATION
        };
    }

    const nearest = findNearestLocation(userLat, userLon, locations);

    if (!nearest) {
        return {
            withinRange: false,
            nearestLocation: null,
            distance: 0
        };
    }

    return {
        withinRange: nearest.distance <= nearest.location.radius_meters,
        nearestLocation: nearest.location,
        distance: nearest.distance
    };
};

/**
 * 格式化距離顯示
 */
export const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${meters} 公尺`;
    }
    return `${(meters / 1000).toFixed(1)} 公里`;
};

/**
 * 檢查瀏覽器是否支援定位
 */
export const isGeolocationSupported = (): boolean => {
    return 'geolocation' in navigator;
};
