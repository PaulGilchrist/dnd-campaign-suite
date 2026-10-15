// @maintained-by-ai: 2026-10-14
// MA-2013: Sun Wukong "Locking Word (Costs 2 Actions)" — the DC 24 Wisdom
// legendary save child adjudicated honestly (chip armed, Bandit rolled raw +0,
// nat ≤ 20 < DC 24 failure stamped on log/lastAttack, costs-2 spend honest)
// but the row authored NO save_effect: extractConditionsFromSaveEffect is
// save_effect-scoped with zero description fallback (§346) → [] →
// applyDamagelessSaveConditions early-returned and NOTHING landed — no move
// lock, no Reactions lock, no speech lock = FAIL(a), the MA-1997 zero-grant
// twin.
// DATA fix: save_effect byte-carrying BOTH engine-parseable clauses —
// literal "can't take Reactions" (parseSlowedClauses — "unable to…" prose is
// byte-inert, MA-2013 pitfall #1 → registered te no_reactions via the
// MA-0711 inline lane) and "speed is 0" (parseSpeedZeroClause → te speed_zero,
// MA-0146 both-seams shape) — + dc_success:"none" (explicit zero-grant success
// face). Duration "until the start of Wukong's next turn" rides the note as
// extractConditionDurationNote → consumer /next turn/ fork → rounds:2
// (MA-0711 inline honesty twin; victim-window engine approximation of the
// attacker anchor — §529 residual). "…or speak" has NO te channel in the
// targetEffectDefinitions registry → condition_clauses_advisory GM-enforced
// residual emitted by the lane. save_target_effect:"no_reactions" (MA-1847
// structured attacker-anchor lane) DELIBERATELY NOT co-authored: that lane
// carries ONE te, and pairing it with the live prose clause would race two
// clocks on no_reactions (§38) — both prose grants here cover DISJOINT te
// keys, so the two §37 rounds:2 clocks never race the same effect.
// Scope: this file pins ONLY the Sun Wukong row contract. Parser undefined/
// byte-inert generics live in MonsterCardHelpers.slowed-clauses/speed-zero
// tests; the generic MA-0711 inline lane in saveProcessing.euphoria-breath.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect, parseSlowedClauses, parseSpeedZeroClause } from '../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WUKONG_DISK = monsters.find((m) => m.index === 'sun-wukong');
const LW = WUKONG_DISK.legendary_actions[3];
const SOMERSAULT = WUKONG_DISK.legendary_actions[2];

