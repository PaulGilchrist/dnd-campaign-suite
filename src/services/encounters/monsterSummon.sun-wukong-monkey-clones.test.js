// MA-2009 cohort: Sun Wukong "Pluck a Hair" (actions[2]) — monster_summon
// with a numeric CONSTANT count (MA-0757 pattern: four copies, zero count
// dice rolled) of the authored conjured-token block "monkey-clone". 1/Day
// gate, 60 ft. range, 10-minute clock; clones exist only as a spawn block.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterSummonRow,
  resolveMonsterSummonRow,
} from './monsterSummon.js';
import monstersData from '../../../public/data/monsters.json';

const wukong = monstersData.find(m => m.index === 'sun-wukong');
const SUMMON_ROW = wukong.actions.find(a => a.name.startsWith('Pluck a Hair'));
const clone = monstersData.find(m => m.index === 'monkey-clone');

function makeDeps(stored = {}) {
  const store = { logs: [], ...stored };
  return {
    store,
    rollDie: vi.fn(() => 50),
    rollExpression: vi.fn(() => { throw new Error('count dice must not roll for a constant count'); }),
    monsters: [clone],
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

describe('MA-2009 disk data shape', () => {
  it('Pluck a Hair authors a constant-count monster_summon of monkey-clone tokens', () => {
    expect(isMonsterSummonRow(SUMMON_ROW)).toBe(true);
    expect(SUMMON_ROW.uses).toBe(1);
    expect(SUMMON_ROW.maxUses).toBe(1);
    expect(SUMMON_ROW.automation).toMatchObject({
      type: 'monster_summon',
      options: [{ monster: 'monkey-clone' }],
      count: 4,
      range_ft: 60,
      duration_minutes: 10,
    });
    expect(SUMMON_ROW.description).toContain('Four monkey clones');
  });

  it('monkey-clone token block matches the authored clone stats', () => {
    expect(clone).toBeTruthy();
    expect(clone.armor_class).toBe(18);
    expect(clone.hit_points).toBe(30);
    expect(clone.actions[0]).toMatchObject({
      name: 'Slam',
      attack_bonus: 14,
      damage_dice_primary: '2d8 + 2',
      damage_type_primary: 'Bludgeoning',
    });
  });
});

describe('MA-2009 activation', () => {
  it('spends 1/Day, spawns exactly 4 monkey-clone tokens, no count dice, logs the 10-minute clock', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Sun Wukong', type: 'npc', initiative: '18' }] } });
    const setPopupHtml = vi.fn();
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Sun Wukong',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result.resolved).toBe(true);
    expect(result.countRoll).toBeNull();
    expect(result.summonedNames).toHaveLength(4);
    expect(deps.store.uses).toEqual({ 'Pluck a Hair': 1 });
    for (const name of result.summonedNames) {
      const spawned = deps.store.cs.creatures.find(c => c.name === name);
      expect(spawned).toMatchObject({ monsterIndex: 'monkey-clone', ac: 18, maxHp: 30, currentHp: 30, summonedBy: 'Sun Wukong' });
    }
    const spawnLog = deps.logs.find(e => e.type === 'summons');
    expect(spawnLog.summonCount).toBe(4);
    expect(spawnLog.description).toContain('Monkey Clone');
    expect(spawnLog.description).toContain('10 minutes');
    expect(deps.rollExpression).not.toHaveBeenCalled();
  });

  it('second same-day click: exhausted refusal, zero spend/spawn', async () => {
    const deps = makeDeps({ cs: { round: 1, creatures: [{ name: 'Sun Wukong', initiative: '18' }] }, uses: { 'Pluck a Hair': 1 } });
    const result = await resolveMonsterSummonRow({
      action: SUMMON_ROW,
      monsterName: 'Sun Wukong',
      campaignName: 'test-campaign',
      setPopupHtml: vi.fn(),
      storedUses: { 'Pluck a Hair': 1 },
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.setCombatSummary).not.toHaveBeenCalled();
  });
});
