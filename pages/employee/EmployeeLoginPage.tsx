import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployee } from '../../contexts/EmployeeContext';
import { LogIn } from 'lucide-react';

const EmployeeLoginPage: React.FC = () => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useEmployee();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (pin.length !== 6) {
            setError('請輸入完整的 6 位數 PIN 碼');
            return;
        }

        setLoading(true);
        setError('');

        const result = await login(pin);

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
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
                        <LogIn className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">員工平台</h1>
                    <p className="text-slate-600">請輸入您的 PIN 碼登入</p>
                </div>

                {/* 登入表單 */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* 錯誤訊息 */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        {/* PIN 碼輸入 */}
                        <div>
                            <label htmlFor="pin" className="block text-sm font-medium text-slate-700 mb-2">
                                PIN 碼（6位數字）
                            </label>
                            <input
                                type="password"
                                id="pin"
                                value={pin}
                                onChange={(e) => handlePinInput(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl font-mono tracking-widest"
                                placeholder="••••••"
                                maxLength={6}
                                autoFocus
                            />
                            <p className="mt-2 text-xs text-slate-500 text-center">
                                {pin.length}/6 位數字
                            </p>
                        </div>

                        {/* 登入按鈕 */}
                        <button
                            type="submit"
                            disabled={loading || pin.length !== 6}
                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? '登入中...' : '登入'}
                        </button>
                    </form>

                    {/* 提示訊息 */}
                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <p className="text-xs text-slate-500 text-center">
                            忘記 PIN 碼？請聯繫人事部門
                        </p>
                    </div>
                </div>

                {/* 返回打卡機 */}
                <div className="mt-6 text-center">
                    <a
                        href="/"
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        ← 返回打卡機
                    </a>
                </div>
            </div>
        </div>
    );
};

export default EmployeeLoginPage;
