import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/lunchDuty.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { DUTY_BREAKS, dutyCreditedHours } = await import(`data:text/javascript,${encodeURIComponent(js)}`);
const at = hm => new Date(`2026-10-05T${hm}:00+08:00`);
const minutes = hm => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const actual = (start, end) => {
    const a = minutes(start), b = minutes(end);
    return (b - a - DUTY_BREAKS.reduce((sum, rest) =>
        sum + Math.max(0, Math.min(b, minutes(rest.end)) - Math.max(a, minutes(rest.start))), 0)) / 60;
};
const credited = (start, end, opts = {}) => dutyCreditedHours({
    marked: true, scheduledStart: '08:00', scheduledEnd: '17:00',
    punchIn: start ? at(start) : null, punchOut: end ? at(end) : null,
    expectedOut: at(opts.expected || '16:00'),
    actualHours: start && end ? actual(start, end) : 0,
    hasApprovedNonWorkLeave: false, ...opts
});

test('both valid OUT times give 7.5 actual, 8 credited', () => {
    for (const end of ['16:00', '16:30']) {
        assert.equal(actual('08:00', end), 7.5);
        assert.equal(credited('08:00', end), 8);
    }
    assert.equal(actual('08:00', '17:00'), 8);
    assert.equal(credited('08:00', '17:00'), 8);
});
test('late IN needs correspondingly late OUT; early OUT is not topped up', () => {
    assert.equal(actual('08:10', '16:40'), 7.5);
    assert.equal(credited('08:10', '16:40', { expected: '16:10' }), 8);
    assert.equal(credited('08:10', '16:10', { expected: '16:10' }), actual('08:10', '16:10'));
    assert.equal(credited('08:10', '16:00', { expected: '16:10' }), actual('08:10', '16:00'));
    assert.equal(credited('08:00', '15:59'), actual('08:00', '15:59'));
    assert.equal(credited('08:31', '16:31', { expected: '16:30' }), actual('08:31', '16:31'));
});
test('leave, missing punch, unmarked and non-standard shift receive no credit', () => {
    assert.equal(credited('08:00', '16:00', { hasApprovedNonWorkLeave: true }), 7.5);
    assert.equal(credited(null, null), 0);
    assert.equal(credited('08:00', null), 0);
    assert.equal(credited('08:00', '16:00', { marked: false }), 7.5);
    assert.equal(credited('08:00', '16:00', { scheduledEnd: '16:00' }), 7.5);
});