describe('MA-2013 disk fingerprint: Sun Wukong Locking Word save_effect + dc_success authored', () => {
  it('row core byte-unchanged (live-verified exact): DC 24 WIS, costs-2, no damage, dc_success:"none" success face, save_effect last', () => {
    expect(WUKONG_DISK.name).toBe('Sun Wukong');
    expect(LW.name).toBe('Locking Word (Costs 2 Actions)');
    expect(LW.save_dc).toBe(24);
    expect(LW.save_type).toBe('Wisdom');
    expect(LW.description).toContain("Failure: the target is unable to move, take Reactions, or speak until the start of Wukong's next turn.");
    expect(LW.description).toContain('Success: no effect. No damage.');
    expect(LW.damage_dice_primary).toBeUndefined();
    expect(LW.dc_success).toBe('none'); // explicit zero-grant success face (MA-1997 discipline)
    const keys = Object.keys(LW);
    expect(keys.indexOf('dc_success')).toBeGreaterThan(keys.indexOf('save_type'));
    expect(keys[keys.length - 1]).toBe('save_effect');
  });

  it('save_effect byte-pinned — BOTH engine clause legs parse; RAW "unable to…" prose byte-inert (pitfall #1); duration note hits /next turn/ fork', () => {
    expect(LW.save_effect).toBe("The target can't take Reactions, its speed is 0, and it can't speak until the start of Wukong's next turn.");
    // reaction leg: MA-2013 pitfall #1 — the parser wants the literal "can't take
    // Reactions"; the RAW "unable to move, take Reactions, or speak" NEVER parses.
    expect(parseSlowedClauses(LW.save_effect)).toEqual({ effects: ['no_reactions'] });
    expect(parseSlowedClauses('the target is unable to move, take Reactions, or speak')).toBeNull();
    // move leg: MA-0146 speed_zero transport.
    expect(parseSpeedZeroClause(LW.save_effect)).toEqual({ effect: 'speed_zero' });
    // these te clauses are the ONLY grants, never a canonical condition grant (§346).
    expect(extractConditionsFromSaveEffect(LW.save_effect)).toEqual([]);
    // MA-0711 inline twin fork (not the 1-minute default) → rounds:2, pinned live below.
    expect(extractConditionDurationNote(LW.save_effect)).toMatch(/^until the start of Wukong's next turn/);
  });

  it('costs-2 legendary header + Somersault advisory sibling untouched (save_effect never leaked to the wrong row)', () => {
    expect(WUKONG_DISK.legendary_actions[0]).toMatchObject({ name: 'Legendary Action Uses: 3', uses: 3 });
    expect(SOMERSAULT).toMatchObject({ name: 'Somersault Leap', advisory: 'somersault_leap' });
    expect(SOMERSAULT.save_effect).toBeUndefined();
  });
});

// ── Live-lane grant path: processSaveRoll NPC inline branch (EB-joined
// Bandit, raw bonus +0) driven from the disk row's own bytes — the exact
// seam the fixed DC 24 chip press adjudicates on. Harness mirrors
// saveProcessing.ma1997-smaug-frightful-presence.test.js.
const runtimeStore = {};
const addEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
  setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
  default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Sun Wukong 1' }),
  getCurrentCombatRound: () => 1,
  getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  normalizeSaveType: (t) => String(t || '').toUpperCase(),
  computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : 0),
  computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) =>
    (evasionActive && dcSuccess === 'half') ? (saveSuccess ? 0 : Math.floor(total / 2))
      : (!saveSuccess ? total : dcSuccess === 'half' ? Math.floor(total / 2) : 0),
  applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
  isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasIgnoreResistance: () => false,
  playerIsImmuneToCondition: () => false,
}));

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const WUKONG = 'Sun Wukong 1';
const TARGET = 'Bandit 1';

function saveContextFromRow({ effectiveD20 }) {
  return {
    attackerName: WUKONG,
    targetName: TARGET,
    actionName: LW.name,
    saveDc: LW.save_dc,
    saveType: LW.save_type,
    dcSuccess: LW.dc_success, // 'none' — success face pays nothing, no damage authored
    autoDamageFormula: null, // damageless row — applyDamagelessSaveConditions lane
    saveConditions: extractConditionsFromSaveEffect(LW.save_effect), // [] — te-clause row
    slowedClauses: parseSlowedClauses(LW.save_effect), // MA-0711 inline arm
    speedZeroClause: parseSpeedZeroClause(LW.save_effect), // MA-0146 inline leg
    conditionDurationNote: extractConditionDurationNote(LW.save_effect),
    effectiveD20,
  };
}

