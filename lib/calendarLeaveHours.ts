/**
 * Use the approved persisted hours for a same-day leave. They may already
 * reflect day-specific arrangements such as lunch duty; multi-day requests
 * have no per-day persisted breakdown and keep the existing interval calculation.
 */
export const getApprovedSingleDayStoredHours = (
    status: string | null | undefined,
    hours: number | null | undefined,
    start: Date,
    end: Date
): number | null => {
    if (status?.toUpperCase() !== 'APPROVED' || hours == null || !Number.isFinite(hours)) {
        return null;
    }

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null;
    }

    const isSameLocalDay = start.getFullYear() === end.getFullYear()
        && start.getMonth() === end.getMonth()
        && start.getDate() === end.getDate();

    return isSameLocalDay ? hours : null;
};
