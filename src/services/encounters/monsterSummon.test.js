// MA-0648: Drow Mage "Summon Demon" (actions[1]) — formerly inert
// other-type row. Authored automation:{type:"monster_summon"} arms a chip
// that routes resolveMonsterSummonRow: 1/Day gate via the MA-0020
// monsterSpellUses economy (spend first, exhausted refuses `<slug>_refused`
// zero-spend/zero-spawn), single honest d100 coin flip (≤50 → shadow-demon,
// miss → quasit fallback), spawn into combatSummary as an ally acting right
// after the caster (summonSpiritHandler cs push + sort + set seam), te
// "summoned" registered on the spawn, attempt/outcome/spawn each logged.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSummonRow,
  adjudicateSummonAttempt,
  resolveMonsterSummonRow,
  buildSummonCoinFlipLog,
  buildSummonSpawnLog,
  buildSummonSelfDamageLog,
} from './monsterSummon.js';
import monstersData from '../../../public/data/monsters.json';

const drowMage = monstersData.find(m => m.index === 'drow-mage');
const SUMMON_ROW = drowMage.actions[1];
const quasit = monstersData.find(m => m.index === 'quasit');
const shadowDemon = monstersData.find(m => m.index === 'shadow-demon');

function makeDeps(stored = {}, roll = 50) {
  const store = { logs: [], ...stored };
  return {
    store,
    rollDie: vi.fn(() => roll),
    monsters: [quasit, shadowDemon],
    skipDomEvents: true,
    getCombatSummary: vi.fn(() => store.cs),
    setCombatSummary: vi.fn(cs => { store.cs = cs; }),
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te = { campaign, target, effect, source, extra };
    }),
    getRuntimeValue: vi.fn(() => store.uses || {}),
    setRuntimeValue: vi.fn((c, k, v) => { store.uses = v; return Promise.resolve(); }),
    addEntry: vi.fn((c, entry) => { store.logs.push(entry); return Promise.resolve(); }),
    get logs() { return store.logs; },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-0648 disk data shape', () => {
  it('drow-mage Summon Demon row authors monster_summon automation + numeric uses', () => {
    expect(SUMMON_ROW.name).toBe('Summon Demon');
    expect(SUMMON_ROW.automation).toEqual({
      type: 'monster_summon',
      options: [
        { monster: 'quasit' },
        { monster: 'shadow-demon', chance: 0.5 },
      ],
      range_ft: 60,
      duration_minutes: 10,
    });
    expect(SUMMON_ROW.uses).toBe(1);
    expect(SUMMON_ROW.maxUses).toBe(1);
    expect(SUMMON_ROW.usage).toEqual({ type: 'per day', times: 1 });
    expect(SUMMON_ROW.save_dc).toBeUndefined();
    expect(SUMMON_ROW.attack_bonus).toBeUndefined();
  });

  it('quasit + shadow-demon spawn targets exist on disk with full blocks', () => {
    expect(quasit.hit_points).toBeGreaterThan(0);
    expect(quasit.actions.length).toBeGreaterThan(0);
    expect(shadowDemon.hit_points).toBeGreaterThan(0);
    expect(shadowDemon.actions.length).toBeGreaterThan(0);
  });

  it('isMonsterSummonRow: only monster_summon rows with options arm', () => {
    expect(isMonsterSummonRow(SUMMON_ROW)).toBe(true);
    expect(isMonsterSummonRow(drowMage.actions[0])).toBe(false);
    expect(isMonsterSummonRow({ automation: { type: 'monster_summon', options: [] } })).toBe(false);
    expect(isMonsterSummonRow(null)).toBe(false);
  });
});

describe('MA-0648 coin-flip adjudication', () => {
  it('d100 ≤ 50 lands the shadow-demon attempt', () => {
    const verdict = adjudicateSummonAttempt(SUMMON_ROW.automation.options, () => 50);
    expect(verdict).toMatchObject({ monster: 'shadow-demon', roll: 50, success: true, chance: 0.5 });
  });

  it('d100 > 50 fails the attempt and falls back to quasit', () => {
    const verdict = adjudicateSummonAttempt(SUMMON_ROW.automation.options, () => 51);
    expect(verdict).toMatchObject({ monster: 'quasit', roll: 51, success: false });
  });

  it('one d100 roll per adjudication, chance-less rows never flip', () => {
    const rollFn = vi.fn(() => 37);
    adjudicateSummonAttempt(SUMMON_ROW.automation.options, rollFn);
    expect(rollFn).toHaveBeenCalledTimes(1);
    expect(adjudicateSummonAttempt([{ monster: 'quasit' }], rollFn)).toMatchObject({ monster: 'quasit', roll: null, success: true });
    expect(rollFn).toHaveBeenCalledTimes(1);
  });
});

