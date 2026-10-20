// @maintained-by-ai
// MA-1582: Tarrasque legendary "Chomp (Costs 2 Actions)" was plain text with
// zero affordance (FAIL(b)/DATA). Fix bytes: one DATA field
// `delegates_to:"Bite"` after name, before description — the MA-0375 beholder
// Chomp→Bite / MA-1580 Tarrasque Attack→Claw byte-twins riding the MA-0022
// delegate seam (legendaryDelegateAction spans actions + legendary_actions;
// the modal resolves the REAL Bite row — +19 / 4d12 + 10 Piercing, MA-1573
// typo-fix byte — through the identical attack seam AFTER the shared MA-0021
// spend gate).
//
// 4-lane tarrasque ownership (#1102 owner table @ma1579 header — ma1582 =
// THIS lane = Chomp delegate + cost-2 economy):
//   ma1579 (general) → header uses:3 + typo fix + cost-1 pool walk (owner)
//   ma1580 (Attack)  → delegates_to:"Claw" delegate seam       (owner :52-118)
//   ma1581 (Move)    → advisory:"movement" child seam           (owner :64-123)
//   ma1582 (Chomp)   → delegates_to:"Bite" + cost-2 spend      (THIS file)
// COST-2 adjudication (honest): the generic legendaryActionCost grammar, the
// insufficient-cost refusal vocabulary and the Demogorgon even-2-pool demands
// are owned by monsterLegendaryUses.ma1883-demogorgon-cast-a-spell.test.js
// :136-244 — cited, not re-driven. THIS lane drives the parsed cost through
// Tarrasque's own row: cost resolves 2 off the Chomp disk name, the spend
// decrements by 2 against the uses:3 header (odd-pool exact chunk 3→1) and
// the next-boundary re-press is the near-miss insufficient-cost #943 with
// ZERO extra spend (used stays 2) — distinct from ma1579's cost-1 walk and
// ma1883's max:2 pool. Header uses + turn-latch/exhausted/own-turn refusal
// generics cite MA-0021 monsterLegendaryUses.test.js :79-110 + ma1579:86-117,
// never re-added (#1102/#1103 recs applied).
//
// DOCUMENTED ACCEPTED RESIDUAL (no code, this comment only): SWALLOW SECOND
// OPTION UNEXPRESSIBLE — RAW "…or uses its Swallow" cannot be offered on the
// single-delegate model; delegates_to names exactly one row. Pinned below by
// the Swallow decoy: the row exists on actions[] but is never a delegate
// target; the Bite-or-Swallow choice stays GM-adjudicated prose.
//
// old->new (#1038 leg table, 8→3): data-bytes + raw-anchor → one disk test
// (name-lookup #1094, raw exact-once anchor #1086, §168 inert child, §225
// hijack-dead sole-Bite-target pin, Swallow decoy = #948 Bite-lane inverse
// of ma1580's Tail decoy); label test → folded into the press test's
// production-log regex; siblings byte-lock block → deleted per recs #1102
// (#1102: header pin owned by ma1579 — :84-87 deleted) + #1103 (Move bytes
// @ma1581:64-87), shrunk to cites + this lane's unique proof (Chomp is the
// ONLY delegates_to:"Bite" row); spend press → kept and STRENGTHENED with
// cost-parse + near-miss #943; own-turn + exhausted refusals → deleted
// (MA-0021 :93-103/:124-134 + ma1579 :98-108 own legs — same deletes ma1580
// made by the same rec). Disk-only asserts (#1057); no wall-clock, log
// timestamps never checked (#app); fixtures test-local → no afterEach needed.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  legendaryDelegateAction,
  legendaryDelegateAttackName,
  legendaryActionCost,
  expendLegendaryUse,
} from './monsterLegendaryUses.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const tarrasque = monstersData.find(m => m.index === 'tarrasque');
// name-lookup, never index (#1094).
const chomp = tarrasque.legendary_actions.find(a => a.name === 'Chomp (Costs 2 Actions)');
const bite = tarrasque.actions.find(a => a.name === 'Bite');

