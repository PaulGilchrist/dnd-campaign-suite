// @maintained-by-ai 2026-11-26
// SP-127 Aid upcast-slot specifics — the Aid-specific half of the paid-slot contract.
// The generic CLA-086 stamp / heal-metaCtx / raw-slot skip refund lanes live in
// cla086-upcast-slot.test.js; Magic Missile in sp075. This file pins ONLY what is
// Aid-family: the spellSlotLevel threading on the aid spec bodyOf (useSimpleSpellHandlers
// 'aid' line — applyAidEffect must see the paid slot, not the base spell.level) with
// the exact chooser-selection cast log (confirmTargets toArray(sel) — previously
// allTargets stamped every combatant), spanning both the lv3 paid and lv2 baseline
// rows of that one fold; the free-cast refund lane ('aid' ∈ FREE_CAST_SPELLS, so a
// paid skip routes through incrementFreeCastResource at the paid level with a
// byte-empty raw slot-write census), and the SP-127 twins on the same registry
// (auraOfVitality consumes spellSlotLevel; deathWard never reads it — byte-harmless
// twin). Fixtures mirror spells.json (5e + 2024).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import * as automation from '../../services/automation/index.js';
import { addEntry } from '../../services/ui/logService.js';
import { incrementFreeCastResource } from '../../services/rules/spells/spellPreparationService.js';
import { setRuntimeValue } from '../runtime/useRuntimeState.js';

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
  // CLA-033/CLA-037 rider seam — fired centrally by every createConfirmHandler;
  // unmocked they throw swallowed TypeErrors (console.error noise) on each confirm.
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [{ name: 'TestCleric', type: 'player' }, { name: 'EvasiveFighter', type: 'player' }, { name: 'War_Cleric', type: 'player' }],
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

