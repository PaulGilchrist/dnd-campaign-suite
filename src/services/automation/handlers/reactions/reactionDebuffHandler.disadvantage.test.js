// @maintained-by-ai 2026-11-27 — warding-flare RANGE-GATE + IMPROVED WARDING
// FLARE tempHp TAIL lane over reactionDebuffHandler.js (effect
// 'disadvantage_on_attack_roll' → EFFECT_ROUTES → wardingFlareRangeGate inside
// handleWardingFlare + logWardingFlareTail → applyImprovedWardingFlare;
// automation/index.js `reaction_debuff`; live from public/data/2024/classes.json
// Light Domain 'Warding Flare' / 'Improved Warding Flare' — CLA-193).
// Family nine-lane seam map lives in reactionDebuffHandler.attacksVsAlly.test.js
// header. This lane owns (CANONICAL for the octet — .wardingFlare.test.js
// explicitly delegates the out-of-range pin here):
//  - wardingFlareRangeGate out-of-range refusal: exact copy, the '30_ft' gate
//    input when the production automation omits a range field (2024 classes.json
//    Warding Flare has none), rangeToFeet/isWithinRange exact-arg censuses, the
//    full-shape warding_flare_refused row under the FROZEN clock, and the
//    zero-side-effect economy — full-array zero-commit/dice/heal/expiration
//    censuses plus the gate-ORDER zero-read pin (the refusal short-circuits
//    BEFORE the latch and targetEffects reads).
//  - applyImprovedWardingFlare tail: feature found in characterAdvancement OR
//    specialActions (it.each; amount ARG-DERIVED as 2×WF_FACE + WIS over the
//    canonical rollDie 2d6 lane) writes ['Ally_Paladin','tempHp',N,campaignName]
//    as the FOURTH ordered write after te → latch → wardingFlareUses spendUse,
//    appending the exact tail copy to the real infoPopup envelope — NEVER the
//    attacker (the exact-array census is the absence-negative). The roll is
//    consumed then DISCARDED when 2d6 + negative WIS lands ≤ 0: the flare still
//    commits the exact three-write census with no tempHp write and no tail copy.
//    The tail never runs on the default (bardic) route even with the feature
//    present (zero setRuntimeValue across that preSpent route).
// NOT owned here (do not re-add): te disadvantage_next_attack row content, latch
// stamp, wardingFlareUses spend arithmetic, addExpiration pin, the two spend-tail
// log-row shapes, no-attack/self-attack/latch refusals and round-wrap re-arm
// (.wardingFlare.test.js — its former weaker out-of-range duplicate was already
// purged there, retiring this file's old forward-flag); handleDisadvantageDebuff
// + reverseHitDamage, the attacksVsAlly range gate and protection te
// (.attacksVsAlly.test.js — its route is handleDisadvantageDebuff's ONLY caller);
// bardic lane content (.cuttingWords*, .uses, .defaultPath); generic handle()
// guards (.earlyExits). The former 'feature absent → no tempHp' leg is REMOVED
// as a strict subset of .wardingFlare.test.js's success census (that rig carries
// no Improved WF feature, so there it pins zero dice AND an exact three-write
// commit — strictly stronger than this file's old key-filtered find).
//
// KNOWN SOURCE DEFECTS (reported, source NOT touched — honest bytes only):
//  - the :132 4-arg reverseHitDamage campaignName drop (attacksVsAlly header
//    SOURCE BUG #2) is UNREACHABLE on this WF route — handleWardingFlare never
//    calls reverseHitDamage — so every kept leg pins
//    applyHealingToTarget.mock.calls === []: what the heal-reversal actually
//    receives on this lane is NOTHING, and no obligation cements the dropped
//    5th arg;
//  - wardingFlareRangeGate calls resolveMapPositions(campaignName, playerName) —
//    2 args into the 3-arg signature — so live the lookup resolves null and the
//    refusal is unreachable. The refusal leg installs positions at the MOCK
//    level to lock the INTENDED behavior and pins call COUNT only, never call
//    ARGS (family policy: broken arity stays uncemented).
//
// Deterministic: FROZEN Date.now re-spied in beforeEach (vi.resetAllMocks
// restores the spy — no afterEach needed); bare vi.fn factories with ALL lane
// defaults re-installed every test (no clearAllMocks residue, no factory-set
// impls, NO *Once chains — the 2d6 ORDER is unobservable through a sum, so
// faces are single defaults and amounts derive from them); infoPopup is the
// REAL dependency-free builder (family-wide mirror-mock purge);
// getRuntimeValue is a (charKey, key) router and the ordered EXACT 2-arg read
// censuses pin the source arity honestly (real signature is 2-param; write side
// is the 4-arg real incl. campaignName); applyHealingToTarget is an ARG-DERIVED
// sync clamp even though every kept leg is zero-heal (a wrong-amount leak
// surfaces as calls instead of hiding); expirations mocked inert
// (addExpiration pin is owned by .wardingFlare); this route never touches
// createSaveListener, so no stray-listener sweep is needed. No churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (bare vi.fn factories — every default re-installed
//    in beforeEach; infoPopup is NOT mocked: real pure builder) ───────────────
vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

