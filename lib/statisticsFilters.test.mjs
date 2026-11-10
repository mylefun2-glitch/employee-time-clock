import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
const source = fs.readFileSync(new URL('../pages/admin/StatisticsPage.tsx', import.meta.url), 'utf8');
const dropdown = source.slice(source.indexOf('const MultiSelectDropdown:'), source.indexOf('const StatisticsPage:'));
const compiled = ts.transpileModule(dropdown, {compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
function select(selected, value) {
    let next = selected, open = true;
    const Component = new Function('React','useState',compiled+';return MultiSelectDropdown;')(React,()=>[true,v=>{open=v;}]);
    const tree=Component({label:'部門篩選',icon:null,options:['ALL','A','B'].map(value=>({value,label:value})),selected,onChange:v=>{next=v;}});
    function walk(n) {if(!n || typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(walk);return [n,...walk(n.props?.children)];}
    const option=walk(tree).find(n=>n.key===value && typeof n.props?.onClick==='function');
    assert.ok(option);option.props.onClick();return {next,open};
}
test('department selection closes dropdown and replaces All',()=>assert.deepEqual(select(['ALL'],'A'),{next:['A'],open:false}));
test('repeated selection cannot silently reset last department to All',()=>assert.deepEqual(select(['A'],'A'),{next:['A'],open:false}));
test('explicit All option resets departments and closes dropdown',()=>assert.deepEqual(select(['A','B'],'ALL'),{next:['ALL'],open:false}));
test('multiple departments can still be added and individually removed',()=>{
    assert.deepEqual(select(['A'],'B'),{next:['A','B'],open:false});
    assert.deepEqual(select(['A','B'],'A'),{next:['B'],open:false});
});
