// @maintained-by-ai: 2026-10-15
// SP-100 confirm-stage refusal lane: gate-stage arming is covered by
// useSpellMetamagicFlow.gate.test.js (breadth) and .console-error.test.js
// (null-creatures); this file owns the confirm-stage refusal seam —
// runRevivify refunding the paid slot (rollbackSpellSlot → setRuntimeValue)
// when triggerRevivify answers with an automation_info popup, and NOT
// refunding on a successful revive.
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

// The confirm lane (useConfirmableFlow.fireConfirmLaneRider) awaits these two —
// stub them so the rider seam resolves quietly instead of leaning on try/catch.
vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
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
  isWizardRitualAdeptSpell: vi.fn(() => false),
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

// Fixture matches public/data/spells.json Revivify (both 5e and 2024):
// level 3, range Touch, 1 action. 'Goblin C' at 0 HP is the dead target.
const DEAD_TARGET = { name: 'Goblin C', type: 'monster', currentHp: 0 };

function makePlayerStats() {
  return { name: 'Cleric', class: { name: 'Cleric' }, level: 17, spellAbilities: { spell_slots_level_3: 4 } };
}

function renderFlow() {
  const setPopupHtml = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'test-campaign', onExecute: vi.fn(), setPopupHtml })
  );
  act(() => {
    result.current.gateMetamagic({ name: 'Revivify', level: 3, range: 'Touch', casting_time: '1 Action' });
  });
  return { result, setPopupHtml };
}

// Arm the picker, pin the lv3 slot at 2 so the +1 refund is observable
// (max is 4), and confirm against the given triggerRevivify result.
async function confirmAgainst(popup) {
  vi.mocked(getRuntimeValue).mockImplementation((name, key) =>
    (key === 'spell_slots_level_3' ? 2 : null));
  vi.mocked(triggerRevivify).mockResolvedValue(popup);
  const { result, setPopupHtml } = renderFlow();
  await act(async () => {
    await result.current.handleRevivifyConfirm({ targetName: 'Goblin C' });
  });
  return { result, setPopupHtml };
}

describe('SP-100 Revivify confirm refusal — slot rollback + spell log target', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Cleric', type: 'player' },
        DEAD_TARGET,
      ],
    });
  });

  it('arms picker with only the dead creature', () => {
    const { result } = renderFlow();
    expect(result.current.pendingRevivify).not.toBeNull();
    expect(result.current.pendingRevivify.creatureTargets).toEqual(['Goblin C']);
  });

  it('rolls the slot back and logs the chosen target when the trigger refuses', async () => {
    const { setPopupHtml } = await confirmAgainst({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revivify',
        automationType: 'revivify',
        description: 'Goblin C is not dead.',
      },
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
    const { setPopupHtml } = await confirmAgainst({
      type: 'popup',
      payload: { type: 'heal', name: 'Revivify', targetName: 'Goblin C', finalHeal: 1, total: 1, formula: '1 HP (revived)', rolls: [], rawTotal: 1 },
    });

    expect(setRuntimeValue).not.toHaveBeenCalledWith('Cleric', 'spell_slots_level_3', 3, 'test-campaign');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ type: 'heal' }));
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      targetName: 'Goblin C',
    }));
  });
});
