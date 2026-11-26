import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointsToHalfUnits, halfUnitsToPoints, calculatePoints, validateQuantity, validateCivilDate, validateCreateRecord, validateRecordPatch, validateRecordFilter, REWARD_TYPES } from '../lib/rewardsDiscipline.mjs';
const subject = '11111111-1111-4111-8111-111111111111';
const input = {subject_id: subject, application_date:'2026-02-28', type_code:'commendation', quantity:3, reason:'Synthetic reason'};
// ECMAScript WhiteSpace + LineTerminator: deliberately not Unicode White_Space.
const trimCodePoints = [0x0009,0x000a,0x000b,0x000c,0x000d,0x0020,0x00a0,0x1680,
  0x2000,0x2001,0x2002,0x2003,0x2004,0x2005,0x2006,0x2007,0x2008,0x2009,0x200a,
  0x2028,0x2029,0x202f,0x205f,0x3000,0xfeff];
const trimCharacters = trimCodePoints.map(cp=>String.fromCodePoint(cp));

test('required reason matches ECMAScript trim but preserves valid original text', () => {
  for (const reason of ['', ' ', '\t\n\r', ...trimCharacters, trimCharacters.join('')]) {
    assert.equal(reason.trim(),'');
    assert.throws(()=>validateCreateRecord({...input,reason}));
    assert.throws(()=>validateRecordPatch({reason}));
  }
  for (const reason of [' \tSynthetic\nmultiline\r\n\u00a0\u3000\ufeff', '\u0085', '\u180e', '\u200b']) {
    assert.equal(validateCreateRecord({...input,reason}).reason,reason);
    assert.equal(validateRecordPatch({reason}).reason,reason);
  }
});

test('reference points preserve half-points and distinct warnings', () => {
  assert.deepEqual(REWARD_TYPES.map(x=>x.points), ['0.5','1','3','-0.5','-0.5','-1','-2']);
  assert.equal(calculatePoints('0.5',3),'1.5');
  assert.equal(calculatePoints('-0.5',3),'-1.5');
});
test('decimal grammar and half units are exact; no silent rounding', () => {
  for (const x of ['0','0.5','-0.5','100','100.0','-200.5']) assert.equal(pointsToHalfUnits(halfUnitsToPoints(pointsToHalfUnits(x))), pointsToHalfUnits(x));
  for (const x of ['0.1','NaN','Infinity','1e2',' 0.5','0.50','+1','-0', '', null, 0.5]) assert.throws(()=>pointsToHalfUnits(x));
  assert.throws(()=>halfUnitsToPoints(Number.MAX_SAFE_INTEGER+1));
  assert.throws(()=>pointsToHalfUnits('1000000000000000.5'));
  assert.throws(()=>calculatePoints('1000000000000000',2));
});
test('quantity must be a bounded numeric positive integer', () => {
  assert.equal(validateQuantity(1),1); assert.equal(validateQuantity(1000000),1000000);
  for (const x of [0,-1,0.5,'1',NaN,Infinity,null,1000001]) assert.throws(()=>validateQuantity(x));
});
test('civil dates validate leap days and never infer missing years', () => {
  assert.equal(validateCivilDate('2024-02-29'),'2024-02-29');
  for (const x of ['2026-02-29','2026-04-31','0000-01-01','2026-1-01','11/26',null,'2026-01-01T00:00:00Z']) assert.throws(()=>validateCivilDate(x));
});
test('create validates and preserves text without html interpretation', () => {
  const r = validateCreateRecord({...input, reason:' <script>text</script> '});
  assert.equal(r.reason,' <script>text</script> '); assert.equal(r.notes,'');
  assert.equal(r.event_date,null);
});
test('no client actor/score/source/status accepted at mutation boundary', () => {
  for (const field of ['actor_id','status','total_points','source','subject_label','version','employee_id']) {
    assert.throws(()=>validateCreateRecord({...input,[field]:'forged'}));
    assert.throws(()=>validateRecordPatch({[field]:'forged'}));
  }
  assert.throws(()=>validateCreateRecord({...input,reason:' '}));
  assert.throws(()=>validateCreateRecord({...input,subject_id:'not-a-uuid'}));
});
test('patch keeps omitted fields absent and allows explicit nullable event/applicant only', () => {
  assert.deepEqual(validateRecordPatch({notes:'changed'}),{notes:'changed'});
  assert.deepEqual(validateRecordPatch({event_date:null,applicant_subject_id:null}),{event_date:null,applicant_subject_id:null});
  assert.throws(()=>validateRecordPatch({application_date:null}));
  assert.throws(()=>validateRecordPatch({subject_id:subject}));
  assert.throws(()=>validateRecordPatch({}));
});
test('filter validates pagination, year, inclusive dates and status', () => {
  assert.deepEqual(validateRecordFilter({}),{page:1,page_size:20});
  assert.equal(validateRecordFilter({search:'%_', year:2026}).search,'%_');
  for (const f of [{page:0},{page_size:101},{year:'2026'},{status:'approved'},{from_date:'2026-02-01',to_date:'2026-01-01'},{unknown:true}]) assert.throws(()=>validateRecordFilter(f));
});
