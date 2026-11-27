// @maintained-by-ai 2026-11-27 — warding-flare te-PRODUCER lane over reactionDebuffHandler.js
// (handleWardingFlare + its post-route wardingFlareUses spendUse channel +
// logWardingFlareTail spend rows; effect 'disadvantage_on_attack_roll' →
// EFFECT_ROUTES; automation/index.js `reaction_debuff`; live from classes.json
// Light Domain 'Warding Flare' — CLA-383 fix locks: Warding Flare writes te
// disadvantage_next_attack (te-producer model, mirrors verified Vicious
// Mockery/Sap/Tumble) instead of the old post-roll second-d20 simulation, and
// re-fires never on one resolved lastAttack thanks to the per-round latch.
// Family nine-lane seam map lives in .attacksVsAlly.test.js header.
//
// This lane owns:
//  - the FULL success commit: exact popup via the REAL infoPopup builder
//    (envelope + automation echo + defenderName/attackerName extras + prose),
//    full-shape te row (effect/target/source/duration/appliedRound/frozen
//    timestamp), addExpiration call census, and the ordered three-write
//    setRuntimeValue census te → latch → wardingFlareUses spendUse — one of
//    the two TRUE post-route spendUse routes (the other is attacksVsAlly's;
//    the bardic default path is preSpent/setRuntimeObject, .uses lane). The
//    uses key comes from the REAL getRuntimeUsesKey camelCase helper (never
//    mocked here);
//  - CLA-383 regression lock as OBSERVABLES: zero diceRoller calls and zero
//    heal across the whole success route — no second d20 is ever simulated
//    on this lane;
//  - the refusal family consolidated into one it.each (no-attack,
//    self-attack, per-round-latch): full-shape refusal popup, exactly ONE
//    full-shape warding_flare_refused log row, full-array zero-commit
//    censuses (NOT key-filtered finds), and gate-ORDER short-circuit pins —
//    every refusal reads findLastAttack exactly once (the route never
//    re-reads lastAttack), pre-range legs never open the range channel, and
//    the latch refusal sits AFTER the range gate which, under live source
//    bug :505, reads positions once and short-circuits before isWithinRange;
//  - latch re-arm on round wrap: latch=1 with round 2 reacts and commits the
//    full three-write census with appliedRound/latch both 2 (proves round
//    comparison, not latch-presence truthiness).
//
// NOT owned here (removed as duplicates / do not re-add): the out-of-range
// gate pin — .disadvantage.test.js keeps the strictly-stronger copy (exact
// refusal text, rangeToFeet/isWithinRange arg pins, '30_ft' default,
// zero-write economy, refusal row shape; the weaker duplicate it flagged in
// this file was already purged and stays purged), the Improved Warding Flare
// tempHp math/tail copy (.disadvantage), exhaustion + no-combat-context
// refusals (.earlyExits, CANONICAL there), bardic latch/marker/uses lanes
// (.cuttingWords*, .uses), attacksVsAlly gates, generic popup prose of other
// routes.
//
// KNOWN SOURCE DEFECT (reported, source NOT touched — honest bytes only):
// wardingFlareRangeGate calls resolveMapPositions(campaignName, playerName) —
// 2 args into the 3-arg signature (reactionDebuffHandler.js:505), so live the
// lookup resolves null and the range refusal is unreachable. The rig's
// resolveMapPositions default reproduces that SKIP without cementing the
// broken arity (no call-args pin).
//
// Deterministic: FROZEN Date.now in beforeEach + bare vi.fn factories with ALL
// lane defaults re-installed after resetAllMocks (no clearAllMocks residue, no
// reliance on hoisted factory impls); infoPopup is the REAL dependency-free
// builder (family-wide mirror-mock purge); store reads route through a
// (charKey, key) router, never positional chains; applyHealingToTarget gets a
// SYNC mockReturnValue (source seam unawaited). This route never touches
// createSaveListener, so no afterEach stray-listener sweep is needed. No
// churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (bare vi.fn factories — every default is re-installed
//    in beforeEach, nothing here survives on factory-set impls) ──────────────

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
  getDistanceFeet: vi.fn(),
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

