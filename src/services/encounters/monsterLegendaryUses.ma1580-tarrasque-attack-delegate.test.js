// @maintained-by-ai
// MA-1580 lane: Tarrasque legendary_actions "Attack" was plain text with zero
// affordance — the claw-or-tail choice was never consumable (post-MA-1579 the
// row was the MA-0510 silent-burn shape: Expend chip armed, click spends,
// console.error "no resolvable mechanic"). Fix = one DATA field
// `delegates_to:"Claw"` riding the MA-0022 delegate seam
// (legendaryDelegateAction spans actions + legendary_actions; the modal
// resolves the real Claw row — +19 / 4d8 + 10 slashing, reach 15 ft. —
// through the identical attack seam, labelled "Attack (Claw attack)", AFTER
// the shared MA-0021 spend gate — §MA-1456 Pounce→Rend / §MA-1494 Arcane
// Prowl→Claw byte-twins, #1101 delegate-resolver twin shape). Single-delegate
// limitation per fix note: the tail alternative stays prose; "Tail" is the
// closest-confusion decoy row — it exists on actions[] but never delegates.
//
// 4-lane tarrasque ownership (owner table @ma1579 header, #1102 adjudicated):
//   ma1579 (general)      → header uses:3 + typo fix + economy   (owner)
//   ma1580 (Attack)       → delegates_to:"Claw" delegate seam    (THIS file)
//   ma1581 (Move)         → advisory:"movement" child seam        (owner)
//   ma1582 (Chomp)        → delegates_to:"Bite" + MA-1883 cost-2 (owner)
// Generic gate/expend/refusal vocabulary is owned by monsterLegendaryUses.test.js
// (MA-0021 :79-134, MA-0022 :171-218) — cited, not re-driven here; expend-gate
// generics per @monsterLegendaryUses.test.js:79-110 (CANON #1082).
//
// old->new map (this pass, 9→3):
//   header bytes old:46-52        → deleted (sole uses-lane owner ma1579:39-67;
//                                    delegate-spend test below proves max:3 arming — #1102 rec, #1038 verified)
//   siblings old:54-70            → deleted (Move byte @ma1581:35-41, Chomp byte
//                                    @ma1582:43-56, name-list @ma1582:83 — transitive dups)
//   label old:84-88               → folded into spend regex (production log line)
//   no-delegate old:90-95        → deleted (generic :191-196; Chomp→Bite @ma1582:64-73)
//   own-turn old:126-134         → deleted (generic :93-97 + ma1579 own-turn leg)
//   exhausted old:136-143        → deleted (generic :99-103 + ma1579 exhausted leg)
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  legendaryDelegateAction,
  legendaryDelegateAttackName,
  expendLegendaryUse,
} from './monsterLegendaryUses.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const tarrasque = monstersData.find(m => m.index === 'tarrasque');
// name-lookup, never index (#1094)
const attack = tarrasque.legendary_actions.find(a => a.name === 'Attack');
const claw = tarrasque.actions.find(a => a.name === 'Claw');

describe('MA-1580 disk bytes: legendary "Attack" delegates_to Claw, exact-once (§225 hijack-dead)', () => {
  it('fix byte exact-once on disk; child template carries no own numerics; Tail decoy stays prose-only', () => {
    // Raw-file anchor (#1086): the tarrasque fix byte appears exactly once in
    // monsters.json (10 other monsters delegate "Claw" — the name+delegates_to
    // pair is what makes this row unique).
    const raw = fs.readFileSync(path.resolve(__dirname, '../../../public/data/monsters.json'), 'utf8');
    expect(raw.split('"name": "Attack",\n        "delegates_to": "Claw",').length - 1).toBe(1);

    expect(attack.delegates_to).toBe('Claw');
    // key order mirrors the proven delegate rows (MA-0375 beholder, MA-1582 twin).
    expect(Object.keys(attack)).toEqual(['name', 'delegates_to', 'description']);
    expect(attack.description).toBe('The tarrasque makes one claw attack or tail attack.');
    // hijack-dead canaries (§168 child template / #1100 §225 shape): the row
    // itself never rolls — own numerics absent, so the delegate leg is live and
    // no fake Claw can shadow the real attack row.
    expect(attack.attack_bonus).toBeUndefined();
    expect(attack.save_dc).toBeUndefined();
    expect(attack.damage_dice_primary).toBeUndefined();
    expect(attack.uses).toBeUndefined();
    // closest-confusion decoy by NAME (#948): RAW offers claw OR tail; the
    // single-delegate model names Claw only — Tail exists on actions[] but is
    // never a delegate target on this monster's legendary lane.
    expect(tarrasque.actions.some(a => a.name === 'Tail')).toBe(true);
    expect(tarrasque.legendary_actions.some(a => a.delegates_to === 'Tail')).toBe(false);
  });
});

describe('MA-1580 resolver-through-production: the delegate lands the REAL Claw attack row', () => {
  it('legendaryDelegateAction spans actions[] and resolves Claw with its master bytes (+19 / 15 ft. / 4d8 + 10 slashing)', () => {
    const delegate = legendaryDelegateAction(tarrasque, attack);
    // dangling-delegation canary (#1079): the named row must exist — identity
    // with the monster's own Claw action, not just a same-named shape.
    expect(delegate).toBe(claw);
    expect(claw.attack_bonus).toBe(19);
    expect(claw.reach).toBe('15 ft.'); // reach-branch guard (#1035)
    expect(claw.damage_dice_primary).toBe('4d8 + 10');
    expect(claw.damage_type_primary).toBe('slashing'); // lowercase disk byte (MA-1262 passthrough family)
    // self-delegation guard on the real row: the master never delegates onward
    // (unknown-name/no-delegate refusal vocabulary: generic :191-196).
    expect(legendaryDelegateAction(tarrasque, claw)).toBeNull();
  });
});

describe('MA-1580 delegated Attack rides the shared spend gate honestly', () => {
  it('end-of-other-turn press spends 3→2 once with the honest "Attack (Claw attack)" label in the spend log', async () => {
    const store = {};
    const logs = [];
    const cs = { round: 1, activeCreatureName: 'Bandit 1' };
    const deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      getCombatContext: vi.fn(() => Promise.resolve(cs)),
    };

    const delegate = legendaryDelegateAction(tarrasque, attack);
    const actionName = legendaryDelegateAttackName(attack, delegate);
    expect(actionName).toBe('Attack (Claw attack)'); // attack seam: Claw has no save_dc

    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName, action: attack, campaignName: 'test-campaign', deps });
    // cost-1 child of the shared pool (distinct from ma1579's plain-name walk:
    // the delegate row itself passes the gate here).
    expect(r).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const spend = logs.filter(e => e.type === 'ability_use');
    expect(spend[0].description).toMatch(/expends a legendary use for Attack \(Claw attack\) .* 2 of 3 left/);
  });
});
