// Browser-safe domain validation. Authorization and score calculation are repeated in DB.
export const REWARD_TYPES = Object.freeze([
  {code:'commendation',label:'嘉獎',points:'0.5'}, {code:'minor_merit',label:'小功',points:'1'},
  {code:'major_merit',label:'大功',points:'3'}, {code:'warning',label:'警告',points:'-0.5'},
  {code:'reprimand',label:'申誡',points:'-0.5'}, {code:'minor_demerit',label:'小過',points:'-1'},
  {code:'major_demerit',label:'大過',points:'-2'},
].map(Object.freeze));
const fail = name => { throw new TypeError(`Invalid ${name}`); };
export function pointsToHalfUnits(value) {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.[05])?$/.test(value) || /^-0(?:\.0)?$/.test(value)) return fail('points');
  const negative = value.startsWith('-');
  const [whole, fraction] = value.replace('-','').split('.');
  const n = Number(whole)*2 + (fraction==='5'?1:0);
  if (!Number.isSafeInteger(n) || n>2000000000000000) return fail('points');
  return negative ? -n : n;
}
export function halfUnitsToPoints(value) {
  if (!Number.isSafeInteger(value) || Math.abs(value)>2000000000000000) return fail('half units');
  return `${value<0?'-':''}${Math.floor(Math.abs(value)/2)}${Math.abs(value)%2?'.5':''}`;
}
export function validateQuantity(value) {
  if (!Number.isInteger(value) || value<1 || value>1000000) return fail('quantity');
  return value;
}
export function calculatePoints(points, quantity) { return halfUnitsToPoints(pointsToHalfUnits(points)*validateQuantity(quantity)); }
export function validateCivilDate(value) {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return fail('date');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value) return fail('date');
  return value;
}
function text(value, name, max, required=false) {
  if (typeof value!=='string' || [...value].length>max || value.includes('\0') || (required&&!value.trim())) return fail(name);
  return value;
}
function uuid(value) {
  if (typeof value!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return fail('uuid');
  return value;
}
function objectKeys(value, allowed) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!allowed.includes(k))) return fail('fields');
}
const editKeys=['application_date','event_date','applicant_subject_id','type_code','quantity','basis','reason','notes'];
function field(key,value) {
  if (key==='application_date') return validateCivilDate(value);
  if (key==='event_date') return value===null?null:validateCivilDate(value);
  if (key==='subject_id') return uuid(value);
  if (key==='applicant_subject_id') return value===null?null:uuid(value);
  if (key==='quantity') return validateQuantity(value);
  if (key==='type_code') {
    if (typeof value!=='string' || !/^[a-z][a-z0-9_]{0,49}$/.test(value)) return fail('type_code');
    return value;
  }
  return text(value,key,key==='basis'?2000:4000,key==='reason');
}
export function validateCreateRecord(input) {
  objectKeys(input,[...editKeys,'subject_id']);
  for (const k of ['subject_id','application_date','type_code','quantity','reason']) if (!(k in input)) return fail(k);
  return Object.fromEntries(Object.entries({basis:'',notes:'',event_date:null,applicant_subject_id:null,...input}).map(([k,v])=>[k,field(k,v)]));
}
export function validateRecordPatch(input) {
  objectKeys(input,editKeys); if (!Object.keys(input).length) return fail('empty patch');
  return Object.fromEntries(Object.entries(input).map(([k,v])=>[k,field(k,v)]));
}
export function validateRecordFilter(input) {
  objectKeys(input,['search','year','type_code','subject_id','status','from_date','to_date','page','page_size']);
  const result={page:1,page_size:20,...input};
  for (const k of ['page','page_size','year']) if (k in result && (!Number.isInteger(result[k]) || result[k]<1 || result[k]>(k==='page_size'?100:k==='year'?9999:1000000))) return fail(k);
  if ('search' in result) text(result.search,'search',200);
  if ('subject_id' in result) uuid(result.subject_id);
  if ('type_code' in result) field('type_code',result.type_code);
  if ('status' in result && !['recorded','voided'].includes(result.status)) return fail('status');
  for (const k of ['from_date','to_date']) if (k in result) validateCivilDate(result[k]);
  if (result.from_date && result.to_date && result.from_date>result.to_date) return fail('date range');
  return result;
}
