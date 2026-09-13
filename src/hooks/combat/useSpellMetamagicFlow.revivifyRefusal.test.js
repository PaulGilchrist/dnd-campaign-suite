// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';
import { addEntry } from '../../services/ui/logService.js';
import { setRuntimeValue, getRuntimeValue } from '../runtime/useRuntimeState.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 0),
  getMaxSorceryPoints: vi.fn(() => 0),
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
    creatures: [
      { name: 'Cleric', type: 'player' },
      { name: 'Goblin C', type: 'monster', currentHp: 0 },
    ],
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
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {}, slotConsumed: true })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(),
}));

import { triggerRevivify } from '../../services/rules/features/revivifyService.js';

function makePlayerStats() {
  return { name: 'Cleric', class: { name: 'Cleric' }, level: 17, spellAbilities: { spell_slots_level_3: 4 } };
}

describe('SP-100 Revivify confirm refusal — slot rollback + spell log target', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Cleric', type: 'player' },
        { name: 'Goblin C', type: 'monster', currentHp: 0 },
      ],
    });
  });

  function renderFlow() {
    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'test-campaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
    );
    act(() => {
      result.current.gateMetamagic({ name: 'Revivify', level: 3, range: 'Touch', casting_time: '1 Action' });
    });
    return { result, setPopupHtml };
  }

  it('arms picker with only the dead creature', () => {
    const { result } = renderFlow();
    expect(result.current.pendingRevivify).not.toBeNull();
    expect(result.current.pendingRevivify.creatureTargets).toEqual(['Goblin C']);
  });

  it('rolls the slot back and logs the chosen target when the trigger refuses', async () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, key) =>
      (key === 'spell_slots_level_3' ? 2 : null));
    vi.mocked(triggerRevivify).mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revivify',
        automationType: 'revivify',
        description: 'Goblin C is not dead.',
      },
    });

    const { result, setPopupHtml } = renderFlow();

    await act(async () => {
      await result.current.handleRevivifyConfirm({ targetName: 'Goblin C' });
    });

    expect(prepareSpellCast).toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith('Cleric', 'spell_slots_level_3', 3, 'test-campaign');
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      targetName: 'Goblin C',
      spellName: 'Revivify',
    }));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ type: 'automation_info' }));
  });

  it('does NOT roll the slot back on a successful revive', async () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, key) =>
      (key === 'spell_slots_level_3' ? 2 : null));
    vi.mocked(triggerRevivify).mockResolvedValue({
      type: 'popup',
      payload: { type: 'heal', name: 'Revivify', targetName: 'Goblin C', finalHeal: 1, total: 1, formula: '1 HP (revived)', rolls: [], rawTotal: 1 },
    });

    const { result } = renderFlow();

    await act(async () => {
      await result.current.handleRevivifyConfirm({ targetName: 'Goblin C' });
    });

    expect(setRuntimeValue).not.toHaveBeenCalledWith('Cleric', 'spell_slots_level_3', 3, 'test-campaign');
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      targetName: 'Goblin C',
    }));
  });
});
