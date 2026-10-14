import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
  rollbackSpellEffects: vi.fn(async () => ({
    targetsHealed: 1,
    conditionsRemoved: [],
    effectsRemoved: 0,
    damageHealed: 9,
    logDescription: "test",
  })),
}));

import { handle } from './counterSpellHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack, rollbackSpellEffects } from '../../common/damageRollback.js';

const campaignName = 'TestCampaign';

describe('debug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debug', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
        { name: 'TestCaster', gridX: 5, gridY: 10 },
      ],
    });
    findLastAttack.mockResolvedValue({
      attackEvent: {
        attackerName: 'Goblin',
        targetName: 'TestCaster',
        damageFormula: '3d6',
        damageName: 'Fire Bolt',
        primaryDamage: 9,
        secondaryDamage: 0,
        affectedTargets: ['TestCaster'],
        statusEffects: null,
      },
      attackerName: 'Goblin',
      targetName: 'TestCaster',
      primaryDamage: 9,
      secondaryDamage: 0,
      totalDamage: 9,
      damageTypes: ['Fire'],
    });
    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({ promptId: 'save-test-prompt' });

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    await handle({ name: 'Counterspell', automation: { type: 'counterspell' } }, {
      name: 'TestCaster',
      level: 10,
      proficiency: 4,
      abilities: [{ name: 'Charisma', bonus: 3 }],
    }, campaignName, null);

    console.log('addEntry calls BEFORE save:', addEntry.mock.calls.map(c => c[1]?.type));

    const savedCallback = addEventListenerSpy.mock.calls[0]?.[1];
    if (savedCallback) {
      // The save-result handler uses .catch() but doesn't await, so we need to flush promises
      savedCallback({
        detail: {
          promptId: 'save-test-prompt',
          success: false,
        },
      });
      // Wait for microtasks
      await new Promise(r => setTimeout(r, 10));
    }

    console.log('addEntry calls AFTER save:', addEntry.mock.calls.map(c => c[1]?.type));
    console.log('rollbackSpellEffects calls:', rollbackSpellEffects.mock.calls.length);
    
    // Check for save_result entry
    const saveResultCalls = addEntry.mock.calls.filter(c => c[1]?.type === 'save_result');
    console.log('save_result calls:', saveResultCalls.length);
    if (saveResultCalls.length > 0) {
      console.log('save_result data:', JSON.stringify(saveResultCalls[0][1], null, 2));
    }
    
    expect(saveResultCalls.length).toBeGreaterThan(0);
  });
});
