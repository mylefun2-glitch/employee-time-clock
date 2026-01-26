/**
 * 員工登入狀態管理 Context
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface EmployeeUser {
    id: string;
    name: string;
    pin: string;
    department: string;
    position?: string;
    email?: string;
    manager_id?: string;
    hire_date?: string;
    is_supervisor: boolean; // 是否為主管
}

interface EmployeeContextType {
    employee: EmployeeUser | null;
    loading: boolean;
    login: (username: string, pin: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [employee, setEmployee] = useState<EmployeeUser | null>(null);
    const [loading, setLoading] = useState(true);

    // 檢查是否有儲存的登入狀態
    useEffect(() => {
        const savedEmployeeId = localStorage.getItem('employee_id');
        if (savedEmployeeId) {
            loadEmployee(savedEmployeeId);
        } else {
            setLoading(false);
        }
    }, []);

    const loadEmployee = async (employeeId: string) => {
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('id', employeeId)
                .single();

            if (error || !data) {
                localStorage.removeItem('employee_id');
                setEmployee(null);
                setLoading(false);
                return;
            }

            // 檢查是否為主管：若 is_supervisor 欄位為 false 或未設定，則檢查是否有下屬
            let is_supervisor = !!(data as any).is_supervisor;
            if (!is_supervisor) {
                const { count } = await supabase
                    .from('employees')
                    .select('id', { count: 'exact', head: true })
                    .eq('manager_id', employeeId);
                is_supervisor = (count || 0) > 0;
            }

            setEmployee({
                ...data,
                is_supervisor
            });
        } catch (err) {
            console.error('Error loading employee:', err);
            setEmployee(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username: string, pin: string): Promise<{ success: boolean; error?: string }> => {
        try {
            // 驗證帳號與 PIN 碼
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('username', username)
                .eq('pin', pin)
                .eq('is_active', true)
                .single();

            if (error || !data) {
                return { success: false, error: '帳號或 PIN 碼錯誤' };
            }

            // 檢查是否為主管：若 is_supervisor 欄位為 false 或未設定，則檢查是否有下屬
            let is_supervisor = !!(data as any).is_supervisor;
            if (!is_supervisor) {
                const { count } = await supabase
                    .from('employees')
                    .select('id', { count: 'exact', head: true })
                    .eq('manager_id', data.id);
                is_supervisor = (count || 0) > 0;
            }

            const employeeData = {
                ...data,
                is_supervisor
            };

            setEmployee(employeeData);
            localStorage.setItem('employee_id', data.id);

            return { success: true };
        } catch (err: any) {
            console.error('Login error:', err);
            return { success: false, error: '登入時發生錯誤' };
        }
    };

    const logout = () => {
        setEmployee(null);
        localStorage.removeItem('employee_id');
    };

    return (
        <EmployeeContext.Provider value={{ employee, loading, login, logout }}>
            {children}
        </EmployeeContext.Provider>
    );
};

export const useEmployee = () => {
    const context = useContext(EmployeeContext);
    if (context === undefined) {
        throw new Error('useEmployee must be used within an EmployeeProvider');
    }
    return context;
};
