// @maintained-by-ai
// LANE — Dark One's Blessing damage-trigger CONSUMER seam: applyDamage.js:1082 reaches
// checkDarkOnesBlessing (darkOnesBlessingService.js:79-84 grant) after HP lands. This lane owns
// the kill-trigger gating, the THP grant tuples, and the log bytes. The rider NEVER touches
// finalDamage — it consumes it only as a guard operand (:104). Not a reroll, not a reducer.
// Producer bytes consulted (#967):
//   darkOnesBlessingService.js:33-34    Fiend patron guard — fix#221 dual-ruleset
//                                         names: 'Fiend Patron' (2024 disk :12409) OR
//                                         'Fiend' (5e disk :12272), subclass OR major
//   darkOnesBlessingService.js:44-46    feature lookup: specialActions PRIMARY +
//                                         bonusActions fallback carrier (#221 5e shape),
//                                         + automation truthiness
//                                         (#1188: error label now names the field actually read)
//   darkOnesBlessingService.js:14-17    bonusActions carrier-shape gate: absent OK
//                                         (legacy), present-non-array loud throw (#221)
//   darkOnesBlessingService.js:56-71    warlock level = computed.level (#1188 dead
//                                         class_levels find/ternary deleted — see level-table arms)
//   darkOnesBlessingService.js:79-80    ally-list block on the dying creature's name
//   darkOnesBlessingService.js:82       amount = Math.max(1, CHA mod + warlock level)
//   darkOnesBlessingService.js:83-84    retain write: Math.max(existingTempHp, amount)
//   darkOnesBlessingService.js:86-92    ability_use log — description pinned byte-exact
//   darkOnesBlessingService.js:95-104   :104 guard — finalDamage>0 operand KEEP-WITH-PROOF (#1188)
//   applyDamage.js:1035-1040            guard operands wasAlive/isNowUnconscious/finalDamage>0
//   applyDamage.js:870                  target-side THP absorb runs BEFORE the guard, so the
//                                        store stub is keyed by `${name}.${key}` (#1137/#1057) —
//                                        a warlock's existing THP must never leak onto the
//                                        Goblin's absorb (the old positional stub did exactly that)
// Guard-reach census (#1035): each T2 leg kills exactly ONE guard clause/operand —
// :33 subclass names, :45/:17 missing feature on both carriers, :46 automation:null,
// :80 allies, :104 wasAlive,
// :104 isNowUnconscious (survives leg — absent from the old file). The :104
// finalDamage>0 operand is DEFENSIVELY REDUNDANT (wasAlive+isNowUnconscious imply
// damageAfterTempHp>0 imply finalDamage>0 — KEEP-WITH-PROOF comment at :96-103) —
// no observable leg can kill it alone; the immune leg is kept as its zero-damage
// byte pin, not an operand falsifier (#1188 verdict: KEEP, not delete).
// #1348 level-resolution table (resolveWarlockLevel post-#1188 has ONE live arm,
// computed.level): T1 hit leg (class_levels [{level:5}] == level), T1 miss leg
// (sparse [{level:3}] — slot value never counted), and T1 absent-shape leg
// (no class_levels key: old chain THREW mid-kill, new shape grants 8).
// Rider-active-vs-inactive legs are byte-distinct (#1022): active legs census exact
// writes + exact log bytes (#app log exact); inactive legs census ZERO tempHp writes
// AND ZERO blessing logs while damage bytes still land on the target (#1160 newHp pin).
// Consume-vs-retain (#1183): the feature has no resource per the rules (unlimited
// kills) — T3 pins repeat grants; no consumed stamp exists to decoy.
// Dup map (#1038) — cited owners, never re-driven here:
//   resistance/immunity halving CANON → applyDamage.helpers.test.js :52-84 (#1182)
//   generic activeBuffs merge + Arcane Ward consume → applyDamage.buffs.test.js (#1186)
//   aura-granted resistances → applyDamage.auraWarding.test.js (#1185)
//   attacker-condition riders → applyDamage.attackerConditions.test.js (#1184)
//   compelled duel guard-leg shape → applyDamage.compelledDuel.test.js (#1187)
//   Dark One's OWN LUCK (different feature) → darkOnesLuckHandler(.integration).test.js
//   darkOnesLuckUses tracking → trackedResources(.Additional).test.js
//   automation INFO row producer → automationInfoBuilder/temp.test.js :132-133/:336-340
//
// old -> new map (11 tests -> 3 it.each groups / 15 legs + 1 label-pin it):
// - "grants temp HP equal to CHA modifier + warlock level..."   -> T1 full-fiend leg
// - "grants minimum 1 temp HP..."                               -> T1 clamp leg (zero-is-data #945: writes 1, never skips)
// - "uses Math.max instead of stacking..."                    -> T1 retain-high + upgrade legs (keyed-stub fix above; single warlock suffices)
// - "falls back to character level..."                        -> T1 fallback leg (#1348 miss arm: pins computed.level 5, NOT the class_levels slot 3 — the old ternary arms were numerically identical, #1188 deleted the dead find)
// - (new #1348)                                                 -> T1 absent-class_levels legacy-save arm (pre-fix THREW mid-kill; post-fix grants 8)
// - "grants temp HP to each Fiend Patron warlock..."          -> T3 (distinct amounts 8/4, + unlimited-retain census)
// - "does not grant ... non-Fiend Patron..."                  -> T2 non-fiend leg
// - "does not grant ... missing or lacks automation..."       -> T2 missing-feature + automation-null legs
// - "does not grant ... 0 damage (immune)..."                 -> T2 immune leg (+skeleton HP pin #1160)
// - "does not grant ... already at 0 HP..."                   -> T2 already-dead leg (+survives leg reaching :50 isNowUnconscious)
// - "does not grant ... ally list..."                         -> T2 ally leg (+T1 unrelated-ally leg kills a block-everything mutant)
// - "logs to campaign when temp HP is granted"                -> folded into T1 (exact bytes replace stringContaining)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { getAllyList } from '../../../hooks/useAllySelection.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'TestCampaign';
const BLESSING = "Dark One's Blessing";

