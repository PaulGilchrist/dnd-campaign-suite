// @maintained-by-ai
// MA-1952: Nidhogg legendary_actions "Grave Gale (Costs 2 Actions)" shipped
// delegates_to:"Corpse Wind (Recharge 5-6)" with NO numeric fields — the gated
// press self-resolved nothing and the delegate leg hijacked the master's save
// pool: popup header "Corpse Wind (Recharge 5-6)", 12d10 CON save where RAW is
// DC 24 STR 4d8 (~3.7× overkill), even siphoning Corpse Wind's MA-1948
// recharge stamp {recharged:false}. FIX (this file's lock): copy the row's own
// prose numerics onto the child — save quartet + dc_success:"none" (save-or-suck,
// prose has NO half clause vs Corpse Wind's explicit half-default). This is the
// DELEGATE-KEPT variant (vs jormungandr #1928 which REMOVED delegates_to):
// delegates_to stays byte-unchanged because legendaryRowHasNumericMechanic
// (MonsterCardModal.jsx:744, byte-duplicated below — unexported, §385
// mock-surface) returns true on save_dc>0, so the delegate leg (:895) is
// guarded OFF and the child self-resolves BEFORE it. DC0 decoy convention
// MA-0551; "pushed 30 ft." stays §70 advisory (no consumer). REAL on-disk row
// pinned programmatic disk-bytes (#1086), lookup by NAME not index (#1094),
// verbatim description ground truth (#993), honest title (#910), decoy sweep by
// NAME, no wall-clock (#app).
//
// Framework-owned (cited, not re-run here):
//  - uses/gate generics (header uses:3, "(Costs 2 Actions)" token) →
//    monsterAbilityUses CANON #1082 — header pin dropped (#1093 / #1100 rec);
//  - save-quartet consumers (handleSaveRoll / resolveBlockSaveDcSuccess half
//    default) → MonsterCardModal conditions family; save-core canonical for the
//    removed-delegate twin → monsterLegendarySave.ma1928-jormungandr-capsize
//    (#1100, closed) — this twin locks only its delegate-kept difference;
//  - recharge axis → monsterRecharge lane (cited if touched);
//  - whole-DB save tripwires (prose-agree, dc_success enum) → #1099 cited,
//    not re-driven.
//
// old→new: old 6 tests → 2. Old "row prose numerics" + "dc_success prose
// justification" + "key order/bait" + "delegates_to kept" + "predicate guard"
// → test 1 single real-row lock (exact save quartet + honest dc_success +
// verbatim description + delegate-kept fix signature + guard-off through the
// predicate + absence canaries; brittle Object.keys order dropped — no consumer
// reads key order, absence canaries carry the shape). Old "Corpse Wind
// byte-guard" + "header/siblings byte-inert" → test 2 decoy sweep by NAME
// (Grave Gale is the ONLY self-resolving save row on the lane; hijack-source
// Corpse Wind stays in the attack lane MA-1948-intact). Header uses:3 pin cut
// per #1082 CANON.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { canRollExpression } from '../../services/dice/diceRoller.js';
import { legendaryDelegateAction } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const NIDHOGG = monsters.find((m) => m.index === 'nidhogg');
// lookup by NAME, not index (#1094 brittle-index fix)
const GALE = NIDHOGG.legendary_actions.find((a) => a.name === 'Grave Gale (Costs 2 Actions)');
const WIND = NIDHOGG.actions.find((a) => a.name === 'Corpse Wind (Recharge 5-6)');

// Byte-duplicate of legendaryRowHasNumericMechanic (MonsterCardModal.jsx:744).
// resolveLegendaryRow (:895) enters the delegate branch ONLY when this is false.
const numericSelfResolve = (action) =>
  action.attack_bonus != null || Number(action.save_dc) > 0
  || canRollExpression(action.damage_dice_primary ?? '');