describe('MA-0648 activation', () => {
  it('success flip: spends 1/Day, spawns shadow-demon into cs as ally after caster, registers te, logs flip + spawn', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Drow Mage 1', type: 'npc', initiative: '12' }] } }, 42);
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Drow Mage 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toMatchObject({ resolved: true, summonedName: 'Shadow Demon', summonedNames: ['Shadow Demon'], countRoll: null, verdict: { monster: 'shadow-demon', roll: 42, success: true, chance: 0.5 }, remaining: 0 });
    expect(deps.store.uses).toEqual({ 'Summon Demon': 1 });
    const spawned = deps.store.cs.creatures.find(c => c.name === 'Shadow Demon');
    expect(spawned).toMatchObject({ type: 'npc', monsterIndex: 'shadow-demon', ac: 14, maxHp: 66, currentHp: 66, summonedBy: 'Drow Mage 1', summonSource: 'monster_ability', initiative: '11.9' });
    expect(spawned.actions[0].name).toBe('Umbral Claw');
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Shadow Demon', 'summoned', 'Drow Mage 1', { duration: '10_minutes' });
    expect(deps.setCombatSummary).toHaveBeenCalled();
    const flipLog = deps.logs.find(e => e.rollType === 'monster_summon_coin_flip');
    expect(flipLog).toMatchObject({ type: 'roll', characterName: 'Drow Mage 1', rolls: [42], total: 42 });
    expect(flipLog.description).toContain('d100 42 vs 50%');
    expect(flipLog.description).toContain('success, summons shadow-demon');
    const spawnLog = deps.logs.find(e => e.type === 'summons');
    expect(spawnLog.summonedCreatures).toEqual(['Shadow Demon']);
    expect(spawnLog.description).toContain('60 ft');
    expect(spawnLog.description).toContain('10 minutes');
    const spendLog = deps.logs.find(e => e.type === 'ability_use');
    expect(spendLog.description).toContain('Summon Demon');
    expect(spendLog.description).toContain('0 left today');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Shadow Demon'));
  });

  it('failed flip: spawns quasit fallback, logged honestly', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Drow Mage 1', type: 'npc', initiative: '8' }] } }, 77);
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Drow Mage 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.summonedName).toBe('Quasit');
    expect(deps.store.cs.creatures.some(c => c.name === 'Quasit')).toBe(true);
    const flipLog = deps.logs.find(e => e.rollType === 'monster_summon_coin_flip');
    expect(flipLog.description).toContain('failure, falls back to quasit');
  });

  it('second same-day click: refused with summon_demon_refused, zero roll/spend/spawn/te', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Drow Mage 1', initiative: '12' }] }, uses: { 'Summon Demon': 1 } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Drow Mage 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: { 'Summon Demon': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    const refusal = deps.logs.find(e => e.automationType === 'summon_demon_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toContain('already used Summon Demon today');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Uses Exhausted'));
  });

  it('non-summon rows never route', async () => {
    const deps = makeDeps();
    const result = await resolveMonsterSummonRow({
      action: drowMage.actions[0],
      monsterName: 'Drow Mage 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'not-monster-summon' });
    expect(deps.logs).toHaveLength(0);
  });

  it('name collision: second spawn gets numbered suffix', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Drow Mage 1', initiative: '12' }, { name: 'Quasit', initiative: '5' }] } }, 77);
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Drow Mage 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      deps,
    });
    expect(result.summonedName).toBe('Quasit 1');
    const log = buildSummonSpawnLog({ monsterName: 'Drow Mage 1', action: SUMMON_ROW, summonedNames: ['Quasit 1'], durationMinutes: 10 });
    expect(log.summonedCreatures).toEqual(['Quasit 1']);
    const flipLog = buildSummonCoinFlipLog({ monsterName: 'Drow Mage 1', action: SUMMON_ROW, verdict: { monster: 'quasit', roll: 77, success: false, chance: 0.5 } });
    expect(flipLog.total).toBe(77);
  });
});

