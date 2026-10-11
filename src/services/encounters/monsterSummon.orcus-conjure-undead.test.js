// MA-1957: Orcus "Conjure Undead" (actions[4]) — monster_summon
// automation with a chance-bearing wight attempt, skeleton fallback, dice count
// (1d4+1), 300 ft. range, and NO duration_minutes (RAW "until destroyed or
// dismissed"): the authored advisory carries the honest HP-cap clock (§70).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSummonRow,
  adjudicateSummonAttempt,
  resolveMonsterSummonRow,
  buildSummonSpawnLog,
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

beforeEach(() => { vi.clearAllMocks(); });

describe('MA-1957 disk data shape', () => {
  it('Conjure Undead authors monster_summon automation with count + advisory and no fake duration', () => {
    expect(isMonsterSummonRow(SUMMON_ROW)).toBe(true);
    expect(SUMMON_ROW.uses).toBe(1);
    expect(SUMMON_ROW.maxUses).toBe(1);
    expect(SUMMON_ROW.usage).toEqual({ type: 'per day', times: 1 });
    expect(SUMMON_ROW.automation.options[0]).toEqual({ monster: 'wight', chance: 0.25 });
    expect(SUMMON_ROW.automation.options).toContainEqual({ monster: 'skeleton' });
    expect(SUMMON_ROW.automation.count).toBe('1d4+1');
    expect(SUMMON_ROW.automation.range_ft).toBe(300);
    expect(SUMMON_ROW.automation.duration_minutes).toBeUndefined();
    expect(SUMMON_ROW.automation.advisory).toContain('500');
  });

  it('summon targets exist on disk with full blocks', () => {
    for (const m of [wight, skeleton, zombie]) {
      expect(m).toBeTruthy();
      expect(m.hit_points).toBeGreaterThan(0);
      expect(m.actions.length).toBeGreaterThan(0);
    }
  });
});

describe('MA-1957 adjudication', () => {
  it('d100 ≤ 25 lands the wight attempt', () => {
    const verdict = adjudicateSummonAttempt(SUMMON_ROW.automation.options, () => 25);
    expect(verdict).toMatchObject({ monster: 'wight', roll: 25, success: true, chance: 0.25 });
  });

  it('d100 > 25 fails the attempt and falls back to skeleton', () => {
    const verdict = adjudicateSummonAttempt(SUMMON_ROW.automation.options, () => 26);
    expect(verdict).toMatchObject({ monster: 'skeleton', roll: 26, success: false });
  });
});

describe('MA-1957 activation', () => {
  it('success: spends 1/Day, rolls 1d4+1 clones into cs as allies of Orcus, logs flip + spawn with advisory clock', async () => {
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
    expect(result.resolved).toBe(true);
    expect(result.verdict).toMatchObject({ monster: 'wight', success: true });
    expect(result.countRoll).toMatchObject({ total: 3 });
    expect(result.summonedNames).toHaveLength(3);
    expect(deps.store.uses).toEqual({ 'Conjure Undead': 1 });
    for (const name of result.summonedNames) {
      const spawned = deps.store.cs.creatures.find(c => c.name === name);
      expect(spawned).toMatchObject({ monsterIndex: 'wight', summonedBy: 'Orcus', summonSource: 'monster_ability' });
    }
    const spawnLog = deps.logs.find(e => e.type === 'summons');
    expect(spawnLog.description).toContain('1d4+1 rolled 3');
    expect(spawnLog.description).toContain('300 ft');
    expect(spawnLog.description).toContain('500');
    expect(spawnLog.description).not.toContain('minutes (expiry clock');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Wight'));
  });

  it('spawn log without duration_minutes carries the authored RAW advisory, never a fabricated clock', () => {
    const log = buildSummonSpawnLog({ monsterName: 'Orcus', action: SUMMON_ROW, summonedNames: ['Wight', 'Wight 1', 'Wight 2'], countRoll: { total: 3, rolls: [2, 1], formula: '1d4+1' }, durationMinutes: undefined });
    expect(log.description).toContain('1d4+1 rolled 3');
    expect(log.description).toContain('500');
    expect(log.description).not.toContain('minutes (expiry clock');
  });

  it('second same-day click: refused, zero roll/spend/spawn', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Orcus', initiative: '10' }] }, uses: { 'Conjure Undead': 1 } });
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Orcus',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: { 'Conjure Undead': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.rollDie).not.toHaveBeenCalled();
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
  });
});
