/**
 * 地理位置服務 (進階版)
 * 提供背景持續監測與最後已知位置快取功能
 */



export interface CompanyLocation {
    id?: string;
    name?: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    is_active?: boolean;
    description?: string;
    trusted_ips?: string[]; // 新增：可信任的 IP 清單 (例如公司固定 IP)
}

export interface GeolocationStatus {
    position: GeolocationData | null;
    error: string | null;
    isWatching: boolean;
    origin?: 'gps' | 'ip' | 'network';
}

// 預設公司位置（範例中加入信任 IP 邏輯）
export const DEFAULT_COMPANY_LOCATION: CompanyLocation = {
    name: '公司總部',
    latitude: 25.0330,
    longitude: 121.5654,
    radius_meters: 100,
    trusted_ips: ['1.2.3.4'] // 這裡以後可以讓管理員設定
};

/**
 * 檢查是否為公司信任的網路環境
 */
export const isCompanyNetwork = async (userIp: string, locations: CompanyLocation[]): Promise<boolean> => {
    for (const loc of locations) {
        if (loc.trusted_ips?.includes(userIp)) return true;
    }
    return false;
};

/**
 * 定位管理員 (Singleton)
 * 負責在背景持續監測位置，並提供最新的位置快取與錯誤狀態
 */
class GeolocationManager {
    private lastPosition: GeolocationData | null = null;
    private lastError: string | null = null;
    private watchId: number | null = null;
    private subscribers: ((status: GeolocationStatus) => void)[] = [];

    /**
     * 開始背景監測
     */
    public startWatching() {
        if (this.watchId !== null || !navigator.geolocation) {
            if (!navigator.geolocation) {
                this.lastError = '您的瀏覽器不支援定位功能';
                this.notifySubscribers();
            }
            return;
        }

        // 某些瀏覽器需要一個單次請求來誘發權限提示
        navigator.geolocation.getCurrentPosition(
            () => { /* 權限已取得，watchPosition 會繼續工作 */ },
            (err) => {
                this.handleError(err);
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );

        console.log('啟動背景定位監測...');
        this.watchId = navigator.geolocation.watchPosition(
            (pos) => {
                this.lastPosition = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    timestamp: pos.timestamp
                };
                this.lastError = null;
                this.notifySubscribers();
            },
            (err) => {
                this.handleError(err);
            },
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 10000
            }
        );
    }

    private handleError(error: GeolocationPositionError) {
        console.warn('定位監測錯誤:', error.message);
        switch (error.code) {
            case error.PERMISSION_DENIED:
                this.lastError = '定位權限遭拒。請檢查瀏覽器設定。';
                break;
            case error.POSITION_UNAVAILABLE:
                this.lastError = '無法取得位置資訊。請確認 GPS 已開啟。';
                break;
            case error.TIMEOUT:
                // 超時不清除位置，只記錄錯誤
                this.lastError = '定位請求逾時，正在重試...';
                break;
            default:
                this.lastError = error.message;
        }
        this.notifySubscribers();
    }

    /**
     * 停止背景監測
     */
    public stopWatching() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.notifySubscribers();
        }
    }

    /**
     * 取得最後已知位置
     */
    public getLastPosition(maxAgeMs: number = 60000): GeolocationData | null {
        if (!this.lastPosition) return null;
        const age = Date.now() - this.lastPosition.timestamp;
        return age < maxAgeMs ? this.lastPosition : null;
    }

    /**
     * 訂閱狀態更新 (包含位置與錯誤資訊)
     */
    public subscribe(callback: (status: GeolocationStatus) => void) {
        this.subscribers.push(callback);
        // 立即回傳當前狀態
        callback({
            position: this.lastPosition,
            error: this.lastError,
            isWatching: this.watchId !== null
        });
        return () => {
            this.subscribers = this.subscribers.filter(s => s !== callback);
        };
    }

    private notifySubscribers() {
        const status: GeolocationStatus = {
            position: this.lastPosition,
            error: this.lastError,
            isWatching: this.watchId !== null
        };
        this.subscribers.forEach(s => s(status));
    }
}

export const geolocationManager = new GeolocationManager();

export interface GeolocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
    ip?: string; // 加入 IP 欄位
}

export interface AccuratePositionResult {
    position: GeolocationData | null;
    error?: string;
    errorCode?: number;
    origin?: 'gps' | 'ip' | 'network';
}

/**
 * 透過 IP 獲取概略位置 (備援方案 - 多來源嘗試)
 */
