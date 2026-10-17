// @maintained-by-ai
// spellCastHandler .damage lane — SEPTET HEAD. Owns the damage-roll content of
// spellCastHandler.js: buildSpellDamageRoll (L318-352), the damage feed of
// lookupSpellData (L306-316), and the damage-vs-popup branch at L413-417.
//
// Production liveness (verified): sole prod caller is the automation dispatch
// table `free_spell: handleSpellCast` (src/services/automation/index.js:313);
// free_spell automations live in public/data/classes.json + feats.json and
// runtime campaign character JSON.
//
// Delegation (pinned below, NOT reimplemented): this handler NEVER applies
// damage — no applyDamage/savePrompt/computeDamageAfterSave imports at source.
// buildSpellDamageRoll emits { type:'roll', payload:{ rollType:'damage',…} }
// and the dice-roll consumer pipeline owns application AND save-half
// semantics (full roll emitted here; half is resolved downstream). The strict
// payload table in test 1 IS the delegation contract — keep it exact.
//
// ── spellCast SEPTET seam map (shared subject: spellCastHandler.js, 418 ln) ──
// Seven lanes share this handler, back-to-back in queue. This map is the law:
// canonical home per seam is decided HERE at source; later lanes act on the
// handoff with exact test names and must NOT re-pin foreign-canonical content.
//   lane (this, #1966) — .damage: buildSpellDamageRoll + damage branch —
//       roll payload strict table, Empowered Evocation fold + CLA-120
//       idempotence, first-key (lowest slot level) formula, Radiant default,
//       known-spell short-circuit (fetch NOT called), damage-null→popup
//       fallback (type only), delegation guards.
//   #1967 .majesty       — isMantleOfMajestyCast (L370-372) + handleMantleOfMajesty
//                          (L75-120): activeBuffs write, addExpiration, concentration
//                          on combatSummary, DC fallbacks, already-active popup.
//                          NOTE verified: "Majesty" here = 2024 Bard *Mantle of*
//                          Majesty (name-gated branch). unbreakableMajesty is a
//                          DIFFERENT module — reactions/reactionBonusHandler.js,
//                          lane closed earlier — not in this septet.
//   #1968 .multiSpell    — handleMultiSpellFreeCast (L251-304): perSpellTracking
//                          used/freeKey stamping, availableSpells list, "All spells…
//                          used" popup, non-tracking channel-divinity popup.
//   #1969 .popup         — grantFreeCastPopup (L354-368) + castLabels (L11-15):
//                          free-cast html, noConcLabel/durLabel, first-cast
//                          _freeCast stamp, mapName passthrough.
//   #1970 .resourceCost  — handleChannelDivinity charge math + resolveChannelDivinity
//                          MaxCharges (L139-163) + FREE_CAST_ROUTES (L375-380):
//                          handleUsesExpressionFreeCast + handleUsesRechargeFreeCast
//                          + rechargeTextFor (L189-249): counters, decrements,
//                          block-at-zero, recharge texts.
//   #1971 .specialCases  — activateWarGodsBlessing (L122-137), perSpellTracking
//                          reset inside handleChannelDivinity (L170-184), lookup
//                          FETCH branches of lookupSpellData: URL selection
//                          '/data/2024/spells.json' vs '/data/spells.json' and
//                          fetch-reject→popup (L310-315), addEntry .catch paths.
//   #1972 .wildCompanion — CLA-388 branch (L387-389): handleWildCompanion +
//                          hasAnySpellSlotAvailable + resolveWildShapeMax (L22-73).
//                          Verified at source: Wild Companion (Druid lv2 2024)
//                          chooser modal / refuse popup + wild_companion_refused
//                          log — NOT Wild Magic.
// Queue after septet: stinkingCloud pair (#1973 areaSave/#1974 main, SP-111 WIRED),
// suggestion #1975, summonSpirit trio (#1976-1978), tashasLaughter #1979,
// truePolymorph hexad (#1980-1986), viciousMockery #1987.
//
// ── Handoff to later lanes (exact names) ──
// • Owns-HERE (do not re-pin elsewhere): "returns the full strict-table damage
//   roll payload…" (delegation contract), "Empowered Evocation folds…",
//   "CLA-120 idempotent fold…", "uses the lowest listed slot level…",
//   "…or ≤ 0 skip the fold", "defaults damageType to Radiant…",
//   "known-spell lookup short-circuits…", "popup-only fallback…",
//   "spells with no damage never touch diceRoller…", "every earlier branch
//   short-circuits…".
// • #1967/#1968/#1970/#1972: your branches run BEFORE the damage lookup —
//   my last test pins only that rollExpression/getEmpoweredEvocationFeatures
//   never fire on those routes; your own payload/log/stamp pins stay canonical
//   in your lanes. Do not duplicate rollExpression pins.
// • #1969: my failure tests pin result.type ONLY — all grantFreeCastPopup
//   html/label/stamp pins remain yours.
// • #1971: fetch-URL pins ('/data/2024/spells.json', '/data/spells.json',
//   fetch-reject→popup) remain yours; the known-spell SHORT-CIRCUIT (fetch
//   NOT called) now lives HERE (canonical .damage feed seam) — do not re-add.
// • Trim notes for this file (vs old): old mega-test split into focused pins;
//   old "no damage at all" sub-case asserted a stale result2 (dangling,
//   fixed); old "…falls back to spells.json" name was false — it never
//   fetched (known spell present); URL pin canonical home is #1971.
// No game timers — turn-based handler, none in tests either.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

