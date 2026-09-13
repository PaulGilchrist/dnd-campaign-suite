// MA-0021: legendary-uses economy — expend / gate / turn-latch / regain /
// refusal. Mirrors MA-0005/MA-0020 finite-uses runtime-map tracking.
// MA-0022: non-numeric legendary rows delegate their mechanic to a named
// attack row on the same monster (`delegates_to`).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  legendaryHeaderAction,
  legendaryMaxUses,
  legendaryUsesRemaining,
  legendaryExpendGate,
  buildLegendaryRefusalLog,
  buildLegendaryRefusalPopup,
  expendLegendaryUse,
  regainLegendaryUses,
  legendaryDelegateAction,
  legendaryDelegateAttackName,
} from './monsterLegendaryUses.js';

const TENTACLE = { name: 'Tentacle', attack_bonus: 9, damage_dice_primary: '2d6 + 5', damage_type_primary: 'Bludgeoning' };

const AB = {
  actions: [TENTACLE],
  legendary_actions: [
    { name: 'Legendary Action Uses: 3 (4 in Lair)', uses: 3, description: 'Immediately after another creature\'s turn…' },
    { name: 'Lash', delegates_to: 'Tentacle', description: 'The aboleth makes one Tentacle attack.' },
    { name: 'Psychic Drain', description: '…regains 5 (1d10) Hit Points.' },
  ],
};

let store;
let logs;
let deps;
let cs;
beforeEach(() => {
  store = {};
  logs = [];
  cs = { round: 1, activeCreatureName: 'Thug 1' };
  deps = {
    getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
    setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
    addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
    getCombatContext: vi.fn(() => Promise.resolve(cs)),
  };
});

describe('MA-0021 header / max / remaining', () => {
  it('header is legendary_actions[0] when it authors uses; max + remaining derive', () => {
    expect(legendaryHeaderAction(AB).uses).toBe(3);
    expect(legendaryMaxUses(AB.legendary_actions[0], {})).toBe(3);
    expect(legendaryUsesRemaining(AB.legendary_actions[0], {})).toBe(3);
    expect(legendaryUsesRemaining(AB.legendary_actions[0], { max: 3, used: 2 })).toBe(1);
    expect(legendaryUsesRemaining(AB.legendary_actions[0], { max: 3, used: 3 })).toBe(0);
  });

  it('max rides the stamped map when the header block is absent (turn-start regain seam)', () => {
    expect(legendaryHeaderAction({ legendary_actions: [{ name: 'No Uses' }] })).toBeNull();
    expect(legendaryMaxUses(null, { max: 3 })).toBe(3);
  });
});

describe('MA-0021 expend gate', () => {
  it('allows the first expend after another creature\'s turn', () => {
    const g = legendaryExpendGate({ header: AB.legendary_actions[0], storedUses: {}, round: 1, activeCreatureName: 'Thug 1', monsterName: 'Aboleth 1', latch: null });
    expect(g.allowed).toBe(true);
    expect(g.remaining).toBe(3);
  });

  it('refuses a second expend within the same creature turn (round+turn latch)', () => {
    const latch = { round: 1, activeCreature: 'Thug 1' };
    const g = legendaryExpendGate({ header: AB.legendary_actions[0], storedUses: { max: 3, used: 1 }, round: 1, activeCreatureName: 'Thug 1', monsterName: 'Aboleth 1', latch });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('turn');
  });

  it('refuses on its own turn', () => {
    const g = legendaryExpendGate({ header: AB.legendary_actions[0], storedUses: {}, round: 2, activeCreatureName: 'Aboleth 1', monsterName: 'Aboleth 1', latch: null });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('own-turn');
  });

  it('refuses when exhausted (0 left)', () => {
    const g = legendaryExpendGate({ header: AB.legendary_actions[0], storedUses: { max: 3, used: 3 }, round: 1, activeCreatureName: 'Thug 1', monsterName: 'Aboleth 1', latch: null });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('exhausted');
  });

  it('allows again on the next other-creature turn (different activeCreature)', () => {
    const latch = { round: 1, activeCreature: 'Thug 1' };
    const g = legendaryExpendGate({ header: AB.legendary_actions[0], storedUses: { max: 3, used: 1 }, round: 1, activeCreatureName: 'Cleric 2', monsterName: 'Aboleth 1', latch });
    expect(g.allowed).toBe(true);
  });
});

