// @maintained-by-ai
// MA-1579: Tarrasque legendary_actions[0] "General" header authors uses:3
// (adult-blue-dracolich MA-0050 byte-twin, §MA-1456/§MA-1494 header+counter+
// spend-gate fingerprint). Pre-fix the row had NO numeric uses →
// legendaryHeaderAction null → no .mc-legendary-header-row counter and the
// children rendered ungated plain text. Sanctioned cosmetic housekeeping
// same-pass: "ofanother creature's turn" → "of another creature's turn" in
// THIS row only (the dracolich twin keeps its bytes untouched).
//
// Header-uses collapse owner (@#1101/CANON #1082): THIS lane is the single
// tarrasque uses-lane owner — the header fix bytes + counter arm + economy
// live-face live here. Sibling lanes byte-pin only their own row:
//   ma1579 (general)      → header uses:3 + typo fix + economy   (this file)
//   ma1580 (Attack)       → delegates_to:"Claw" delegate seam
//   ma1581 (Move)         → advisory:"movement" child seam
//   ma1582 (Chomp)        → delegates_to:"Bite" + MA-1883 cost-2 spend
// Generic gate/expend/refusal/regain vocabulary is owned by
// monsterLegendaryUses.test.js (MA-0021) — cited, not re-driven here; the
// 4-token legendaryExpendGate fingerprint table (and its byte-identical twin
// in ma1581) was removed as a transitive duplicate of MA-0021 :79-110.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  legendaryHeaderAction,
  legendaryMaxUses,
  legendaryUsesRemaining,
  expendLegendaryUse,
  regainLegendaryUses,
} from './monsterLegendaryUses.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const tarrasque = monstersData.find(m => m.index === 'tarrasque');
const dracolich = monstersData.find(m => m.index === 'adult-blue-dracolich');

describe('MA-1579 monsters.json data: Tarrasque "General" header fix bytes, exact-once', () => {
  it('header row locks the fixed bytes: uses:3 + spacing-typo closed in the full description', () => {
    const header = tarrasque.legendary_actions[0];
    expect(Object.keys(header)).toEqual(['name', 'uses', 'description']);
    expect(header.name).toBe('General');
    expect(header.uses).toBe(3);
    // Exact-byte lock subsumes the four contains-faces: "of another
    // creature's turn" (typo closed), RAW count 3 + regain clause carried.
    expect(header.description).toBe("The tarrasque can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The tarrasque regains spent legendary actions at the start of its turn.");
    // Absence canary (§165 one-counter): uses lives ONLY on the header —
    // no child row shadows it. Child row bytes are owned by sibling lanes
    // (ma1580 Attack / ma1581 Move / ma1582 Chomp), cited not re-pinned.
    for (const child of tarrasque.legendary_actions.slice(1)) {
      expect(child.uses).toBeUndefined();
    }
    // Sanctioned fix is row-scoped: the dracolich twin keeps its "ofanother"
    // byte (its header uses:3 is already owned by MA-0050, monsterLegendaryUses.test.js).
    expect(dracolich.legendary_actions[0].description).toContain('only at the end ofanother creature\'s turn');
  });
});

describe('MA-1579 consumer arm: the header resolves where pre-fix it was null', () => {
  it('legendaryHeaderAction arms the fixed row; counter derives 3/3 (was no counter, ungated children)', () => {
    const header = legendaryHeaderAction(tarrasque);
    expect(header).toBe(tarrasque.legendary_actions[0]);
    expect(header.name).toBe('General');
    expect(legendaryMaxUses(header, {})).toBe(3);
    expect(legendaryUsesRemaining(header, {})).toBe(3);
  });
});

describe('MA-1579 Tarrasque economy is live through the real expend/regain seam', () => {
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

  it('press after another turn spends 3→2, turn-latch and own-turn refuse zero-spend, exhausted refuses, regain re-arms (MA-0050 economy-is-live shape)', async () => {
    const press = (actionName, action = null) => expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName, action, campaignName: 'test-campaign', deps });

    const first = await press('Attack');
    expect(first).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(logs.some(e => e.type === 'ability_use' && /expends a legendary use for Attack .* 2 of 3 left/.test(e.description))).toBe(true);

    const sameBoundary = await press('Move');
    expect(sameBoundary.reason).toBe('turn');
    expect(sameBoundary.popupHtml).toMatch(/Only one legendary action can be expended immediately after each creature's turn/);

    cs.activeCreatureName = 'Tarrasque 1';
    const ownTurn = await press('Attack');
    expect(ownTurn.reason).toBe('own-turn');
    expect(ownTurn.popupHtml).toMatch(/after ANOTHER creature's turn, not its own/);

    store['Tarrasque 1.monsterLegendaryUses'] = { max: 3, used: 3 };
    cs.activeCreatureName = 'Bandit 2';
    const exhausted = await press('Attack');
    expect(exhausted.reason).toBe('exhausted');
    expect(exhausted.popupHtml).toMatch(/has no legendary uses left/);
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(logs.filter(e => e.automationType === 'legendary_use_refused').length).toBe(3);

    const regain = await regainLegendaryUses({ monsterName: 'Tarrasque 1', campaignName: 'test-campaign', deps });
    expect(regain).toEqual({ regained: true, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses'].used).toBe(0);
    cs.activeCreatureName = 'Bandit 3';
    const after = await press('Attack');
    expect(after).toEqual({ spent: true, remaining: 2, max: 3 });
  });
});
