import type { LeaveBalance } from '../types';
import type { LeaveDetailRecord } from '../components/admin/LeaveBalancePdfExporter';

type Period = LeaveBalance['annual']['periods'][number];
const EPS = 0.000001;
const round = (n: number) => Math.round(n * 100) / 100;
const ADVANCE_DAYS = 7; // Only reconcile historical requests immediately before an earned anniversary.

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
 * next seniority grant. Four historical requests just before an anniversary
 * may draw the next grant within seven days, only once that grant has actually
 * been earned as of the report date; flag that advance explicitly on the PDF.
 * Do not impose an expiry on this PDF allocation.
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
        const nextGrant = ordered.find(p => p.start_date > date);
        const daysBefore = nextGrant && date ? (Date.parse(`${nextGrant.start_date}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000 : Infinity;
        const advanceTo = !cashout && date >= ordered[0]?.start_date && nextGrant?.start_date <= asOf && daysBefore <= ADVANCE_DAYS ? nextGrant?.start_date : undefined;
        const parts: { label: string | null; hours: number; advancedFrom?: string }[] = [];
        for (const grant of grants) {
            if (remaining <= EPS) break;
            if (!date || (date < grant.period.start_date && grant.period.start_date !== advanceTo) || grant.left <= EPS) continue;
            const take = Math.min(remaining, grant.left);
            parts.push({ label: grant.period.label, hours: round(take), ...(date < grant.period.start_date ? { advancedFrom: grant.period.start_date } : {}) });
            grant.left -= take;
            remaining -= take;
            if (cashout) grant.cashout += take;
            else grant.used += take;
        }
        if (remaining > EPS) parts.push({ label: null, hours: round(remaining) });
        for (const part of parts) {
            const row = { ...record, hours: part.hours, ...(parts.length > 1 ? { source_hours: round(Number(record.hours)) } : {}), ...(part.advancedFrom ? { advanced_from_date: part.advancedFrom } : {}) };
            if (part.label === null) unallocated.push(row);
            else buckets.get(part.label)!.push(row);
        }
    }
    const reportPeriods = grants.map(({ period, left, used, cashout }) => ({
        ...period,
        used: round(used), cashout: round(cashout),
        remaining: round(left),
    }));
    return { buckets, periods: reportPeriods, unallocated, future };
}
