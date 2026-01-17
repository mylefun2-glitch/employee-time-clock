import React, { useEffect, useState, useRef } from 'react';
import { Employee } from '../services/attendance';

interface AttendanceLog {
    id: string;
    timestamp: string;
    check_type: 'IN' | 'OUT';
}

interface SuccessOverlayProps {
    employee: Employee;
    checkType: 'IN' | 'OUT';
    time: string;
    recentLogs: AttendanceLog[];
    onClose: () => void;
    autoCloseSeconds?: number;
}

const SuccessOverlay: React.FC<SuccessOverlayProps> = ({
    employee,
    checkType,
    time,
    recentLogs,
    onClose,
    autoCloseSeconds = 5
}) => {
    const [timeLeft, setTimeLeft] = useState(autoCloseSeconds);
    const onCloseRef = useRef(onClose);

    // 保持 onCloseRef 最新
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    onCloseRef.current();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []); // 空依賴陣列，只在掛載時執行一次

    const formatTimestamp = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header with Icon */}
                <div className={`p-8 text-center ${checkType === 'IN' ? 'bg-emerald-500' : 'bg-orange-500'} text-white`}>
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-4 animate-bounce">
                        <span className="material-symbols-outlined text-5xl">
                            {checkType === 'IN' ? 'check_circle' : 'logout'}
                        </span>
                    </div>
                    <h2 className="text-3xl font-bold mb-1">
                        {checkType === 'IN' ? '上班打卡成功' : '下班打卡成功'}
                    </h2>
                    <p className="text-white/80 font-medium">
                        {employee.name}，辛苦了！
                    </p>
                </div>

                {/* Info Section */}
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                        <div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">部門</p>
                            <p className="text-slate-700 dark:text-slate-200 font-semibold">{employee.department}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">打卡時間</p>
                            <p className="text-slate-700 dark:text-slate-200 font-semibold">{time}</p>
                        </div>
                    </div>

                    {/* Recent Logs */}
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">history</span>
                            最近打卡紀錄
                        </h3>
                        <div className="space-y-2">
                            {recentLogs.length > 0 ? (
                                recentLogs.map((log) => (
                                    <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-2 h-2 rounded-full ${log.check_type === 'IN' ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
                                            <span className="text-slate-700 dark:text-slate-200 font-medium tracking-wide text-sm">
                                                {log.check_type === 'IN' ? '上班' : '下班'}
                                            </span>
                                        </div>
                                        <span className="text-slate-500 dark:text-slate-400 text-sm font-mono">
                                            {formatTimestamp(log.timestamp)}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center py-4 text-slate-400 italic text-sm">無歷史紀錄</p>
                            )}
                        </div>
                    </div>

                    {/* Close Button & Countdown */}
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                    >
                        我知道了 ({timeLeft}s)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuccessOverlay;
