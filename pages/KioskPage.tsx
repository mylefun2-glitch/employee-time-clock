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

    // --- 優化新增狀態 ---
    const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
    const [lastLog, setLastLog] = useState<any>(null);
    const [suggestedType, setSuggestedType] = useState<'IN' | 'OUT' | null>(null);
    const [isVerifyingPin, setIsVerifyingPin] = useState(false);
    const [autoClearTimer, setAutoClearTimer] = useState<NodeJS.Timeout | null>(null);

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

    // 重置自動清空定時器
    const resetAutoClear = useCallback(() => {
        if (autoClearTimer) clearTimeout(autoClearTimer);
        const timer = setTimeout(() => {
            setPin('');
            setActiveEmployee(null);
            setLastLog(null);
            setSuggestedType(null);
        }, 15000); // 15秒無動作自動清空
        setAutoClearTimer(timer);
    }, [autoClearTimer]);

    // 監控 PIN 碼輸入，滿 6 位自動驗證
    useEffect(() => {
        if (pin.length === 6) {
            const verify = async () => {
                setIsVerifyingPin(true);
                try {
                    const emp = await checkPin(pin);
                    if (emp) {
                        setActiveEmployee(emp);
                        const logs = await getRecentAttendance(emp.id, 1);
                        const latest = logs[0];
                        setLastLog(latest);
                        
                        // 智慧建議邏輯：如果最後一筆是 IN，則建議 OUT；否則建議 IN
                        if (latest && latest.check_type === 'IN') {
                            setSuggestedType('OUT');
                        } else {
                            setSuggestedType('IN');
                        }
                        resetAutoClear();
                    } else {
                        // PIN 碼無效
                        setSuggestedType(null);
                        setActiveEmployee(null);
                    }
                } catch (err) {
                    console.error('身份驗證失敗', err);
                } finally {
                    setIsVerifyingPin(false);
                }
            };
            verify();
        } else {
            // 清除當前狀態
            if (activeEmployee) setActiveEmployee(null);
            if (suggestedType) setSuggestedType(null);
        }
        
        if (pin.length > 0) resetAutoClear();
    }, [pin]);

    const handleKeypadPress = useCallback((value: KeypadValue) => {
        resetAutoClear();
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
    }, [resetAutoClear]);

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
            const employee = activeEmployee || await checkPin(pin);
            if (!employee) {
                setFailureMessage('驗證失敗：找不到此 PIN 碼');
                setShowFailure(true);
                setPin('');
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 500);
                setIsLoading(false);
                return;
            }

            // 防呆確認：如果員工選擇的操作與預期相反（重複打相同類型的卡）
            const selectedType = type === 'in' ? 'IN' : 'OUT';
            if (lastLog && lastLog.check_type === selectedType) {
                const typeName = selectedType === 'IN' ? '上班' : '下班';
                const confirmMsg = `偵測到您今日已於 ${new Date(lastLog.timestamp).toLocaleTimeString()} 進行過${typeName}打卡，確定要再次${typeName}嗎？`;
                if (!window.confirm(confirmMsg)) {
                    setIsLoading(false);
                    return;
                }
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

            const typeStr = selectedType;
            const logResult = await logAttendance(employee.id, typeStr, locationData);

            if (logResult.success) {
                const recentLogs = await getRecentAttendance(employee.id);
                setSuccessData({ employee, type: typeStr, time: formatTime(currentTime), recentLogs });
                setShowSuccess(true);
                setPin('');
                setActiveEmployee(null);
                setLastLog(null);
                setSuggestedType(null);
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
        <div className="bg-[#eef6ff] dark:bg-background-dark text-slate-900 dark:text-white font-display h-[100dvh] flex flex-col items-center justify-center p-3 sm:p-4 selection:bg-primary/20 relative overflow-hidden">
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-[100px]" />
            </div>

            <main className="w-full max-w-[420px] h-auto max-h-[720px] bg-white dark:bg-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col relative z-10 shrink-0">
                <header className="bg-white dark:bg-[#1e293b] p-4 text-center border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-center gap-3">
                        <img src="/logo.jpg" alt="Y'ACC Logo" className="h-10 w-auto object-contain" />
                        <h2 className="text-primary dark:text-blue-400 text-base font-black tracking-widest">打 卡 系 統</h2>
                    </div>
                </header>

                <div className="py-4 text-center bg-slate-50/50 dark:from-[#1e293b]">
                    <h1 className="text-5xl leading-none font-bold text-slate-800 dark:text-slate-100 tracking-tight font-mono tabular-nums">{formatTime(currentTime)}</h1>
                    <p className="text-slate-400 text-[10px] mt-1 font-bold">{formatDate(currentTime)}</p>
                </div>

                <div className={`px-6 py-2 ${isAnimating ? 'animate-pulse' : ''}`}>
                    <div className="flex justify-center gap-2 mb-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className={`h-11 w-9 flex items-center justify-center rounded-lg text-xl font-black transition-all duration-200 ${pin[index] !== undefined ? 'border-2 border-primary bg-primary/5 text-primary' : 'border-b-2 border-slate-200 bg-slate-50 text-slate-800'}`}>
                                {pin[index]}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-6 pb-4">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <NumberButton key={num} value={num.toString() as KeypadValue} onClick={handleKeypadPress} />
                        ))}
                        <button onClick={() => handleKeypadPress('BACKSPACE')} className="h-11 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center shadow-sm"><span className="material-symbols-outlined text-lg">backspace</span></button>
                        <NumberButton value="0" onClick={handleKeypadPress} />
                        <button onClick={() => handleKeypadPress('CLEAR')} className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs shadow-sm">清除</button>
                    </div>

                    {/* 身分資訊區 - 壓縮高度 */}
                    <div className="mb-2 h-[52px]">
                        {isVerifyingPin ? (
                            <div className="h-full bg-blue-50 border border-blue-100 rounded-xl px-4 flex items-center justify-center gap-2 animate-pulse">
                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-bold text-primary">驗證中...</span>
                            </div>
                        ) : activeEmployee ? (
                            <div className="h-full bg-emerald-50 border border-emerald-100 rounded-xl px-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined text-base">person</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-600 leading-none mb-0.5">Hello!</p>
                                        <p className="text-sm font-black text-slate-800 leading-none">{activeEmployee.name}</p>
                                    </div>
                                </div>
                                {suggestedType && (
                                    <div className="bg-white/80 px-2 py-1 rounded-lg border border-emerald-200 text-center">
                                        <p className="text-[8px] font-black text-emerald-600 uppercase">建議</p>
                                        <p className="text-[10px] font-black text-slate-700 leading-none">{suggestedType === 'IN' ? '上班' : '下班'}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center border border-dashed border-slate-200 rounded-xl">
                                <p className="text-[10px] font-bold text-slate-300">請輸入員編 PIN 碼</p>
                            </div>
                        )}
                    </div>

                    <div className="mb-3">
                        {locationInfo ? (
                            <div className={`py-1.5 px-3 border rounded-lg flex items-center gap-2 ${locationInfo.error ? 'bg-rose-50 border-rose-200' : locationInfo.withinRange ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                                <span className={`material-symbols-outlined text-lg ${locationInfo.error ? 'text-rose-500' : 'text-slate-500'}`}>
                                    {locationInfo.error ? 'location_off' : 'my_location'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold truncate">
                                        {locationInfo.error ? '定位受限' : (locationInfo.withinRange ? '位置正常' : '超出範圍')} 
                                        {!locationInfo.error && <span className="ml-1 opacity-60 font-normal">({locationInfo.locationName})</span>}
                                    </p>
                                </div>
                                <button onClick={() => { setLocationInfo(null); geolocationManager.stopWatching(); geolocationManager.startWatching(); }} className="p-1 hover:bg-black/5 rounded">
                                    <span className="material-symbols-outlined text-base text-slate-400">refresh</span>
                                </button>
                            </div>
                        ) : (
                            <div className="py-1.5 px-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2 animate-pulse">
                                <span className="material-symbols-outlined text-base text-slate-400">hourglass_empty</span>
                                <span className="text-[10px] text-slate-500">定位中...</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <CompactActionButton 
                            type="in" 
                            onClick={() => handleSubmit('in')} 
                            disabled={pin.length !== 6 || isLoading} 
                            isSuggested={suggestedType === 'IN'}
                            isDuplicated={lastLog?.check_type === 'IN'}
                        />
                        <CompactActionButton 
                            type="out" 
                            onClick={() => handleSubmit('out')} 
                            disabled={pin.length !== 6 || isLoading} 
                            isSuggested={suggestedType === 'OUT'}
                            isDuplicated={lastLog?.check_type === 'OUT'}
                        />
                    </div>

                    <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100">
                        <Link to="/employee/login" className="text-slate-400 hover:text-primary transition-colors font-bold text-[10px]">員工入口</Link>
                        <Link to="/admin/login" className="text-slate-400 hover:text-primary transition-colors font-bold text-[10px]">管理者入口</Link>
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
    <button onClick={() => onClick(value)} className="h-11 rounded-xl bg-slate-50 hover:bg-slate-100 text-lg font-black text-slate-700 border border-slate-100 shadow-sm transition-all active:scale-95 active:bg-slate-200">{value}</button>
);

const CompactActionButton: React.FC<{ 
    type: 'in' | 'out'; 
    onClick: () => void; 
    disabled: boolean;
    isSuggested?: boolean;
    isDuplicated?: boolean;
}> = ({ type, onClick, disabled, isSuggested, isDuplicated }) => (
    <button 
        onClick={onClick} 
        disabled={disabled}
        className={`h-20 flex flex-col items-center justify-center rounded-2xl text-white font-black transition-all relative overflow-hidden group
            ${type === 'in' 
                ? (isSuggested ? 'bg-emerald-500 shadow-lg shadow-emerald-200 ring-2 ring-emerald-100 scale-105 opacity-100 z-10' : 'bg-emerald-600/40 opacity-50') 
                : (isSuggested ? 'bg-orange-500 shadow-lg shadow-orange-200 ring-2 ring-orange-100 scale-105 opacity-100 z-10' : 'bg-orange-600/40 opacity-50')
            } 
            ${disabled ? 'opacity-20 grayscale-100 cursor-not-allowed scale-100 ring-0' : 'hover:scale-[1.05] hover:opacity-100 active:scale-95'}
        `}
    >
        {isSuggested && (
            <div className="absolute top-0 right-0 p-1 flex items-center">
                <span className="text-[8px] font-black bg-white/20 px-1 rounded-full animate-pulse">SUGGESTED</span>
            </div>
        )}
        <span className={`material-symbols-outlined text-2xl mb-0.5 ${isSuggested ? 'animate-pulse' : ''}`}>
            {type === 'in' ? 'login' : 'logout'}
        </span>
        <span className="text-xs tracking-widest">{type === 'in' ? '上班打卡' : '下班打卡'}</span>

        {isDuplicated && !isSuggested && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <p className="text-[8px] font-black bg-black/60 px-1.5 py-0.5 rounded border border-white/10 text-white uppercase">Today OK</p>
            </div>
        )}
    </button>
);

export default KioskPage;
