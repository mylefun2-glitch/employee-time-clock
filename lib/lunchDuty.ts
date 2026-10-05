// Local dates (YYYY-MM-DD) belong to Asia/Taipei; never derive duty_date via UTC ISO slicing.
export const DUTY_BREAKS = [
    { start: '12:00', end: '12:30' },
    { start: '16:00', end: '16:30' }
] as const;

/** Credit only a complete marked day, not an absence, partial shift or leave day.
 * Actual work is computed separately from punch intervals and both rest windows.
 * 16:00 and 16:30 OUT are equivalent because the second window is unpaid rest.
 */
export function dutyCreditedHours(input: {
    marked: boolean; scheduledStart: string; scheduledEnd: string;
    punchIn: Date | null; punchOut: Date | null;
    expectedOut: Date; actualHours: number; hasApprovedNonWorkLeave: boolean;
}): number {
    const { marked, scheduledStart, scheduledEnd, punchIn, punchOut, expectedOut, actualHours, hasApprovedNonWorkLeave } = input;
    if (!marked || scheduledStart.slice(0, 5) !== '08:00' || scheduledEnd.slice(0, 5) !== '17:00' ||
        !punchIn || !punchOut || hasApprovedNonWorkLeave ||
        punchIn.getTime() > expectedOut.getTime() - 7.5 * 60 * 60 * 1000 ||
        punchOut.getTime() < expectedOut.getTime() || actualHours < 7.5) return actualHours;
    return Math.max(actualHours, 8);
}