// MA-0651: Drow Priestess of Lolth "Summon Demon" — single chance-option
// row (yochlol @ 30%) with NO fallback: failed flip spawns nothing and the
// summoner takes 1d10 psychic via applyDamageToTarget; uses:3 gate spends
// then refuses at 0.
const priestess = monstersData.find(m => m.index === 'drow-priestess-of-lolth');
const PRIESTESS_ROW = priestess.actions.find(a => a.name === 'Summon Demon');
const yochlol = monstersData.find(m => m.index === 'yochlol');

function makeSelfDmgDeps(stored = {}, roll = 50, dmgRoll = { total: 7, rolls: [7], modifier: 0, formula: '1d10' }) {
  const deps = makeDeps(stored, roll);
  deps.monsters = [yochlol];
  deps.rollExpression = vi.fn(() => dmgRoll);
  deps.applyDamageToTarget = vi.fn(async (cs, target, raw) => {
    const c = cs.creatures.find(x => x.name === target);
    c.currentHp -= raw;
    return { finalDamage: raw, newHp: c.currentHp };
  });
  return deps;
}

describe('MA-0651 Priestess summon data', () => {
  it('authors monster_summon automation: yochlol 30% + structured self-damage + uses 3', () => {
    expect(isMonsterSummonRow(PRIESTESS_ROW)).toBe(true);
    expect(PRIESTESS_ROW.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: 'yochlol', chance: 0.3 }],
      self_damage_formula: '1d10',
      self_damage_type: 'psychic',
      range_ft: 60,
      duration_minutes: 10,
    });
    expect(PRIESTESS_ROW.uses).toBe(3);
    expect(PRIESTESS_ROW.maxUses).toBe(3);
    expect(PRIESTESS_ROW.description).toContain('1d10');
    expect(PRIESTESS_ROW.description).not.toContain('1dlO');
    expect(yochlol.hit_points).toBeGreaterThan(0);
  });

  it('per-row chance: 30% here vs 50% on the Drow Mage twin', () => {
    expect(adjudicateSummonAttempt(PRIESTESS_ROW.automation.options, () => 30)).toMatchObject({ monster: 'yochlol', roll: 30, success: true, chance: 0.3 });
    expect(adjudicateSummonAttempt(SUMMON_ROW.automation.options, () => 50)).toMatchObject({ monster: 'shadow-demon', success: true, chance: 0.5 });
  });
});

