import React, { useEffect, useState, useRef } from 'react';

interface FailureOverlayProps {
    message: string;
    onClose: () => void;
    autoCloseSeconds?: number;
}

const FailureOverlay: React.FC<FailureOverlayProps> = ({
    message,
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-rose-100 dark:border-rose-900/30">
                {/* Header with Icon */}
                <div className="p-8 text-center bg-rose-500 text-white">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-4 animate-shake">
                        <span className="material-symbols-outlined text-5xl">
                            error
                        </span>
                    </div>
                    <h2 className="text-3xl font-bold mb-1">
                        打卡失敗
                    </h2>
                    <p className="text-white/80 font-medium">
                        請檢查後再試一次
                    </p>
                </div>

                {/* Info Section */}
                <div className="p-8 text-center">
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-500 mb-4">
                            <span className="material-symbols-outlined text-2xl">info</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-200 text-lg font-semibold leading-relaxed">
                            {message}
                        </p>
                    </div>

                    {/* Close Button & Countdown */}
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                    >
                        我知道了 ({timeLeft}s)
                    </button>

                    <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
                        若持續發生問題，請聯繫管理員
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-shake {
                    animation: shake 0.4s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default FailureOverlay;