// Graph-inert only: the WF success route calls addExpiration, but the exact
// call pin is owned by .wardingFlare.test.js — this lane pins zero-calls on
// refusals only.
vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// Canonical dice lane mock (fix#169 recipe): the WF 2d6 roll through
// diceRoller.rollDie, never raw Math.random.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollDie: vi.fn(),
}));

import { handle } from './reactionDebuffHandler.js';

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as diceRoller from '../../../dice/diceRoller.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';
const PLAYER = 'Light_Cleric';
const ATTACKER = 'Thug 1';
const DEFENDER = 'Ally_Paladin';

// FROZEN clock: the refusal row and every te/log row is pinned full-shape.
const FROZEN_NOW = 1735689600000;

const LATCH_KEY = '_Warding_Flare_usedRound';
const USES_STORED = 4; // router read for 'wardingFlareUses'
const WIS_MOD = 4;
const WF_FACE = 4; // default d6 face; 2d6 + WIS = 12 (ARG-DERIVED below)
const HEAL_BASE_HP = 157;

// Production shape from 2024 classes.json Light Domain — deliberately NO
// range field: the gate's '30_ft' default is pinned on the refusal leg. It
// also doubles as the expected `automation` echo inside every full-shape
// popup (production passes the auto object through untouched).
const BASE_AUTOMATION = {
  type: 'reaction_debuff',
  trigger: 'attack_roll_within_30ft',
  effect: 'disadvantage_on_attack_roll',
  uses_expression: 'WIS modifier_min_1',
  recharge: 'long_rest',
  casting_time: '1 reaction',
};

const IMPROVED_WF = {
  name: 'Improved Warding Flare',
  automation: { tempHpExpression: '2d6 + WIS modifier' },
};

const OUT_OF_RANGE =
  `${ATTACKER} is out of range of ${PLAYER} — Warding Flare requires the attacker to be within 30 feet.`;

// Core flare prose (handleWardingFlare :565-566); the tail appends below it.
const FLARE_CORE =
  `<b>Warding Flare</b><br/>Light flares between ${DEFENDER} and ${ATTACKER}.<br/>` +
  `${ATTACKER} has Disadvantage on its next attack roll (until used, or until the start of ${PLAYER}'s next turn).`;

function makeWardingFlareAction() {
  return { name: 'Warding Flare', automation: BASE_AUTOMATION };
}

function makeCleric(overrides = {}) {
  return {
    name: PLAYER,
    level: 8,
    abilities: [{ name: 'Wisdom', bonus: WIS_MOD }],
    characterAdvancement: [],
    specialActions: [],
    ...overrides,
  };
}

// REAL infoPopup envelope: the applied WF popup carries top-level
// defenderName/attackerName extras; refusals carry none.
const flarePopup = (description) => ({
  type: 'popup',
  payload: { type: 'automation_info', name: 'Warding Flare', description, automation: BASE_AUTOMATION },
  defenderName: DEFENDER,
  attackerName: ATTACKER,
});

// Full-shape te row under the frozen clock, round 1 (content is owned by
// .wardingFlare — reused here only inside this lane's ORDERED census proving
// the tempHp write lands AFTER te → latch → spendUse).
const flareTe = {
  effect: 'disadvantage_next_attack',
  target: ATTACKER,
  source: PLAYER,
  duration: 'until_used',
  appliedRound: 1,
  timestamp: FROZEN_NOW,
};

const SPEND_WRITES = [
  ['campaign', 'targetEffects', [flareTe], campaignName],
  [PLAYER, LATCH_KEY, 1, campaignName],
  [PLAYER, 'wardingFlareUses', USES_STORED - 1, campaignName],
];

// Ordered EXACT reads on an applied WF route (source arity is 2-param):
// front-door uses budget → latch → campaign te list → spendUse re-read.
const SUCCESS_READS = [
  [PLAYER, 'wardingFlareUses'],
  [PLAYER, LATCH_KEY],
  ['campaign', 'targetEffects'],
  [PLAYER, 'wardingFlareUses'],
];

