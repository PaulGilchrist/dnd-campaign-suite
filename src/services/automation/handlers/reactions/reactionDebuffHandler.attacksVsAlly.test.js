// @maintained-by-ai 2026-11-27 — attacks-vs-ally lane over reactionDebuffHandler.js
// (effect 'disadvantage_on_attacks_vs_ally' — the Protection fighting-style Reaction,
// live from rules-fightingStyles.js 5e + 2024, dispatched via automation/index.js
// `reaction_debuff` → handle → EFFECT_ROUTES). Test-trim audit 2026-11-27: the three
// gate refusals consolidated into one it.each family (full-shape popup toEqual +
// full-array zero-commit censuses, NOT key-filtered + gate-ORDER short-circuit pins:
// every refusal sits after exactly ONE findLastAttack read, so the debuff executor —
// which re-reads lastAttack — never ran, and pre-range legs never touch the range
// channels); the upsert legs consolidated into one it.each with exact-array te-write
// censuses under the frozen clock (the custom-duration leg doubles as the only
// in-range-PASS gate pin, isWithinRange('Paladin','Goblin',30) proving both the
// '30_ft' parseInt and that distance is checked against the ATTACKER); the success
// leg carries the ordered two-write commit census (te write BEFORE spendUse, §39)
// + full-shape popup (seed-pinned second d20 face 8 turns HIT into MISS and fires
// the heal-reversal tail) + full-shape single ability_use log row. infoPopup is the
// REAL dependency-free builder now (mirror mock retired — popup shape stays honest).
// No *Once chains, no mid-test re-harnesses, no save-listener strays possible here.
//
// Nine-file seam map over reactionDebuffHandler.js (each lane owns what it pins;
// do not duplicate across lanes):
//  - attacksVsAlly (THIS file): handleAttacksVsAlly (findLastAttack gate, defender
//      gate, range gate, protection-te upsert) + handleDisadvantageDebuff (second-d20
//      sim + reverseHitDamage heal tail — this route is its ONLY caller) +
//      logAttacksVsAllyTail + this route's spendUse channel (setRuntimeValue
//      '<feature>Uses' — the NON-preSpent route; blessedDefenderUses is this lane's,
//      wardingFlareUses stays .wardingFlare's). The default success rig leaves
//      resolveMapPositions resolving undefined — that exercises the no-positions
//      range-gate SKIP branch; the gate-REACHED legs are the refusal/upsert tables.
//  - .branchesOfTheTree.test.js:       teleport_and_slow route — Rage gate,
//      campaign-root activeCreatureName, STR save prompt + save-result
//      teleport/expiration ('refuses when Rage is not active...',
//      'on fail: teleports — stamps branches_of_the_tree_teleport marker te...').
//  - .cuttingWords.latch.test.js:      bardic default path round latch +
//      attack-instance marker ('refuses the same attack roll twice...',
//      'passes campaignName + mapName + playerName to resolveMapPositions...').
//  - .cuttingWords.test.js:            bardic BI d20/damage reduction sim
//      ('reduces d20 by bardic inspiration die...', 'reduces damage and heals target').
//  - .defaultPath.test.js:             handleAttackRollDebuff / handleDamageDebuff
//      detail ('caps reduced d20 at minimum of 1', 'returns popup when damage
//      event has no targetName', 'uses primaryDamage as fallback when totalDamage is 0').
//  - .disadvantage.test.js:            warding-flare route out-of-range +
//      Improved Warding Flare tempHp tail ('returns popup when out of range'
//      for effect disadvantage_on_attack_roll — NOT this lane's same-named
//      refusal leg, which pins handleAttacksVsAlly's gate).
//  - .earlyExits.test.js:              generic handle() guards before routing
//      (requiresShield, uses-exhausted recharge label, no combat context — the
//      no-combat-context refusal is CANONICAL there; not restated here).
//  - .uses.test.js:                    bardic default-path spend via the
//      setRuntimeObject stampPatch channel — this lane pins the setRuntimeValue
//      spendUse channel instead (uses-lane header agrees: "true post-route
//      spendUse is owned on the attacksVsAlly and wardingFlare lanes").
//  - .wardingFlare.test.js:            disadvantage_next_attack te-producer
//      ('spends one use and writes te disadvantage_next_attack...' — its own
//      wardingFlareUses key; blessedDefenderUses stays this lane's).
//
// KNOWN PRODUCTION DEFECTS (reported, source NOT touched per task):
//  1. handleAttacksVsAlly calls resolveMapPositions(campaignName, playerName) — 2 args
//     into the 3-arg signature (campaignName, mapName, attackerName)
//     (reactionDebuffHandler.js:455), so live the gate lookup resolves null and the
//     range refusal is silently unreachable. This lane keeps the mock-level pin so
//     the INTENDED refusal behaviour is locked for whoever fixes the arity; it does
//     NOT pin the broken argument order (cf. cuttingWords.latch pinning the correct
//     3-arg call).
//  2. handleDisadvantageDebuff calls reverseHitDamage with 4 args, dropping the
//     5th `campaignName` param (reactionDebuffHandler.js:132; compare :74 which
//     passes it) — the miss-reversal heal runs without campaign context. No test
//     pins the missing arg; assert applyHealingToTarget call ARGS only after fixing.
//  3. No ally/self-exclusion gate: Protection fires RAW only when a creature
//     "attacks a target other than you", yet handleAttacksVsAlly accepts ANY
//     defender, including the player themselves (cf. the sibling self-attack
//     refusal in handleWardingFlare, reactionDebuffHandler.js:525). Unpinned by
//     design — a fix must add the gate AND its refusal leg here.
//
// Deterministic: FROZEN Date.now (every timestamped te/log row full-shape pinned);
// runtime/logService/range/rollback/healing/dice fully mocked with BARE vi.fn
// factories and ALL lane defaults re-installed every beforeEach (no clearAllMocks
// residue, no reliance on hoisted factory impls under resetAllMocks). The second
// d20 rolls through the mocked canonical diceRoller lane (fix#169 recipe), face
// seed-pinned to 8. This route never touches createSaveListener, so no afterEach
// stray-listener sweep is needed. No churn expected.
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

