// SP-126: the live Web confirmer must stamp the REACHABLE automation type
// 'web_area_save' (the pre-fix 'web' stamp fell through executeHandler to
// null — slot + concentration paid, no saves, no Restrained, no logs).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [{ name: 'Zombie 1', type: 'monster' }, { name: 'Thug 1', type: 'monster' }],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(() => Promise.resolve(null)),
}));

global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ creatures: [] }),
  text: () => Promise.resolve(''),
}));

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

import { executeHandler } from '../../services/automation/index.js';

const playerStats = {
  name: 'DivinationWizard',
  level: 20,
  class: { name: 'Wizard' },
  proficiency: 6,
  abilities: [{ name: 'Intelligence', bonus: 5 }],
  spellAbilities: { saveDc: 19 },
  spellcastingAbility: 'intelligence',
};

function makeSpell(overrides = {}) {
  return {
    name: 'Web',
    level: 2,
    range: '60 feet',
    casting_time: 'Action',
    duration: 'Concentration, up to 1 hour',
    school: 'Conjuration',
    ...overrides,
  };
}

describe('useSpellMetamagicFlow — Web confirm stamp (SP-126)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleWebConfirm dispatches automation type web_area_save with the real save DC', async () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(playerStats, 'test-campaign', vi.fn(), null, [], vi.fn())
    );

    act(() => {
      result.current.gateMetamagic(makeSpell());
    });

    expect(result.current.pendingWeb).toBeTruthy();

    await act(async () => {
      await result.current.handleWebConfirm(['Zombie 1', 'Thug 1']);
    });

    expect(executeHandler).toHaveBeenCalledTimes(1);
    const action = executeHandler.mock.calls[0][0];
    expect(action.automation.type).toBe('web_area_save');
    expect(action.automation.saveDc).toBe(19);
    expect(action.automation.saveType).toBe('DEX');
    expect(action.metaCtx.targets).toEqual(['Zombie 1', 'Thug 1']);
  });
});