// (charKey, key)-keyed router — never positional Once-chains, so extra
// internal reads surface in the read census instead of shifting values.
function routeRuntimeValue({ effects = [], uses = USES_STORED, latch = undefined } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((charKey, key) => {
    if (key === 'targetEffects') return [...effects];
    if (key.endsWith('Uses')) return uses;
    if (key === LATCH_KEY) return latch;
    return undefined;
  });
}

// Thug 1 hits Ally_Paladin — attacker ≠ player ≠ defender so every pin names
// its exact role. MERGES event/damage overrides, never replaces.
function setupAttack(overrides = {}) {
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: {
      d20: 15,
      bonus: 5,
      targetName: DEFENDER,
      targetAc: 14,
      effectiveAc: null,
      hit: true,
      timestamp: FROZEN_NOW,
    },
    attackerName: ATTACKER,
    targetName: DEFENDER,
    primaryDamage: 10,
    secondaryDamage: 0,
    totalDamage: 10,
    damageTypes: ['Slashing'],
    ...overrides,
  });
}

function logDescriptionBlob() {
  return logService.addEntry.mock.calls.map(([, entry]) => entry.description ?? '').join('\n');
}

describe('reactionDebuffHandler — warding-flare lane (range gate + Improved WF tempHp tail)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);

    // All lane defaults re-installed EVERY test (no impl residue).
    routeRuntimeValue();
    useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    useRuntimeState.setRuntimeObject.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
    // ARG-DERIVED sync clamp (source seam is unawaited). Every kept WF leg is
    // zero-heal; the clamp keeps any wrong-amount leak visible as calls.
    applyHealing.applyHealingToTarget.mockImplementation((cs, name, amount) => ({
      newHp: HEAL_BASE_HP + amount,
      actualHeal: amount,
    }));
    targetResolver.resolveTarget.mockResolvedValue(null);
    // Range-skip default: reproduces the live source-bug SKIP (2-arg
    // resolveMapPositions → null) without cementing the broken arity.
    targetResolver.resolveMapPositions.mockResolvedValue(undefined);
    rangeCheck.isWithinRange.mockResolvedValue(true);
    // '30_ft' → 30: the INPUT-side default pin lives on the refusal leg.
    rangeValidation.rangeToFeet.mockReturnValue(30);
    expirations.addExpiration.mockReturnValue(undefined);
    // Seed pins (fix#169): faces present so any stray roll surfaces in the
    // dice censuses instead of resolving undefined.
    diceRoller.rollD20.mockReturnValue(1);
    diceRoller.rollDie.mockReturnValue(WF_FACE);
    // uses_expression 'WIS modifier_min_1' → budget max 4 (expression
    // evaluation is the automationService lane).
    automationService.evaluateAutoExpression.mockReturnValue(4);
    // Default rig: NO recent attack — each test arms what it needs.
    damageRollback.findLastAttack.mockResolvedValue({
      attackEvent: null,
      attackerName: null,
      targetName: null,
      primaryDamage: 0,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
  });

  it('refuses an out-of-range attacker with the exact gate copy and a zero-economy census — full popup, one refused row, gate-ORDER short-circuit before latch/te reads', async () => {
    setupAttack();
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 20, gridY: 0 },
    });
    rangeCheck.isWithinRange.mockResolvedValue(false);

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    // Refusal envelope carries NO defenderName/attackerName extras.
    expect(result).toEqual({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Warding Flare', description: OUT_OF_RANGE, automation: BASE_AUTOMATION },
    });

    // Production automation omits range → the gate INPUT defaults to '30_ft';
    // distance is checked player→attacker with the converted feet.
    expect(rangeValidation.rangeToFeet.mock.calls).toEqual([['30_ft']]);
    expect(rangeCheck.isWithinRange.mock.calls).toEqual([[PLAYER, ATTACKER, 30]]);
    // Positions were consulted once; call ARGS stay unpinned (broken 2-arg
    // arity not cemented — the mock-level rig locks the INTENDED refusal).
    expect(targetResolver.resolveMapPositions).toHaveBeenCalledTimes(1);

    // Gate ORDER: one identity read of lastAttack, and the ONLY store read is
    // the front-door uses budget — the refusal short-circuits BEFORE the
    // latch and targetEffects reads.
    expect(damageRollback.findLastAttack.mock.calls).toEqual([[campaignName]]);
    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([[PLAYER, 'wardingFlareUses']]);

    // Full-array zero-spend census (NOT key-filtered finds): no te, no latch,
    // no spend, no expiration, no dice, no heal.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
    expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([]);
    expect(expirations.addExpiration.mock.calls).toEqual([]);
    expect(diceRoller.rollD20.mock.calls).toEqual([]);
    expect(diceRoller.rollDie.mock.calls).toEqual([]);
    expect(applyHealing.applyHealingToTarget.mock.calls).toEqual([]);

    expect(logService.addEntry.mock.calls).toEqual([
      [campaignName, {
        type: 'automation',
        characterName: PLAYER,
        automationType: 'warding_flare_refused',
        name: 'Warding Flare',
        description: OUT_OF_RANGE,
        timestamp: FROZEN_NOW,
      }],
    ]);
  });

  // 2d6 order is unobservable through a sum, so distinct Once-chained faces
  // bought nothing — a single default face + ARG-DERIVED amount says the same.
  it.each(['characterAdvancement', 'specialActions'])(
    'Improved Warding Flare in %s grants 2d6 + WIS tempHp to the DEFENDER as the fourth ordered write with exact tail copy (never the attacker)',
    async (storageKey) => {
      const ps = makeCleric({ [storageKey]: [IMPROVED_WF] });
      setupAttack();
      const expectedTempHp = WF_FACE * 2 + WIS_MOD;

      const result = await handle(makeWardingFlareAction(), ps, campaignName, mapName);

      expect(result).toEqual(flarePopup(
        FLARE_CORE + `<br/><br/>${DEFENDER} gains ${expectedTempHp} Temporary Hit Points from Improved Warding Flare.`
      ));

      // Both d6 faces consume the canonical rollDie(6) seam; the second d20
      // simulation never runs on this route (CLA-383).
      expect(diceRoller.rollDie.mock.calls).toEqual([[6], [6]]);
      expect(diceRoller.rollD20.mock.calls).toEqual([]);

      // Ordered commit census: te → latch → spendUse → tail tempHp onto the
      // DEFENDER. The exact array is the absence-negative for any attacker
      // write or stray key, and proves the tail appends AFTER the spend.
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        ...SPEND_WRITES,
        [DEFENDER, 'tempHp', expectedTempHp, campaignName],
      ]);
      expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([]);
      expect(applyHealing.applyHealingToTarget.mock.calls).toEqual([]);
      expect(damageRollback.findLastAttack.mock.calls).toEqual([[campaignName]]);
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual(SUCCESS_READS);

      // The grant only mutates the popup prose — it never logs its own row
      // (the two spend/condition rows are owned by .wardingFlare).
      expect(logService.addEntry.mock.calls).toHaveLength(2);
      expect(logDescriptionBlob()).not.toContain('Improved Warding Flare');
    }
  );

  it('discards the tempHp grant when 2d6 + negative WIS lands at or below zero — dice consumed, flare commits its three writes, no tempHp write, no tail copy', async () => {
    const NEG_WIS = -2;
    const ps = makeCleric({
      abilities: [{ name: 'Wisdom', bonus: NEG_WIS }],
      characterAdvancement: [IMPROVED_WF],
    });
    setupAttack();
    diceRoller.rollDie.mockReturnValue(1); // per-case face install: 1 + 1 − 2 = 0

    const result = await handle(makeWardingFlareAction(), ps, campaignName, mapName);

    // Full-shape applied popup WITHOUT the tail append (subsumes the old
    // not.toContain('Temporary Hit Points') negative).
    expect(result).toEqual(flarePopup(FLARE_CORE));
    expect(diceRoller.rollDie.mock.calls).toEqual([[6], [6]]);
    // Exactly the three standard commits — the 4th tempHp write is absent.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual(SPEND_WRITES);
    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual(SUCCESS_READS);
  });

  it('never runs the WF tempHp tail on the default (bardic) route even when the feature is present', async () => {
    const CUTTING_WORDS = {
      name: 'Cutting Words',
      automation: {
        type: 'reaction_debuff',
        range: '60_ft',
        effect: '',
        uses_expression: null,
        recharge: 'long_rest',
      },
    };
    const ps = makeCleric({ specialActions: [IMPROVED_WF] });
    // Attack-lane trigger (zero damage) so the bardic route stays heal-free.
    setupAttack({ primaryDamage: 0, secondaryDamage: 0, totalDamage: 0, damageTypes: [] });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: ATTACKER } });

    const result = await handle(CUTTING_WORDS, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    // The bardic lane DID run: its BI die (default size 6) rolls once through
    // the same rollDie seam — the WF tail's two extra dice never appear.
    expect(result.payload.description).toContain('Bardic Inspiration die: 1d6 = <b>4</b>');
    expect(diceRoller.rollDie.mock.calls).toEqual([[6]]);
    // The whole WF channel stays shut: zero setRuntimeValue means no tempHp
    // write, no disadvantage_next_attack te and no wardingFlareUses spend
    // (the bardic route spends via the setRuntimeObject stampPatch — .uses).
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
    expect(result.payload.description).not.toContain('Temporary Hit Points');
  });
});
