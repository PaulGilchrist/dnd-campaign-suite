// @maintained-by-ai: 2026-10-15
// CLA-086: the gated confirm lane pays the upcast slot but the heal seams (runCureWounds /
// runHealingWord) historically resolved at the base makePending spellLevel. This file pins
// ONLY the upcast seam: the canonical stampPaidSlotLevel backfill (and its cantrip / base /
// pre-set guards), the upcast-level heal metaCtx reaching onExecute / triggerHealingWord,
// the upcast cast-log spellLevel stamp, and skip refunding the level actually consumed.
// Base-level (lv1) confirm payloads, pending clears, and gate opens are covered by the
// sibling lanes (complex-handlers.spells, skip, gate). Spell fixtures mirror spells.json.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { stampPaidSlotLevel } from './useConfirmableFlow.js';

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
  // CLA-033: fired by the gated confirm lane's rider seam in useConfirmableFlow.
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [{ name: 'TestCleric', type: 'player' }, { name: 'Ally One', type: 'player' }],
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
  prepareSpellCast: vi.fn(async (spell, metaCtx) => ({ modifiedSpell: spell, metaCtx: metaCtx || {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

// Runtime slot ledger: lv1=4, lv2=3, lv3=2 available — skips read back and refund here.
const SLOT_DEFAULTS = vi.hoisted(() => ({
  spell_slots_level_1: 4,
  spell_slots_level_2: 3,
  spell_slots_level_3: 2,
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => SLOT_DEFAULTS[key]),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyAidEffect: vi.fn(() => Promise.resolve(null)),
  applyHeroesFeastEffect: vi.fn(() => Promise.resolve(null)),
  applyLesserRestorationEffect: vi.fn(() => Promise.resolve(null)),
  applyMageArmorEffect: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromEvilAndGood: vi.fn(() => Promise.resolve(null)),
  applyShieldOfFaithEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(() => Promise.resolve(null)),
  applyBlessEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(() => Promise.resolve(null)),
  applyInvisibility: vi.fn(() => Promise.resolve(null)),
  applyGreaterInvisibility: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfPurityEffect: vi.fn(() => Promise.resolve(null)),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve(null)),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve(null)),
  applyDeathWardEffect: vi.fn(() => Promise.resolve(null)),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyHeroism: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
  executeHandler: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve(null)),
}));

global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
}));

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

// Fixtures mirror public/data/spells.json (heal_at_slot_level progression, casting times).
function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    class: { name: 'Cleric' },
    level: 17,
    ...overrides,
  };
}

const CURE_WOUNDS = {
  name: 'Cure Wounds',
  level: 1,
  casting_time: '1 action',
  range: 'Touch',
  heal_at_slot_level: { 1: '1d8 + MOD', 2: '2d8 + MOD', 3: '3d8 + MOD' },
};

const HEALING_WORD = {
  name: 'Healing Word',
  level: 1,
  casting_time: '1 bonus action',
  range: '60 feet',
  heal_at_slot_level: { 1: '1d4 + MOD', 2: '2d4 + MOD', 3: '3d4 + MOD' },
};

function renderFlow(onExecute) {
  return renderHook(() => useSpellMetamagicFlow({
    playerStats: makePlayerStats(),
    campaignName: 'TestCampaign',
    onExecute,
    setSecondaryTargetModal: null,
    characters: [],
    setPopupHtml: vi.fn(),
  }));
}

