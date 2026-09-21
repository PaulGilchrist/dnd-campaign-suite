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
    expect(result).toEqual({ resolved: true, summonedName: 'Shadow Demon', verdict: { monster: 'shadow-demon', roll: 42, success: true, chance: 0.5 }, remaining: 0 });
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
    const log = buildSummonSpawnLog({ monsterName: 'Drow Mage 1', action: SUMMON_ROW, summonedName: 'Quasit 1', durationMinutes: 10 });
    expect(log.summonedCreatures).toEqual(['Quasit 1']);
    const flipLog = buildSummonCoinFlipLog({ monsterName: 'Drow Mage 1', action: SUMMON_ROW, verdict: { monster: 'quasit', roll: 77, success: false, chance: 0.5 } });
    expect(flipLog.total).toBe(77);
  });
});