// Canonical dice lane mock (fix#169 recipe): zero-dice censuses below are only
// meaningful if a stray roll WOULD have hit a recording seam — CLA-383's dead
// second-d20 simulation must show up as a call, not silently pass.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollDie: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// infoPopup deliberately NOT mocked: it is a dependency-free pure builder, so
// the REAL one keeps every full-shape popup toEqual below honest about the
// actual production envelope (mirror mock purged family-wide).
// getRuntimeUsesKey (src/services/shared/usesKey.js) also stays REAL — the
// '<feature>Uses' key pinned in the commit census is the genuine camelCase
// derivation, not a mirrored string.

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './reactionDebuffHandler.js';

import * as targetResolver from '../../common/targetResolver.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Constants / helpers ─────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';
const playerName = 'War_Cleric';
const attackerName = 'Thug 1';

// FROZEN clock: every timestamped te/log row is pinned full-shape.
const FROZEN_NOW = 1735689600000;

// The BASE automation doubles as the expected `automation` echo inside every
// full-shape popup (production passes the auto object through untouched).
const BASE_AUTOMATION = {
  type: 'reaction_debuff',
  trigger: 'attack_roll_within_30ft',
  effect: 'disadvantage_on_attack_roll',
  uses_expression: 'WIS modifier_min_1',
  recharge: 'long_rest',
  casting_time: '1 reaction',
};

const LATCH_KEY = '_Warding_Flare_usedRound';

// Full-shape te row this lane produces under the frozen clock (round 1).
function wardingFlareTe(round) {
  return {
    effect: 'disadvantage_next_attack',
    target: attackerName,
    source: playerName,
    duration: 'until_used',
    appliedRound: round,
    timestamp: FROZEN_NOW,
  };
}

function makeWardingFlareAction() {
  return { name: 'Warding Flare', automation: BASE_AUTOMATION };
}

function makeCleric(overrides = {}) {
  return {
    name: playerName,
    level: 8,
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    characterAdvancement: [],
    specialActions: [],
    ...overrides,
  };
}

// (charKey, key)-keyed router — NOT positional Once-chains, so adding internal
// getRuntimeValue reads elsewhere cannot shift these values onto the wrong key.
// Only three reads exist on this lane: the campaign te list, the '<feature>Uses'
// budget, and the round latch.
function routeRuntimeValue({ effects = [], uses = 3, latch = undefined } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((charKey, key) => {
    if (key === 'targetEffects') return [...effects];
    if (key.endsWith('Uses')) return uses;
    if (key === LATCH_KEY) return latch;
    return undefined;
  });
}

// Merges into the healthy resolved-attack rig (merge, never replace).
// Default resolveMapPositions resolves undefined — the live source-bug-:505
// range-gate SKIP branch — so the route reaches latch/te/spend untouched.
function setupAttack({ attackEvent = resolvedAttackEvent(), attacker = attackerName } = {}) {
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent,
    attackerName: attacker,
    targetName: attackEvent ? attackEvent.targetName : null,
    primaryDamage: attackEvent?.hit ? 5 : 0,
    secondaryDamage: 0,
    totalDamage: attackEvent?.hit ? 5 : 0,
    damageTypes: attackEvent?.hit ? ['Bludgeoning'] : [],
  });
}

