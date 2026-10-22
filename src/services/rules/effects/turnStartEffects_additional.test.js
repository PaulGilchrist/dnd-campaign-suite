// @maintained-by-ai
// Lane: per-effect turn-start handler faces NOT pinned elsewhere + the
// FT-082 te option-scoping collateral chain.
// Owner header (expirations_expireStaleEffects.test.js, verbatim): "the
// FT-082 te option-scoping collateral is owned by
// turnStartEffects_additional.test.js" — the three-phase holder-seam drain
// below is that owner face, strengthened to exact full write budgets
// (survivor te bytes + queue drain tuple).
// NOT pinned here (owners cited): dread_ambush_speed grant/latch/round-gate
// lifecycle — turnStartEffects.dread-ambush-regrant.test.js ("CLA-100:
// Dread Ambush ... Ambusher's Leap — once-per-COMBAT speed_boost grant
// lifecycle", exact buff tuple + latch + log + round-2 block + re-grant).
// Topple prone boundary — expirations_expireStaleEffects.test.js
// ("applyTurnStartEffects — Topple prone cleanup boundary (currentRound >=
// appliedRound + 1, via the real toppleCleanup)" — fires AND not-fires rows
// with exact writes; the not-fires row is a strictly stronger zero-write
// budget than the two topple its deleted here). Queue maturity operator
// table and dispatch-arg routing: same owner file (clearExpirationEffects
// mocked there; real per-type internals: clearExpirationEffects*.test.js).
// Cited BY: attackRollDamageCalc-radiantSoul.test.js and
// directSpellDamageSteps-radiantSoul.test.js ("once-per-turn latch RESET
// seam — owned there" → radiant row below), expirations_applyAuraDamage
// ("heroism_temp_hp handler — turnStartEffects_additional.test.js"),
// CharSheet.conditionEffects.mageHand.test.js, applyTurnStartEffects
// ("remaining handlers").
// No-timers policy: rounds flow only through getCurrentCombatRound seeds.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

// Faithful-enough stub: numeric strings resolve to their number so
// damageExpression/healExpression pass-through is distinguishable.
vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => (typeof expr === 'number' ? expr : Number(expr))),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { applyTurnStartEffects, expireStaleEffects, KEY } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound, getCombatSummary } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';
import storage from '../../ui/storage.js';

const CAMPAIGN = 'TestCampaign';

// mockReset the mutable seams so a seeded implementation or stale
// mockReturnValue can never leak between tests (determinism).
function resetMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockReset().mockReturnValue(null);
  getCombatSummary.mockReset().mockReturnValue(null);
  getCurrentCombatRound.mockReset().mockReturnValue(1);
  window.dispatchEvent = vi.fn();
}

function seedStore(values) {
  getRuntimeValue.mockImplementation((name, prop) => {
    const key = `${name}.${prop}`;
    return key in values ? values[key] : null;
  });
}

// FAITHFUL store (#1517 discipline): writes land in the same object reads
// consult, so cross-invocation law arithmetic (and the op ledger) are
// genuinely observable instead of re-seeded fiction. Unseeded keys read null.
function faithfulStore(initial) {
  const store = { ...initial };
  const ops = [];
  getRuntimeValue.mockImplementation((name, prop) => {
    const key = `${name}.${prop}`;
    ops.push(`GET ${key}`);
    return key in store ? store[key] : null;
  });
  setRuntimeValue.mockImplementation((name, prop, value) => {
    const key = `${name}.${prop}`;
    store[key] = value;
    ops.push(`SET ${key}=${JSON.stringify(value)}`);
    return Promise.resolve();
  });
  return { store, ops };
}

beforeEach(() => resetMocks());

