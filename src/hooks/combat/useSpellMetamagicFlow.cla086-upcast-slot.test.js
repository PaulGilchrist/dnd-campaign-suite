// @maintained-by-ai 2026-11-26
// CLA-086: the gated confirm lane pays the upcast slot but the heal seams (runCureWounds /
// runHealingWord in useSimpleSpellHandlers.js SIMPLE_SPELL_SPECS) historically resolved at
// the base makePending spellLevel. This file pins ONLY the upcast seam: the canonical
// stampPaidSlotLevel backfill (useConfirmableFlow.js, with its cantrip / base / pre-set
// guards), the upcast-level heal metaCtx reaching onExecute / triggerHealingWord via the
// live healSlotLevel reader, the upcast cast-log spellLevel stamp, and a gate-armed upcast
// pending whose paid skip refunds the level actually consumed (lv3, not lv1).
// Owned elsewhere: base lv1 confirm payloads / pending clears / gate opens
// (complex-handlers.spells, gate), unpaid-skip zero-write (skip), the byte-identical paid
// refund pairs at unit level incl. the base lv1 refund and the slotConsumed producer
// (useConfirmableFlow.skip-paid-gate). NOTE: the raw handleHealingWordConfirm/
// handleCureWoundsConfirm factories in useComplexSpellHandlers.js:31-66 are dead shadowed
// code (already filed) — these pins exercise the live SIMPLE_SPELL_SPECS lane.
// Spell fixtures mirror spells.json.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { stampPaidSlotLevel } from './useConfirmableFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';
import { triggerHealingWord } from '../../services/rules/features/healingWordService.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';

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
  // CLA-037 twin on the same confirm-lane seam — unmocked it throws a
  // swallowed TypeError inside fireConfirmLaneRider (console.error noise).
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
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

  it.each([
    { label: 'Cure Wounds', spell: CURE_WOUNDS, confirm: 'handleCureWoundsConfirm', spellName: 'Cure Wounds', viaOnExecute: true },
    { label: 'Healing Word', spell: HEALING_WORD, confirm: 'handleHealingWordConfirm', spellName: 'Healing Word', viaOnExecute: false },
  ])('$label upcast lv3: runner metaCtx and cast log resolve at the paid slot', async ({ spell, confirm, spellName, viaOnExecute }) => {
    const onExecute = vi.fn();
    const { result } = renderFlow(onExecute);

    await act(async () => {
      await result.current.gateMetamagic({ ...spell, isUpcast: true, upcastLevel: 3 });
    });
    await act(async () => {
      await result.current[confirm]({ targetName: 'Ally One' });
    });

    // Slot payment stays at the upcast level...
    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    const prepOpts = prepareSpellCast.mock.calls[0][2];
    expect(prepOpts.upcastLevel).toBe(3);
    expect(prepOpts.isUpcast).toBe(true);
    // ...and the heal metaCtx now carries it (was lv1 pre-fix). Runner called
    // exactly once also proves the gate armed the pending it consumed.
    const runner = viaOnExecute ? onExecute : triggerHealingWord;
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0][1]).toEqual({ targetName: 'Ally One', slotLevel: 3 });
    // Cast row stamps the paid level, not the base makePending level.
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      spellName,
      spellLevel: 3,
    }));
  });

  it('skip of a gate-armed paid lv3 upcast refunds the level actually consumed (lv3, not lv1)', async () => {
    const { result } = renderFlow(vi.fn());

    await act(async () => {
      await result.current.gateMetamagic({ ...CURE_WOUNDS, isUpcast: true, upcastLevel: 3 });
    });
    // Integration half skip-paid-gate.test.js cannot see: the REAL gateMetamagic
    // pending must carry spell.upcastLevel into the refund lane (that file
    // hand-builds its pending). Money-state: gates arm UNPAID (2026-11-15
    // pay-state gate) and confirm both pays and clears the pending, so a paid
    // skip is only reachable by stamping the flag the pay seam produces.
    result.current.pendingCureWounds.slotConsumed = true;
    act(() => {
      result.current.handleCureWoundsSkip();
    });

    // lv3 read back and refunded at lv3 (2 → 3); lv1 ledger untouched by the upcast skip.
    // The base lv1 refund pair is owned by skip-paid-gate.test.js.
    expect(getRuntimeValue).toHaveBeenCalledWith('TestCleric', 'spell_slots_level_3');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'spell_slots_level_3', 3, 'TestCampaign');
    expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'spell_slots_level_1')).toHaveLength(0);
  });
});
