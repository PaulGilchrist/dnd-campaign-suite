import { describe, it, expect } from 'vitest';
import { handle } from './divineOrderHandler.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
  return {
    name: 'Divine Order',
    description: 'A divine order ability',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('divineOrderHandler.handle', () => {
  it('should return a popup with type automation_info', async () => {
    const action = makeAction();

    const result = await handle(action, {}, 'TestCampaign', 'TestMap');

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: action.name,
        description: action.description,
      },
    });
  });

  it('should use action.name in the popup payload', async () => {
    const action = makeAction({ name: 'Custom Divine Order' });

    const result = await handle(action, {}, 'TestCampaign', 'TestMap');

    expect(result.payload.name).toBe('Custom Divine Order');
  });

  it('should use action.description when provided', async () => {
    const action = makeAction({ description: 'Custom description' });

    const result = await handle(action, {}, 'TestCampaign', 'TestMap');

    expect(result.payload.description).toBe('Custom description');
  });

  it('should fall back to "Divine Order" when description is missing', async () => {
    const action = makeAction({ description: undefined });

    const result = await handle(action, {}, 'TestCampaign', 'TestMap');

    expect(result.payload.description).toBe('Divine Order');
  });

  it('should fall back to "Divine Order" when description is falsy', async () => {
    const action = makeAction({ description: null });

    const result = await handle(action, {}, 'TestCampaign', 'TestMap');

    expect(result.payload.description).toBe('Divine Order');
  });

  it('should ignore playerStats, campaignName, and mapName parameters', async () => {
    const action = makeAction();
    const playerStats = { name: 'TestPlayer', level: 5 };
    const campaignName = 'MyCampaign';
    const mapName = 'Dungeon1';

    const result = await handle(action, playerStats, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe(action.name);
    expect(result.payload.description).toBe(action.description);
  });

  it('should work with minimal action object', async () => {
    const action = {};

    const result = await handle(action, {}, 'TestCampaign', 'TestMap');

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: undefined,
        description: 'Divine Order',
      },
    });
  });

  it('should be async and return a promise', async () => {
    const action = makeAction();
    const result = handle(action, {}, 'TestCampaign', 'TestMap');

    expect(result).toBeInstanceOf(Promise);
  });
});