describe('MA-0021 expend spend flow', () => {
  it('spends 1, writes the map + latch, logs ability_use with N left', async () => {
    const r = await expendLegendaryUse({ monsterName: 'Aboleth 1', monster: AB, actionName: 'Lash', campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(true);
    expect(r.remaining).toBe(2);
    expect(store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(store['Aboleth 1._legendaryUses_usedRound']).toEqual({ round: 1, activeCreature: 'Thug 1' });
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend).toBeTruthy();
    expect(spend.description).toMatch(/expends a legendary use for Lash .* 2 of 3 left/s);
  });

  it('exhausted click: zero spend, zero latch, legendary_use_refused log', async () => {
    store['Aboleth 1.monsterLegendaryUses'] = { max: 3, used: 3 };
    const r = await expendLegendaryUse({ monsterName: 'Aboleth 1', monster: AB, actionName: 'Lash', campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(false);
    expect(r.reason).toBe('exhausted');
    expect(r.popupHtml).toMatch(/Legendary Action Refused/);
    expect(store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(store['Aboleth 1._legendaryUses_usedRound']).toBeUndefined();
    expect(logs.some(e => e.automationType === 'legendary_use_refused')).toBe(true);
    expect(logs.some(e => e.type === 'ability_use')).toBe(false);
  });

  it('same-turn second click refused, no spend', async () => {
    await expendLegendaryUse({ monsterName: 'Aboleth 1', monster: AB, actionName: 'Lash', campaignName: 'test-campaign', deps });
    const second = await expendLegendaryUse({ monsterName: 'Aboleth 1', monster: AB, actionName: 'Psychic Drain', campaignName: 'test-campaign', deps });
    expect(second.spent).toBe(false);
    expect(second.reason).toBe('turn');
    expect(store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });
});

describe('MA-0021 turn-start regain', () => {
  it('regains all uses at the start of the monster turn, clears latch, logs ability_use', async () => {
    store['Aboleth 1.monsterLegendaryUses'] = { max: 3, used: 2 };
    store['Aboleth 1._legendaryUses_usedRound'] = { round: 1, activeCreature: 'Thug 1' };
    const r = await regainLegendaryUses({ monsterName: 'Aboleth 1', campaignName: 'test-campaign', deps });
    expect(r.regained).toBe(true);
    expect(store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });
    expect(store['Aboleth 1._legendaryUses_usedRound']).toBeNull();
    const log = logs.find(e => e.type === 'ability_use');
    expect(log).toBeTruthy();
    expect(log.description).toMatch(/regains all expended legendary action uses .* 3 available/);
  });

  it('silent no-op when nothing was spent', async () => {
    const r = await regainLegendaryUses({ monsterName: 'Aboleth 1', campaignName: 'test-campaign', deps });
    expect(r.regained).toBe(false);
    expect(logs.length).toBe(0);
  });

  it('refusal log carries the legendary_use_refused automationType + zero-spend wording', () => {
    const e = buildLegendaryRefusalLog({ monsterName: 'Aboleth 1', actionName: 'Lash', reason: 'turn' });
    expect(e.automationType).toBe('legendary_use_refused');
    expect(e.description).toMatch(/refused \(turn\).*zero spend, no roll/s);
  });
});

describe('MA-0022 legendary delegation (Lash → Tentacle)', () => {
  it('delegates_to resolves to the named attack row with its own numbers', () => {
    const lash = AB.legendary_actions[1];
    const d = legendaryDelegateAction(AB, lash);
    expect(d).toBe(TENTACLE);
    expect(d.attack_bonus).toBe(9);
    expect(d.damage_dice_primary).toBe('2d6 + 5');
  });

  it('finds delegates among legendary_actions siblings too', () => {
    const m = {
      legendary_actions: [
        AB.legendary_actions[0],
        { name: 'Lash', delegates_to: 'Tentacle' },
        TENTACLE,
      ],
    };
    expect(legendaryDelegateAction(m, m.legendary_actions[1])).toBe(TENTACLE);
  });

  it('null when no delegates_to, unknown name, or self-reference', () => {
    expect(legendaryDelegateAction(AB, AB.legendary_actions[2])).toBeNull();
    expect(legendaryDelegateAction(AB, { name: 'Lash', delegates_to: 'Bite' })).toBeNull();
    expect(legendaryDelegateAction(AB, TENTACLE)).toBeNull();
    expect(legendaryDelegateAction(null, { name: 'Lash', delegates_to: 'Tentacle' })).toBeNull();
  });

  it('delegate attack log name reads "Lash (Tentacle attack)"', () => {
    const lash = AB.legendary_actions[1];
    expect(legendaryDelegateAttackName(lash, TENTACLE)).toBe('Lash (Tentacle attack)');
  });

  it('spend with the delegate name spends 1 use and logs "Lash (Tentacle attack)"', async () => {
    const r = await expendLegendaryUse({ monsterName: 'Aboleth 1', monster: AB, actionName: legendaryDelegateAttackName(AB.legendary_actions[1], TENTACLE), campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(true);
    expect(store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/expends a legendary use for Lash \(Tentacle attack\)/);
  });

  it('no-delegate refusal popup + log wording, zero spend', () => {
    const p = buildLegendaryRefusalPopup({ monsterName: 'Aboleth 1', actionName: 'Lash', reason: 'no-delegate' });
    expect(p).toMatch(/Legendary Action Refused/);
    expect(p).toMatch(/delegates to an attack that could not be found/);
    const e = buildLegendaryRefusalLog({ monsterName: 'Aboleth 1', actionName: 'Lash', reason: 'no-delegate' });
    expect(e.automationType).toBe('legendary_use_refused');
    expect(e.description).toMatch(/refused \(no-delegate\).*zero spend, no roll/s);
  });
});