describe('MA-0651 failed summon with no fallback', () => {
  it('d100 31 > 30: verdict.monster null, no spawn', () => {
    const verdict = adjudicateSummonAttempt(PRIESTESS_ROW.automation.options, () => 31);
    expect(verdict).toEqual({ monster: null, roll: 31, success: false, chance: 0.3 });
  });

  it('fail: spends a use, zero spawn/te, rolls 1d10 applied to summoner via applyDamageToTarget, flips+self-damage logged', async () => {
    const deps = makeSelfDmgDeps({ cs: { round: 1, creatures: [{ name: 'Drow Priestess of Lolth', type: 'npc', initiative: '15', currentHp: 113, maxHp: 113 }] } }, 88, { total: 7, rolls: [7], modifier: 0, formula: '1d10' });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: PRIESTESS_ROW,
      monsterName: 'Drow Priestess of Lolth',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.summonedName).toBeNull();
    expect(result.remaining).toBe(2);
    expect(deps.store.cs.creatures.some(c => c.name === 'Yochlol')).toBe(false);
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.rollExpression).toHaveBeenCalledWith('1d10');
    expect(deps.applyDamageToTarget).toHaveBeenCalledWith(deps.store.cs, 'Drow Priestess of Lolth', 7, ['psychic'], { campaignName: 'test-campaign', characters: [], attackerName: 'Drow Priestess of Lolth' });
    expect(deps.store.cs.creatures[0].currentHp).toBe(106);
    expect(deps.store.uses).toEqual({ 'Summon Demon': 1 });
    const flipLog = deps.logs.find(e => e.rollType === 'monster_summon_coin_flip');
    expect(flipLog.description).toContain('d100 88 vs 30%');
    expect(flipLog.description).toContain('failure, no summon answers');
    const dmgLog = deps.logs.find(e => e.rollType === 'monster_summon_self_damage');
    expect(dmgLog).toMatchObject({ type: 'roll damage', characterName: 'Drow Priestess of Lolth', rolls: [7], total: 7, damageType: 'psychic', formula: '1d10' });
    expect(dmgLog.description).toContain('7 psychic damage (rolled 7)');
    expect(deps.logs.some(e => e.type === 'summons')).toBe(false);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('summon fails'));
  });

  it('success d100 30: spawns Yochlol ally, self-damage NEVER rolls', async () => {
    const deps = makeSelfDmgDeps({ cs: { round: 1, creatures: [{ name: 'Drow Priestess of Lolth', type: 'npc', initiative: '15', currentHp: 113, maxHp: 113 }] } }, 30);
    const result = await resolveMonsterSummonRow({
      action: PRIESTESS_ROW,
      monsterName: 'Drow Priestess of Lolth',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: {},
      deps,
    });
    expect(result).toMatchObject({ resolved: true, summonedName: 'Yochlol', remaining: 2 });
    const spawned = deps.store.cs.creatures.find(c => c.name === 'Yochlol');
    expect(spawned).toMatchObject({ type: 'npc', monsterIndex: 'yochlol', summonedBy: 'Drow Priestess of Lolth', summonSource: 'monster_ability', initiative: '14.9' });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Yochlol', 'summoned', 'Drow Priestess of Lolth', { duration: '10_minutes' });
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.applyDamageToTarget).not.toHaveBeenCalled();
    expect(deps.store.cs.creatures.find(c => c.name === 'Drow Priestess of Lolth').currentHp).toBe(113);
    expect(deps.logs.some(e => e.type === 'summons')).toBe(true);
  });

  it('uses gate counts 3→2→1→0 then refuses with summon_demon_refused, zero roll/self-damage/spawn', async () => {
    const cs = { round: 1, creatures: [{ name: 'Drow Priestess of Lolth', type: 'npc', initiative: '15', currentHp: 113, maxHp: 113 }] };
    for (const used of [0, 1, 2]) {
      const deps = makeSelfDmgDeps({ cs, uses: { 'Summon Demon': used } }, 88);
      const result = await resolveMonsterSummonRow({
        action: PRIESTESS_ROW,
        monsterName: 'Drow Priestess of Lolth',
        campaignName: 'test-campaign',
        setPopupHtml: vi.fn(),
        storedUses: { 'Summon Demon': used },
        deps,
      });
      expect(result).toMatchObject({ resolved: true, remaining: 2 - used });
      expect(deps.store.uses).toEqual({ 'Summon Demon': used + 1 });
    }
    const deps = makeSelfDmgDeps({ cs, uses: { 'Summon Demon': 3 } }, 88);
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: PRIESTESS_ROW,
      monsterName: 'Drow Priestess of Lolth',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: { 'Summon Demon': 3 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.applyDamageToTarget).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.store.uses).toEqual({ 'Summon Demon': 3 });
    expect(deps.logs.find(e => e.automationType === 'summon_demon_refused')).toBeTruthy();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Uses Exhausted'));
  });

  it('buildSummonSelfDamageLog carries roll detail', () => {
    const log = buildSummonSelfDamageLog({ monsterName: 'Drow Priestess of Lolth', action: PRIESTESS_ROW, damageRoll: { total: 5, rolls: [5], modifier: 0, formula: '1d10' } });
    expect(log).toMatchObject({ type: 'roll damage', rollType: 'monster_summon_self_damage', total: 5, damageType: 'psychic' });
    expect(log.description).toContain('5 psychic damage (rolled 5)');
  });
});

// MA-0664: Dust Mephit "Variant: Summon Mephits" (actions[2]) — formerly an
// inert usage-only row. Authored automation {monster_summon, options:[dust-
// mephit @ 25%], count:"1d4", range_ft:60, duration_minutes:1} + numeric
// uses/maxUses:1 rides the MA-0648 seam extended with COUNT: the count dice
// rolls only AFTER the chance flip succeeds (failed flip = zero count roll,
// zero spawn, honest popup, 1/Day already spent); N self-copies spawn with
// unique names via getNextUniqueMonsterName, ONE summons log lists names +
// count detail, te "summoned" per spawn with the row's 1-minute duration.
const dustMephit = monstersData.find(m => m.index === 'dust-mephit');
const SUMMON_MEPHITS_ROW = dustMephit.actions[2];

function makeCountDeps(cs, coin = 25, countRoll = { total: 3, rolls: [1, 1, 1], modifier: 0, formula: '1d4' }, uses = {}) {
  const deps = makeDeps({ cs, uses }, coin);
  deps.monsters = [dustMephit];
  deps.rollExpression = vi.fn(() => countRoll);
  return deps;
}

