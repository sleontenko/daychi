import test from 'node:test';
import assert from 'node:assert/strict';
import { seedPosition, settleLayout, settleLayoutAsync } from './src/graph-layout.js';

const options = { local: false, typeOf: () => 'material', sizeOf: () => 3 };
function fixture(count = 120) {
  const nodes = Array.from({length: count}, (_, i) => ({ id: `material-${i}`, ...seedPosition({id:`material-${i}`,type:'material'}, i % 13, 13) }));
  const links = nodes.slice(1).map((node, i) => ({source:nodes[Math.floor(i / 3)].id,target:node.id,k:'structure'}));
  return { nodes, links };
}

test('identical catalogues produce identical finite positions', () => {
  const a = fixture(), b = fixture();
  settleLayout(a.nodes, a.links, options); settleLayout(b.nodes, b.links, options);
  assert.deepEqual(a.nodes, b.nodes);
  assert(a.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));
});

test('settled layout has no background movement', async () => {
  const {nodes,links} = fixture(); settleLayout(nodes,links,options);
  const snapshot = structuredClone(nodes);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.deepEqual(nodes, snapshot);
});

test('async layout yields, matches the settled result, and can cancel a stale scope', async () => {
  const a=fixture(), b=fixture();
  settleLayout(a.nodes,a.links,options);
  let yielded=false;
  setTimeout(()=>{yielded=true;},0);
  assert.equal(await settleLayoutAsync(b.nodes,b.links,options),true);
  assert.equal(yielded,true); assert.deepEqual(b.nodes,a.nodes);
  const c=fixture(); const before=structuredClone(c.nodes);
  assert.equal(await settleLayoutAsync(c.nodes,c.links,options,()=>false),false);
  assert.deepEqual(c.nodes.map(({id,x,y})=>({id,x,y})),before);
});

test('full large local neighborhood is supported with its center pinned', () => {
  const {nodes,links} = fixture(1000);
  nodes[0].fx=nodes[0].fy=0;
  settleLayout(nodes,links,{...options,local:true});
  assert.equal(nodes.length,1000);
  assert.equal(nodes[0].x,0); assert.equal(nodes[0].y,0);
  assert(nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));
});