function makeCreature(name, hp, extra = {}) {
  return { name, type: 'monster', maxHp: hp, currentHp: hp, resistances: [], immunities: [], ...extra };
}

// Fixture shape matches the producer row (automationInfoBuilder/temp.js :212-215):
// the service reads subclass name, specialActions[].automation truthiness, the
// Charisma bonus, and level — NOT class_levels anymore (#1188 deleted the dead
// find; omitClassLevels pins the legacy-save shape, #1348) — nothing else
// (darkOnesBlessingService.js:20-71). fix#221 adds the OPTIONAL bonusActions
// passthrough for the 5e-shape carrier (disk casting_time routes the row there —
// featureCategorizationUtils.js :20); default stays undefined = legacy shape,
// every pre-fix arm byte-intact.
function makeFiendWarlock(name, chaBonus, level, { patron = 'Fiend Patron', classLevels, specialActions, bonusActions, omitClassLevels = false } = {}) {
  return {
    name,
    computedStats: {
      level,
      class: { name: 'Warlock', subclass: { name: patron }, ...(omitClassLevels ? {} : { class_levels: classLevels ?? [{ level }] }) },
      abilities: [{ name: 'Charisma', bonus: chaBonus }],
      specialActions: specialActions ?? [{ name: BLESSING, automation: { type: 'dark_ones_blessing' } }],
      ...(bonusActions !== undefined ? { bonusActions } : {}),
    },
  };
}

// Keyed stub (#1137/#1057): answers `${name}.${key}` so warlock THP NEVER leaks
// onto the target's absorbWithTempHp read (applyDamage.js:870).
function stubStore(overrides = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    const keyed = overrides[`${name}.${key}`];
    if (keyed !== undefined) return keyed;
    if (key === 'activeConditions' || key === 'activeBuffs') return [];
    return undefined;
  });
}

function tempHpWrites() {
  return setRuntimeValue.mock.calls
    .filter((c) => c[1] === 'tempHp')
    .map((c) => [c[0], c[2], c[3]]);
}

function blessingLogs() {
  return addEntry.mock.calls
    .filter((c) => c[1]?.abilityName === BLESSING)
    .map((c) => c[1]);
}

