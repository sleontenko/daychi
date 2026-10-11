import test from 'node:test';
import assert from 'node:assert/strict';
import {publications, rememberOpened, readIds, BOOKMARKS_KEY} from './src/ui-model.js';
test('updates use annotation revision time without reordering the catalog',()=>{
 const catalog=[{id:'new-source',ts:30},{id:'old-source-new-note',ts:10,updated_ts:40},{id:'tie',ts:30},{id:'undated'}];
 assert.deepEqual(publications(catalog).map(x=>x.id),['old-source-new-note','new-source','tie','undated']);
 assert.deepEqual(catalog.map(x=>x.id),['new-source','old-source-new-note','tie','undated']);
 assert.deepEqual(publications(catalog),publications(catalog));
});
test('opening history is personal, deduplicated and bounded',()=>{
 const ids=Array.from({length:20},(_,i)=>String(i));
 assert.deepEqual(rememberOpened(ids,'5').slice(0,3),['5','0','1']);
 assert.equal(rememberOpened(ids,'new').length,20);
 assert.equal(BOOKMARKS_KEY,'quietpractice.wiki.bookmarks.v1');
});
test('malformed or unavailable browser storage cannot block wiki',()=>{
 assert.deepEqual(readIds('x',{getItem(){throw Error('blocked')}}),[]);
 assert.deepEqual(readIds('x',{getItem:()=>'{'}),[]);
 assert.deepEqual(readIds('x',{getItem:()=>JSON.stringify(['id',null,12,'x'.repeat(201)])}),['id']);
});