async function rollNpcInline({ effectiveD20, bonus, context }) {
  return processSaveRoll({
    rollType: 'save',
    target: { name: TARGET, type: 'npc' }, // EB-joined NPC → processNpcSave inline lane
    characterName: TARGET,
    campaignName,
    context: context || saveContextFromRow({ effectiveD20 }),
    bonus,
    logEntry: vi.fn(),
    setPopupHtml: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  addEntryLogs.length = 0;
});

describe('MA-2013 live-lane: failed save grants BOTH legs (was FAIL(a) zero-grant)', () => {
  it('failed save (Bandit raw +0, nat 14 < DC 24, live-exact face): no_reactions + speed_zero te, two rounds:2 clocks on DISJOINT te keys (§38 never raced), grant + advisory logs, zero damage', async () => {
    const { saveSuccess } = await rollNpcInline({ effectiveD20: 14, bonus: 0 });
    expect(saveSuccess).toBe(false);
    expect(applyDamageToTarget).not.toHaveBeenCalled();

    const tes = runtimeStore['campaign.targetEffects'] || [];
    expect(tes.some(te => te.effect === 'no_reactions' && te.target === TARGET && te.source === WUKONG)).toBe(true);
    expect(tes.some(te => te.effect === 'speed_zero' && te.target === TARGET && te.source === WUKONG)).toBe(true);
    // victim-side activeCondition of the speed_zero leg (§125/§209 both-surface landing)
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['speed_zero']);

    // MA-0711 fork hits /next turn/, MA-0146 leg fixed rounds:2 — one clock per
    // clause producer, effectKeys never racing the same te (§38).
    expect(addExpiration).toHaveBeenCalledTimes(2);
    const [speedZeroClock, slowedClock] = addExpiration.mock.calls.map(c => c[0]);
    expect(speedZeroClock).toMatchObject({ attackerName: WUKONG, targetName: TARGET, rounds: 2 });
    expect(speedZeroClock.effects.map(e => e.effectKey || e.type)).toEqual(expect.arrayContaining(['speed_zero']));
    expect(slowedClock).toMatchObject({ attackerName: WUKONG, targetName: TARGET, rounds: 2 });
    expect(slowedClock.effects).toEqual([{ type: 'remove_target_effect', effectKey: 'no_reactions', source: WUKONG, target: TARGET }]);
    const keys1 = speedZeroClock.effects.map(e => e.effectKey || e.type);
    const keys2 = slowedClock.effects.map(e => e.effectKey || e.type);
    expect(keys1.filter(k => keys2.includes(k))).toEqual([]);

    // grant logs: "No Reactions" condition applied + speed_zero_granted
    const grant = addEntryLogs.find(e => e.type === 'condition' && e.action === 'applied');
    expect(grant).toBeTruthy();
    expect(grant.characterName).toBe(TARGET);
    expect(grant.sourceName).toBe(WUKONG);
    expect(grant.condition).toBe('No Reactions');
    expect(grant.description).toMatch(/failed Sun Wukong 1's Locking Word \(Costs 2 Actions\) save/i);
    expect(grant.description).toMatch(/until the end of Bandit 1's next turn/i);
    expect(addEntryLogs.some(e => e.automationType === 'speed_zero_granted' && e.characterName === TARGET)).toBe(true);

    // "…or speak" leg has NO te channel in the registry → advisory residual.
    const advisory = addEntryLogs.find(e => e.automationType === 'condition_clauses_advisory');
    expect(advisory).toBeTruthy();
    expect(advisory.characterName).toBe(TARGET);
    expect(advisory.description).toMatch(/GM-enforced/i);
  });
});

describe('MA-2013 success + byte-inert faces: zero grants every time', () => {
  it('successful save (nat 20 + 4 ≥ DC 24 rig face): zero te, zero clock, zero grant/advisory logs', async () => {
    const { saveSuccess } = await rollNpcInline({ effectiveD20: 20, bonus: 4 });
    expect(saveSuccess).toBe(true);

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
    expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
    expect(addExpiration).not.toHaveBeenCalled();
    expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
    expect(addEntryLogs.some(e => e.automationType === 'speed_zero_granted')).toBe(false);
    expect(addEntryLogs.some(e => e.automationType === 'condition_clauses_advisory')).toBe(false);
  });

  it('pre-fix byte-inert guard: clauseless row (save_effect undefined) fails with ZERO state (FAIL(a) fingerprint)', async () => {
    const { saveSuccess } = await rollNpcInline({
      bonus: 0,
      context: { ...saveContextFromRow({ effectiveD20: 2 }), slowedClauses: parseSlowedClauses(undefined), speedZeroClause: parseSpeedZeroClause(undefined), conditionDurationNote: null },
    });
    expect(saveSuccess).toBe(false);
    expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
    expect(addExpiration).not.toHaveBeenCalled();
  });
});