import { handle } from './spellCastHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as postCastRiderService from '../../../../services/rules/spells/postCastRiderService.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

function makeKnownSpell(overrides = {}) {
  return {
    name: 'Fire Bolt',
    school: 'Evocation',
    damage: { damage_at_slot_level: { '1': '1d10' }, damage_type: 'Fire' },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Divine Smite',
    automation: {
      type: 'free_spell',
      ...automation,
    },
  };
}

function wizardWith(spells) {
  return makePlayerStats({ spellAbilities: { spells } });
}

describe('spellCastHandler.damage - roll payload contract (buildSpellDamageRoll canonical)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it('returns the full strict-table damage roll payload for a known damaging spell (delegation contract)', async () => {
    const ps = wizardWith([makeKnownSpell()]);
    diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });

    const result = await handle(makeAction({ spell: 'Fire Bolt' }), ps, campaignName, null);

    // Exact payload = the contract consumed by the downstream roll pipeline.
    expect(result).toEqual({
      type: 'roll',
      payload: {
        rollType: 'damage',
        name: 'Fire Bolt',
        formula: '1d10',
        total: 7,
        rolls: [7],
        modifier: 0,
        contextConfig: {
          damageType: 'Fire',
          attackerName: 'TestWizard',
        },
      },
    });
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10');
    // Delegation pins: this handler never applies damage, never logs the
    // damage event, and never stamps runtime state on the damage path —
    // application and campaign logging belong to the roll consumer.
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('known-spell lookup short-circuits: fetch is never called when the spell is in spellAbilities.spells', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const ps = wizardWith([makeKnownSpell()]);
    diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

    const result = await handle(makeAction({ spell: 'Fire Bolt' }), ps, campaignName, null);

    expect(result.type).toBe('roll');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses the lowest listed slot level formula regardless of insertion order (locked source semantics)', async () => {
    // Object.keys on integer-like keys enumerates ascending, so
    // damage_at_slot_level resolves the LOWEST listed slot's formula —
    // even when a higher level was authored first. Pinned as-is.
    const ps = wizardWith([makeKnownSpell({
      damage: { damage_at_slot_level: { '3': '3d10', '1': '1d10' }, damage_type: 'Fire' },
    })]);
    diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

    const result = await handle(makeAction({ spell: 'Fire Bolt' }), ps, campaignName, null);

    expect(result.payload.formula).toBe('1d10');
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10');
  });

  it('Empowered Evocation folds one int-modifier term into Evocation formulas, passed to rollExpression pre-fold', async () => {
    const ps = wizardWith([makeKnownSpell()]);
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [7], modifier: 2 });

    const result = await handle(makeAction({ spell: 'Fire Bolt' }), ps, campaignName, null);

    expect(result.payload.formula).toBe('1d10 + 2 [Empowered Evocation]');
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10 + 2 [Empowered Evocation]');
    expect(result.payload.total).toBe(9);
    expect(result.payload.modifier).toBe(2);
  });

  it('CLA-120 idempotent fold: never stacks a second [Empowered Evocation] term onto an already-folded formula', async () => {
    const ps = wizardWith([makeKnownSpell({
      damage: { damage_at_slot_level: { '1': '1d10 + 2 [Empowered Evocation]' }, damage_type: 'Fire' },
    })]);
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [7], modifier: 2 });

    const result = await handle(makeAction({ spell: 'Fire Bolt' }), ps, campaignName, null);

    expect(result.payload.formula).toBe('1d10 + 2 [Empowered Evocation]');
    expect(result.payload.formula.split('[Empowered Evocation]').length - 1).toBe(1);
  });

  it('non-Evocation school or INT modifier of 0 / negative / absent feature all skip the fold', async () => {
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);

    const skipCases = [
      { label: 'Necromancy school', spell: makeKnownSpell({ name: 'Chill Touch', school: 'Necromancy' }), intMod: 2 },
      { label: 'INT modifier 0', spell: makeKnownSpell(), intMod: 0 },
      { label: 'negative INT modifier', spell: makeKnownSpell(), intMod: -1 },
      { label: 'missing school', spell: makeKnownSpell({ school: undefined }), intMod: 2 },
    ];

    for (const c of skipCases) {
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(c.intMod);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const result = await handle(makeAction({ spell: c.spell.name }), wizardWith([c.spell]), campaignName, null);

      expect(result.payload.formula, c.label).not.toContain('[Empowered Evocation]');
    }

    // No EE feature at all: modifier is never even consulted.
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockClear();
    await handle(makeAction({ spell: 'Fire Bolt' }), wizardWith([makeKnownSpell()]), campaignName, null);
    expect(postCastRiderService.getEmpoweredEvocationIntModifier).not.toHaveBeenCalled();
  });

  it('defaults damageType to Radiant when damage_type is absent', async () => {
    const ps = wizardWith([makeKnownSpell({
      name: 'Scorching Ray',
      damage: { damage_at_slot_level: { '1': '2d6' } },
    })]);
    diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });

    const result = await handle(makeAction({ spell: 'Scorching Ray' }), ps, campaignName, null);

    expect(result.payload.contextConfig.damageType).toBe('Radiant');
  });

  it('popup-only fallback when rollExpression fails — type pin, no roll, content owned by .popup lane', async () => {
    const ps = wizardWith([makeKnownSpell()]);
    diceRoller.rollExpression.mockReturnValue(null);

    const result = await handle(makeAction({ spell: 'Fire Bolt' }), ps, campaignName, null);

    expect(result.type).toBe('popup');
  });

  it('spells with no damage or no formula never touch diceRoller — popup fallback (no throw)', async () => {
    // damage present but no damage_at_slot_level: optional-chain short-circuit
    // must yield null, not throw on Object.keys(undefined).
    const noFormula = makeKnownSpell({ name: 'Weird Spell', damage: { damage_type: 'Psychic' } });
    const result1 = await handle(makeAction({ spell: 'Weird Spell' }), wizardWith([noFormula]), campaignName, null);
    expect(result1.type).toBe('popup');

    // No damage key at all.
    const noDamage = makeKnownSpell({ name: 'Light', damage: undefined });
    const result2 = await handle(makeAction({ spell: 'Light' }), wizardWith([noDamage]), campaignName, null);
    expect(result2.type).toBe('popup');

    // EE feature lookup is downstream of the formula guard — never fired.
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(postCastRiderService.getEmpoweredEvocationFeatures).not.toHaveBeenCalled();
  });

  it('every earlier branch short-circuits before the damage roll — rollExpression and EE lookup never fire', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('no lookup on intercepted routes'));

    const cases = [
      // multi-spell → handleMultiSpellFreeCast (#1968 owns the popup)
      makeAction({ name: 'Nature Spirit (multi)', spell: ['Fire Bolt', 'Cure Wounds'] }),
      // uses_expression route (#1970 owns counter + html)
      makeAction({ name: 'Misty Step Charge', spell: 'Misty Step', uses_expression: 'WIS modifier_min_1', usesMax: 2 }),
      // Mantle of Majesty (#1967 owns buffs/concentration)
      makeAction({ name: 'Mantle of Majesty', type: 'free_spell', spell: 'Command', concentration: true }),
      // CLA-388 wild companion (#1972 owns chooser/refusal)
      makeAction({ name: 'Wild Companion', resourceCost: 'wild_companion', spell: 'Find Familiar' }),
    ];

    for (const action of cases) {
      const result = await handle(action, makePlayerStats(), campaignName, null);
      expect(result.type, action.name).not.toBe('roll');
    }

    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(postCastRiderService.getEmpoweredEvocationFeatures).not.toHaveBeenCalled();
  });
});
