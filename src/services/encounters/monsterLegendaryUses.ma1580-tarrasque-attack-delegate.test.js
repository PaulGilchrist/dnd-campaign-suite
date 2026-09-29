// MA-1580: Tarrasque legendary_actions[1] "Attack" was plain text with zero
// affordance — the claw-or-tail choice was never consumable (post-MA-1579 the
// row is the MA-0510 silent-burn shape: Expend chip armed, click spends,
// console.error "no resolvable mechanic"). Fix = one DATA field
// `delegates_to:"Claw"` riding the MA-0022 delegate seam
// (legendaryDelegateAction spans actions + legendary_actions; the modal
// resolves the real Claw row — +19 / 4d8 + 10 slashing — through the
// identical attack seam, labelled "Attack (Claw attack)", AFTER the shared
// MA-0021 spend gate — §MA-1456 Pounce→Rend / §MA-1494 Arcane Prowl→Claw
// byte-twins). Single-delegate limitation per fix note: the tail alternative
// stays prose. Header uses:3 (MA-1579, commit 75649ae9e) byte-locked here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  legendaryHeaderAction,
  legendaryDelegateAction,
  legendaryDelegateAttackName,
  expendLegendaryUse,
} from './monsterLegendaryUses.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const tarrasque = monstersData.find(m => m.index === 'tarrasque');
const claw = tarrasque.actions.find(a => a.name === 'Claw');

describe('MA-1580 monsters.json data: Tarrasque legendary "Attack" delegates_to Claw', () => {
  it('legendary_actions[1] carries delegates_to "Claw" at the proven byte position', () => {
    const attack = tarrasque.legendary_actions[1];
    expect(attack.name).toBe('Attack');
    expect(attack.delegates_to).toBe('Claw');
    // key order mirrors the proven delegates_to rows (dracolich "Tail
    // Attack" monsters.json:1416, sphinx-of-lore MA-1494): name →
    // delegates_to → description.
    expect(Object.keys(attack)).toEqual(['name', 'delegates_to', 'description']);
    expect(attack.description).toBe('The tarrasque makes one claw attack or tail attack.');
    // fix-note single-delegate limitation: ONLY Claw authored; no numeric
    // fields on the child (the row itself never rolls — §168 child template).
    expect(attack.attack_bonus).toBeUndefined();
    expect(attack.save_dc).toBeUndefined();
    expect(attack.damage_dice_primary).toBeUndefined();
    expect(attack.uses).toBeUndefined();
  });

  it('MA-1579 header byte-locked: "General" rows[0] still authors uses:3', () => {
    const header = tarrasque.legendary_actions[0];
    expect(Object.keys(header)).toEqual(['name', 'uses', 'description']);
    expect(header.name).toBe('General');
    expect(header.uses).toBe(3);
    expect(legendaryHeaderAction(tarrasque)).toBe(header);
  });

  it('siblings byte-locked: Chomp (Costs 2 Actions) untouched; Move MA-1581 advisory stamp (stale inert-pin inverted same pass §216)', () => {
    const la = tarrasque.legendary_actions;
    expect(la.map(a => a.name)).toEqual(['General', 'Attack', 'Move', 'Chomp (Costs 2 Actions)']);
    const move = la.find(a => a.name === 'Move');
    // MA-1581 fix: Move is now an advisory child — advisory + advisory_message
    // after name, before description (androsphinx/arch-hag advisory byte-shape).
    expect(Object.keys(move)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    expect(move.advisory).toBe('movement');
    expect(move.description).toBe('The tarrasque moves up to half its speed.');
    const chomp = la.find(a => a.name === 'Chomp (Costs 2 Actions)');
    // Chomp cost-2 intact: name-text "(Costs 2 Actions)" + description byte,
    // no delegates_to authored (bite-or-Swallow choice is a separate ticket).
    expect(Object.keys(chomp)).toEqual(['name', 'description']);
    expect(chomp.description).toBe('The tarrasque makes one bite attack or uses its Swallow.');
    expect(chomp.delegates_to).toBeUndefined();
  });

  it('delegate spans actions[]: legendaryDelegateAction lands the REAL Claw attack row', () => {
    const attack = tarrasque.legendary_actions[1];
    const delegate = legendaryDelegateAction(tarrasque, attack);
    expect(delegate).toBe(claw);
    expect(claw.attack_bonus).toBe(19);
    expect(claw.reach).toBe('15 ft.');
    expect(claw.damage_dice_primary).toBe('4d8 + 10');
    expect(claw.damage_type_primary).toBe('slashing'); // lowercase disk byte (MA-1262 passthrough family)
    // self-delegation guard: the delegate never resolves to the child itself
    expect(legendaryDelegateAction(tarrasque, claw)).toBeNull();
  });

  it('delegate chip label: "Attack (Claw attack)" — attack seam (Claw has no save_dc)', () => {
    const attack = tarrasque.legendary_actions[1];
    const delegate = legendaryDelegateAction(tarrasque, attack);
    expect(legendaryDelegateAttackName(attack, delegate)).toBe('Attack (Claw attack)');
  });

  it('no-delegate refusal vocabulary reachable for the untouched Chomp child', () => {
    const chomp = tarrasque.legendary_actions.find(a => a.name === 'Chomp (Costs 2 Actions)');
    expect(legendaryDelegateAction(tarrasque, chomp)).toBeNull();
  });
});

describe('MA-1580 delegated Attack rides the shared spend gate honestly', () => {
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

  it('end-of-other-turn press spends 3→2 with the delegated label in the spend log', async () => {
    const attack = tarrasque.legendary_actions[1];
    const delegate = legendaryDelegateAction(tarrasque, attack);
    const actionName = legendaryDelegateAttackName(attack, delegate);
    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName, action: attack, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const spend = logs.filter(e => e.type === 'ability_use');
    expect(spend[0].description).toMatch(/expends a legendary use for Attack \(Claw attack\) .* 2 of 3 left/);
  });

  it('own-turn press refuses own-turn with ZERO spend (gate turn-latch honest)', async () => {
    cs.activeCreatureName = 'Tarrasque 1';
    const attack = tarrasque.legendary_actions[1];
    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Attack (Claw attack)', action: attack, campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(false);
    expect(r.reason).toBe('own-turn');
    expect(store['Tarrasque 1.monsterLegendaryUses']).toBeUndefined();
    expect(logs.some(e => e.automationType === 'legendary_use_refused')).toBe(true);
  });

  it('exhausted press refuses exhausted with ZERO spend', async () => {
    store['Tarrasque 1.monsterLegendaryUses'] = { max: 3, used: 3 };
    const attack = tarrasque.legendary_actions[1];
    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Attack (Claw attack)', action: attack, campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(false);
    expect(r.reason).toBe('exhausted');
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
  });
});