// Canonical dice lane mock (fix#169 recipe): the disadvantage second d20
// arrives via diceRoller, never raw Math.random.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollDie: vi.fn(),
}));

// infoPopup deliberately NOT mocked: it is a dependency-free pure builder, so
// the REAL one keeps every full-shape popup toEqual below honest about the
// actual production popup envelope.

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './reactionDebuffHandler.js';

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as diceRoller from '../../../dice/diceRoller.js';

// ── Constants / helpers ─────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';

// FROZEN clock: every timestamped te/log row is pinned full-shape.
const FROZEN_NOW = 1735689600000;
const EARLIER = FROZEN_NOW - 5000;

// The BASE automation doubles as the expected `automation` echo inside every
// full-shape popup (makeAction spreads it unchanged unless overridden).
const BASE_AUTOMATION = {
  type: 'reaction_debuff',
  range: '30_ft',
  effect: 'disadvantage_on_attacks_vs_ally',
  uses_expression: 2,
  recharge: 'long_rest',
};

// Full composed success description: d20 15+5=20 vs AC 14 HIT, disadvantage
// min(15, 8)=8 → 8+5=13 < 14 MISS, heal-reversal of the mocked 10-damage hit.
const SUCCESS_DESCRIPTION =
  '<b>Blessed Defender</b><br/>Attacker: Goblin<br/>' +
  'Attack roll: d20(15) + 5 = 20 vs AC 14 → <b>HIT</b><br/>' +
  'Disadvantage (second d20: 8): d20(8) + 5 = 13 vs AC 14 → <b>MISS</b><br/>' +
  '<br/><i>The attack now misses!</i><br/>Goblin healed for 10 HP.';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Paladin',
    ...overrides,
  };
}

function freshAttackEvent(options = {}) {
  return {
    d20: 15,
    bonus: 5,
    targetName: 'Goblin',
    targetAc: 14,
    effectiveAc: null,
    hit: true,
    timestamp: FROZEN_NOW,
    ...options,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Blessed Defender',
    automation: { ...BASE_AUTOMATION, ...overrides },
  };
}

function protectionTe({ target = 'Goblin', source = 'Paladin', duration = 'until_start_of_next_turn', timestamp = FROZEN_NOW } = {}) {
  return { effect: 'protection', target, source, duration, timestamp };
}

