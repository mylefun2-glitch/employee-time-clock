import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { KeypadValue, Employee } from '../types';
import { checkPin, logAttendance, getRecentAttendance } from '../services/attendance';
import { 
    getAccurateCurrentPosition, 
    isWithinAnyLocation, 
    formatDistance, 
    isGeolocationSupported, 
    CompanyLocation, 
    geolocationManager,
    getIpBasedLocation
} from '../services/geolocation';
import { getActiveLocations } from '../services/companyLocationService';
import SuccessOverlay from '../components/SuccessOverlay';
import FailureOverlay from '../components/FailureOverlay';

// Helper to format date in Traditional Chinese
const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
    }).format(date);
};

// Helper to format time as HH:mm
const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

const KioskPage: React.FC = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [pin, setPin] = useState<string>('');
    const [isAnimating, setIsAnimating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successData, setSuccessData] = useState<{
        employee: Employee;
        type: 'IN' | 'OUT';
        time: string;
        recentLogs: any[];
    } | null>(null);
    const [showFailure, setShowFailure] = useState(false);
    const [failureMessage, setFailureMessage] = useState('');
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationInfo, setLocationInfo] = useState<{ 
        distance: number; 
        withinRange: boolean; 
        locationName?: string; 
        error?: string; 
        accuracy?: number; 
        origin?: 'gps' | 'ip' | 'network' 
    } | null>(null);
    const [companyLocations, setCompanyLocations] = useState<CompanyLocation[]>([]);

    // 背景持續監測位置
    useEffect(() => {
        const isSecure = window.isSecureContext || window.location.hostname === 'localhost';
        
        if (!isGeolocationSupported()) {
            getIpBasedLocation().then(ipPos => {
                if (ipPos) {
                    const { withinRange, distance, nearestLocation } = isWithinAnyLocation(
                        ipPos.latitude,
                        ipPos.longitude,
                        companyLocations
                    );
                    setLocationInfo({
                        distance,
                        withinRange,
                        locationName: nearestLocation?.name || '公司',
                        accuracy: ipPos.accuracy,
                        origin: 'ip'
                    });
                } else {
                    setLocationInfo({ distance: 0, withinRange: false, error: '您的瀏覽器不支援定位功能' });
                }
            });
            return;
        }

        if (!isSecure) {
            setLocationInfo({ distance: 0, withinRange: false, error: '連線不安全：請使用 HTTPS 網址啟用定位' });
            return;
        }

        geolocationManager.startWatching();
        
        const unsubscribe = geolocationManager.subscribe((status) => {
            if (status.error) {
                getIpBasedLocation().then(ipPos => {
                    if (ipPos) {
                        const { withinRange, distance, nearestLocation } = isWithinAnyLocation(
                            ipPos.latitude,
                            ipPos.longitude,
                            companyLocations
                        );
                        setLocationInfo({
                            distance,
                            withinRange,
                            locationName: nearestLocation?.name || '公司',
                            accuracy: ipPos.accuracy,
                            origin: 'ip'
                        });
                    } else {
                        setLocationInfo(prev => ({
                            distance: prev?.distance || 0,
                            withinRange: prev?.withinRange || false,
                            error: status.error || undefined,
                            accuracy: prev?.accuracy,
                            origin: prev?.origin
                        }));
                    }
                });
            } else if (status.position) {
                const { withinRange, distance, nearestLocation } = isWithinAnyLocation(
                    status.position.latitude,
                    status.position.longitude,
                    companyLocations
                );
                setLocationInfo({
                    distance,
                    withinRange,
                    locationName: nearestLocation?.name || '公司',
                    accuracy: status.position.accuracy,
                    origin: 'gps'
                });
            }
        });
        
        return () => {
            unsubscribe();
            geolocationManager.stopWatching();
        };
    }, [companyLocations.length]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const loadLocations = async () => {
            const locations = await getActiveLocations();
            setCompanyLocations(locations);
        };
        loadLocations();
    }, []);

    const handleKeypadPress = useCallback((value: KeypadValue) => {
        if (value === 'CLEAR') {
            setPin('');
            return;
        }
        if (value === 'BACKSPACE') {
            setPin((prev) => prev.slice(0, -1));
            return;
        }
        setPin((prev) => {
            if (prev.length >= 6) return prev;
            return prev + value;
        });
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (showSuccess || showFailure) return;
            const { key } = event;
            if (/^[0-9]$/.test(key)) {
                handleKeypadPress(key as KeypadValue);
            } else if (key === 'Backspace') {
                handleKeypadPress('BACKSPACE');
            } else if (key === 'Escape') {
                handleKeypadPress('CLEAR');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeypadPress, showSuccess, showFailure]);

    const handleSubmit = async (type: 'in' | 'out') => {
        if (pin.length !== 6 || isLoading) {
            if (pin.length !== 6) {
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 500);
            }
            return;
        }

        setIsLoading(true);

        try {
            const employee = await checkPin(pin);
            if (!employee) {
                setFailureMessage('驗證失敗：找不到此 PIN 碼');
                setShowFailure(true);
                setPin('');
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 500);
                setIsLoading(false);
                return;
            }

            let locationData: { latitude: number; longitude: number; accuracy: number; origin?: string } | undefined;

            setIsGettingLocation(true);
            try {
                const result = await getAccurateCurrentPosition(3500, 200);
                if (result.position) {
                    locationData = { ...result.position, origin: result.origin };
                    const { withinRange, distance, nearestLocation } = isWithinAnyLocation(
                        result.position.latitude,
                        result.position.longitude,
                        companyLocations
                    );
                    setLocationInfo({
                        distance,
                        withinRange,
                        locationName: nearestLocation?.name || '公司',
                        accuracy: result.position.accuracy,
                        origin: result.origin === 'ip' ? 'ip' : (result.origin === 'network' ? 'network' : 'gps')
                    });
                }
            } catch (error: any) {
                console.warn('定位失敗:', error.message);
            } finally {
                setIsGettingLocation(false);
            }

            const typeStr = type === 'in' ? 'IN' : 'OUT';
            const logResult = await logAttendance(employee.id, typeStr, locationData);

            if (logResult.success) {
                const recentLogs = await getRecentAttendance(employee.id);
                setSuccessData({ employee, type: typeStr, time: formatTime(currentTime), recentLogs });
                setShowSuccess(true);
                setPin('');
            } else {
                setFailureMessage(`打卡失敗：${logResult.error || '未知錯誤'}`);
                setShowFailure(true);
            }
        } catch (error) {
            console.error(error);
            setFailureMessage('系統發生錯誤，請稍後再試');
            setShowFailure(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-[#eef6ff] dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col items-center justify-center p-4 selection:bg-primary/20 relative overflow-hidden">
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-[100px]" />
            </div>

            <main className="w-full max-w-[440px] bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col relative z-10">
                <header className="bg-white dark:bg-[#1e293b] p-6 text-center border-b border-slate-100 dark:border-slate-700">
                    <div className="flex flex-col items-center gap-2">
                        <img src="/logo.jpg" alt="Y'ACC Logo" className="h-20 w-auto object-contain mb-1" />
                        <h2 className="text-primary dark:text-blue-400 text-lg font-black tracking-[0.1em]">員 工 打 卡 系 統</h2>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium tracking-wide">{formatDate(currentTime)}</p>
                </header>

                <div className="py-6 text-center bg-gradient-to-b from-slate-50 to-white dark:from-[#1e293b] dark:to-[#1e293b]">
                    <h1 className="text-[56px] leading-none font-bold text-slate-800 dark:text-slate-100 tracking-tight font-mono tabular-nums">{formatTime(currentTime)}</h1>
                </div>

                <div className={`px-6 pb-2 ${isAnimating ? 'animate-pulse' : ''}`}>
                    <div className="flex justify-center gap-3 mb-4 mt-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className={`h-14 w-11 flex items-center justify-center rounded-lg text-2xl font-bold transition-all duration-200 ${pin[index] !== undefined ? 'border-2 border-primary bg-primary/5 text-primary' : 'border-b-2 border-slate-200 bg-slate-50 text-slate-800'}`}>
                                {pin[index]}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 pt-2">
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <NumberButton key={num} value={num.toString() as KeypadValue} onClick={handleKeypadPress} />
                        ))}
                        <button onClick={() => handleKeypadPress('BACKSPACE')} className="h-14 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center"><span className="material-symbols-outlined">backspace</span></button>
                        <NumberButton value="0" onClick={handleKeypadPress} />
                        <button onClick={() => handleKeypadPress('CLEAR')} className="h-14 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500">清除</button>
                    </div>

                    <div className="mb-4">
                        {locationInfo ? (
                            <div className={`p-3 border rounded-lg flex items-center gap-3 ${locationInfo.error ? 'bg-rose-50 border-rose-200' : locationInfo.withinRange ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                                <div className="flex flex-col items-center">
                                    <span className={`material-symbols-outlined text-2xl ${
                                        locationInfo.error ? 'text-rose-500' : 
                                        locationInfo.origin === 'network' ? 'text-emerald-500 font-bold' :
                                        locationInfo.origin === 'ip' ? 'text-blue-500' :
                                        locationInfo.accuracy && locationInfo.accuracy < 100 ? 'text-green-500' : 'text-amber-500'
                                    }`}>
                                        {locationInfo.error ? 'location_off' : 
                                         locationInfo.origin === 'network' ? 'verified_user' :
                                         locationInfo.origin === 'ip' ? 'lan' :
                                         locationInfo.accuracy && locationInfo.accuracy < 100 ? 'signal_cellular_4_bar' : 'signal_cellular_2_bar'}
                                    </span>
                                    {locationInfo.accuracy && <span className="text-[10px] font-bold opacity-60">{Math.round(locationInfo.accuracy)}m</span>}
                                </div>
                                <div className="flex-1 text-sm">
                                    <p className="font-bold">
                                        {locationInfo.error ? '定位受限' : 
                                         locationInfo.origin === 'network' ? '公司網路驗證通過' :
                                         locationInfo.origin === 'ip' ? '網路位置 (備援)' :
                                         (locationInfo.withinRange ? '位置正常' : '超出範圍')}
                                    </p>
                                    <p className="text-xs opacity-70">
                                        {locationInfo.error || (
                                            locationInfo.origin === 'network' ? '已偵測到公司公網 IP，位置合法' :
                                            locationInfo.origin === 'ip' ? '已透過網路估算概略位置' : 
                                            `距離 ${locationInfo.locationName} 約 ${formatDistance(locationInfo.distance)}`
                                        )}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                    {isGettingLocation ? (
                                        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
                                    ) : (
                                        <button 
                                            onClick={() => {
                                                setLocationInfo(null);
                                                geolocationManager.stopWatching();
                                                geolocationManager.startWatching();
                                            }}
                                            className="p-1.5 hover:bg-black/5 rounded-md text-slate-400 hover:text-primary transition-colors"
                                            title="重新整理定位"
                                        >
                                            <span className="material-symbols-outlined text-lg">refresh</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-3 animate-pulse">
                                <span className="material-symbols-outlined text-slate-400">my_location</span>
                                <span className="text-sm text-slate-500">正在獲取位置...</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <ActionButton type="in" onClick={() => handleSubmit('in')} disabled={pin.length !== 6 || isLoading} />
                        <ActionButton type="out" onClick={() => handleSubmit('out')} disabled={pin.length !== 6 || isLoading} />
                    </div>

                    {/* 底部功能入口 */}
                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-center gap-6">
                        <Link to="/employee/login" className="flex items-center gap-1.5 text-slate-500 hover:text-primary transition-colors font-bold text-sm">
                            <span className="material-symbols-outlined text-lg">person</span>
                            員工入口
                        </Link>
                        <div className="w-px h-3 bg-slate-200 dark:bg-slate-600"></div>
                        <Link to="/admin/login" className="flex items-center gap-1.5 text-slate-500 hover:text-primary transition-colors font-bold text-sm">
                            <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                            管理者入口
                        </Link>
                    </div>
                </div>
            </main>

            <footer className="mt-8 text-slate-400 text-xs text-center relative z-10">
                <p>© 2023 Company Name. All rights reserved.</p>
                <div className="flex items-center justify-center gap-1 mt-1 text-emerald-500">
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    <span>Secure Connection</span>
                </div>
            </footer>

            {showSuccess && successData && <SuccessOverlay employee={successData.employee} checkType={successData.type} time={successData.time} recentLogs={successData.recentLogs} onClose={() => setShowSuccess(false)} />}
            {showFailure && <FailureOverlay message={failureMessage} onClose={() => setShowFailure(false)} />}
        </div>
    );
};

const NumberButton: React.FC<{ value: KeypadValue; onClick: (val: KeypadValue) => void }> = ({ value, onClick }) => (
    <button onClick={() => onClick(value)} className="h-14 rounded-lg bg-slate-50 hover:bg-slate-100 text-xl font-semibold text-slate-700 border border-slate-100">{value}</button>
);

const ActionButton: React.FC<{ type: 'in' | 'out'; onClick: () => void; disabled: boolean }> = ({ type, onClick, disabled }) => (
    <button onClick={onClick} className={`h-16 flex flex-col items-center justify-center rounded-xl text-white font-bold transition-all ${type === 'in' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-orange-500 hover:bg-orange-600'} ${disabled ? 'opacity-50' : 'opacity-100'}`}>
        <span className="material-symbols-outlined">{type === 'in' ? 'login' : 'logout'}</span>
        <span>{type === 'in' ? '上班打卡' : '下班打卡'}</span>
    </button>
);

export default KioskPage;
