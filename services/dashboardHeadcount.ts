export interface DashboardEmployeeRecord {
    id: string;
    is_active: boolean;
    is_chairman?: boolean | null;
    insurance_end_date?: string | null;
}

export interface DashboardHeadcount {
    activeEmployees: number;
    monthlyResignedEmployees: number;
    headcountMonth: string;
}

export function calculateDashboardHeadcount(
    employees: readonly DashboardEmployeeRecord[],
    now: Date = new Date()
): DashboardHeadcount {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(now);
    const value = (type: string) => parts.find(part => part.type === type)!.value;
    const year = value('year');
    const month = value('month');
    const today = `${year}-${month}-${value('day')}`;
    const monthStart = `${year}-${month}-01`;
    let activeEmployees = 0;
    let monthlyResignedEmployees = 0;

    for (const employee of employees) {
        if (employee.is_chairman === true) continue;

        if (employee.is_active === true) {
            activeEmployees++;
            continue;
        }

        if (employee.is_active !== false || !employee.insurance_end_date) continue;
        const departureDate = employee.insurance_end_date.slice(0, 10);
        if (departureDate >= monthStart && departureDate <= today) {
            monthlyResignedEmployees++;
        }
    }

    return {
        activeEmployees,
        monthlyResignedEmployees,
        headcountMonth: `${year}-${month}`
    };
}