// ---------------------------------------------------------------------------
// Simple per-effect handlers — exact full write budget per dispatch
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — flurries, clears and canaries', () => {
  it.each([
    { label: 'WIS +3 grants 3 uses', wisdom: 3, uses: 3 },
    { label: 'negative WIS clamps to minimum 1', wisdom: -5, uses: 1 },
  ])('flurry_healing_harm: $label', async ({ wisdom, uses }) => {
    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'flurry_healing_harm', usesExpression: 'WIS modifier minimum 1' }],
      abilities: [{ name: 'Wisdom', bonus: wisdom }],
    }, CAMPAIGN);

    expect(setRuntimeValue.mock.calls).toEqual([
      ['TestCharacter', 'flurryHealingHarmUses', uses, CAMPAIGN],
    ]);
  });

  // The radiant row is the once-per-turn latch RESET seam cited BY
  // attackRollDamageCalc-radiantSoul.test.js / directSpellDamageSteps-radiantSoul.test.js —
  // including the space→underscore key transform.
  it.each([
    { type: 'living_legend_turn_start', name: 'TestCharacter', key: 'unerringStrikeUsed' },
    { type: 'radiant_soul_turn_start', name: 'TestCharacter', key: '_radiantSoul_TestCharacter_oncePerTurn' },
    { type: 'radiant_soul_turn_start', name: 'Radiant One', key: '_radiantSoul_Radiant_One_oncePerTurn' },
    { type: 'resistance_clear_turn', name: 'TestCharacter', key: 'resistanceUsedThisTurn' },
  ])('$type resets $key unconditionally at turn start', async ({ type, name, key }) => {
    seedStore({ [`${name}.${key}`]: true });

    await applyTurnStartEffects(name, { turnStartEffects: [{ type }] }, CAMPAIGN);

    expect(setRuntimeValue.mock.calls).toEqual([[name, key, false, CAMPAIGN]]);
  });

  it.each([
    {
      label: 'speed_zero present — strips it and clears both aim flags',
      conditions: ['speed_zero', 'poisoned'],
      writes: [
        ['TestCharacter', 'activeConditions', ['poisoned'], CAMPAIGN],
        ['TestCharacter', 'steadyAimMovedThisTurn', false, CAMPAIGN],
        ['TestCharacter', 'steadyAimSpeedZero', false, CAMPAIGN],
      ],
    },
    {
      label: 'no speed_zero — conditions untouched, flags still cleared',
      conditions: ['poisoned'],
      writes: [
        ['TestCharacter', 'steadyAimMovedThisTurn', false, CAMPAIGN],
        ['TestCharacter', 'steadyAimSpeedZero', false, CAMPAIGN],
      ],
    },
  ])('steady_aim_clear: $label', async ({ conditions, writes }) => {
    seedStore({
      'TestCharacter.activeConditions': conditions,
      'TestCharacter.steadyAimMovedThisTurn': true,
      'TestCharacter.steadyAimSpeedZero': true,
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [{ type: 'steady_aim_clear' }] }, CAMPAIGN);

    expect(setRuntimeValue.mock.calls).toEqual(writes);
  });

  // The invisible-preserving face is pinned by the exact budget itself: no
  // activeConditions write appears in any row.
  it.each([
    { label: 'cost 1 + invisible — cost cleared, invisible preserved', cost: 1, conditions: ['invisible', 'fatigued'], writes: [['TestCharacter', 'stealthAttackCost', 0, CAMPAIGN]] },
    { label: 'not invisible — zero writes', cost: 1, conditions: ['fatigued'], writes: [] },
    { label: 'cost 0 or absent — zero writes', cost: 0, conditions: ['invisible'], writes: [] },
  ])('supreme_sneak: $label', async ({ cost, conditions, writes }) => {
    seedStore({
      'TestCharacter.stealthAttackCost': cost,
      'TestCharacter.activeConditions': conditions,
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [{ type: 'supreme_sneak' }] }, CAMPAIGN);

    expect(setRuntimeValue.mock.calls).toEqual(writes);
  });

  it('use_magic_device is a registered no-op placeholder — dispatch writes nothing', async () => {
    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [{ type: 'use_magic_device' }] }, CAMPAIGN);

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  // CLA-218: mage hand control lasts until the start of your next turn.
  it.each([
    { label: 'clears mageHandControlled when set', controlled: true, writes: [['TestCharacter', 'mageHandControlled', false, CAMPAIGN]] },
    { label: 'never writes when it was unset (guard)', controlled: null, writes: [] },
  ])('mage_hand_legerdemain: $label', async ({ controlled, writes }) => {
    seedStore({ 'TestCharacter.mageHandControlled': controlled });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [{ type: 'mage_hand_legerdemain', name: 'Mage Hand Legerdemain' }] }, CAMPAIGN);

    expect(setRuntimeValue.mock.calls).toEqual(writes);
  });

  // Cited BY expirations_applyAuraDamage.test.js: "heroism_temp_hp handler —
  // turnStartEffects_additional.test.js". Real tempHpService replace-bigger
  // rule runs underneath (existing tempHp 3 → 5 replaces).
  it.each([
    { label: 'Heroism 5 replaces tempHp 3', buffs: [{ name: 'Heroism', tempHpAmount: 5 }], tempHp: 3, writes: [['TestCharacter', 'tempHp', 5, CAMPAIGN]] },
    { label: 'no Heroism buff — zero writes', buffs: [], tempHp: 3, writes: [] },
    { label: 'Heroism without a positive amount — zero writes', buffs: [{ name: 'Heroism' }], tempHp: 3, writes: [] },
  ])('heroism_temp_hp: $label', async ({ buffs, tempHp, writes }) => {
    seedStore({ 'TestCharacter.activeBuffs': buffs, 'TestCharacter.tempHp': tempHp });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [{ type: 'heroism_temp_hp' }] }, CAMPAIGN);

    expect(setRuntimeValue.mock.calls).toEqual(writes);
  });

  // clearFlagIfSet seam at the flag NOT pinned by
  // expirations_expireStaleEffects.test.js (which owns _recklessAttack /
  // piercer / Savage_Attacker rows) — exact write budget AND seam order.
  // #1324: survivorUsedThisTurn was a structurally DEAD latch (the pre-loop
  // clear erased it before the guard could consult, same call). Disk law has
  // no latch at all (classes.json:5970 "at the start of each of your
  // turns"), so the key is now never read OR written — seeded stale true,
  // it must not appear in any write budget.
  it('clears portentUsedThisTurn at every turn start — stale survivor latch key never rewritten', async () => {
    seedStore({
      'TestCharacter.survivorUsedThisTurn': true,
      'TestCharacter.portentUsedThisTurn': true,
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, CAMPAIGN);

    expect(setRuntimeValue.mock.calls).toEqual([
      ['TestCharacter', 'portentUsedThisTurn', false, CAMPAIGN],
    ]);
  });

  // CLA-350 Survivor — disk law table on a FAITHFUL store (#1517: writes
  // are visible to reads, unseeded keys read null), so multi-turn law
  // arithmetic is observable end-to-end instead of re-seeded fiction.
  // Law (5e classes.json:5970): heal 5+CON at the START OF EACH OF YOUR
  // TURNS while bloodied (<= half), inert at 0 HP. There is no once-per-rest
  // cap to latch; availability therefore reforms at EVERY bloodied
  // turn-start (host PASS: "round re-arm fired x2 logs"), and a post-long-
  // rest seam is simply full HP ⇒ above-half gate ⇒ zero writes. NO-CLOCK:
  // turns advance only through explicit invocations below.
  it('heals at every bloodied turn-start across turns — latch never read, never written', async () => {
    const { store, ops } = faithfulStore({
      'TestCharacter.hitPoints': 20,
      'TestCharacter.currentHitPoints': 2,
      'TestCharacter.survivorUsedThisTurn': true, // stale latch must not block law
    });
    const effects = { turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5' }] };

    // Turn 1 bloodied 2/20 -> heal 5 (CON 0) -> 7, still bloodied.
    await applyTurnStartEffects('TestCharacter', effects, CAMPAIGN);
    expect(store['TestCharacter.currentHitPoints']).toBe(7);
    // fix#22 validate-before-mutate ledger: HP reads precede the HP write.
    const opsText = ops.join('|');
    expect(opsText).toContain('GET TestCharacter.hitPoints');
    expect(opsText.indexOf('GET TestCharacter.currentHitPoints')).toBeLessThan(opsText.indexOf('SET TestCharacter.currentHitPoints=7'));

    // Turn 2 bloodied turn-start (7/20 <= 10) -> law repeats: heal to 12,
    // computed from the store-VISIBLE 7, not a re-seeded fixture.
    await applyTurnStartEffects('TestCharacter', effects, CAMPAIGN);
    expect(store['TestCharacter.currentHitPoints']).toBe(12);

    // Turn 3 at 12/20 above half -> lawful silence (HP gate, not a latch).
    await applyTurnStartEffects('TestCharacter', effects, CAMPAIGN);
    expect(store['TestCharacter.currentHitPoints']).toBe(12);

    // Post-long-rest seam arm #1348: rest lane restores HP to full 20/20
    // (rest files untouched) — turn-start at full HP is above-half lawful
    // silence, and the feature stays available every future bloodied turn.
    store['TestCharacter.currentHitPoints'] = 20;
    await applyTurnStartEffects('TestCharacter', effects, CAMPAIGN);
    expect(store['TestCharacter.currentHitPoints']).toBe(20);

    expect(setRuntimeValue.mock.calls.map(([, key, value]) => [key, value]))
      .toEqual([['currentHitPoints', 7], ['currentHitPoints', 12]]);
    expect(addEntry).toHaveBeenCalledTimes(2);
    // Order ledger: latch-clear-before-loop pattern is gone entirely.
    expect(ops.filter(op => op.includes('survivorUsedThisTurn'))).toEqual([]);
    expect(setRuntimeValue.mock.calls.filter(([, key]) => key === 'survivorUsedThisTurn')).toEqual([]);
  });

  // Bloodied boundaries (single invocation, fresh faithful store each row):
  // floor(20/2) = 10 heals, 11 does not; 0/-3 stay down; clamps at max.
  it.each([
    { label: 'bloodied 8/20 heals to 13', currentHp: 8, heal: '5', hpAfter: 13, writes: 1 },
    { label: 'bloodied boundary 10/20 heals to 15', currentHp: 10, heal: '5', hpAfter: 15, writes: 1 },
    { label: 'just above boundary 11/20 — zero writes', currentHp: 11, heal: '5', hpAfter: 11, writes: 0 },
    { label: 'at or below 0 HP — zero writes', currentHp: 0, heal: '5', hpAfter: 0, writes: 0 },
    { label: 'negative HP — zero writes', currentHp: -3, heal: '5', hpAfter: -3, writes: 0 },
    { label: 'clamps at max HP (9/20 heal 15 -> 20)', currentHp: 9, heal: '15', hpAfter: 20, writes: 1 },
  ])('survivor_turn_start_heal: $label', async ({ currentHp, heal, hpAfter, writes }) => {
    const { store } = faithfulStore({
      'TestCharacter.hitPoints': 20,
      'TestCharacter.currentHitPoints': currentHp,
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: heal }],
    }, CAMPAIGN);

    expect(store['TestCharacter.currentHitPoints']).toBe(hpAfter);
    if (writes === 0) {
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      return;
    }
    expect(setRuntimeValue.mock.calls).toEqual([
      ['TestCharacter', 'currentHitPoints', hpAfter, CAMPAIGN],
    ]);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use',
      characterName: 'TestCharacter',
      abilityName: 'Survivor',
      description: `TestCharacter uses Survivor to heal ${Number(heal)} HP (bloodied)`,
    });
  });

  // The REAL once-per-invocation protection (replacing the dead latch): the
  // by-type merge at turnStartEffects.js dedups computed vs runtime rows, so
  // a Survivor present in BOTH arrays still heals exactly once per call —
  // caller round-gates (`${round}:${name}`) handle once-per-turn across calls.
  it('computed + runtime duplicate Survivor rows heal exactly once per invocation', async () => {
    const { store } = faithfulStore({
      'TestCharacter.hitPoints': 20,
      'TestCharacter.currentHitPoints': 8,
      'TestCharacter.turnStartEffects': [{ type: 'survivor_turn_start_heal', healExpression: '5' }],
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5' }],
    }, CAMPAIGN);

    expect(store['TestCharacter.currentHitPoints']).toBe(13); // not 18
    expect(setRuntimeValue.mock.calls.filter(([, key]) => key === 'currentHitPoints')).toHaveLength(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// grapple_damage (Unarmed Fighting) — the dispatch loop AWAITS this async
// handler (turnStartEffects.js `if (result) await result`), so the full
// face — HP mutation of grappled non-self creatures, log, single persist
// and broadcast — is deterministically observable. (Replaces the former
// expect(true).toBe(true) placeholder whose "fire-and-forget" premise was
// false.)
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects — grapple_damage (Unarmed Fighting)', () => {
  function grappleSummary() {
    return {
      creatures: [
        { name: 'Grappler', conditions: ['grappled'], hit_points: { current: 12 } },
        { name: 'Orc', conditions: ['grappled'], hit_points: { current: 10 } },
        { name: 'Wolf', conditions: [], hit_points: { current: 8 } },
      ],
    };
  }

  it('damages grappled creatures other than self, logs, persists once and broadcasts', async () => {
    const summary = grappleSummary();
    getCombatSummary.mockReturnValue(summary);

    await applyTurnStartEffects('Grappler', {
      turnStartEffects: [{ type: 'grapple_damage', damageExpression: '2', damageType: 'Bludgeoning' }],
    }, CAMPAIGN);

    expect(summary.creatures[1].hit_points.current).toBe(8); // Orc: 10 - 2
    expect(summary.creatures[0].hit_points.current).toBe(12); // self skipped
    expect(summary.creatures[2].hit_points.current).toBe(8); // not grappled — untouched
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use',
      characterName: 'Grappler',
      abilityName: 'Unarmed Fighting',
      description: 'Unarmed Fighting grapple damage: 2 bludgeoning to Orc',
      timestamp: expect.any(Number),
    });
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', summary, CAMPAIGN);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('zero-damage expression stops before any mutation, log, persist or broadcast', async () => {
    const summary = grappleSummary();
    getCombatSummary.mockReturnValue(summary);

    await applyTurnStartEffects('Grappler', {
      turnStartEffects: [{ type: 'grapple_damage', damageExpression: '0' }],
    }, CAMPAIGN);

    expect(summary.creatures[1].hit_points.current).toBe(10);
    expect(addEntry).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// expireStaleEffects → real clearExpirationEffects → handleRemoveTargetEffect
// turn-boundary scoping. Exact full write budgets: survivor te bytes on the
// campaign store + the owner queue drain tuple.
// ---------------------------------------------------------------------------
describe('expireStaleEffects — remove_target_effect scoping', () => {
  beforeEach(() => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestCharacter' }] });
  });

  it.each([
    {
      label: 'round-matured multiattack_defense leaves other targets\' effects intact',
      currentRound: 2,
      entry: { target: 'Orc', effects: [{ type: 'remove_target_effect', effectKey: 'multiattack_defense', source: 'Defensive Tactics', target: 'Orc' }], appliedRound: 1, expiryRounds: 1 },
      storedTe: [
        { effect: 'multiattack_defense', target: 'Orc', source: 'Defensive Tactics' },
        { effect: 'slow', target: 'Human' },
      ],
      survivors: [{ effect: 'slow', target: 'Human' }],
    },
    {
      label: 'holder-seam sap removes only its own target among identical effect+source te',
      currentRound: 2,
      entry: { target: 'TestCharacter', effects: [{ type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: 'Sap', target: 'TestCharacter' }], appliedRound: 1, expiryRounds: undefined, expireOnCreatureName: 'TestCharacter' },
      storedTe: [
        { effect: 'disadvantage_next_attack', target: 'TestCharacter', source: 'Sap' },
        { effect: 'disadvantage_next_attack', target: 'Orc', source: 'Sap' },
      ],
      survivors: [{ effect: 'disadvantage_next_attack', target: 'Orc', source: 'Sap' }],
    },
    {
      label: 'Slow mastery speed_reduction removal keeps the same-source slow te',
      currentRound: 2,
      entry: { target: 'Orc', effects: [{ type: 'remove_target_effect', effectKey: 'speed_reduction', source: 'Slow', target: 'Orc' }], appliedRound: 1, expiryRounds: 1 },
      storedTe: [
        { effect: 'speed_reduction', source: 'Slow', target: 'Orc' },
        { effect: 'slow', source: 'Slow' },
      ],
      survivors: [{ effect: 'slow', source: 'Slow' }],
    },
    {
      label: 'round boundary 3 >= 1 + 2 matures vex, preserving the other vexTarget payload',
      currentRound: 3,
      entry: { target: 'TestCharacter', effects: [{ type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: 'Vex', target: 'TestCharacter' }], appliedRound: 1, expiryRounds: 2 },
      storedTe: [
        { effect: 'next_attack_advantage', target: 'TestCharacter', source: 'Vex', vexTarget: 'Orc' },
        { effect: 'next_attack_advantage', target: 'Orc', source: 'Vex', vexTarget: 'Human' },
      ],
      survivors: [{ effect: 'next_attack_advantage', target: 'Orc', source: 'Vex', vexTarget: 'Human' }],
    },
  ])('$label', async ({ currentRound, entry, storedTe, survivors }) => {
    getCurrentCombatRound.mockReturnValue(currentRound);
    seedStore({
      'TestCharacter.pendingExpirations': [entry],
      'campaign.targetEffects': storedTe,
    });

    await expireStaleEffects(CAMPAIGN, 'TestCharacter');

    expect(setRuntimeValue.mock.calls).toEqual([
      ['campaign', 'targetEffects', survivors, CAMPAIGN],
      ['TestCharacter', KEY, [], CAMPAIGN],
    ]);
  });

  // FT-082 OWNER FACE (per expirations_expireStaleEffects.test.js header):
  // Slasher Hamstring te ("until the start of your next turn") registered
  // via expireOnCreatureName drains exactly at the holder's next-turn start,
  // and the option-scoped remove_target_effect must not collateral-remove
  // other speed_reduction te from the same holder or other sources.
  it('FT-082: Hamstring drains at holder next-turn start only, option-scoped', async () => {
    const hamstringTe = { effect: 'speed_reduction', source: 'EvasiveFighter', option: 'Hamstring', target: 'Zombie 1', value: 10 };
    const otherRiderTe = { effect: 'speed_reduction', source: 'EvasiveFighter', option: 'OtherRider', target: 'Skeleton' };
    const slowTe = { effect: 'speed_reduction', source: 'Slow', target: 'Zombie 1' };
    const entry = {
      target: 'Zombie 1',
      effects: [{ type: 'remove_target_effect', effectKey: 'speed_reduction', source: 'EvasiveFighter', option: 'Hamstring', target: 'Zombie 1' }],
      appliedRound: 2,
      expiryRounds: Infinity,
      expireOnCreatureName: 'EvasiveFighter',
    };

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'EvasiveFighter' }, { name: 'Skeleton' }] });
    seedStore({
      'EvasiveFighter.pendingExpirations': [entry],
      'Skeleton.pendingExpirations': [],
      'campaign.targetEffects': [{ ...hamstringTe }, { ...otherRiderTe }, { ...slowTe }],
    });

    // Applied round, holder's turn — strict > seam holds: zero writes.
    getCurrentCombatRound.mockReturnValue(2);
    await expireStaleEffects(CAMPAIGN, 'EvasiveFighter');
    expect(setRuntimeValue).not.toHaveBeenCalled();

    // Next round, a different creature's turn — still nothing.
    getCurrentCombatRound.mockReturnValue(3);
    await expireStaleEffects(CAMPAIGN, 'Skeleton');
    expect(setRuntimeValue).not.toHaveBeenCalled();

    // Next round, holder's turn start — drains: exact survivor te bytes and
    // the emptied queue, nothing else.
    await expireStaleEffects(CAMPAIGN, 'EvasiveFighter');
    expect(setRuntimeValue.mock.calls).toEqual([
      ['campaign', 'targetEffects', [{ ...otherRiderTe }, { ...slowTe }], CAMPAIGN],
      ['EvasiveFighter', KEY, [], CAMPAIGN],
    ]);
  });
});