describe('MA-0664 dust-mephit summon data', () => {
  it('actions[2] authors monster_summon + count dice + numeric 1/Day gate, keeps usage', () => {
    expect(SUMMON_MEPHITS_ROW.name).toBe('Variant: Summon Mephits');
    expect(SUMMON_MEPHITS_ROW.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: 'dust-mephit', chance: 0.25 }],
      count: '1d4',
      range_ft: 60,
      duration_minutes: 1,
    });
    expect(SUMMON_MEPHITS_ROW.uses).toBe(1);
    expect(SUMMON_MEPHITS_ROW.maxUses).toBe(1);
    expect(SUMMON_MEPHITS_ROW.usage).toEqual({ type: 'per day', times: 1 });
    expect(isMonsterSummonRow(SUMMON_MEPHITS_ROW)).toBe(true);
    expect(dustMephit.hit_points).toBeGreaterThan(0);
    expect(dustMephit.actions.length).toBeGreaterThan(0);
  });

  it('chance boundary: d100 25 lands, 26 fails with no fallback', () => {
    expect(adjudicateSummonAttempt(SUMMON_MEPHITS_ROW.automation.options, () => 25)).toMatchObject({ monster: 'dust-mephit', roll: 25, success: true, chance: 0.25 });
    expect(adjudicateSummonAttempt(SUMMON_MEPHITS_ROW.automation.options, () => 26)).toEqual({ monster: null, roll: 26, success: false, chance: 0.25 });
  });
});

describe('MA-0664 count spawn resolution', () => {
  it('failed flip d100 26: spends 1/Day, ZERO count roll, ZERO spawn/te, honest fails popup', async () => {
    const deps = makeCountDeps({ round: 1, creatures: [{ name: 'Dust Mephit 1', type: 'npc', initiative: '14', currentHp: 17, maxHp: 17 }] }, 26);
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_MEPHITS_ROW,
      monsterName: 'Dust Mephit 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toMatchObject({ resolved: true, summonedName: null, summonedNames: [], countRoll: null, remaining: 0 });
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.store.cs.creatures).toHaveLength(1);
    expect(deps.store.uses).toEqual({ 'Variant: Summon Mephits': 1 });
    expect(deps.logs.find(e => e.rollType === 'monster_summon_coin_flip').description).toContain('d100 26 vs 25%');
    expect(deps.logs.some(e => e.type === 'summons')).toBe(false);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('summon fails'));
  });

  it('success flip d100 25 + 1d4=3: count rolled AFTER flip, 3 unique-named self-copies spawn after caster, te per spawn @1_minutes, ONE summons log with count detail', async () => {
    const deps = makeCountDeps({ round: 1, creatures: [{ name: 'Dust Mephit 1', type: 'npc', initiative: '14', currentHp: 17, maxHp: 17 }] }, 25);
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_MEPHITS_ROW,
      monsterName: 'Dust Mephit 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(deps.rollDie).toHaveBeenCalledTimes(1);
    expect(deps.rollExpression).toHaveBeenCalledWith('1d4');
    expect(result).toMatchObject({ resolved: true, summonedName: 'Dust Mephit', countRoll: { total: 3 } });
    // getNextUniqueMonsterName always-suffix quirk: summoner "Dust Mephit 1"
    // pins maxNum=1, so copies land on 2/3 — names stay unique, as intended.
    expect(result.summonedNames).toEqual(['Dust Mephit', 'Dust Mephit 2', 'Dust Mephit 3']);
    const spawned = deps.store.cs.creatures.filter(c => c.monsterIndex === 'dust-mephit');
    expect(spawned.map(c => c.name)).toEqual(['Dust Mephit', 'Dust Mephit 2', 'Dust Mephit 3']);
    for (const c of spawned) {
      expect(c).toMatchObject({ type: 'npc', ac: 12, maxHp: 17, currentHp: 17, summonedBy: 'Dust Mephit 1', summonSource: 'monster_ability', initiative: '13.9' });
    }
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(3);
    for (const name of result.summonedNames) {
      expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', name, 'summoned', 'Dust Mephit 1', { duration: '1_minutes' });
    }
    const spawnLogs = deps.logs.filter(e => e.type === 'summons');
    expect(spawnLogs).toHaveLength(1);
    expect(spawnLogs[0].summonedCreatures).toEqual(['Dust Mephit', 'Dust Mephit 2', 'Dust Mephit 3']);
    expect(spawnLogs[0].summonCount).toBe(3);
    expect(spawnLogs[0].countRoll).toEqual({ total: 3, rolls: [1, 1, 1], modifier: 0, formula: '1d4' });
    expect(spawnLogs[0].description).toContain('1d4 rolled 3');
    expect(spawnLogs[0].description).toContain('60 ft');
    expect(spawnLogs[0].description).toContain('remain 1 minutes');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Count: 1d4 rolled 3'));
  });

  it('count 1 spawns base name only, no suffix on empty board', async () => {
    const deps = makeCountDeps({ round: 1, creatures: [{ name: 'Bandit', type: 'npc', initiative: '10' }] }, 12, { total: 1, rolls: [1], modifier: 0, formula: '1d4' });
    const result = await resolveMonsterSummonRow({
      action: SUMMON_MEPHITS_ROW,
      monsterName: 'Dust Mephit 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: {},
      deps,
    });
    expect(result.summonedNames).toEqual(['Dust Mephit']);
    expect(deps.store.cs.creatures.map(c => c.name)).toEqual(['Bandit', 'Dust Mephit']);
  });

  it('1/Day gate: second click refused with variant_summon_mephits_refused, zero coin/count/spend/spawn', async () => {
    const deps = makeCountDeps({ round: 1, creatures: [{ name: 'Dust Mephit 1', initiative: '14' }] }, 5, { total: 4 }, { 'Variant: Summon Mephits': 1 });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_MEPHITS_ROW,
      monsterName: 'Dust Mephit 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: { 'Variant: Summon Mephits': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.logs.find(e => e.automationType === 'variant_summon_mephits_refused')).toBeTruthy();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Uses Exhausted'));
  });
});

