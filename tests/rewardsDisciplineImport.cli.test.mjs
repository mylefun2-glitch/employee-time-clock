import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,chmod,symlink,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {HEADERS,readPrivateJSON,writePrivate} from '../scripts/rewards-discipline-import.mjs';
const script=fileURLToPath(new URL('../scripts/rewards-discipline-import.mjs',import.meta.url));
test('offline CLI, private artifacts, sanitized failures and explicit connection gate',async()=>{
 const base=process.env.REWARDS_IMPORT_TEST_TMP||path.join(homedir(),'.hermes','cache','scratch');await mkdir(base,{recursive:true});
 const root=await mkdtemp(path.join(base,'rd-import-synthetic-'));await chmod(root,0o700);
 try{
  const src=path.join(root,'source.json'),meta=path.join(root,'metadata.json'),payload=path.join(root,'payload.json');
  const row=['SYNTHETIC_PRIVATE_MARKER','2024/2/29','synthetic-person','Synthetic Label','synthetic-person','Synthetic Label','basis','嘉獎','1','0.5','Synthetic reason','update'];
  await writeFile(src,JSON.stringify({values:[HEADERS,row]}),{mode:0o600});
  await writeFile(meta,JSON.stringify({spreadsheet_id:'synthetic-ledger',gid:'123',tab:'獎懲'}),{mode:0o600});
  const cli=extras=>spawnSync(process.execPath,[script,'--source',src,'--metadata',meta,...extras],{encoding:'utf8'});
  const result=cli(['--payload-out',payload]);assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).mode,'offline-dry-run');assert.equal(JSON.parse(result.stdout).valid_count,1);
  assert.ok(!result.stdout.includes(row[0]));assert.ok(!result.stderr.includes(row[0]));
  assert.equal((await stat(payload)).mode&0o777,0o600);assert.equal(JSON.parse(await readFile(payload,'utf8')).payloads.length,1);
  assert.notEqual(cli(['--connection-file','synthetic-dsn-must-not-print']).status,0);
  const failed=cli(['--apply','--actor','not-a-uuid','--connection-file','synthetic-dsn-must-not-print']);assert.notEqual(failed.status,0);assert.ok(!failed.stderr.includes('synthetic-dsn-must-not-print'));
  await chmod(src,0o644);await assert.rejects(()=>readPrivateJSON(src),/0600/);assert.notEqual(cli([]).status,0);await chmod(src,0o600);
  const link=path.join(root,'symlink.json');await symlink(src,link);await assert.rejects(()=>readPrivateJSON(link),/0600/);
  await assert.rejects(()=>writePrivate(payload,'must-not-overwrite'));assert.equal(JSON.parse(await readFile(payload,'utf8')).payloads.length,1);
  await writeFile(src,JSON.stringify({values:[HEADERS,row,row]}),{mode:0o600});
  const invalid=cli([]);assert.equal(invalid.status,1);assert.equal(JSON.parse(invalid.stdout).invalid_count,2);assert.equal(JSON.parse(invalid.stdout).valid_count,0);assert.ok(!invalid.stderr.includes(row[0]));
  // Even a mode-0700 directory inside a repository must not receive private payloads.
  const fakeRepo=path.join(root,'repo');await mkdir(fakeRepo,{mode:0o700});await mkdir(path.join(fakeRepo,'.git'));
  await assert.rejects(()=>writePrivate(path.join(fakeRepo,'private.json'),'private'),/REPOSITORY/);
 }finally{await rm(root,{recursive:true,force:true});}
});