// Router mock keyed on (charKey, key) — NOT positional Once-chains, so adding
// internal getRuntimeValue reads elsewhere in the handler cannot shift these
// values onto the wrong key.
function routeRuntimeValue({ effects = [], uses = 1 } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((charKey, key) => {
    if (key === 'targetEffects') return [...effects];
    if (key.endsWith('Uses')) return uses;
    return undefined;
  });
}

// Merges overrides into a healthy default success path (merge, never replace —
// the makeAction defect fixed repeatedly this week). Default budget of 2 max /
// 1 left makes every zero-commit census meaningful (a spend WOULD have shown).
function setupPath(options = {}) {
  const action = makeAction(options.actionOverrides);
  const ps = makePlayerStats(options.psOverrides);

  routeRuntimeValue({ effects: options.effects, uses: options.uses });
  if (options.combatSummary !== undefined) {
    damageUtils.getCombatContext.mockResolvedValue(options.combatSummary);
  }
  if (options.positions !== undefined) {
    targetResolver.resolveMapPositions.mockResolvedValue(options.positions);
  }
  if (options.inRange !== undefined) {
    rangeCheck.isWithinRange.mockResolvedValue(options.inRange);
  }

  const attackEvent = options.attackEvent !== undefined
    ? options.attackEvent
    : freshAttackEvent(options.attack);
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent,
    attackerName: options.attackerName ?? (attackEvent ? 'Goblin' : null),
    targetName: options.targetName ?? (attackEvent ? attackEvent.targetName ?? null : null),
    primaryDamage: options.primaryDamage ?? (attackEvent ? 10 : 0),
    secondaryDamage: 0,
    totalDamage: options.totalDamage ?? (attackEvent && attackEvent.hit !== false ? 10 : 0),
    damageTypes: options.damageTypes ?? (attackEvent ? ['Piercing'] : []),
  });

  return handle(action, ps, campaignName, mapName);
}

// ── Tests ───────────────────────────────────────────────────────