function logEntry(charName, amount, victimName) {
  return {
    type: 'ability_use',
    characterName: charName,
    abilityName: BLESSING,
    description: `${charName} gained ${amount} temporary hit points from Dark One's Blessing when ${victimName} was reduced to 0 HP.`,
    timestamp: expect.any(Number),
  };
}

function applyTo(target, raw, damageTypes, warlocks) {
  const combatSummary = { round: 1, creatures: [target] };
  return applyDamageToTarget(combatSummary, target.name, raw, damageTypes, {
    campaignName: CAMPAIGN,
    characters: warlocks,
    ignoreResistance: false,
    attackerName: null,
    suppressHpLog: false,
  });
}

describe('Dark One\'s Blessing — rider ACTIVE (grant + log census)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it.each([
    {
      title: 'full fiend: CHA mod +3 + warlock level 5 -> 8 THP',
      warlock: () => makeFiendWarlock('FiendWarlock', 3, 5),
      overrides: {}, allyList: [],
      expectedWrite: ['FiendWarlock', 8, CAMPAIGN], logAmount: 8,
    },
    {
      title: 'clamp: CHA mod -5 + level 1 = -4 -> writes minimum 1 (zero-is-data, never skips)',
      warlock: () => makeFiendWarlock('LowStatWarlock', -5, 1),
      overrides: {}, allyList: [],
      expectedWrite: ['LowStatWarlock', 1, CAMPAIGN], logAmount: 1,
    },
    {
      title: '#1348 miss arm: class_levels slot 3 vs computed.level 5 -> 3+5=8, NOT 3+3=6 (level counts computed.level; the deleted #1188 ternary arms were numerically identical, so the slot value was never observable)',
      warlock: () => makeFiendWarlock('FiendWarlock', 3, 5, { classLevels: [{ level: 3 }] }),
      overrides: {}, allyList: [],
      expectedWrite: ['FiendWarlock', 8, CAMPAIGN], logAmount: 8,
    },
    {
      title: '#1348 absent arm: legacy save without class_levels -> grants 8 (old dead chain THREW mid-kill after HP landed; behavior delta pinned)',
      warlock: () => makeFiendWarlock('LegacyWarlock', 3, 5, { omitClassLevels: true }),
      overrides: {}, allyList: [],
      expectedWrite: ['LegacyWarlock', 8, CAMPAIGN], logAmount: 8,
    },
    {
      title: 'unrelated name on ally list -> still grants (guard matches the victim only)',
      warlock: () => makeFiendWarlock('FiendWarlock', 3, 5),
      overrides: {}, allyList: ['FriendlyGiant'],
      expectedWrite: ['FiendWarlock', 8, CAMPAIGN], logAmount: 8,
    },
    {
      title: 'retain-high: existing 9 vs amount 8 -> writes 9 (Math.max, never downgrades) but logs the offered 8 (:38 vs :44 — distinct fields)',
      warlock: () => makeFiendWarlock('FiendWarlock', 3, 5),
      overrides: { 'FiendWarlock.tempHp': 9 }, allyList: [],
      expectedWrite: ['FiendWarlock', 9, CAMPAIGN], logAmount: 8,
    },
    {
      title: 'upgrade: existing 3 vs amount 8 -> writes 8 (never keeps the lower buffer)',
      warlock: () => makeFiendWarlock('FiendWarlock', 3, 5),
      overrides: { 'FiendWarlock.tempHp': 3 }, allyList: [],
      expectedWrite: ['FiendWarlock', 8, CAMPAIGN], logAmount: 8,
    },
    {
      title: 'fix#221 5e-shape ACTIVE: subclass "Fiend" (5e disk :12272) + blessing carried in bonusActions via casting_time "1 bonus action" (5e disk :12416-12421 verbatim) -> grants 3+5=8 (pre-fix silently declined at BOTH :6 name guard and the specialActions-only read)',
      warlock: () => makeFiendWarlock('Fi5eWarlock', 3, 5, {
        patron: 'Fiend',
        specialActions: [],
        bonusActions: [{ name: BLESSING, automation: { type: 'temp_hp_buff', buffExpression: 'cha_modifier + warlock level', trigger: 'reduce_creature_to_0_hp', casting_time: '1 bonus action' } }],
      }),
      overrides: {}, allyList: [],
      expectedWrite: ['Fi5eWarlock', 8, CAMPAIGN], logAmount: 8,
    },
  ])('$title', async ({ warlock, overrides, allyList, expectedWrite, logAmount }) => {
    getAllyList.mockReturnValue(allyList);
    stubStore(overrides);
    const goblin = makeCreature('Goblin', 5);
    const warlockChar = warlock();

    await applyTo(goblin, 10, ['Slashing'], [warlockChar, { name: 'Goblin', computedStats: { resistances: [], immunities: [] } }]);

    expect(goblin.currentHp).toBe(0); // damage itself is unaffected by the rider (#1160)
    expect(tempHpWrites()).toEqual([expectedWrite]); // full write census, campaign-keyed (#932/#1019)
    expect(blessingLogs()).toEqual([logEntry(expectedWrite[0], logAmount, 'Goblin')]); // exact bytes (#app)
  });
});

