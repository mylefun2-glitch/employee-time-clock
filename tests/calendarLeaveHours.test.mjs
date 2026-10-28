import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/calendarLeaveHours.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { getApprovedSingleDayStoredHours } = await import(`data:text/javascript,${encodeURIComponent(js)}`);
const local = (day, hour) => new Date(2026, 8, day, hour, 0, 0);

test('approved single-day leave uses authoritative stored hours, not its time-span duration', () => {
    assert.equal(getApprovedSingleDayStoredHours('APPROVED', 1, local(22, 15), local(22, 17)), 1);
    assert.equal(getApprovedSingleDayStoredHours('approved', 0.5, local(22, 15), local(22, 17)), 0.5);
});

test('pending, missing-hours, and cross-day leave retain existing interval calculation', () => {
    assert.equal(getApprovedSingleDayStoredHours('PENDING', 1, local(22, 15), local(22, 17)), null);
    assert.equal(getApprovedSingleDayStoredHours('APPROVED', null, local(22, 15), local(22, 17)), null);
    assert.equal(getApprovedSingleDayStoredHours('APPROVED', 1, local(22, 23), local(23, 1)), null);
});