describe('reactionDebuffHandler — attacks-vs-ally gate (disadvantage_on_attacks_vs_ally)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);

    // Lane defaults re-installed EVERY test (mockReset semantics; no impl
    // residue survives between tests).
    routeRuntimeValue();
    useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    useRuntimeState.setRuntimeObject.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
    // SYNCHRONOUS source seam (reactionDebuffHandler.js:27 — no await): a
    // mockResolvedValue here would hand the code a Promise and silently blank
    // the heal reversal, so this lane pins the SYNC return shape.
    applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 12, actualHeal: 10 });
    damageRollback.findLastAttack.mockResolvedValue({
      attackEvent: null,
      attackerName: null,
      targetName: null,
      primaryDamage: 0,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
    targetResolver.resolveTarget.mockResolvedValue(null);
    targetResolver.resolveMapPositions.mockResolvedValue(undefined);
    rangeCheck.isWithinRange.mockResolvedValue(true);
    // Seed pin (fix#169 idiom): second d20 face 8 → min(15,8)=8; 8+5=13 < AC 14.
    diceRoller.rollD20.mockReturnValue(8);
    diceRoller.rollDie.mockReturnValue(4);
  });

  describe('gate refusals — full-shape popup, zero commits, gate order', () => {
    it.each([
      {
        title: 'no recent attack event',
        options: { attackEvent: null },
        description: 'No recent attack found. Blessed Defender can only be used after an attack roll.',
        reachedRangeGate: false,
      },
      {
        title: 'attack event with no defender',
        options: { attackEvent: { d20: 15, bonus: 5, hit: true, timestamp: FROZEN_NOW } },
        description: 'Could not determine who was attacked. Cannot apply Blessed Defender.',
        reachedRangeGate: false,
      },
      {
        title: 'attacker out of the 30_ft range',
        options: {
          positions: {
            attackerPos: { gridX: 0, gridY: 0 },
            targetPos: { gridX: 20, gridY: 0 },
          },
          inRange: false,
        },
        description: 'Goblin is out of range.',
        reachedRangeGate: true,
      },
    ])(
      'refuses with popup and commits nothing — $title',
      async ({ options, description, reachedRangeGate }) => {
        const result = await setupPath(options);

        expect(result).toEqual({
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Blessed Defender',
            description,
            automation: BASE_AUTOMATION,
          },
        });

        // Full-array zero-commit census (NOT key-filtered): no te, no uses
        // spend, no log row, no dice, no reversal heal.
        expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
        expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([]);
        expect(logService.addEntry.mock.calls).toEqual([]);
        expect(diceRoller.rollD20.mock.calls).toEqual([]);
        expect(diceRoller.rollDie.mock.calls).toEqual([]);
        expect(applyHealing.applyHealingToTarget.mock.calls).toEqual([]);

        // Gate ORDER (short-circuit): every refusal happens after exactly ONE
        // findLastAttack read, so handleDisadvantageDebuff — which re-reads
        // lastAttack — never ran.
        expect(damageRollback.findLastAttack).toHaveBeenCalledTimes(1);
        if (reachedRangeGate) {
          // Range derived from automation.range '30_ft' via parseInt, checked
          // against the ATTACKER (not the defender).
          expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Paladin', 'Goblin', 30);
        } else {
          // Legs refusing before the range gate never touch its channels.
          expect(targetResolver.resolveMapPositions.mock.calls).toEqual([]);
          expect(rangeCheck.isWithinRange.mock.calls).toEqual([]);
        }
      }
    );
  });

  describe('protection te upsert — exact-array write census', () => {
    it.each([
      {
        title: 'custom duration from automation (also the in-range PASS gate leg)',
        options: {
          actionOverrides: { duration: '1_round' },
          positions: {
            attackerPos: { gridX: 0, gridY: 0 },
            targetPos: { gridX: 1, gridY: 0 },
          },
        },
        expected: [protectionTe({ duration: '1_round' })],
        reachedRangeGate: true,
      },
      {
        title: 'existing protection te for same defender is replaced in place (source swaps)',
        options: {
          effects: [protectionTe({ source: 'Other', timestamp: EARLIER })],
        },
        expected: [protectionTe()],
        reachedRangeGate: false,
      },
      {
        title: 'other-defender te is kept and the new te is appended',
        options: {
          effects: [protectionTe({ target: 'Orc', source: 'Other', timestamp: EARLIER })],
        },
        expected: [
          protectionTe({ target: 'Orc', source: 'Other', timestamp: EARLIER }),
          protectionTe(),
        ],
        reachedRangeGate: false,
      },
    ])(
      'writes one targetEffects array — $title',
      async ({ options, expected, reachedRangeGate }) => {
        await setupPath(options);

        // The te write is the FIRST setRuntimeValue commit (order matters for
        // the §39 spend-after-commit contract pinned in the success leg).
        expect(useRuntimeState.setRuntimeValue.mock.calls[0]).toEqual([
          'campaign',
          'targetEffects',
          expected,
          campaignName,
        ]);
        if (reachedRangeGate) {
          expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Paladin', 'Goblin', 30);
        }
      }
    );
  });

  it('applies: ordered commit census (te write, then spendUse), full-shape popup, one ability_use log row', async () => {
    const result = await setupPath();

    // Only the seed-pinned second d20 rolls; no bardic d6 lane on this route.
    expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
    expect(diceRoller.rollDie.mock.calls).toEqual([]);
    // HIT→MISS reversal attempts the damage rollback exactly once. (Call ARGS
    // stay unpinned while source defect #2 — missing campaignName — is open.)
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(1);

    // Ordered full census of the two commits: protection te write FIRST, then
    // the non-preSpent spendUse (1 − 1 = 0 on the real getRuntimeUsesKey name).
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      ['campaign', 'targetEffects', [protectionTe()], campaignName],
      ['Paladin', 'blessedDefenderUses', 0, campaignName],
    ]);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Blessed Defender',
        description: SUCCESS_DESCRIPTION,
        automation: BASE_AUTOMATION,
      },
      defenderHp: 12,
      defenderName: 'Goblin',
      healedAmount: 10,
    });

    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry.mock.calls[0]).toEqual([
      campaignName,
      {
        type: 'ability_use',
        characterName: 'Paladin',
        abilityName: 'Blessed Defender',
        description: SUCCESS_DESCRIPTION,
        targetName: 'Goblin',
        timestamp: FROZEN_NOW,
      },
    ]);
  });
});
