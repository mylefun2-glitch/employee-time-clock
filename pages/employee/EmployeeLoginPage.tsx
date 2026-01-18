import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployee } from '../../contexts/EmployeeContext';
import { LogIn, ArrowLeft } from 'lucide-react';

const EmployeeLoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useEmployee();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username.trim()) {
            setError('請輸入員工帳號');
            return;
        }

        if (pin.length !== 6) {
            setError('請輸入完整的 6 位數 PIN 碼');
            return;
        }

        setLoading(true);
        setError('');

        const result = await login(username, pin);

        if (result.success) {
            navigate('/employee/dashboard');
        } else {
            setError(result.error || '登入失敗');
            setPin('');
        }

        setLoading(false);
    };

    const handlePinInput = (value: string) => {
        const numericValue = value.replace(/\D/g, '').slice(0, 6);
        setPin(numericValue);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo 和標題 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4 shadow-xl shadow-blue-100">
                        <LogIn className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">員工服務平台</h1>
                    <p className="text-slate-500 font-medium">請輸入您的帳號與 PIN 碼以登入</p>
                </div>

                {/* 登入表單 */}
                <div className="bg-white rounded-3xl shadow-2xl p-8 border border-white/50 backdrop-blur-sm">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* 錯誤訊息 */}
                        {error && (
                            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                <span className="material-symbols-outlined text-rose-500">error</span>
                                <p className="text-sm text-rose-600 font-bold">{error}</p>
                            </div>
                        )}

                        {/* 帳號輸入 */}
                        <div>
                            <label htmlFor="username" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                員工帳號 (預設為姓名)
                            </label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-slate-900 font-bold outline-none transition-all"
                                placeholder="請輸入帳號"
                                autoFocus
                            />
                        </div>

                        {/* PIN 碼輸入 */}
                        <div>
                            <label htmlFor="pin" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                PIN 碼 (6位身分證後六碼)
                            </label>
                            <input
                                type="password"
                                id="pin"
                                value={pin}
                                onChange={(e) => handlePinInput(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-center text-3xl font-mono tracking-[0.5em] text-slate-900 outline-none transition-all"
                                placeholder="••••••"
                                maxLength={6}
                            />
                            <div className="mt-3 flex justify-center">
                                <div className="flex gap-1">
                                    {[...Array(6)].map((_, i) => (
                                        <div
                                            key={i}
                                            className={`h-1.5 w-6 rounded-full transition-all ${i < pin.length ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 登入按鈕 */}
                        <button
                            type="submit"
                            disabled={loading || pin.length !== 6 || !username.trim()}
                            className="w-full bg-blue-600 text-white py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:translate-y-0 transition-all"
                        >
                            {loading ? '身分驗證中...' : '確認登入'}
                        </button>
                    </form>

                    {/* 提示訊息 */}
                    <div className="mt-8 pt-8 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-4 rounded-xl">
                            <span className="material-symbols-outlined text-base">info</span>
                            <p className="font-medium">忘記帳號或 PIN 碼？請聯繫單位主管或人事部門。</p>
                        </div>
                    </div>
                </div>

                {/* 返回打卡機 */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm transition-all group"
                    >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        返回打卡系統首頁
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmployeeLoginPage;
