import React from 'react';

const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-[#0f172a] animate-in fade-in duration-500">
            {/* 背景裝飾 */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />

            <div className="relative flex flex-col items-center">
                {/* Logo 容器與動畫環 */}
                <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-3xl" />
                    <div className="absolute inset-0 border-4 border-primary rounded-3xl animate-loading-spin" style={{ borderLeftColor: 'transparent', borderBottomColor: 'transparent' }} />

                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 animate-pulse">
                            <span className="material-symbols-outlined text-white text-3xl">bolt</span>
                        </div>
                    </div>
                </div>

                {/* 文字與進度感 */}
                <div className="text-center space-y-3">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-widest uppercase">
                        YACC <span className="text-primary">Connect</span>
                    </h2>
                    <div className="flex items-center gap-1 justify-center">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-4">
                        正在為您準備專屬介面...
                    </p>
                </div>
            </div>

            <style>{`
        @keyframes loading-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-loading-spin {
          animation: loading-spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
        </div>
    );
};

export default LoadingScreen;
