import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/202611260001_employee_rewards_discipline.sql',import.meta.url),'utf8');
const types=readFileSync(new URL('../types/rewardsDiscipline.ts',import.meta.url),'utf8');
const contract=readFileSync(new URL('../docs/rewards-discipline-contract.md',import.meta.url),'utf8');
test('explicit RPC names agree across SQL, TS and integration contract',()=>{
 const names=[...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(rd_\w+)\(/g)].map(x=>x[1]).sort();
 assert.equal(names.length,14);assert.equal(new Set(names).size,14);
 const typeNames=[...types.matchAll(/^  (rd_\w+):/gm)].map(x=>x[1]).sort();assert.deepEqual(typeNames,names);
 for(const name of names) assert.ok(contract.includes(name));
});
test('migration remains additive, transactional, and never seeds capability from existing users',()=>{
 assert.match(sql,/^BEGIN;$/m);assert.match(sql,/COMMIT;\s*$/);
 assert.doesNotMatch(sql,/(?:ALTER|UPDATE|DELETE FROM|INSERT INTO|DROP TABLE)\s+(?:public\.)?(?:employees|employee_movements|attendance_logs|employee_lunch_duty|"Employee")\b/i);
 assert.doesNotMatch(sql,/INSERT INTO rewards_private\.rd_admins/);
 assert.match(sql,/REVOKE ALL ON ALL TABLES IN SCHEMA rewards_private FROM PUBLIC, anon, authenticated, service_role/);
 assert.match(sql,/REVOKE ALL ON ALL FUNCTIONS IN SCHEMA rewards_private FROM PUBLIC, anon, authenticated, service_role/);
});
test('every security definer has empty search_path and no metadata authorization',()=>{
 const definitions=sql.split('CREATE OR REPLACE FUNCTION ').slice(1);
 for(const def of definitions) if(def.slice(0,def.indexOf(' AS $$')).includes('SECURITY DEFINER')) assert.match(def.slice(0,def.indexOf(' AS $$')),/SET search_path = ''/);
 assert.doesNotMatch(sql,/auth\.(?:jwt|role)\(|user_metadata|app_metadata|localStorage/);
});
