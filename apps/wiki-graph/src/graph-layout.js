import { forceSimulation, forceLink, forceManyBody, forceX, forceY, forceCollide } from 'd3-force';

// Stable initial positions: the same catalogue does not reshuffle on reload.
export function seedPosition(node, sectionIndex, sectionCount) {
  let hash = 2166136261;
  for (const char of node.id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const random = () => { hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0; return hash / 4294967296; };
  const angle = (sectionIndex / Math.max(sectionCount, 1)) * Math.PI * 2;
  const radius = node.type === 'section' ? 380 : 420 + random() * 160;
  return { x: Math.cos(angle) * radius + (random() - 0.5) * 120, y: Math.sin(angle) * radius + (random() - 0.5) * 120 };
}

// d3 does the layout once. No timer survives to move nodes during hover,
// selection, zoom or navigation; dragging updates the chosen position directly.
function simulationFor(nodes, links, { local, typeOf, sizeOf }) {
  return forceSimulation(nodes).stop()
    .force('link', forceLink(links).id(node => node.id)
      .distance(link => (local ? 3 : 1) * (link.k === 'structure' ? (typeOf(link.source.id) === 'subtopic' ? 70 : 22) : 14))
      .strength(link => link.k === 'structure' ? 0.5 : 0.9))
    .force('charge', forceManyBody().strength(local ? -220 : -26).theta(0.9).distanceMax(local ? 600 : 260))
    .force('x', forceX(0).strength(local ? 0.08 : 0.035))
    .force('y', forceY(0).strength(local ? 0.08 : 0.035))
    .force('collide', forceCollide(node => sizeOf(node.id) + (local ? 18 : 1.5)).iterations(local ? 2 : 1))
    .alphaDecay(0.025);
}

export function settleLayout(nodes, links, options) {
  if (nodes.length) simulationFor(nodes, links, options).tick(280);
}

// Yield between small batches so even a large catalogue leaves navigation
// responsive. Superseded scopes stop calculating and never publish positions.
export async function settleLayoutAsync(nodes, links, options, current = () => true) {
  if (!nodes.length) return true;
  const simulation = simulationFor(nodes, links, options);
  // Timer throttling in background tabs can turn a short layout into a minute.
  // MessageChannel yields to input/rendering without that timer clamp.
  const channel = typeof window !== 'undefined' && typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
  const yieldTask = channel ? () => new Promise(resolve => {
    channel.port1.onmessage = resolve;
    channel.port2.postMessage(null);
  }) : () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    for (let tick = 0; tick < 280; tick += 2) {
      await yieldTask();
      if (!current()) return false;
      simulation.tick(2);
    }
    return true;
  } finally {
    channel?.port1.close();
    channel?.port2.close();
  }
}