// MA-0757: Galeb Duhr "Animate Boulders" (actions[1]) — formerly a
// zero-affordance OTHER-type row with a silently-ignored uses:"1/Day"
// STRING. Authored automation {monster_summon, options:[galeb-duhr @
// stat_override int/cha 1], count:2 (numeric CONSTANT — RAW "one or two"
// is the duhr's choice; no chooser seam app-wide, so the row adjudicates
// the max of two animated boulders, GM holds one back if "one"), range 60,
// duration 1} + numeric uses/maxUses rides the MA-0020 gate. SELF-SUMMON
// guard: the boulder IS the summoner's block ("lacks this action", RAW),
// so monster_summon automation actions are stripped from every spawn —
// boulders can never chain-animate. Chance-less rows never flip a d100 and
// log no coin-flip entry (no bogus "d100 null vs 0%").
const galebDuhr = monstersData.find(m => m.index === 'galeb-duhr');
const ANIMATE_ROW = galebDuhr.actions[1];

describe('MA-0757 galeb-duhr Animate Boulders data', () => {
  it('authors monster_summon automation + numeric count + numeric 1/Day gate; uses-string removed', () => {
    expect(ANIMATE_ROW.name).toBe('Animate Boulders');
    expect(ANIMATE_ROW.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: 'galeb-duhr', stat_override: { int: 1, cha: 1 } }],
      count: 2,
      range_ft: 60,
      duration_minutes: 1,
    });
    expect(ANIMATE_ROW.uses).toBe(1);
    expect(ANIMATE_ROW.maxUses).toBe(1);
    expect(typeof ANIMATE_ROW.uses).toBe('number');
    expect(ANIMATE_ROW.usage).toBeUndefined();
    expect(isMonsterSummonRow(ANIMATE_ROW)).toBe(true);
  });

  // MA-0759 twin fix: galib-duhr's formerly inert row rides the SAME seam
  // with the byte-shape mirrored from galeb-duhr. Its cosmetic usage DICT
  // (§241 twin discriminator vs the silent uses-STRING) is dropped exactly
  // like MA-0757 dropped its uses-string — numeric uses/maxUses gate now.
  it('MA-0759 galib-duhr twin row mirrors the galeb-duhr byte-shape', () => {
    const galib = monstersData.find(m => m.index === 'galib-duhr');
    const row = galib.actions[1];
    expect(row.name).toBe('Animate Boulders');
    expect(row.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: 'galib-duhr', stat_override: { int: 1, cha: 1 } }],
      count: 2,
      range_ft: 60,
      duration_minutes: 1,
    });
    expect(row.uses).toBe(1);
    expect(row.maxUses).toBe(1);
    expect(typeof row.uses).toBe('number');
    expect(row.usage).toBeUndefined();
    expect(isMonsterSummonRow(row)).toBe(true);
    // OCR restamp (§23): mangled bytes gone, readable prose in.
    expect(row.description).toContain('of a galeb duhr');
    expect(row.description).toContain('concentrating on a spell');
    expect(row.description).not.toContain('ofa');
    expect(row.description).not.toContain('spel1');
    // Galib variant framing kept distinct from galeb-duhr's text.
    expect(row.description).toContain('up to two boulders');
    expect(row.description).not.toBe(galebDuhr.actions[1].description);
  });

  it('chance-less summon is guaranteed: adjudication never flips a d100', () => {
    const rollFn = vi.fn(() => 50);
    expect(adjudicateSummonAttempt(ANIMATE_ROW.automation.options, rollFn)).toMatchObject({ monster: 'galeb-duhr', roll: null, success: true, chance: null });
    expect(rollFn).not.toHaveBeenCalled();
  });
});

