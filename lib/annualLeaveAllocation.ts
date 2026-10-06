import type { LeaveBalance } from '../types';
import type { LeaveDetailRecord } from '../components/admin/LeaveBalancePdfExporter';

type Period = LeaveBalance['annual']['periods'][number];
const EPS = 0.000001;
const round = (n: number) => Math.round(n * 100) / 100;

/** Date of the leave in Taiwan; SQL period boundaries are local calendar dates, end exclusive. */
export const taipeiDate = (value: string): string => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
};

const nextYear = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().slice(0, 10);
};

/**
 * Report-only allocation. Each entitlement is available from its own start until
 * the end of the following period (one-year deferral). Consume the earliest
 * expiring eligible grant first; never spend an entitlement before it exists.
 * An unexplained excess stays visible instead of being attached to a wrong year.
 * Does not write back to the original requests or the balance RPC.
 */
export function allocateAnnualByDate(periods: Period[], records: LeaveDetailRecord[], asOf: string) {
    const ordered = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const grants = ordered.map((period, index) => ({
        period,
        expiry: ordered[index + 1]?.end_date || nextYear(period.end_date),
        left: Math.max(0, Number(period.entitlement || 0)),
        used: 0,
        cashout: 0,
    }));
    const buckets = new Map<string, LeaveDetailRecord[]>(ordered.map(p => [p.label, []]));
    const unallocated: LeaveDetailRecord[] = [];
    const future: LeaveDetailRecord[] = [];
    const indexed = records.map((record, index) => ({ record, index, date: taipeiDate(record.start_date) }))
        .filter(({ record }) => ['ANNUAL', 'ALC'].includes(record.leave_type_code))
        .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
    for (const { record, date } of indexed) {
        let remaining = Math.max(0, Number(record.hours || 0));
        if (remaining <= EPS) continue;
        if (date && date > asOf) { future.push({ ...record, hours: round(remaining) }); continue; }
        const cashout = record.leave_type_code === 'ALC';
        for (const grant of grants) {
            if (remaining <= EPS) break;
            if (!date || date < grant.period.start_date || date >= grant.expiry || grant.left <= EPS) continue;
            const take = Math.min(remaining, grant.left);
            buckets.get(grant.period.label)!.push({ ...record, hours: round(take) });
            grant.left -= take;
            remaining -= take;
            if (cashout) grant.cashout += take;
            else grant.used += take;
        }
        if (remaining > EPS) unallocated.push({ ...record, hours: round(remaining) });
    }
    const reportPeriods = grants.map(({ period, expiry, left, used, cashout }) => ({
        ...period,
        used: round(used), cashout: round(cashout),
        // An expired unspent grant is not a current available balance.
        remaining: expiry > asOf ? round(left) : 0,
    }));
    return { buckets, periods: reportPeriods, unallocated, future };
}
