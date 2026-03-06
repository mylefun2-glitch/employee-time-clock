import React from 'react';

interface TimeInput24hProps {
    value: string; // "HH:mm" format
    onChange: (value: string) => void;
    label?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
}

const TimeInput24h: React.FC<TimeInput24hProps> = ({
    value,
    onChange,
    required = false,
    disabled = false,
    className = ""
}) => {
    // Split "HH:mm" into hours and minutes
    const [h, m] = value.split(':');
    const hours = h || '00';
    const minutes = m || '00';

    const handleHourChange = (newHour: string) => {
        onChange(`${newHour}:${minutes}`);
    };

    const handleMinuteChange = (newMinute: string) => {
        onChange(`${hours}:${newMinute}`);
    };

    return (
        <div className={`flex items-center gap-0.5 ${className}`}>
            <div className="flex-1 relative">
                <select
                    value={hours}
                    onChange={(e) => handleHourChange(e.target.value)}
                    disabled={disabled}
                    required={required}
                    className="w-full h-11 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono font-bold appearance-none cursor-pointer text-sm"
                >
                    {Array.from({ length: 24 }).map((_, i) => {
                        const val = i.toString().padStart(2, '0');
                        return <option key={val} value={val}>{val}時</option>;
                    })}
                </select>
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                </div>
            </div>

            <span className="font-black text-slate-300">:</span>

            <div className="flex-1 relative">
                <select
                    value={minutes}
                    onChange={(e) => handleMinuteChange(e.target.value)}
                    disabled={disabled}
                    required={required}
                    className="w-full h-11 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono font-bold appearance-none cursor-pointer text-sm"
                >
                    {Array.from({ length: 60 }).map((_, i) => {
                        const val = i.toString().padStart(2, '0');
                        return <option key={val} value={val}>{val}分</option>;
                    })}
                </select>
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                </div>
            </div>
        </div>
    );
};

export default TimeInput24h;