describe('MA-0757 constant-count self-summon resolution', () => {
  function makeGalebDeps(cs, uses = {}) {
    const deps = makeDeps({ cs, uses });
    deps.monsters = [galebDuhr];
    deps.rollExpression = vi.fn(() => ({ total: 99, rolls: [99], modifier: 99, formula: 'must-not-roll' }));
    return deps;
  }

  const DUHR_CS = () => ({ round: 1, creatures: [{ name: 'Galeb Duhr 1', type: 'npc', monsterIndex: 'galeb-duhr', initiative: '10', currentHp: 95, maxHp: 95 }] });

  it('spawns TWO boulders (constant count, ZERO dice rolled) right after the duhr; each lacks Animate Boulders, Int/Cha 1 stamped, te @1_minutes; no coin-flip log; summons+ability_use logged', async () => {
    const deps = makeGalebDeps(DUHR_CS());
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: ANIMATE_ROW,
      monsterName: 'Galeb Duhr 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(result).toMatchObject({ resolved: true, countRoll: null, remaining: 0 });
    expect(result.summonedNames).toEqual(['Galeb Duhr', 'Galeb Duhr 2']);
    const boulders = deps.store.cs.creatures.filter(c => c.name !== 'Galeb Duhr 1');
    expect(boulders.map(c => c.name)).toEqual(['Galeb Duhr', 'Galeb Duhr 2']);
    for (const b of boulders) {
      expect(b).toMatchObject({ type: 'npc', monsterIndex: 'galeb-duhr', summonedBy: 'Galeb Duhr 1', summonSource: 'monster_ability', ac: 16, maxHp: 123, currentHp: 123, initiative: '9.9' });
      expect(b.ability_scores).toMatchObject({ str: 20, dex: 14, con: 20, int: 1, wis: 12, cha: 1 });
      expect(b.actions.map(a => a.name)).toEqual(['Avalanche Slam']);
      expect(b.actions.some(a => a.automation?.type === 'monster_summon')).toBe(false);
    }
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(2);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Galeb Duhr', 'summoned', 'Galeb Duhr 1', { duration: '1_minutes' });
    expect(deps.store.uses).toEqual({ 'Animate Boulders': 1 });
    expect(deps.logs.some(e => e.rollType === 'monster_summon_coin_flip')).toBe(false);
    const spawnLog = deps.logs.find(e => e.type === 'summons');
    expect(spawnLog.summonedCreatures).toEqual(['Galeb Duhr', 'Galeb Duhr 2']);
    expect(spawnLog.summonCount).toBe(2);
    expect(spawnLog.description).toContain('60 ft');
    expect(spawnLog.description).toContain('remain 1 minutes');
    const spendLog = deps.logs.find(e => e.type === 'ability_use');
    expect(spendLog.description).toContain('Animate Boulders');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Galeb Duhr'));
  });

  it('MA-0648 twin byte-unchanged: chance row still flips and coin-flip log still lands', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Drow Mage 1', type: 'npc', initiative: '12' }] } }, 42);
    await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Drow Mage 1',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: {},
      deps,
    });
    expect(deps.rollDie).toHaveBeenCalledTimes(1);
    expect(deps.logs.some(e => e.rollType === 'monster_summon_coin_flip')).toBe(true);
  });

  it('1/Day gate: refire refused with animate_boulders_refused, zero spend/spawn/te', async () => {
    const deps = makeGalebDeps(DUHR_CS(), { 'Animate Boulders': 1 });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: ANIMATE_ROW,
      monsterName: 'Galeb Duhr 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: { 'Animate Boulders': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.store.cs.creatures).toHaveLength(1);
    expect(deps.logs.find(e => e.automationType === 'animate_boulders_refused')).toBeTruthy();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Uses Exhausted'));
  });
});

