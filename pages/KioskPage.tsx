import React, { useState, useEffect, useCallback } from 'react';
import { KeypadValue } from '../types';
import { checkPin, logAttendance, getRecentAttendance } from '../services/attendance';
import { Employee } from '../types';
import { getCurrentPosition, isWithinAnyLocation, formatDistance, isGeolocationSupported, CompanyLocation } from '../services/geolocation';
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

// Helper to format time as HH:mm:ss
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
    const [locationInfo, setLocationInfo] = useState<{ distance: number; withinRange: boolean; locationName?: string } | null>(null);
    const [companyLocations, setCompanyLocations] = useState<CompanyLocation[]>([]);

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Load company locations
    useEffect(() => {
        const loadLocations = async () => {
            const locations = await getActiveLocations();
            setCompanyLocations(locations);
        };
        loadLocations();
    }, []);

    // Handle keypad input
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

    // Handle submission
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
            // 1. Verify PIN
            const employee = await checkPin(pin);

            if (!employee) {
                // PIN not found
                setFailureMessage('驗證失敗：找不到此 PIN 碼');
                setShowFailure(true);
                setPin('');
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 500);
                setIsLoading(false);
                return;
            }

            // 2. 獲取地理位置（記錄模式：即使失敗也允許打卡）
            let locationData: { latitude: number; longitude: number; accuracy: number } | undefined;

            if (isGeolocationSupported()) {
                setIsGettingLocation(true);
                try {
                    const position = await getCurrentPosition();
                    locationData = position;

                    // 檢查是否在任一公司地點範圍內
                    const { withinRange, distance, nearestLocation } = isWithinAnyLocation(
                        position.latitude,
                        position.longitude,
                        companyLocations
                    );

                    setLocationInfo({
                        distance,
                        withinRange,
                        locationName: nearestLocation?.name || '公司'
                    });

                    // 記錄模式：顯示警告但仍允許打卡
                    if (!withinRange) {
                        console.warn(`打卡位置超出範圍：${distance} 公尺（最近地點：${nearestLocation?.name || '未知'}）`);
                    }
                } catch (error: any) {
                    console.warn('無法取得位置：', error.message);
                    // 記錄模式：定位失敗仍允許打卡
                } finally {
                    setIsGettingLocation(false);
                }
            }

            // 3. Log Attendance
            const typeStr = type === 'in' ? 'IN' : 'OUT'; // Map to DB enum
            const result = await logAttendance(employee.id, typeStr, locationData);

            if (result.success) {
                // 3. Fetch recent logs for the overlay
                const recentLogs = await getRecentAttendance(employee.id);

                setSuccessData({
                    employee,
                    type: type === 'in' ? 'IN' : 'OUT',
                    time: formatTime(currentTime),
                    recentLogs
                });
                setShowSuccess(true);
                setPin('');
            } else {
                setFailureMessage(`打卡失敗：${result.error || '未知錯誤'}`);
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

            {/* Background Blobs */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-[100px]" />
            </div>

            {/* Main Card */}
            <main className="w-full max-w-[440px] bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col relative z-10">

                {/* Header */}
                <header className="bg-white dark:bg-[#1e293b] p-6 text-center border-b border-slate-100 dark:border-slate-700">
                    <div className="flex flex-col items-center gap-2">
                        <img src="/logo.jpg" alt="Y'ACC Logo" className="h-20 w-auto object-contain mb-1" />
                        <h2 className="text-primary dark:text-blue-400 text-lg font-black tracking-[0.1em]">
                            員 工 打 卡 系 統
                        </h2>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium tracking-wide">
                        {formatDate(currentTime)}
                    </p>
                </header>

                {/* Clock Display */}
                <div className="py-6 text-center bg-gradient-to-b from-slate-50 to-white dark:from-[#1e293b] dark:to-[#1e293b]">
                    <h1 className="text-[56px] leading-none font-bold text-slate-800 dark:text-slate-100 tracking-tight font-mono tabular-nums">
                        {formatTime(currentTime)}
                    </h1>
                </div>

                {/* PIN Input Display */}
                <div className={`px-6 pb-2 ${isAnimating ? 'animate-pulse' : ''}`}>
                    <p className={`text-center mb-4 text-sm font-medium transition-colors ${isAnimating ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>
                        {isAnimating ? '請輸入完整6碼驗證碼' : '請輸入身分驗證碼 (民國生日後六碼)'}
                    </p>
                    <div className="flex justify-center gap-3 mb-2">
                        {Array.from({ length: 6 }).map((_, index) => {
                            const digit = pin[index];
                            const isFilled = digit !== undefined;
                            return (
                                <div
                                    key={index}
                                    className={`h-14 w-11 flex items-center justify-center rounded-lg text-2xl font-bold shadow-sm transition-all duration-200
                    ${isFilled
                                            ? 'border-2 border-primary bg-primary/5 text-primary dark:text-blue-400'
                                            : 'border-b-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white'
                                        }`}
                                >
                                    {digit}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Keypad Section */}
                <div className="p-6 pt-2">
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <NumberButton key={num} value={num.toString() as KeypadValue} onClick={handleKeypadPress} />
                        ))}

                        <button
                            onClick={() => handleKeypadPress('BACKSPACE')}
                            className="h-14 rounded-lg bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 active:scale-[0.98] transition-all text-base font-medium text-rose-600 dark:text-rose-400 shadow-sm border border-rose-100 dark:border-rose-900/50 flex items-center justify-center gap-1 group select-none"
                        >
                            <span className="material-symbols-outlined text-[20px]">backspace</span>
                        </button>

                        <NumberButton value="0" onClick={handleKeypadPress} />

                        <button
                            onClick={() => handleKeypadPress('CLEAR')}
                            className="h-14 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-[0.98] transition-all text-base font-medium text-slate-500 dark:text-slate-400 shadow-sm border border-slate-100 dark:border-slate-600 select-none"
                        >
                            清除
                        </button>
                    </div>

                    {/* 位置資訊顯示 */}
                    {isGettingLocation && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                            <span className="text-sm text-blue-700 dark:text-blue-300">正在獲取位置...</span>
                        </div>
                    )}

                    {locationInfo && !isGettingLocation && (
                        <div className={`mb-4 p-3 border rounded-lg flex items-center gap-2 ${locationInfo.withinRange
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                            }`}>
                            <span className="material-symbols-outlined text-lg">
                                {locationInfo.withinRange ? 'check_circle' : 'warning'}
                            </span>
                            <div className="flex-1">
                                <p className={`text-sm font-medium ${locationInfo.withinRange
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-amber-700 dark:text-amber-300'
                                    }`}>
                                    {locationInfo.withinRange ? '位置正常' : '位置異常'}
                                </p>
                                <p className={`text-xs ${locationInfo.withinRange
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                    }`}>
                                    距離{locationInfo.locationName || '公司'} {formatDistance(locationInfo.distance)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                        <ActionButton
                            type="in"
                            onClick={() => handleSubmit('in')}
                            disabled={pin.length !== 6 || isLoading}
                        />
                        <ActionButton
                            type="out"
                            onClick={() => handleSubmit('out')}
                            disabled={pin.length !== 6 || isLoading}
                        />
                    </div>
                </div>

            </main>

            {/* Success Overlay */}
            {showSuccess && successData && (
                <SuccessOverlay
                    employee={successData.employee}
                    checkType={successData.type}
                    time={successData.time}
                    recentLogs={successData.recentLogs}
                    onClose={() => setShowSuccess(false)}
                />
            )}

            {/* Failure Overlay */}
            {showFailure && (
                <FailureOverlay
                    message={failureMessage}
                    onClose={() => setShowFailure(false)}
                />
            )}


            {/* Footer */}
            <footer className="mt-8 text-slate-400 text-xs text-center relative z-10">
                <p>© 2023 Company Name. All rights reserved.</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[14px] text-emerald-500">lock</span>
                    <span>Secure Connection</span>
                </div>
                <div className="mt-4 flex items-center justify-center gap-6">
                    <a href="/employee/login" className="flex items-center gap-1.5 text-slate-400 hover:text-blue-500 transition-colors font-bold group">
                        <span className="material-symbols-outlined text-[18px] group-hover:rotate-12 transition-transform">person</span>
                        員工平台登入
                    </a>
                    <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700"></div>
                    <a href="/admin/login" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors font-medium">
                        <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                        後台管理
                    </a>
                </div>
            </footer>
        </div>
    );
};

// Subcomponent: Number Button
const NumberButton: React.FC<{ value: KeypadValue; onClick: (val: KeypadValue) => void }> = ({ value, onClick }) => (
    <button
        onClick={() => onClick(value)}
        className="h-14 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-[0.98] transition-all text-xl font-semibold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-slate-600 select-none"
    >
        {value}
    </button>
);

// Subcomponent: Action Button
const ActionButton: React.FC<{ type: 'in' | 'out'; onClick: () => void; disabled: boolean }> = ({ type, onClick, disabled }) => {
    const isCheckIn = type === 'in';

    const baseClasses = "relative h-16 flex flex-col items-center justify-center rounded-xl text-white shadow-lg dark:shadow-none transition-all active:scale-[0.98] group overflow-hidden select-none";

    const colorClasses = isCheckIn
        ? "bg-[#10B981] hover:bg-[#059669] active:bg-[#047857] shadow-emerald-200"
        : "bg-[#F97316] hover:bg-[#EA580C] active:bg-[#C2410C] shadow-orange-200";

    const opacityClass = disabled ? "opacity-70 grayscale-[0.3]" : "opacity-100";

    return (
        <button
            onClick={onClick}
            className={`${baseClasses} ${colorClasses} ${opacityClass}`}
        // We don't actually disable the button to allow the "shake" error feedback logic in handle submit to fire if user presses it
        >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <span className="material-symbols-outlined mb-0.5 text-2xl">
                {isCheckIn ? 'login' : 'logout'}
            </span>
            <span className="text-base font-bold tracking-wide">
                {isCheckIn ? '上班打卡' : '下班打卡'}
            </span>
        </button>
    );
};

export default KioskPage;
