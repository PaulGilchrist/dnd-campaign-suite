// @maintained-by-ai
// MA-1957 lane: Orcus "Conjure Undead (1/Day)" (actions[4]) — monster_summon with
// a 25% wight attempt, chance-less skeleton fallback (zombie is a third, never-
// picked option — the resolver takes the FIRST chance-less option), count dice
// "1d4+1", 300 ft range, and NO duration_minutes: RAW "until destroyed or
// dismissed" rides the authored 500-HP-cap advisory verbatim (§70, never a
// fabricated clock; #1134 duration-kind honesty — GM-enforced, no wall-clock).
//
// CITATION TABLE (this lane holds ONLY its row's bytes + the family-unique stack):
//  - isMonsterSummonRow / coin-flip boundary + fallback adjudication generics:
//    CANON monsterSummon.test.js :75-101 (+ the identical 25/26 boundary at
//    :383-386) — cited, not re-driven; verdicts here land only via the real
//    resolver in the press tests below;
//  - 1/Day exhausted refusal + refusal popup/log byte-shape: CANON
//    monsterSummon.test.js :153-173; uses-gate/spend/useKey-strip CANON
//    monsterAbilityUses.test.js (#1082) — cited. The press below stays ONLY for
//    the family-unique stripped useKey: Orcus is the one summon row whose name
//    carries a "(1/Day)" suffix, so gate key 'Conjure Undead' ≠ row name and
//    refusal slug `conjure_undead_refused` are this row's own vocabulary;
//  - count-dice-after-flip + unique-name multi-spawn + one-summons-log: CANON
//    monsterSummon.test.js :412-447 — cited;
//  - no-duration_rows advisory verbatim, never "10 minutes": MA-1215 sovereign
//    :810-817 / MA-1729 wraith :1064-1072 own the duration-kind bytes via the
//    resolve path — cited (standalone buildSummonSpawnLog unit deleted).
//  - summon registry/despawn/lifecycle: summonedCreatureService.test.js
//    (#1067 CLOSED owner) — cited, lifecycle not re-driven here;
//  - "Conjure Undead (1/Day)" row-name legendary-axis inertness:
//    monsterLegendaryUses.ma1962-orcus-creeping-death-advisory.test.js :116 —
//    different axis; constant-count twin axis: sun-wukong lane (MA-2009).
//
// OLD -> NEW MAP:
//  disk data shape ....................... test 1 (strengthened: full options incl.
//                                          zombie + order, key census, advisory,
//                                          targets by-name ac/hp — old "full blocks"
//                                          trawls folded in)
//  adjudicate ≤25 / >25 unit tests ...... deleted (base CANON, see table); driven
//                                          through the real resolver by tests 2 + 3
//  success press ......................... test 2 (strengthened: te gm_adjudicated,
//                                          wight block ac/hp folded, remaining 0,
//                                          count note in popup, zero clock armed)
//  buildSummonSpawnLog advisory unit ... deleted (MA-1215/MA-1729 own the leg;
//                                          test 2 keeps this lane's instance)
//  second-click exhausted ............... test 4 (keeps row-unique useKey-strip)
//  NEW test 3 ...................... failed flip d100 26 lands the chance-less
//                                          fallback WITH count dice — the ONE
//                                          chance+count stack no sibling resolves
//                                          (drow mage: fallback no count; mephit:
//                                          count no fallback) — skeletons spawn.
import { describe, it, expect, vi } from 'vitest';
import {
  isMonsterSummonRow,
  resolveMonsterSummonRow,
} from './monsterSummon.js';
import monstersData from '../../../public/data/monsters.json';

const orcus = monstersData.find(m => m.index === 'orcus');
const SUMMON_ROW = orcus.actions.find(a => a.name.startsWith('Conjure Undead'));
const wight = monstersData.find(m => m.index === 'wight');
const skeleton = monstersData.find(m => m.index === 'skeleton');
const zombie = monstersData.find(m => m.index === 'zombie');

function makeDeps(stored = {}, roll = 20) {
  const store = { logs: [], ...stored };
  return {
    store,
    rollDie: vi.fn(() => roll),
    rollExpression: vi.fn(() => ({ total: 3, rolls: [2, 1], formula: '1d4+1' })),
    monsters: [wight, skeleton, zombie],
    skipDomEvents: true,
    getCombatSummary: vi.fn(() => store.cs),
    setCombatSummary: vi.fn(cs => { store.cs = cs; }),
    registerTargetEffect: vi.fn(),
    getRuntimeValue: vi.fn(() => store.uses || {}),
    setRuntimeValue: vi.fn((c, k, v) => { store.uses = v; return Promise.resolve(); }),
    addEntry: vi.fn((c, entry) => { store.logs.push(entry); return Promise.resolve(); }),
    get logs() { return store.logs; },
  };
}

