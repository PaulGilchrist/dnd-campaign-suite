// @maintained-by-ai 2026-11-26
// SP-100 confirm-stage refusal lane: gate-stage arming is covered by
// spellGates.revivify.test.js (picker payload matrix, authoritative),
// useSpellMetamagicFlow.gate.test.js (hook-level breadth, incl. the Revivify
// dead-target row) and .console-error.test.js (null-creatures) — an arming
// test here was a weaker duplicate and is removed (run2#1731). The refusal
// branch is a single check on payload.type === 'automation_info'
// (useSimpleSpellHandlers.js runRevivify), so ONE refusal leg is enough; the
// "material vanished" variant was the same branch with different description
// bytes and is removed (material refusal owned by useSpellMetamagicGates.
// material-refused / revivify-material-precedence). This file owns exactly the
// confirm-stage seam: runRevivify refunding the paid slot (rollbackSpellSlot →
// setRuntimeValue) + the PX 2026-11-15 audit-honesty deferred-stamp lane
// (useConfirmableFlow options.deferCastLog + pending.castRefused — refusal
// stamps NO type:'spell' row; success still lands the cast row, same bytes).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
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

  it('refusal: rolls the slot back, shows the popup, and stamps NO spell cast row', async () => {
    const { setPopupHtml } = await confirmAgainst({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Revivify',
        automationType: 'revivify',
        description: 'Goblin C is not dead.',
      },
    });

    // Slot pay-then-refund (2 → pay → 3 refund); the refund write itself
    // proves the pay stage ran, so no mock-internal assertion on prepareSpellCast.
    expect(setRuntimeValue).toHaveBeenCalledWith('Cleric', 'spell_slots_level_3', 3, 'test-campaign');
    // PX 2026-11-15 audit-honesty: nothing happened → no type:'spell' row.
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
    }));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ type: 'automation_info' }));
  });

  it('success: does NOT roll the slot back and still stamps the spell cast row', async () => {
    const { setPopupHtml } = await confirmAgainst({
      type: 'popup',
      payload: { type: 'heal', name: 'Revivify', targetName: 'Goblin C', finalHeal: 1, total: 1, formula: '1 HP (revived)', rolls: [], rawTotal: 1 },
    });

    expect(setRuntimeValue).not.toHaveBeenCalledWith('Cleric', 'spell_slots_level_3', 3, 'test-campaign');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ type: 'heal' }));
    // Deferred stamp carries the SAME bytes as the shared writer: chooser
    // selection as targetName/targets, paid level, caster name.
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      characterName: 'Cleric',
      targetName: 'Goblin C',
      targets: ['Goblin C'],
      spellName: 'Revivify',
      spellLevel: 3,
    }));
  });
});
