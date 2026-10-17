export const COLORS = ['#c67139','#7a8a5e','#b5895a','#8c6f9e','#5f8a8b','#c2a14a','#a25a5a','#6b7fa8','#9a6b4f','#4f7a5a','#b97a95','#7d7466','#d08f6a'];

export function graphOverview(data) {
  if (!data || !Array.isArray(data.sections) || !Array.isArray(data.nodes) || !Array.isArray(data.edges)
      || data.sections.length > 40 || data.nodes.length > 12000 || data.edges.length > 30000) throw new Error('Invalid graph');
  const sections = data.sections.map((s,i) => {
    if (!s || typeof s.id !== 'string' || typeof s.name !== 'string' || !Number.isFinite(s.count) || s.count < 0) throw new Error('Invalid section');
    return { ...s, color:COLORS[i%COLORS.length] };
  });
  if (new Set(sections.map(s=>s.id)).size !== sections.length) throw new Error('Duplicate sections');
  const ids = new Set(), bySection = new Map(sections.map(s=>[s.id,[]]));
  for (const n of data.nodes) {
    if (!n || typeof n.id !== 'string' || typeof n.label !== 'string' || !bySection.has(n.sec)
        || !['section','subtopic','material'].includes(n.type) || ids.has(n.id)) throw new Error('Invalid node');
    ids.add(n.id); bySection.get(n.sec).push(n);
  }
  for (const e of data.edges) {
    if (!e || !ids.has(e.s) || !ids.has(e.t) || !['structure','series'].includes(e.k)) throw new Error('Invalid edge');
  }
  const ranked = [...sections].sort((a,b)=>b.count-a.count || a.id.localeCompare(b.id));
  const materialCount = data.nodes.filter(n=>n.type==='material').length;
  const maxCount = Math.max(1,...sections.map(s=>s.count));
  const centers = ranked.map((s,i) => {
    const angle=(i-1)*Math.PI*2/Math.max(1,ranked.length-1)-Math.PI/2;
    return { ...s,rank:i,r:29+54*Math.sqrt(s.count/maxCount),x:i===0?480:480+296*Math.cos(angle),y:i===0?230:230+137*Math.sin(angle) };
  });
  // Settle section clusters; node positions remain deterministic between visits.
  for (let pass=0;pass<240;pass++) {
    for (let i=0;i<centers.length;i++) for(let j=i+1;j<centers.length;j++) {
      const a=centers[i],b=centers[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,want=a.r+b.r+23;
      if(d<want){const move=(want-d)*.35;a.x-=dx/d*move;a.y-=dy/d*move;b.x+=dx/d*move;b.y+=dy/d*move;}
    }
    for(const c of centers){c.x=Math.min(905-c.r,Math.max(55+c.r,c.x));c.y=Math.min(425-c.r,Math.max(35+c.r,c.y));}
  }
  const positions=new Map();
  for (const c of centers) {
    const members=bySection.get(c.id).filter(n=>n.type!=='section').sort((a,b)=>a.id.localeCompare(b.id));
    bySection.get(c.id).filter(n=>n.type==='section').forEach(n=>positions.set(n.id,{...n,x:c.x,y:c.y}));
    members.forEach((n,i)=>{const angle=i*2.399963229728653,r=c.r*Math.sqrt((i+.5)/Math.max(1,members.length));positions.set(n.id,{...n,x:c.x+Math.cos(angle)*r,y:c.y+Math.sin(angle)*r});});
  }
  return { centers, positions, edges:data.edges, materialCount, sectionCount:sections.length, version:data.version };
}