export const getIpBasedLocation = async (): Promise<GeolocationData | null> => {
    // 來源 1: ipapi.co
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
            const data = await response.json();
            if (data && data.latitude && data.longitude) {
                console.log('IP 定位成功 (ipapi.co):', data.ip);
                return {
                    latitude: data.latitude,
                    longitude: data.longitude,
                    accuracy: 3000,
                    timestamp: Date.now(),
                    ip: data.ip
                };
            }
        }
    } catch (e) {
        console.warn('ipapi.co 定位嘗試失敗');
    }

    // 來源 2: ip-api.com (透過 https 需付費，測試是否有免對應端)
    try {
        const response = await fetch('https://ipinfo.io/json?token='); // 雖然沒 token 限制多，但可作為備援
        if (response.ok) {
            const data = await response.json();
            if (data && data.loc) {
                const [lat, lon] = data.loc.split(',').map(Number);
                console.log('IP 定位成功 (ipinfo.io):', data.ip);
                return {
                    latitude: lat,
                    longitude: lon,
                    accuracy: 5000,
                    timestamp: Date.now(),
                    ip: data.ip
                };
            }
        }
    } catch (e) {
        console.warn('ipinfo.io 定位嘗試失敗');
    }

    return null;
};

/**
 * 獲取當前位置 (優化版 - 包含 IP 與網路驗證備援)
 */
export const getAccurateCurrentPosition = async (
    timeoutMs: number = 5000,
    accuracyThresholdMeters: number = 200,
    companyLocations: CompanyLocation[] = []
): Promise<AccuratePositionResult> => {
    const cached = geolocationManager.getLastPosition(30000);
    if (cached && cached.accuracy <= accuracyThresholdMeters) {
        return { position: cached, origin: 'gps' };
    }

    geolocationManager.startWatching();

    return new Promise((resolve) => {
        let isResolved = false;

        const checkStatus = async (status: GeolocationStatus) => {
            if (isResolved) return;
            
            if (status.position && status.position.accuracy <= accuracyThresholdMeters) {
                isResolved = true;
                resolve({ position: status.position, origin: 'gps' });
                return;
            }

            if (status.error && (status.error.includes('權限') || status.error.includes('支援'))) {
                isResolved = true;
                const ipPos = await getIpBasedLocation();
                if (ipPos && ipPos.ip) {
                    const isCompany = await isCompanyNetwork(ipPos.ip, companyLocations);
                    resolve({ 
                        position: ipPos, 
                        origin: isCompany ? 'network' : 'ip',
                        error: undefined 
                    });
                } else {
                    resolve({ position: null, error: '定位失敗 (GPS/IP 均不可用)' });
                }
            }
        };

        const unsubscribe = geolocationManager.subscribe(checkStatus);

        setTimeout(async () => {
            if (!isResolved) {
                isResolved = true;
                unsubscribe();
                
                const last = geolocationManager.getLastPosition(timeoutMs + 30000);
                if (last) {
                    resolve({ position: last, origin: 'gps' });
                } else {
                    // 超時後嘗試 IP 定位
                    const ipPos = await getIpBasedLocation();
                    if (ipPos && ipPos.ip) {
                        const isCompany = await isCompanyNetwork(ipPos.ip, companyLocations);
                        resolve({ 
                            position: ipPos, 
                            origin: isCompany ? 'network' : 'ip',
                            error: undefined
                        });
                    } else {
                        resolve({ position: null, error: '定位逾時' });
                    }
                }
            }
        }, timeoutMs);
    });
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
};

export const findNearestLocation = (userLat: number, userLon: number, locations: CompanyLocation[]) => {
    if (locations.length === 0) return null;
    let nearest = locations[0];
    let minD = calculateDistance(userLat, userLon, nearest.latitude, nearest.longitude);
    for (let i = 1; i < locations.length; i++) {
        const d = calculateDistance(userLat, userLon, locations[i].latitude, locations[i].longitude);
        if (d < minD) { minD = d; nearest = locations[i]; }
    }
    return { location: nearest, distance: minD };
};

export const isWithinAnyLocation = (userLat: number, userLon: number, locations: CompanyLocation[]) => {
    if (locations.length === 0) {
        const d = calculateDistance(userLat, userLon, DEFAULT_COMPANY_LOCATION.latitude, DEFAULT_COMPANY_LOCATION.longitude);
        return { withinRange: d <= DEFAULT_COMPANY_LOCATION.radius_meters, nearestLocation: DEFAULT_COMPANY_LOCATION, distance: d };
    }
    const nearest = findNearestLocation(userLat, userLon, locations);
    if (!nearest) return { withinRange: false, nearestLocation: null, distance: 0 };
    return { withinRange: nearest.distance <= nearest.location.radius_meters, nearestLocation: nearest.location, distance: nearest.distance };
};

export const formatDistance = (meters: number): string => meters < 1000 ? `${meters} 公尺` : `${(meters / 1000).toFixed(1)} 公里`;
export const isGeolocationSupported = (): boolean => 'geolocation' in navigator;