function resolvedAttackEvent(options = {}) {
  return {
    d20: 12,
    bonus: 4,
    targetName: playerName,
    targetAc: 12,
    effectiveAc: null,
    hit: true,
    forcedMode: 'normal',
    rolls: [12],
    rollType: 'attack',
    timestamp: FROZEN_NOW,
    ...options,
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('reactionDebuffHandler — Warding Flare te-producer lane (CLA-383)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);

    // Lane defaults re-installed EVERY test (no impl residue between tests).
    routeRuntimeValue();
    useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    useRuntimeState.setRuntimeObject.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
    // SYNCHRONOUS source seam (reactionDebuffHandler.js:27 — no await): a
    // mockResolvedValue here would hand the code a Promise. This route never
    // heals, but the sync shape is honest and the zero-census stays meaningful.
    applyHealing.applyHealingToTarget.mockReturnValue({ newHp: null, actualHeal: 0 });
    targetResolver.resolveTarget.mockResolvedValue(null);
    targetResolver.resolveMapPositions.mockResolvedValue(undefined);
    rangeCheck.isWithinRange.mockResolvedValue(true);
    // '30_ft' → 30: the range-gate ARGS and the omitted-range default leg are
    // pinned by .disadvantage.test.js (the range-gate owner), not here.
    rangeValidation.rangeToFeet.mockReturnValue(30);
    expirations.addExpiration.mockReturnValue(undefined);
    // Seed pins (fix#169 idiom): faces present so any stray roll is visible
    // in the zero-dice censuses rather than undefined.
    diceRoller.rollD20.mockReturnValue(1);
    diceRoller.rollDie.mockReturnValue(1);
    // uses_expression 'WIS modifier_min_1' → budget max 4 (expression eval is
    // the automationService lane; numeric/string arg pins live in .earlyExits).
    automationService.evaluateAutoExpression.mockReturnValue(4);
    // Default rig: NO recent attack — each test arms the attack it needs.
    setupAttack({ attackEvent: null });
  });

  it('reacts once: full-shape popup + te row + expiration + ordered te→latch→uses census + exact two-row tail — zero dice, zero heal (CLA-383)', async () => {
    routeRuntimeValue({ uses: 4 });
    setupAttack();

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Warding Flare',
        description:
          '<b>Warding Flare</b><br/>Light flares between War_Cleric and Thug 1.<br/>' +
          "Thug 1 has Disadvantage on its next attack roll (until used, or until the start of War_Cleric's next turn).",
        automation: BASE_AUTOMATION,
      },
      defenderName: 'War_Cleric',
      attackerName: 'Thug 1',
    });

    // CLA-383 as observable: the resolved attack is adjudicated by te
    // production, NEVER by simulating a second d20 (or rolling any die), and
    // this route never heals (heal-reversal is the attacksVsAlly lane).
    expect(diceRoller.rollD20.mock.calls).toEqual([]);
    expect(diceRoller.rollDie.mock.calls).toEqual([]);
    expect(applyHealing.applyHealingToTarget.mock.calls).toEqual([]);
    // One identity read of the resolved attack; the route never re-fires.
    expect(damageRollback.findLastAttack.mock.calls).toEqual([[campaignName]]);

    // Ordered full commit census: te write FIRST, then latch stamp, then the
    // post-route spendUse (4 − 1 = 3 under the real getRuntimeUsesKey name).
    // The exact array doubles as the absence-negative: no stray keys.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      ['campaign', 'targetEffects', [wardingFlareTe(1)], campaignName],
      ['War_Cleric', LATCH_KEY, 1, campaignName],
      ['War_Cleric', 'wardingFlareUses', 3, campaignName],
    ]);
    expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([]);

    expect(expirations.addExpiration.mock.calls).toEqual([
      [{
        attackerName: 'War_Cleric',
        targetName: 'Thug 1',
        effects: [{ type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: 'War_Cleric' }],
        campaignName,
        rounds: undefined,
        expireOnCreatureName: 'War_Cleric',
      }],
    ]);

    // Exact ordered two-row spend tail (logWardingFlareTail, Improved WF absent).
    expect(logService.addEntry.mock.calls).toEqual([
      [campaignName, {
        type: 'ability_use',
        characterName: 'War_Cleric',
        abilityName: 'Warding Flare',
        description: 'War_Cleric used Warding Flare to give Thug 1 Disadvantage on their next attack roll.',
        targetName: 'Thug 1',
        timestamp: FROZEN_NOW,
      }],
      [campaignName, {
        type: 'condition',
        characterName: 'War_Cleric',
        targetName: 'Thug 1',
        condition: 'Disadvantage on next attack',
        source: 'Warding Flare',
        description: "Thug 1 has Disadvantage on its next attack roll (from War_Cleric's Warding Flare).",
        timestamp: FROZEN_NOW,
      }],
    ]);
  });

  const REFUSAL_CASES = [
    {
      title: 'no recent attack roll exists',
      rig: () => setupAttack({ attackEvent: null }),
      description: 'No recent attack roll found. Warding Flare can only be used in reaction to an attack roll.',
      reachedRangeGate: false,
    },
    {
      title: 'the triggering attack is the cleric\'s own',
      rig: () => setupAttack({ attacker: 'War_Cleric' }),
      description: 'Warding Flare cannot be used against your own attack rolls.',
      reachedRangeGate: false,
    },
    {
      title: 'it has already reacted this round (per-trigger latch)',
      rig: () => {
        routeRuntimeValue({ uses: 3, latch: 1 });
        setupAttack();
      },
      description: 'Warding Flare has already been used this round — a Reaction can only be taken once per round. It re-arms when the next round begins.',
      reachedRangeGate: true,
    },
  ];

  it.each(REFUSAL_CASES)(
    'refuses without spending — full popup, one refused-row census, zero commits — $title',
    async ({ rig, description, reachedRangeGate }) => {
      rig();

      const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

      // Refusal popups carry NO defenderName/attackerName extras (the applied
      // envelope's absence-negative lives inside this exact toEqual).
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Warding Flare',
          description,
          automation: BASE_AUTOMATION,
        },
      });

      // Exactly one full-shape warding_flare_refused log row.
      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, {
          type: 'automation',
          characterName: 'War_Cleric',
          automationType: 'warding_flare_refused',
          name: 'Warding Flare',
          description,
          timestamp: FROZEN_NOW,
        }],
      ]);

      // Full-array zero-spend census (NOT key-filtered finds): no te, no
      // latch stamp, no uses spend, no expiration, no dice.
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
      expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([]);
      expect(expirations.addExpiration.mock.calls).toEqual([]);
      expect(diceRoller.rollD20.mock.calls).toEqual([]);
      expect(diceRoller.rollDie.mock.calls).toEqual([]);

      // Gate-ORDER short-circuit: exactly one findLastAttack read (the route
      // that re-reads lastAttack never ran). Pre-range legs never open the
      // range channel; the latch refusal sits AFTER the range gate, which
      // under live source bug :505 reads positions once and skips before
      // isWithinRange (call ARGS stay unpinned — broken arity not cemented).
      expect(damageRollback.findLastAttack.mock.calls).toEqual([[campaignName]]);
      if (reachedRangeGate) {
        expect(targetResolver.resolveMapPositions).toHaveBeenCalledTimes(1);
        expect(rangeCheck.isWithinRange.mock.calls).toEqual([]);
      } else {
        expect(targetResolver.resolveMapPositions.mock.calls).toEqual([]);
      }
    }
  );

  it('re-arms on round wrap: latch round 1 vs combat round 2 reacts — one te appliedRound 2, latch 2, one spend 2→1', async () => {
    routeRuntimeValue({ uses: 2, latch: 1 });
    damageUtils.getCombatContext.mockResolvedValue({ round: 2, creatures: [] });
    setupAttack();

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    expect(result.type).toBe('popup');
    // Full census again: proves the latch compares ROUNDS (not mere presence)
    // and that re-arm produces exactly one fresh te row — length-1 array is
    // the one-te guarantee.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      ['campaign', 'targetEffects', [wardingFlareTe(2)], campaignName],
      ['War_Cleric', LATCH_KEY, 2, campaignName],
      ['War_Cleric', 'wardingFlareUses', 1, campaignName],
    ]);
  });
});