const SLOT_DEFAULTS = vi.hoisted(() => ({
  spell_slots_level_1: 4,
  spell_slots_level_2: 3,
  spell_slots_level_3: 3,
  spell_slots_level_4: 3,
  spell_slots_level_5: 2,
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

function renderFlow() {
  return renderHook(() => useSpellMetamagicFlow({
    playerStats: { name: 'TestCleric', class: { name: 'Cleric' }, level: 17 },
    campaignName: 'TestCampaign',
    onExecute: vi.fn(),
    setSecondaryTargetModal: null,
    characters: [],
    setPopupHtml: vi.fn(),
  }));
}

// Mirrors spells.json Aid (both rulesets): lv2, automation.type 'aid',
// hpMaxIncreaseExpression keyed on spellSlotLevel; 'Bonus Action' is the 2024
// casting_time carried on the popup fixture.
function makeAid(overrides = {}) {
  return {
    name: 'Aid',
    level: 2,
    casting_time: 'Bonus Action',
    range: '30 feet',
    automation: { type: 'aid', range: '30 feet', maxTargets: 3, hpMaxIncreaseExpression: '5 + ((spellSlotLevel - 2) * 5)' },
    heal_at_slot_level: { 2: '5', 3: '10' },
    ...overrides,
  };
}

describe('SP-127 Aid — confirm lane threads the paid slot + exact target log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // One fold, both rows: `spellSlotLevel: p.metaCtx?.slotLevel || p.spellLevel`
  // on the 'aid' spec. The lv3 row proves the paid stamp reaches applyAidEffect
  // (was base 2); the lv2 row pins the fallback branch byte-identically.
  const CONFIRM_CASES = [
    { label: 'lv3 upcast forwards the paid slot 3', spell: { isUpcast: true, upcastLevel: 3 }, sel: ['War_Cleric'], want: 3 },
    { label: 'lv2 baseline forwards the base level 2', spell: {}, sel: ['EvasiveFighter', 'War_Cleric'], want: 2 },
  ];

  it.each(CONFIRM_CASES)('$label; the log lists ONLY the chosen targets', async ({ spell, sel, want }) => {
    const { result } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic(makeAid(spell));
    });
    // The gate armed the Aid chooser (runner called exactly once below proves
    // the confirm consumed this pending).
    expect(result.current.pendingAid).not.toBeNull();

    await act(async () => {
      await result.current.handleAidConfirm(sel);
    });

    // Full applySpell call shape: action, playerStats, campaign, null, raw selection.
    expect(automation.applyAidEffect).toHaveBeenCalledWith(
      {
        name: 'Aid',
        spell: expect.objectContaining({ name: 'Aid', level: 2 }),
        automation: { type: 'aid', range: '30 feet', maxTargets: 3 },
        spellSlotLevel: want,
      },
      expect.objectContaining({ name: 'TestCleric' }),
      'TestCampaign',
      null,
      sel,
    );

    // Exact chooser selection — no allTargets stamping of every combatant:
    // TestCleric/EvasiveFighter/War_Cleric minus the selection must stay out.
    const spellLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'spell' && e.spellName === 'Aid');
    expect(spellLogs).toHaveLength(1);
    expect(spellLogs[0]).toEqual(expect.objectContaining({
      spellLevel: want,
      castingTime: 'Bonus Action',
      targets: sel,
      targetName: sel[0],
      characterName: 'TestCleric',
    }));
    for (const bystander of ['TestCleric', 'EvasiveFighter', 'War_Cleric']) {
      if (!sel.includes(bystander)) {
        expect(spellLogs[0].targets, bystander).not.toContain(bystander);
      }
    }
  });

  it('paid skip after lv3 upcast refunds at the paid level via the free-cast lane — zero raw slot writes', async () => {
    const { result } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic(makeAid({ isUpcast: true, upcastLevel: 3 }));
    });
    // 2026-11-15 pay-state gate: gates arm UNPAID (createConfirmHandler pays at
    // confirm), so the PAID refund bytes are pinned on a rig that stamps the
    // money-state flag the pay seam produces. Refund bytes unchanged.
    result.current.pendingAid.slotConsumed = true;
    act(() => {
      result.current.handleAidSkip();
    });

    // 'aid' is in FREE_CAST_SPELLS — rollback routes through the free-cast
    // resource refund at the paid upcast level, never raw lv2 slot keys.
    expect(incrementFreeCastResource).toHaveBeenCalledTimes(1);
    expect(incrementFreeCastResource).toHaveBeenCalledWith(
      'TestCleric',
      'Aid',
      3,
      expect.objectContaining({ name: 'TestCleric', class: { name: 'Cleric' } }),
      'TestCampaign',
    );
    // Exhaustive raw-slot census: the free-cast lane must never touch any
    // spell_slots_level_N key (the cla086 raw lane owns lv3 read-back refunds).
    const rawSlotWrites = setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_level_'));
    expect(rawSlotWrites).toHaveLength(0);
  });
});

describe('SP-127 twins — same registry fold on the auraOfVitality/deathWard specs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TWINS = [
    // auraOfVitalityHandler.js consumes spellSlotLevel — the fold is live.
    { label: 'Aura of Vitality', apply: 'applyAuraOfVitalityEffect', handler: 'handleAuraOfVitalityConfirm', spell: { name: 'Aura of Vitality', level: 3, casting_time: 'Action', range: '30 feet', isUpcast: true, upcastLevel: 4 }, want: 4 },
    // deathWardHandler never reads spellSlotLevel (RAW static) — byte-harmless twin.
    { label: 'Death Ward', apply: 'applyDeathWardEffect', handler: 'handleDeathWardConfirm', spell: { name: 'Death Ward', level: 4, casting_time: 'Action', range: 'Touch', isUpcast: true, upcastLevel: 5 }, want: 5 },
  ];

  it.each(TWINS)('$label upcast: forwards spellSlotLevel $want (not base level)', async ({ apply, handler, spell, want }) => {
    const { result } = renderFlow();

    await act(async () => {
      await result.current.gateMetamagic(spell);
    });
    await act(async () => {
      await result.current[handler](['War_Cleric']);
    });

    expect(automation[apply]).toHaveBeenCalledTimes(1);
    expect(automation[apply].mock.calls[0][0].spellSlotLevel).toBe(want);
  });
});