describe('Dark One\'s Blessing — guard falsifiers (rider INACTIVE, byte-distinct)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  // Each leg kills exactly ONE guard clause/operand (#1035): removing that clause makes
  // the zero-census below fail. Damage bytes still land — only the rider is absent (#1022).
  it.each([
    {
      title: 'non-Fiend patron with the full feature row -> no grant (subclass guard :33)',
      target: () => makeCreature('Goblin', 5),
      warlock: () => makeFiendWarlock('OtherWarlock', 3, 5, { patron: 'Great Old One Patron' }),
      raw: 10, types: ['Slashing'], allyList: [], expectedHp: 0,
    },
    {
      title: 'specialActions empty -> no grant (missing feature, :45)',
      target: () => makeCreature('Goblin', 5),
      warlock: () => makeFiendWarlock('NoFeatureWarlock', 3, 5, { specialActions: [] }),
      raw: 10, types: ['Slashing'], allyList: [], expectedHp: 0,
    },
    {
      title: 'fix#221 falsifier: subclass "Fiend" but blessing on NEITHER carrier -> no grant (name-path miss on specialActions AND bonusActions)',
      target: () => makeCreature('Goblin', 5),
      warlock: () => makeFiendWarlock('Fi5eNoRow', 3, 5, {
        patron: 'Fiend',
        specialActions: [],
        bonusActions: [{ name: "Dark One's Own Luck", automation: { type: 'dark_ones_luck', diceExpression: '1d10' } }],
      }),
      raw: 10, types: ['Slashing'], allyList: [], expectedHp: 0,
    },
    {
      title: 'feature row with automation null -> no grant (:46)',
      target: () => makeCreature('Goblin', 5),
      warlock: () => makeFiendWarlock('NoAutomationWarlock', 3, 5, { specialActions: [{ name: BLESSING, automation: null }] }),
      raw: 10, types: ['Slashing'], allyList: [], expectedHp: 0,
    },
    {
      title: 'target survives the hit -> no grant (kills :104 isNowUnconscious operand)',
      target: () => makeCreature('Goblin', 5),
      warlock: () => makeFiendWarlock('FiendWarlock', 3, 5),
      raw: 2, types: ['Slashing'], allyList: [], expectedHp: 3,
    },
    {
      title: 'victim already at 0 HP -> no grant (kills :104 wasAlive operand)',
      target: () => { const g = makeCreature('Goblin', 5); g.currentHp = 0; return g; },
      warlock: () => makeFiendWarlock('FiendWarlock', 3, 5),
      raw: 10, types: ['Slashing'], allyList: [], expectedHp: 0,
    },
    {
      title: 'immune victim -> finalDamage 0, victim untouched -> no grant (zero-damage byte pin; the :50 finalDamage>0 operand is defensive — implied by wasAlive+isNowUnconscious; halving math CANON helpers #1182)',
      target: () => makeCreature('Skeleton', 10, { immunities: ['necrotic'] }),
      warlock: () => makeFiendWarlock('FiendWarlock', 3, 5),
      raw: 15, types: ['Necrotic'], allyList: [], expectedHp: 10,
    },
    {
      title: 'victim named on the warlock\'s ally list -> no grant (:80)',
      target: () => makeCreature('Goblin', 5),
      warlock: () => makeFiendWarlock('FiendWarlock', 3, 5),
      raw: 10, types: ['Slashing'], allyList: ['Goblin'], expectedHp: 0,
    },
  ])('$title', async ({ target, warlock, raw, types, allyList, expectedHp }) => {
    getAllyList.mockReturnValue(allyList);
    stubStore();
    const victim = target();

    const result = await applyTo(victim, raw, types, [warlock(), { name: victim.name, computedStats: { resistances: [], immunities: [] } }]);

    expect(tempHpWrites()).toEqual([]);
    expect(blessingLogs()).toEqual([]);
    expect(victim.currentHp).toBe(expectedHp); // damage bytes intact, rider absent (#1160)
    expect(result.newHp).toBe(expectedHp);
  });

  it('#1188 label pin: non-array specialActions rejects with the specialActions-bytes message (the old characterAdvancement lie must never return)', async () => {
    getAllyList.mockReturnValue([]);
    stubStore();
    const warlock = makeFiendWarlock('FiendWarlock', 3, 5, { specialActions: 'not-an-array' });
    await expect(applyTo(makeCreature('Goblin', 5), 10, ['Slashing'], [warlock])).rejects.toThrow('specialActions must be an array');
    expect(tempHpWrites()).toEqual([]); // refusal is loud AND write-free
  });

  it('fix#221 carrier-shape pin: blessing absent from specialActions and bonusActions non-array rejects with the bonusActions-bytes message (symmetric loud gate; specialActions PRIMARY untouched)', async () => {
    getAllyList.mockReturnValue([]);
    stubStore();
    const warlock = makeFiendWarlock('Fi5eWarlock', 3, 5, { patron: 'Fiend', specialActions: [], bonusActions: 'not-an-array' });
    await expect(applyTo(makeCreature('Goblin', 5), 10, ['Slashing'], [warlock])).rejects.toThrow('bonusActions must be an array');
    expect(tempHpWrites()).toEqual([]); // refusal is loud AND write-free (#1188 twin)
  });
});