describe('MA-1582 monsters.json disk bytes: Tarrasque legendary "Chomp (Costs 2 Actions)" delegates_to Bite, exact-once (§225 hijack-dead)', () => {
  it('fix bytes + key placement (name→delegates_to→description, MA-0375/MA-1580 twin); raw anchor exact-once #1086; §168 inert child never rolls; Chomp is the ONLY delegates_to:"Bite" row, Swallow decoy never delegated (#948 Bite-lane inverse of ma1580 Tail)', () => {
    expect(chomp.name).toBe('Chomp (Costs 2 Actions)');
    expect(chomp.delegates_to).toBe('Bite');
    // key placement mirrors the proven delegate rows (MA-0375 beholder, MA-1580).
    expect(Object.keys(chomp)).toEqual(['name', 'delegates_to', 'description']);
    expect(chomp.description).toBe('The tarrasque makes one bite attack or uses its Swallow.');
    // §168 child template: the row never rolls — no own numeric/economy/advisory.
    expect(chomp.attack_bonus).toBeUndefined();
    expect(chomp.save_dc).toBeUndefined();
    expect(chomp.damage_dice_primary).toBeUndefined();
    expect(chomp.advisory).toBeUndefined();
    expect(chomp.uses).toBeUndefined();
    // Raw-file anchor (#1086): the fix byte appears exactly once in
    // monsters.json — the "(Costs 2 Actions)" suffix separates this row from
    // the MA-0580 Death Tyrant plain-"Chomp" twin (monsterLegendaryUses.test.js:1330).
    const raw = fs.readFileSync(path.resolve(__dirname, '../../../public/data/monsters.json'), 'utf8');
    expect(raw.split('"name": "Chomp (Costs 2 Actions)",\n        "delegates_to": "Bite",').length - 1).toBe(1);
    expect(JSON.parse(raw).find(m => m.index === 'tarrasque').legendary_actions.find(a => a.name === 'Chomp (Costs 2 Actions)').delegates_to).toBe('Bite');
    // hijack-dead: exactly one Chomp row and it is the sole delegates_to:"Bite"
    // target — no shadow row re-points Bite; Swallow (the RAW second option,
    // documented residual) exists on actions[] but is never a delegate target.
    expect(tarrasque.legendary_actions.filter(a => a.name.startsWith('Chomp')).map(a => a.delegates_to)).toEqual(['Bite']);
    expect(tarrasque.legendary_actions.some(a => a.delegates_to === 'Swallow')).toBe(false);
    expect(tarrasque.actions.some(a => a.name === 'Swallow')).toBe(true);
    // Sibling lanes byte-pin their own rows — cited, not re-pinned (#1102/#1103):
    // header uses:3 + typo + absence-of-child-uses @ma1579:39-56, Attack→Claw
    // @ma1580:52-77, Move advisory @ma1581:64-87.
  });
});

describe('MA-1582 resolver-through-production: Chomp lands the REAL Bite attack row', () => {
  it('legendaryDelegateAction spans actions[] and resolves Bite with its master bytes (+19 / 10 ft. / 4d12 + 10 Piercing MA-1573); dangling canary #1079; Bite itself never delegates onward', () => {
    const delegate = legendaryDelegateAction(tarrasque, chomp);
    // identity with the monster's own Bite action, not just a same-named shape.
    expect(delegate).toBe(bite);
    expect(bite.attack_bonus).toBe(19);
    expect(bite.reach).toBe('10 ft.'); // reach-branch guard (#1035)
    expect(bite.damage_dice_primary).toBe('4d12 + 10');
    expect(bite.damage_type_primary).toBe('Piercing'); // MA-1573 capital-P disk byte
    expect(bite.hit_conditions).toEqual(['grappled', 'restrained']);
    // self-delegation guard on the real row: the master never delegates onward
    // (no-delegate refusal vocabulary: generic MA-0022 :171-218).
    expect(legendaryDelegateAction(tarrasque, bite)).toBeNull();
  });
});

describe('MA-1582 Chomp pays its RAW cost-2 through the shared gate (MA-1883 closed; generics cited MA-0021:79-110)', () => {
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

  it('cost parses 2 off the disk name; legal press spends 3→1 once (odd-pool exact chunk, spends-2 log with the delegated label); next-boundary near-miss cost-2 vs 1-left refuses insufficient-cost ZERO extra spend #943', async () => {
    // disk name → parsed cost (grammar owner ma1883:136-165; this row lands it).
    expect(legendaryActionCost(chomp)).toBe(2);
    const delegate = legendaryDelegateAction(tarrasque, chomp);
    const actionName = legendaryDelegateAttackName(chomp, delegate);
    expect(actionName).toBe('Chomp (Costs 2 Actions) (Bite attack)'); // attack seam: Bite has no save_dc

    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName, action: chomp, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 1, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    const spend = logs.filter(e => e.type === 'ability_use');
    expect(spend[0].description).toMatch(/spends 2 legendary uses for Chomp \(Costs 2 Actions\) \(Bite attack\) .* 1 of 3 left/);

    // Near-miss #943 at the cost-2 boundary: a legal fresh-boundary press with
    // 1 remaining costs 2 → economy-floor refusal, used stays 2 (half-spend
    // abuse is dead). Refusal builders/vocabulary owned by ma1883:237-244.
    cs.activeCreatureName = 'Bandit 2';
    const near = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName, action: chomp, campaignName: 'test-campaign', deps });
    expect(near.spent).toBe(false);
    expect(near.reason).toBe('insufficient-cost');
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(logs.some(e => e.automationType === 'legendary_use_refused' && /insufficient-cost: costs 2, 1 left/.test(e.description))).toBe(true);
    expect(logs.filter(e => e.type === 'ability_use').length).toBe(1);
  });
});
