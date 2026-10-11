import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeHistory} from './src/native-history.js';
test('reader, graph selection, filters and nested article return to their actual entry',()=>{
  const history=nativeHistory();assert.equal(history.canBack,false);
  history.record('#view=catalog&q=дыхание',false);
  history.record('#view=article&id=A',false);
  history.record('#view=graph&sel=A&mode=local&depth=1',false);
  history.record('#view=graph&sel=A&mode=local&depth=2',true);
  history.record('#view=article&id=B',false);
  assert.equal(history.previous(),'#view=graph&sel=A&mode=local&depth=2');
  assert.equal(history.previous(),'#view=article&id=A');
  assert.equal(history.previous(),'#view=catalog&q=дыхание');
  assert.equal(history.previous(),'#view=home');assert.equal(history.canBack,false);
  assert.equal(history.previous(),'#view=home');
});
