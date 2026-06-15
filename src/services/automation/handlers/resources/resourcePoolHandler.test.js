import { describe, it, expect } from 'vitest';

// ── Imports ────────────────────────────────────────────────────

import { handle } from './resourcePoolHandler.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
  return {
    name: 'Resource Pool',
    description: 'A pool of resources',
    automation: { type: 'resource_pool' },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('resourcePoolHandler.handle', () => {
  it('should return a modal action with the correct structure', async () => {
    const action = makeAction();
    const result = await handle(action, {}, 'campaign', 'map');

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('resourcePool');
    expect(result.payload.name).toBe(action.name);
    expect(result.payload.description).toBe(action.description);
    expect(result.payload.automation).toBe(action.automation);
  });

  it('should use empty string for description when not provided', async () => {
    const action = {
      name: 'Resource Pool',
      automation: { type: 'resource_pool' },
    };
    const result = await handle(action, {}, 'campaign', 'map');

    expect(result.payload.description).toBe('');
  });

  it('should pass through all payload fields from the action', async () => {
    const action = {
      name: 'Unique Pool',
      description: 'Custom description',
      automation: { type: 'resource_pool', max: 10, current: 5 },
    };
    const result = await handle(action, {}, 'campaign', 'map');

    expect(result.payload.name).toBe('Unique Pool');
    expect(result.payload.description).toBe('Custom description');
    expect(result.payload.automation).toEqual({ type: 'resource_pool', max: 10, current: 5 });
  });

  it('should ignore playerStats, campaignName, and mapName parameters', async () => {
    const action = makeAction();
    const playerStats = { name: 'Hero', level: 5 };
    const result = await handle(action, playerStats, 'MyCampaign', 'BattleMap');

    expect(result.type).toBe('modal');
    expect(result.payload.name).toBe(action.name);
    expect(result.payload.description).toBe(action.description);
  });

  it('should return modal type even with minimal action', async () => {
    const action = { name: 'Pool' };
    const result = await handle(action, {}, 'campaign', 'map');

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('resourcePool');
    expect(result.payload.name).toBe('Pool');
    expect(result.payload.description).toBe('');
    expect(result.payload.automation).toBeUndefined();
  });
});