describe('MA-1957 disk data shape', () => {
  it('row bytes: 25% wight + skeleton/zombie options in order, 1d4+1 @300 ft, uses 1/Day, key census proves no fabricated duration, advisory carries the 500 HP cap; targets transported by name', () => {
    expect(SUMMON_ROW.name).toBe('Conjure Undead (1/Day)');
    expect(isMonsterSummonRow(SUMMON_ROW)).toBe(true);
    expect(SUMMON_ROW.uses).toBe(1);
    expect(SUMMON_ROW.maxUses).toBe(1);
    expect(SUMMON_ROW.usage).toEqual({ type: 'per day', times: 1 });
    expect(Object.keys(SUMMON_ROW.automation)).toEqual(['type', 'options', 'count', 'range_ft', 'advisory']);
    expect(SUMMON_ROW.automation.type).toBe('monster_summon');
    expect(SUMMON_ROW.automation.options).toEqual([
      { monster: 'wight', chance: 0.25 },
      { monster: 'skeleton' },
      { monster: 'zombie' },
    ]);
    expect(SUMMON_ROW.automation.count).toBe('1d4+1');
    expect(SUMMON_ROW.automation.range_ft).toBe(300);
    expect(SUMMON_ROW.automation.duration_minutes).toBeUndefined();
    expect(SUMMON_ROW.automation.advisory).toContain('500');
    expect(SUMMON_ROW.automation.advisory).toContain('destroyed or dismissed');
    expect({ ac: wight.armor_class, hp: wight.hit_points }).toEqual({ ac: 14, hp: 82 });
    expect({ ac: skeleton.armor_class, hp: skeleton.hit_points }).toEqual({ ac: 14, hp: 13 });
    expect(zombie.hit_points).toBeGreaterThan(0);
  });
});

describe('MA-1957 press resolution', () => {
  it('fresh press, d100 12 ≤ 25: spends 1/Day, count dice AFTER the flip, spawns 3 Wights from the disk block right after Orcus, te summoned @gm_adjudicated, logs + popup carry the advisory never a fabricated clock', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Orcus', type: 'npc', initiative: '10' }] } }, 12);
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Orcus',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toMatchObject({ resolved: true, verdict: { monster: 'wight', roll: 12, success: true, chance: 0.25 }, countRoll: { total: 3 }, remaining: 0 });
    expect(result.summonedNames).toHaveLength(3);
    for (const name of result.summonedNames) {
      const spawned = deps.store.cs.creatures.find(c => c.name === name);
      expect(spawned).toMatchObject({ type: 'npc', monsterIndex: 'wight', ac: 14, maxHp: 82, currentHp: 82, summonedBy: 'Orcus', summonSource: 'monster_ability' });
      expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', name, 'summoned', 'Orcus', { duration: 'gm_adjudicated' });
    }
    expect(deps.store.uses).toEqual({ 'Conjure Undead': 1 });
    expect(deps.logs.find(e => e.rollType === 'monster_summon_coin_flip').description).toContain('d100 12 vs 25%');
    const spawnLogs = deps.logs.filter(e => e.type === 'summons');
    expect(spawnLogs).toHaveLength(1);
    expect(spawnLogs[0].summonedCreatures).toEqual(result.summonedNames);
    expect(spawnLogs[0].description).toContain('1d4+1 rolled 3');
    expect(spawnLogs[0].description).toContain('300 ft');
    expect(spawnLogs[0].description).toContain('500');
    expect(spawnLogs[0].description).not.toContain('minutes (expiry clock');
    expect(deps.logs.some(e => e.automationType === 'duration_clock_armed')).toBe(false);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Wight'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Count: 1d4+1 rolled 3'));
  });

  it('failed flip d100 26 > 25: chance-less fallback resolves with count dice — 3 Skeletons (disk block) spawn, ZERO Wights, flip logged honestly, 1/Day still spent', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Orcus', type: 'npc', initiative: '10' }] } }, 26);
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Orcus',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toMatchObject({ resolved: true, verdict: { monster: 'skeleton', roll: 26, success: false }, countRoll: { total: 3 }, remaining: 0 });
    expect(result.summonedNames).toHaveLength(3);
    for (const name of result.summonedNames) {
      const spawned = deps.store.cs.creatures.find(c => c.name === name);
      expect(spawned).toMatchObject({ type: 'npc', monsterIndex: 'skeleton', ac: 14, maxHp: 13, currentHp: 13, summonedBy: 'Orcus', summonSource: 'monster_ability' });
      expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', name, 'summoned', 'Orcus', { duration: 'gm_adjudicated' });
    }
    expect(deps.store.cs.creatures.some(c => c.monsterIndex === 'wight')).toBe(false);
    expect(deps.store.uses).toEqual({ 'Conjure Undead': 1 });
    expect(deps.logs.find(e => e.rollType === 'monster_summon_coin_flip').description).toContain('failure, falls back to skeleton');
    expect(deps.logs.find(e => e.type === 'summons').description).toContain('1d4+1 rolled 3');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Skeleton'));
  });

  it('exhausted press: refused via the family-unique stripped useKey (row name "Conjure Undead (1/Day)" gates as "Conjure Undead") — conjure_undead_refused, zero roll/count/spend/spawn/te', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Orcus', initiative: '10' }] }, uses: { 'Conjure Undead': 1 } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Orcus',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: { 'Conjure Undead': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.store.cs.creatures).toHaveLength(1);
    expect(deps.logs.find(e => e.automationType === 'conjure_undead_refused')).toBeTruthy();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Uses Exhausted'));
  });
});