describe('stampPaidSlotLevel (CLA-086 canonical stamp)', () => {
  it('stamps only the paid upcast level onto the pending metaCtx carrier', () => {
    const cases = [
      { name: 'upcast lv3', pending: { spell: { level: 1, upcastLevel: 3 }, spellLevel: 1 }, want: 3 },
      { name: 'base lv1 stays unstamped', pending: { spell: { level: 1 }, spellLevel: 1 }, want: undefined },
      { name: 'pre-set slotLevel preserved (byte-twin guard)', pending: { spell: { level: 1, upcastLevel: 3 }, spellLevel: 1, metaCtx: { slotLevel: 2 } }, want: 2 },
    ];
    for (const tc of cases) {
      stampPaidSlotLevel(tc.pending);
      expect(tc.pending.metaCtx?.slotLevel, tc.name).toBe(tc.want);
    }
    // The cantrip guard is stronger than "unstamped": the carrier is never created.
    const cantrip = { spell: { level: 0 }, spellLevel: 0 };
    stampPaidSlotLevel(cantrip);
    expect(cantrip.metaCtx).toBeUndefined();
  });
});

describe('useSpellMetamagicFlow — gated upcast heals resolve at the paid slot (CLA-086)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Cure Wounds upcast lv3: metaCtx.slotLevel reaches onExecute at 3 and the cast log stamps 3', async () => {
    const { prepareSpellCast } = await import('../../services/rules/spells/spellPreparationService.js');
    const { addEntry } = await import('../../services/ui/logService.js');
    const onExecute = vi.fn();
    const { result } = renderFlow(onExecute);

    await act(async () => {
      await result.current.gateMetamagic({ ...CURE_WOUNDS, isUpcast: true, upcastLevel: 3 });
    });
    expect(result.current.pendingCureWounds).not.toBeNull();

    await act(async () => {
      await result.current.handleCureWoundsConfirm({ targetName: 'Ally One' });
    });

    // Slot payment stays at the upcast level...
    const prepOpts = prepareSpellCast.mock.calls[0][2];
    expect(prepOpts.upcastLevel).toBe(3);
    expect(prepOpts.isUpcast).toBe(true);
    // ...and the heal metaCtx now carries it (was lv1 pre-fix).
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][1]).toEqual({ targetName: 'Ally One', slotLevel: 3 });
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      spellName: 'Cure Wounds',
      spellLevel: 3,
    }));
  });

  it('Healing Word upcast lv3: triggerHealingWord metaCtx resolves at slot 3', async () => {
    const { triggerHealingWord } = await import('../../services/rules/features/healingWordService.js');
    const { addEntry } = await import('../../services/ui/logService.js');
    const { result } = renderFlow(vi.fn());

    await act(async () => {
      await result.current.gateMetamagic({ ...HEALING_WORD, isUpcast: true, upcastLevel: 3 });
    });
    expect(result.current.pendingHealingWord).not.toBeNull();

    await act(async () => {
      await result.current.handleHealingWordConfirm({ targetName: 'Ally One' });
    });

    expect(triggerHealingWord).toHaveBeenCalledTimes(1);
    expect(triggerHealingWord.mock.calls[0][1]).toEqual({ targetName: 'Ally One', slotLevel: 3 });
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      spellName: 'Healing Word',
      spellLevel: 3,
    }));
  });

  it('skip refunds the slot level actually consumed — lv3 upcast back to lv3, base lv1 back to lv1', async () => {
    const { setRuntimeValue, getRuntimeValue } = await import('../runtime/useRuntimeState.js');
    const { result } = renderFlow(vi.fn());

    await act(async () => {
      await result.current.gateMetamagic({ ...CURE_WOUNDS, isUpcast: true, upcastLevel: 3 });
    });
    act(() => {
      result.current.handleCureWoundsSkip();
    });

    // lv3 read back and refunded at lv3 (2 → 3); lv1 ledger untouched by the upcast skip.
    expect(getRuntimeValue).toHaveBeenCalledWith('TestCleric', 'spell_slots_level_3');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'spell_slots_level_3', 3, 'TestCampaign');
    expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'spell_slots_level_1')).toHaveLength(0);

    // Base-level skip keeps the legacy byte-identical lv1 refund (4 → 5).
    await act(async () => {
      await result.current.gateMetamagic(CURE_WOUNDS);
    });
    act(() => {
      result.current.handleCureWoundsSkip();
    });
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'spell_slots_level_1', 5, 'TestCampaign');
  });
});
