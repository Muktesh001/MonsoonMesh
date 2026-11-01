export type RoadEdge = { from: string; to: string; distance: number; risk: number; closed?: boolean };

export function shortestRoute(
  edges: RoadEdge[],
  origin: string,
  destination: string,
  riskPenalty = 2,
): { nodes: string[]; cost: number } | null {
  const adjacency = new Map<string, RoadEdge[]>();
  for (const edge of edges) {
    if (edge.closed) continue;
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), { ...edge, from: edge.to, to: edge.from }]);
  }
  const costs = new Map([[origin, 0]]);
  const previous = new Map<string, string>();
  const pending = new Set([origin]);
  while (pending.size) {
    let current: string | undefined;
    for (const node of pending) {
      if (current === undefined || (costs.get(node) ?? Infinity) < (costs.get(current) ?? Infinity)) current = node;
    }
    if (current === undefined || !Number.isFinite(costs.get(current))) break;
    if (current === destination) break;
    pending.delete(current);
    for (const edge of adjacency.get(current) ?? []) {
      const nextCost = (costs.get(current) ?? Infinity) + edge.distance * (1 + riskPenalty * edge.risk / 100);
      if (nextCost < (costs.get(edge.to) ?? Infinity)) {
        costs.set(edge.to, nextCost);
        previous.set(edge.to, current);
        pending.add(edge.to);
      }
    }
  }
  if (!costs.has(destination)) return null;
  const nodes = [destination];
  while (nodes[0] !== origin) {
    const prior = previous.get(nodes[0]!);
    if (!prior) return null;
    nodes.unshift(prior);
  }
  return { nodes, cost: costs.get(destination)! };
}
