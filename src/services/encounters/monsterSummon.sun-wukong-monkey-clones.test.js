// @maintained-by-ai
// MA-2009 lane: Sun Wukong "Pluck a Hair (1/Day)" (actions[3]) — monster_summon
// riding the MA-0757 constant-count axis: numeric CONSTANT count 4 (zero count
// dice), chance-less guaranteed spawn (no d100 flip, no coin-flip log) of the
// authored conjured-token block "monkey-clone" @60 ft; duration_minutes:10 IS
// authored on disk ⇒ te summoned @'10_minutes' verbatim (§70 honesty: zones
// enforcement is OFF in this harness, so the legacy expiry advisory rides the
// log and NO clock is armed — a seam, never a wall-clock countdown).
// Wukong-distinct bytes owned here: count 4 BY NAME, the monkey-clone token
// block (AC 18 / HP 30 / Slam +14 2d8+2 — monsterEpicCohort.test.js header
// explicitly cedes these to this lane), the "(1/Day)"-suffix stripped useKey
// 'Pluck a Hair' + refusal slug `pluck_a_hair_refused`, and the one-hit-death
// quirk ("A clone dies when it takes damage") — disk advisory ONLY: the
// resolver stamps standard 30-HP tokens and never automates the insta-death.
//
// CITATION TABLE (this lane holds ONLY its row's bytes; generics cited, not re-driven):
//  - isMonsterSummonRow + coin-flip boundary/fallback generics: CANON
//    monsterSummon.test.js :75-101 — cited (wukong's chance-less guaranteed
//    verdict carries no flip: the same guarantee the galeb-duhr twin proves at
//    :546-550) — never re-driven here, only this row's own instance below;
//  - constant-count ZERO-dice multi-spawn + te + ONE summons log: CANON
//    monsterSummon.test.js :553-598 (galeb-duhr count-2 twin) — cited; the
//    fresh press below keeps only this row's distinct values (count 4, foreign
//    token block, bystander survivor census, 10_minutes authored duration);
//  - 1/Day exhausted refusal byte-shape: CANON monsterSummon.test.js :153-173;
//    uses-gate/spend/useKey-strip CANON monsterAbilityUses.test.js (#1082) —
//    cited. The press below stays ONLY for wukong's own stripped useKey: row
//    name 'Pluck a Hair (1/Day)' gates as 'Pluck a Hair', so that key and
//    `pluck_a_hair_refused` are this row's own vocabulary (#1154 orcus precedent:
//    suffixed-name rows keep their own exhausted press);
//  - summon registry/despawn/lifecycle: summonedCreatureService.test.js
//    (#1067 CLOSED owner) — cited, lifecycle not re-driven here.
//
// OLD -> NEW MAP:
//  disk row shape ................. test 1 (strengthened: exact row name + usage +
//                                          full-automation toEqual proves constant 4
//                                          and no fabricated advisory/stat_override/
//                                          CR-cap fields, quirk description bytes)
//  monkey-clone token block ....... folded into test 1 (target transported by name —
//                                          the one place the epic cohort says this lane
//                                          owns the token AC/HP/attack bytes)
//  success press ................... test 2 (strengthened: exact 4 names BY NAME,
//                                          initiative 17.9 seam-pinned to the fixed
//                                          board, Slam carried, te @10_minutes x4,
//                                          ZERO dice loud-throw guards, no coin-flip
//                                          log, NO clock armed, popup + bystander
//                                          survivor census)
//  exhausted press ............... test 3 (slimmed per #1154 rec to the zero-write
//                                          census + this row's own stripped-key slug)
import { describe, it, expect, vi } from 'vitest';
import {
  isMonsterSummonRow,
  resolveMonsterSummonRow,
} from './monsterSummon.js';
import monstersData from '../../../public/data/monsters.json';

const wukong = monstersData.find(m => m.index === 'sun-wukong');
const SUMMON_ROW = wukong.actions.find(a => a.name.startsWith('Pluck a Hair'));
const clone = monstersData.find(m => m.index === 'monkey-clone');

const CS = () => ({ round: 1, creatures: [
  { name: 'Sun Wukong', type: 'npc', monsterIndex: 'sun-wukong', initiative: '18', currentHp: 400, maxHp: 400 },
  { name: 'Bandit', type: 'npc', initiative: '11', currentHp: 999, maxHp: 999, ac: 12 },
] });

function makeDeps(stored = {}) {
  const store = { logs: [], ...stored };
  return {
    store,
    // Loud decoys: a chance-less, constant-count row must NEVER touch a die.
    rollDie: vi.fn(() => { throw new Error('chance-less summon must never flip a d100'); }),
    rollExpression: vi.fn(() => { throw new Error('count dice must not roll for a constant count'); }),
    monsters: [clone],
    skipDomEvents: true,
    getCombatSummary: vi.fn(() => store.cs),
    setCombatSummary: vi.fn(cs => { store.cs = cs; }),
    registerTargetEffect: vi.fn(),
    getRuntimeValue: vi.fn(() => ({})),
    setRuntimeValue: vi.fn((c, k, v) => { store.uses = v; return Promise.resolve(); }),
    addEntry: vi.fn((c, entry) => { store.logs.push(entry); return Promise.resolve(); }),
    get logs() { return store.logs; },
  };
}

