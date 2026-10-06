import type { LeaveBalance } from '../types';
import type { LeaveDetailRecord } from '../components/admin/LeaveBalancePdfExporter';

type Period = LeaveBalance['annual']['periods'][number];
const EPS = 0.000001;
const round = (n: number) => Math.round(n * 100) / 100;

/** Date of the leave in Taiwan; entitlement start dates are local calendar dates. */
export const taipeiDate = (value: string): string => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
};

/**
 * Report-only allocation: an entitlement can be spent from its effective date.
 * Use the oldest unspent entitlement until exhausted, then continue with the
 * next seniority grant. Do not impose an expiry on this PDF allocation; in
 * particular never assign a request to a grant that did not yet exist.
 * Unexplained excess stays visible instead of being attached to a wrong year.
 * Does not write back to the original requests or the balance RPC.
 */
export function allocateAnnualByDate(periods: Period[], records: LeaveDetailRecord[], asOf: string) {
    const ordered = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const grants = ordered.map(period => ({
        period,
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
            if (!date || date < grant.period.start_date || grant.left <= EPS) continue;
            const take = Math.min(remaining, grant.left);
            buckets.get(grant.period.label)!.push({ ...record, hours: round(take) });
            grant.left -= take;
            remaining -= take;
            if (cashout) grant.cashout += take;
            else grant.used += take;
        }
        if (remaining > EPS) unallocated.push({ ...record, hours: round(remaining) });
    }
    const reportPeriods = grants.map(({ period, left, used, cashout }) => ({
        ...period,
        used: round(used), cashout: round(cashout),
        remaining: round(left),
    }));
    return { buckets, periods: reportPeriods, unallocated, future };
}
