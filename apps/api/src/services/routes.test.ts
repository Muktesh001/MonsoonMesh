import { describe, expect, it } from 'vitest';
import { shortestRoute } from './routes.js';

describe('shortestRoute', () => {
  it('avoids closed edges and includes risk in route cost', () => {
    const route = shortestRoute([
      { from: 'a', to: 'b', distance: 10, risk: 0 },
      { from: 'a', to: 'c', distance: 7, risk: 5 },
      { from: 'c', to: 'b', distance: 7, risk: 0 },
      { from: 'b', to: 'd', distance: 5, risk: 0, closed: true },
      { from: 'c', to: 'd', distance: 8, risk: 0 },
    ], 'a', 'd');
    expect(route?.nodes).toEqual(['a', 'c', 'd']);
    expect(shortestRoute([], 'a', 'd')).toBeNull();
  });
});