describe('MA-2009 disk data shape', () => {
  it('row bytes: constant count 4 of monkey-clone tokens @60 ft, authored 10-minute duration, numeric 1/Day; full-automation toEqual proves no fabricated fields; clone token + one-hit-death quirk by name', () => {
    expect(SUMMON_ROW.name).toBe('Pluck a Hair (1/Day)');
    expect(isMonsterSummonRow(SUMMON_ROW)).toBe(true);
    expect(SUMMON_ROW.uses).toBe(1);
    expect(SUMMON_ROW.maxUses).toBe(1);
    expect(SUMMON_ROW.usage).toEqual({ type: 'per day', times: 1 });
    expect(SUMMON_ROW.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: 'monkey-clone' }],
      count: 4,
      range_ft: 60,
      duration_minutes: 10,
    });
    expect(SUMMON_ROW.description).toContain('Four monkey clones');
    expect(SUMMON_ROW.description).toContain('A clone dies when it takes damage');
    // Token block owned by this lane (monsterEpicCohort.test.js header).
    expect(clone.name).toBe('Monkey Clone');
    expect({ ac: clone.armor_class, hp: clone.hit_points }).toEqual({ ac: 18, hp: 30 });
    expect(clone.actions[0]).toMatchObject({
      name: 'Slam',
      attack_bonus: 14,
      damage_dice_primary: '2d8 + 2',
      damage_type_primary: 'Bludgeoning',
    });
  });
});

describe('MA-2009 press resolution', () => {
  it('fresh press: spends 1/Day under stripped key "Pluck a Hair", ZERO dice, spawns exactly 4 Monkey Clone tokens (exact names, block bytes, acting right after Wukong @17.9, Slam carried), te summoned @10_minutes x4, ONE summons log with the authored duration, no coin-flip log, NO clock armed, bystander untouched', async () => {
    const deps = makeDeps({ cs: CS() });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Sun Wukong',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toMatchObject({ resolved: true, countRoll: null, verdict: { monster: 'monkey-clone', roll: null, success: true }, remaining: 0 });
    // getNextUniqueMonsterName seam: empty-board base name, then numeric
    // suffixes from 1 (no numbered Wukong-namesake pins maxNum higher —
    // contrast the base mephit :426-428 maxNum=1 quirk).
    expect(result.summonedNames).toEqual(['Monkey Clone', 'Monkey Clone 1', 'Monkey Clone 2', 'Monkey Clone 3']);
    for (const name of result.summonedNames) {
      const spawned = deps.store.cs.creatures.find(c => c.name === name);
      expect(spawned).toMatchObject({ type: 'npc', monsterIndex: 'monkey-clone', ac: 18, maxHp: 30, currentHp: 30, summonedBy: 'Sun Wukong', summonSource: 'monster_ability', initiative: '17.9' });
      expect(spawned.actions.map(a => a.name)).toEqual(['Slam']);
      expect(deps.registerTargetEffect).toHaveBeenCalledWith('test-campaign', name, 'summoned', 'Sun Wukong', { duration: '10_minutes' });
    }
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(4);
    expect(deps.store.uses).toEqual({ 'Pluck a Hair': 1 });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.logs.some(e => e.rollType === 'monster_summon_coin_flip')).toBe(false);
    expect(deps.logs.some(e => e.automationType === 'duration_clock_armed')).toBe(false);
    const spawnLogs = deps.logs.filter(e => e.type === 'summons');
    expect(spawnLogs).toHaveLength(1);
    expect(spawnLogs[0]).toMatchObject({ summonCount: 4, countRoll: null });
    expect(spawnLogs[0].summonedCreatures).toEqual(result.summonedNames);
    expect(spawnLogs[0].description).toContain('60 ft');
    expect(spawnLogs[0].description).toContain('remain 10 minutes');
    const spendLog = deps.logs.find(e => e.type === 'ability_use');
    expect(spendLog.description).toContain('Pluck a Hair');
    expect(spendLog.description).toContain('0 left today');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Monkey Clone'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('4 copies join'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('for 10 minutes'));
    const bandit = deps.store.cs.creatures.find(c => c.name === 'Bandit');
    expect(bandit).toMatchObject({ currentHp: 999, initiative: '11' });
    expect(deps.store.cs.creatures).toHaveLength(6);
  });

  it('exhausted press: refused via wukong\'s own stripped useKey (row name "Pluck a Hair (1/Day)" gates as "Pluck a Hair") — pluck_a_hair_refused + Uses Exhausted popup, zero-write census', async () => {
    const deps = makeDeps({ cs: CS(), uses: { 'Pluck a Hair': 1 } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Sun Wukong',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: { 'Pluck a Hair': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.store.cs.creatures).toHaveLength(2);
    expect(deps.store.uses).toEqual({ 'Pluck a Hair': 1 });
    const refusal = deps.logs.find(e => e.automationType === 'pluck_a_hair_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toContain('already used Pluck a Hair today');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Uses Exhausted'));
  });
});