describe('Dark One\'s Blessing — loop + unlimited retain', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('grants each Fiend warlock their own amount, and keeps granting on later kills (no resource consumed)', async () => {
    getAllyList.mockReturnValue([]);
    stubStore();
    const warlock1 = makeFiendWarlock('FiendWarlock1', 3, 5); // 3 + 5 = 8
    const warlock2 = makeFiendWarlock('FiendWarlock2', 0, 4); // 0 + 4 = 4

    await applyTo(makeCreature('Goblin', 5), 10, ['Slashing'], [warlock1, warlock2]);
    expect(tempHpWrites()).toEqual([
      ['FiendWarlock1', 8, CAMPAIGN],
      ['FiendWarlock2', 4, CAMPAIGN],
    ]); // per-character math, loop census
    expect(blessingLogs()).toEqual([
      logEntry('FiendWarlock1', 8, 'Goblin'),
      logEntry('FiendWarlock2', 4, 'Goblin'),
    ]);

    // Retain census (#1183, inverse): the blessing is unlimited — a second kill
    // re-triggers both grants with identical bytes (stub keeps existing 0; a
    // consumed-stamped mutant would drop this census to 2 writes / 2 logs).
    await applyTo(makeCreature('Skeleton', 2), 10, ['Slashing'], [warlock1, warlock2]);
    expect(tempHpWrites()).toEqual([
      ['FiendWarlock1', 8, CAMPAIGN],
      ['FiendWarlock2', 4, CAMPAIGN],
      ['FiendWarlock1', 8, CAMPAIGN],
      ['FiendWarlock2', 4, CAMPAIGN],
    ]);
    expect(blessingLogs().map((e) => e.description)).toEqual([
      'FiendWarlock1 gained 8 temporary hit points from Dark One\'s Blessing when Goblin was reduced to 0 HP.',
      'FiendWarlock2 gained 4 temporary hit points from Dark One\'s Blessing when Goblin was reduced to 0 HP.',
      'FiendWarlock1 gained 8 temporary hit points from Dark One\'s Blessing when Skeleton was reduced to 0 HP.',
      'FiendWarlock2 gained 4 temporary hit points from Dark One\'s Blessing when Skeleton was reduced to 0 HP.',
    ]); // exact bytes per kill (#app log exact)
  });
});
