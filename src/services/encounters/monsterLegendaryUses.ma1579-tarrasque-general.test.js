// MA-1579: Tarrasque legendary_actions[0] "General" header authors uses:3
// (adult-blue-dracolich MA-0050 byte-twin, §MA-1456/§MA-1494 header+counter+
// spend-gate fingerprint). Pre-fix the row had NO numeric uses →
// legendaryHeaderAction null → no .mc-legendary-header-row counter and the
// Attack/Move/Chomp children rendered ungated plain text. Sanctioned cosmetic
// housekeeping same-pass: "ofanother creature's turn" → "of another creature's
// turn" in THIS row only (the dracolich twin keeps its bytes untouched).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  legendaryHeaderAction,
  legendaryMaxUses,
  legendaryUsesRemaining,
  legendaryExpendGate,
  expendLegendaryUse,
  regainLegendaryUses,
} from './monsterLegendaryUses.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const tarrasque = monstersData.find(m => m.index === 'tarrasque');
const dracolich = monstersData.find(m => m.index === 'adult-blue-dracolich');

describe('MA-1579 monsters.json data: Tarrasque "General" header authors uses:3', () => {
  it('legendary_actions[0] is the General header with uses 3 at the dracolich byte position', () => {
    const header = tarrasque.legendary_actions[0];
    const keys = Object.keys(header);
    expect(keys).toEqual(['name', 'uses', 'description']);
    expect(header.name).toBe('General');
    expect(header.uses).toBe(3);
  });

  it('sanctioned cosmetic fix: description carries "of another creature\'s turn" (spacing typo closed)', () => {
    expect(tarrasque.legendary_actions[0].description).toContain('only at the end of another creature\'s turn');
    expect(tarrasque.legendary_actions[0].description).not.toContain('ofanother');
    // RAW advisory text kept: count 3 + regain clause byte-carry the fix row.
    expect(tarrasque.legendary_actions[0].description).toContain('can take 3 legendary actions');
    expect(tarrasque.legendary_actions[0].description).toContain('regains spent legendary actions at the start of its turn');
  });

  it('legendaryHeaderAction arms: header resolves with uses 3 (was null pre-fix)', () => {
    const header = legendaryHeaderAction(tarrasque);
    expect(header?.name).toBe('General');
    expect(header?.uses).toBe(3);
    expect(legendaryMaxUses(header, {})).toBe(3);
    expect(legendaryUsesRemaining(header, {})).toBe(3);
  });

  it('children are intact and un-gated per row: Attack, Move, Chomp (Costs 2 Actions) — no per-child uses (§165)', () => {
    const la = tarrasque.legendary_actions;
    expect(la.map(a => a.name)).toEqual(['General', 'Attack', 'Move', 'Chomp (Costs 2 Actions)']);
    const chomp = la.find(a => a.name === 'Chomp (Costs 2 Actions)');
    expect(chomp.description).toBe('The tarrasque makes one bite attack or uses its Swallow.');
    expect(chomp.uses).toBeUndefined();
    for (const child of la.slice(1)) {
      expect(child.uses).toBeUndefined();
    }
  });

  it('dracolich sibling byte-locked: General header untouched, its "ofanother" twin byte preserved', () => {
    const header = dracolich.legendary_actions[0];
    expect(Object.keys(header)).toEqual(['name', 'uses', 'description']);
    expect(header.name).toBe('General');
    expect(header.uses).toBe(3);
    expect(header.description).toContain('only at the end ofanother creature\'s turn');
    expect(header.description).toContain('The dracolich can take 3 legendary actions');
  });
});

describe('MA-1579 Tarrasque legendary spend economy is live', () => {
  let store;
  let logs;
  let deps;
  let cs;
  beforeEach(() => {
    store = {};
    logs = [];
    cs = { round: 1, activeCreatureName: 'Bandit 1' };
    deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      getCombatContext: vi.fn(() => Promise.resolve(cs)),
    };
  });

  it('gate arms after another creature\'s turn and spends 3→2→1→0', async () => {
    const first = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Attack', campaignName: 'test-campaign', deps });
    expect(first).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });

    const sameBoundary = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Move', campaignName: 'test-campaign', deps });
    expect(sameBoundary.spent).toBe(false);
    expect(sameBoundary.reason).toBe('turn');

    cs.activeCreatureName = 'Bandit 2';
    await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Move', campaignName: 'test-campaign', deps });
    cs.activeCreatureName = 'ElderPaladin';
    const third = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Chomp (Costs 2 Actions)', campaignName: 'test-campaign', deps });
    expect(third).toEqual({ spent: true, remaining: 0, max: 3 });
    const spend = logs.filter(e => e.type === 'ability_use');
    expect(spend[0].description).toMatch(/expends a legendary use for Attack .* 2 of 3 left/);
  });

  it('exhausted press refuses: exhausted reason + legendary_use_refused log, zero spend', async () => {
    store['Tarrasque 1.monsterLegendaryUses'] = { max: 3, used: 3 };
    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Attack', campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(false);
    expect(r.reason).toBe('exhausted');
    expect(r.popupHtml).toMatch(/has no legendary uses left/);
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(logs.some(e => e.automationType === 'legendary_use_refused')).toBe(true);
  });

  it('own-turn press refuses: own-turn reason, zero spend', async () => {
    cs.activeCreatureName = 'Tarrasque 1';
    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Attack', campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(false);
    expect(r.reason).toBe('own-turn');
    expect(r.popupHtml).toMatch(/after ANOTHER creature's turn, not its own/);
    expect(store['Tarrasque 1.monsterLegendaryUses']).toBeUndefined();
  });

  it('own turn-start regain refills the pool to max 3', async () => {
    await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Attack', campaignName: 'test-campaign', deps });
    const regain = await regainLegendaryUses({ monsterName: 'Tarrasque 1', campaignName: 'test-campaign', deps });
    expect(regain).toEqual({ regained: true, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses'].used).toBe(0);
    cs.activeCreatureName = 'Bandit 1';
    const after = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Attack', campaignName: 'test-campaign', deps });
    expect(after.remaining).toBe(2);
  });

  it('legendaryExpendGate fingerprint: no stored uses yet → allowed 3; latch tokens exhausted/own-turn/turn (§MA-1456)', () => {
    const header = legendaryHeaderAction(tarrasque);
    expect(legendaryExpendGate({ header, storedUses: {}, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Tarrasque 1', latch: null }))
      .toEqual({ allowed: true, remaining: 3, max: 3 });
    expect(legendaryExpendGate({ header, storedUses: { max: 3, used: 3 }, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Tarrasque 1', latch: null }).reason).toBe('exhausted');
    expect(legendaryExpendGate({ header, storedUses: { max: 3, used: 1 }, round: 1, activeCreatureName: 'Tarrasque 1', monsterName: 'Tarrasque 1', latch: null }).reason).toBe('own-turn');
    expect(legendaryExpendGate({ header, storedUses: { max: 3, used: 1 }, round: 2, activeCreatureName: 'Bandit 1', monsterName: 'Tarrasque 1', latch: { round: 2, activeCreature: 'Bandit 1' } }).reason).toBe('turn');
  });
});