describe('MA-1952 disk fingerprint: Nidhogg Grave Gale self-resolves DC 24 STR 4d8 with delegate kept-but-guarded', () => {
  it('real-row lock: prose numerics authored on the child — DC 24 Strength 4d8 Necrotic nothing-on-success, delegates_to byte-unchanged so the :895 delegate leg is provably guarded off', () => {
    expect(NIDHOGG.name).toBe('Nidhogg');
    expect(GALE.name).toBe('Grave Gale (Costs 2 Actions)');
    // verbatim description ground truth (#993): "must succeed … or take 18 (4d8)
    // Necrotic damage and be pushed 30 ft." — no half clause → dc_success honest.
    expect(GALE.description).toBe(
      'Nidhogg beats his wings, exhaling a blast of corpse-light wind: one creature within 60 ft. must succeed on a DC 24 Strength saving throw or take 18 (4d8) Necrotic damage and be pushed 30 ft.'
    );
    // exact save quartet + honest dc_success ("none", vs Corpse Wind's half-default)
    expect(GALE.save_dc).toBe(24);
    expect(GALE.save_type).toBe('Strength');
    expect(GALE.damage_dice_primary).toBe('4d8');
    expect(GALE.damage_type_primary).toBe('Necrotic');
    expect(GALE.dc_success).toBe('none');
    expect(canRollExpression(GALE.damage_dice_primary)).toBe(true);
    // absence canaries carry the shape (key order has no consumer): no hit-axis
    // bait (§153/MA-1898), no save_effect ("pushed" is advisory §70), no
    // attack_bonus (§225), Corpse Wind's recharge must NOT ride the legendary lane.
    expect(GALE.attack_bonus).toBeUndefined();
    expect(GALE.hit_conditions).toBeUndefined();
    expect(GALE.save_effect).toBeUndefined();
    expect(GALE.recharge).toBeUndefined();
    // the ticket's fix signature (DELEGATE-KEPT twin vs #1928): the hijack
    // fingerprint was predicate-false + delegates_to-truthy → pool hijacked to
    // 12d10 CON. With the numerics authored, the predicate is TRUE and the
    // delegate leg is guarded off: entersDelegateLeg must stay false.
    expect(GALE.delegates_to).toBe('Corpse Wind (Recharge 5-6)');
    expect(numericSelfResolve(GALE)).toBe(true);
    expect(!numericSelfResolve(GALE) && Boolean(GALE.delegates_to)).toBe(false);
    // delegate data stays intact for the byte-shape — production still resolves
    // Gale→Wind; only the routing guard never reaches it.
    expect(legendaryDelegateAction(NIDHOGG, GALE)).toBe(WIND);
  });

  it('decoy sweep: Grave Gale is the ONLY self-resolving save row on the legendary lane, and hijack-source Corpse Wind stays attack-lane MA-1948-intact', () => {
    // Only-save-row-unique-on-lane pin: no legendary sibling can shadow or
    // duplicate the DC 24 STR grant, and no recharge byte leaks onto the lane.
    const saveRows = NIDHOGG.legendary_actions
      .filter((a) => a.save_dc != null || a.save_type != null || a.save_effect != null || a.dc_success != null)
      .map((a) => a.name);
    expect(saveRows).toEqual(['Grave Gale (Costs 2 Actions)']);
    expect(NIDHOGG.legendary_actions.some((a) => a.recharge != null)).toBe(false);
    // pure-delegate children (predicate-false + delegates_to): exactly Bite/Claw —
    // the pre-fix Grave Gale fingerprint (delegates without numerics) is dead.
    const pureDelegates = NIDHOGG.legendary_actions
      .filter((a) => a.delegates_to && !numericSelfResolve(a))
      .map((a) => a.name);
    expect(pureDelegates).toEqual(['Bite', 'Claw']);
    // hijack-source decoy row: Corpse Wind master bytes OWNED verbatim by
    // ma1948 :59-71 (rec #1121 trim): save_dc/save_type/dice/dc_success-
    // absence/recharge quartet+decoy dropped — same disk bytes, same values,
    // pinned stronger there. This lane keeps only the name-presence leg that
    // proves the pure-delegate census above is non-vacuous.
    expect(WIND.name).toBe('Corpse Wind (Recharge 5-6)');
  });
});
