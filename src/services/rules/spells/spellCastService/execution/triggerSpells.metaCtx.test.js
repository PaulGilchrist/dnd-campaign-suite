// @new-for-SP-092
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleGenericAutomation } from './triggerSpells.js';

/* ------------------------------------------------------------------ */
/*  Test-data factories                                                */
/* ------------------------------------------------------------------ */

function makePrismaticSpray() {
  return {
    name: 'Prismatic Spray',
    level: 7,
    automation: { type: 'prismatic_spray', saveType: 'DEX', damage: '10d6', saveDc: 'spell_save_dc' },
  };
}

function makePlayerStats() {
  return { name: 'TestWizard', level: 20, proficiency: 6 };
}

/* ------------------------------------------------------------------ */

describe('handleGenericAutomation metaCtx forwarding (SP-092)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards metaCtx.selectedTargets into the dispatched action for prismatic_spray', async () => {
    const executeHandler = vi.fn(async () => null);
    const spell = makePrismaticSpray();
    const playerStats = makePlayerStats();
    const metaCtx = { selectedTargets: ['Zombie 1', 'Zombie 2', 'Archmage 1', 'Archmage 2'] };

    const result = await handleGenericAutomation({ spell, executeHandler, playerStats: playerStats, campaignName: 'test-campaign', mapName: 'map', characters: [], metaCtx });

    expect(result.handled).toBe(true);
    expect(executeHandler).toHaveBeenCalledTimes(1);
    const action = executeHandler.mock.calls[0][0];
    expect(action.metaCtx).toEqual({ selectedTargets: ['Zombie 1', 'Zombie 2', 'Archmage 1', 'Archmage 2'] });
    expect(action.metaCtx.selectedTargets).toEqual(metaCtx.selectedTargets);
  });

  it('preserves other metaCtx keys (slotLevel, heightenTarget) when forwarding', async () => {
    const executeHandler = vi.fn(async () => null);
    const spell = makePrismaticSpray();
    const metaCtx = { selectedTargets: ['Goblin'], slotLevel: 7, heightenTarget: 'Goblin' };

    await handleGenericAutomation({ spell, executeHandler, playerStats: makePlayerStats(), campaignName: 'test-campaign', mapName: 'map', characters: [], metaCtx });

    const action = executeHandler.mock.calls[0][0];
    expect(action.metaCtx).toEqual({ selectedTargets: ['Goblin'], slotLevel: 7, heightenTarget: 'Goblin' });
  });

  it('passes an empty metaCtx object when no metaCtx argument is supplied (fallback preserved)', async () => {
    const executeHandler = vi.fn(async () => null);
    const spell = makePrismaticSpray();

    await handleGenericAutomation({ spell, executeHandler, playerStats: makePlayerStats(), campaignName: 'test-campaign', mapName: 'map', characters: [] });

    const action = executeHandler.mock.calls[0][0];
    expect(action.metaCtx).toEqual({});
    expect(action.metaCtx.selectedTargets).toBeUndefined();
  });

  it('does not mutate the caller metaCtx object', async () => {
    const executeHandler = vi.fn(async () => null);
    const spell = makePrismaticSpray();
    const metaCtx = { selectedTargets: ['Goblin'] };

    await handleGenericAutomation({ spell, executeHandler, playerStats: makePlayerStats(), campaignName: 'test-campaign', mapName: 'map', characters: [], metaCtx });

    const action = executeHandler.mock.calls[0][0];
    expect(action.metaCtx).not.toBe(metaCtx);
    expect(metaCtx).toEqual({ selectedTargets: ['Goblin'] });
  });
});