// MA-0759: Galib Duhr "Animate Boulders" (actions[1]) — galeb-duhr twin
// riding the same MA-0757 extensions verbatim: chance-less guaranteed
// summon, constant count 2 ("up to two" authored as the adjudicable max,
// zero dice), option-level stat_override {int:1, cha:1}, and the
// self-summon guard stripping monster_summon actions from the boulders
// ("lacks this action", RAW — boulders can never chain-animate).
const galibDuhr = monstersData.find(m => m.index === 'galib-duhr');
const GALIB_ANIMATE_ROW = galibDuhr.actions[1];

describe('MA-0759 galib-duhr constant-count self-summon resolution', () => {
  function makeGalibDeps(cs, uses = {}) {
    const deps = makeDeps({ cs, uses });
    deps.monsters = [galibDuhr];
    deps.rollExpression = vi.fn(() => ({ total: 99, rolls: [99], modifier: 99, formula: 'must-not-roll' }));
    return deps;
  }

  const GALIB_CS = () => ({ round: 1, creatures: [{ name: 'Galib Duhr 1', type: 'npc', monsterIndex: 'galib-duhr', initiative: '10', currentHp: 85, maxHp: 85 }] });

  it('spawns TWO boulders (constant count, ZERO dice rolled) right after the duhr; each lacks Animate Boulders, Int/Cha 1 stamped, te @1_minutes; no coin-flip log; summons+ability_use logged', async () => {
    const deps = makeGalibDeps(GALIB_CS());
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: GALIB_ANIMATE_ROW,
      monsterName: 'Galib Duhr 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(result).toMatchObject({ resolved: true, countRoll: null, remaining: 0 });
    expect(result.summonedNames).toEqual(['Galib Duhr', 'Galib Duhr 2']);
    const boulders = deps.store.cs.creatures.filter(c => c.name !== 'Galib Duhr 1');
    expect(boulders.map(c => c.name)).toEqual(['Galib Duhr', 'Galib Duhr 2']);
    for (const b of boulders) {
      expect(b).toMatchObject({ type: 'npc', monsterIndex: 'galib-duhr', summonedBy: 'Galib Duhr 1', summonSource: 'monster_ability', ac: 16, maxHp: 85, currentHp: 85, initiative: '9.9' });
      expect(b.ability_scores).toMatchObject({ str: 20, dex: 14, con: 20, int: 1, wis: 12, cha: 1 });
      expect(b.actions.map(a => a.name)).toEqual(['Slam']);
      expect(b.actions.some(a => a.automation?.type === 'monster_summon')).toBe(false);
    }
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(2);
    expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'Galib Duhr', 'summoned', 'Galib Duhr 1', { duration: '1_minutes' });
    expect(deps.store.uses).toEqual({ 'Animate Boulders': 1 });
    expect(deps.logs.some(e => e.rollType === 'monster_summon_coin_flip')).toBe(false);
    const spawnLog = deps.logs.find(e => e.type === 'summons');
    expect(spawnLog.summonedCreatures).toEqual(['Galib Duhr', 'Galib Duhr 2']);
    expect(spawnLog.summonCount).toBe(2);
    expect(spawnLog.description).toContain('60 ft');
    expect(spawnLog.description).toContain('remain 1 minutes');
    const spendLog = deps.logs.find(e => e.type === 'ability_use');
    expect(spendLog.description).toContain('Animate Boulders');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Galib Duhr'));
  });

  it('1/Day gate: refire refused with animate_boulders_refused, zero spend/spawn/te', async () => {
    const deps = makeGalibDeps(GALIB_CS(), { 'Animate Boulders': 1 });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: GALIB_ANIMATE_ROW,
      monsterName: 'Galib Duhr 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: { 'Animate Boulders': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.store.cs.creatures).toHaveLength(1);
    expect(deps.logs.find(e => e.automationType === 'animate_boulders_refused')).toBeTruthy();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Uses Exhausted'));
  });
});
