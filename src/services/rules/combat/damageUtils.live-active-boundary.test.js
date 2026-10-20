// @maintained-by-ai
// BUG (MA-1966 infra): getCombatContext PREFERRED the baked combatSummary.activeCreatureName
// over the live top-level activeCreatureName (patching only when absent), so the boundary
// stamp consumed by legendaryExpendGate froze mid-round and every fresh-boundary legendary
// press was honestly refused (turn)/own-turn. Fix: the LIVE top-level key wins whenever
// present (playbook §31 codifies it as truth); the baked field is the fallback.
// These tests pin the precedence AND chain it into expendLegendaryUse with the REAL
// getCombatContext (fetch stubbed, cs mirror deliberately stale). The generic gate
// truth-table and economy lifecycle live in monsterLegendaryUses.test.js — this lane
// owns ONLY the live-vs-baked boundary stamp.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { getCombatContext } from './damageUtils.js';
import { expendLegendaryUse } from '../../encounters/monsterLegendaryUses.js';

const MONSTER = {
  actions: [{ name: 'Rotting Fist', attack_bonus: 9, damage_dice_primary: '2d10 + 4', damage_type_primary: 'Bludgeoning' }],
  legendary_actions: [
    { name: 'Legendary Action Uses: 3', uses: 3, description: 'Immediately after another creature\'s turn…' },
    { name: 'Necrotic Strike', delegates_to: 'Rotting Fist', description: 'The mummy makes one Rotting Fist attack.' },
  ],
};

// Production-shaped change-data: initiative navigation writes the TOP-LEVEL
// activeCreatureName first at every Next/Prev step (initiative/navigationHandlers.js);
// the baked combatSummary only moves at round-wrap/resort writes — hence "stale".
function stubChangeData({ csActive, liveActive, round = 1 }) {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      // fresh object per fetch — getCombatContext mutates the returned summary
      combatSummary: { round, activeCreatureName: csActive, creatures: [{ name: 'Mummy Lord 1' }] },
      ...(liveActive !== undefined ? { activeCreatureName: liveActive } : {}),
    }),
  }));
}

describe('getCombatContext live-active precedence (MA-1966 infra)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('live top-level activeCreatureName WINS over the baked cs field, other fields intact', async () => {
    stubChangeData({ csActive: 'AasimarTest', liveActive: 'Disciplined_Monk', round: 3 });
    const cs = await getCombatContext('test-campaign');
    expect(cs.activeCreatureName).toBe('Disciplined_Monk');
    expect(cs.round).toBe(3);
    expect(cs.creatures).toEqual([{ name: 'Mummy Lord 1' }]);
  });

  it('baked cs field is the fallback with no live key; no combatSummary is null even with a live key', async () => {
    stubChangeData({ csActive: 'AasimarTest', liveActive: undefined });
    expect((await getCombatContext('test-campaign')).activeCreatureName).toBe('AasimarTest');

    // Guard short-circuit (combatSummary &&): a live key alone never fabricates a summary.
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ activeCreatureName: 'Ghost' }),
    }));
    expect(await getCombatContext('test-campaign')).toBeNull();
  });
});

describe('legendary gate chain over a stale cs mirror (MA-1966 infra)', () => {
  let store;
  let logs;
  let deps;

  beforeEach(() => {
    store = {};
    logs = [];
    deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      // REAL reader seam — only fetch is stubbed above.
      getCombatContext,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const press = (liveActive, { csActive, round = 1 } = {}) => {
    stubChangeData({ csActive, liveActive, round });
    return expendLegendaryUse({ monsterName: 'Mummy Lord 1', monster: MONSTER, actionName: 'Necrotic Strike (Rotting Fist attack)', campaignName: 'test-campaign', deps });
  };

  it('mid-round presses SPEND at each fresh boundary even though the cs mirror is frozen on the first creature', async () => {
    // Frozen mirror 'AasimarTest' for the WHOLE round (pre-fix: press #2+ refused 'turn').
    const first = await press('AberrantSorcerer', { csActive: 'AasimarTest' });
    expect(first.spent).toBe(true);
    expect(first.remaining).toBe(2);
    expect(store['Mummy Lord 1._legendaryUses_usedRound']).toEqual({ round: 1, activeCreature: 'AberrantSorcerer' });

    // Same boundary double-press still refuses honestly.
    const dup = await press('AberrantSorcerer', { csActive: 'AasimarTest' });
    expect(dup.spent).toBe(false);
    expect(dup.reason).toBe('turn');

    // Fresh boundaries: each SPENDS despite the frozen mirror.
    const second = await press('Disciplined_Monk', { csActive: 'AasimarTest' });
    expect(second.spent).toBe(true);
    expect(second.remaining).toBe(1);
    const third = await press('DivinationWizard', { csActive: 'AasimarTest' });
    expect(third.spent).toBe(true);
    expect(third.remaining).toBe(0);

    // Exhausted after 3 spends at 3 distinct boundaries — refusals preserved.
    const dry = await press('ElderPaladin', { csActive: 'AasimarTest' });
    expect(dry.spent).toBe(false);
    expect(dry.reason).toBe('exhausted');

    const spendLogs = logs.filter(e => e.type === 'ability_use');
    expect(spendLogs).toHaveLength(3);
    expect(logs.filter(e => e.automationType === 'legendary_use_refused')).toHaveLength(2);
  });

  it('own-turn refusal holds when ONLY the live key names the monster — the frozen mirror would have wrongly allowed the spend', async () => {
    // cs stays baked on 'AasimarTest'; the live tracker lands on the monster at round-wrap.
    // Pre-fix the stale 'AasimarTest' won the boundary stamp → legal spend; live-wins → own-turn.
    const own = await press('Mummy Lord 1', { csActive: 'AasimarTest', round: 2 });
    expect(own.spent).toBe(false);
    expect(own.reason).toBe('own-turn');
    expect(store['Mummy Lord 1.monsterLegendaryUses']).toBeUndefined();
    expect(store['Mummy Lord 1._legendaryUses_usedRound']).toBeUndefined();
    expect(logs.filter(e => e.automationType === 'legendary_use_refused')).toHaveLength(1);
  });
});
