// MA-1952: Nidhogg legendary_actions[3] "Grave Gale (Costs 2 Actions)" shipped
// delegates_to:"Corpse Wind (Recharge 5-6)" with NO numeric fields — the gated
// press self-resolved nothing and the delegate leg (:895) hijacked the master's
// save pool: popup header "Corpse Wind (Recharge 5-6)", 12d10, lastAttack
// saveType CONSTITUTION, 60/70 dmg where RAW max is 18 (~3.7× overkill), and the
// press even siphoned Corpse Wind's MA-1948 recharge stamp {recharged:false}.
// The row's own prose authors the mechanic: "one creature within 60 ft. must
// succeed on a DC 24 Strength saving throw or take 18 (4d8) Necrotic damage and be
// pushed 30 ft." — save-or-suck, success stated as NOTHING (no "half" byte, vs
// Corpse Wind's explicit "Success: Half damage."), so dc_success:"none"
// (MV-20/MA-0481/MA-1928 half-leak family). FIX (this file's lock): copy the
// row's numeric truth onto the child. delegates_to STAYS byte-unchanged —
// legendaryRowHasNumericMechanic (MonsterCardModal.jsx:744, byte-duplicated below;
// unexported, §385 mock-surface) returns true on save_dc>0, so the delegate leg
// at :895 is guarded OFF and the child self-resolves BEFORE it (smaller diff;
// MA-1928 removed delegates_to only because its hijack was attack-pool).
// DC0 decoy convention MA-0551; "pushed 30 ft." stays §70 advisory (push te is
// save-picker-only + "push(ed) up to" regex — no consumer, not this ticket).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { canRollExpression } from '../../services/dice/diceRoller.js';
import { legendaryDelegateAction } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const NIDHOGG = monsters.find((m) => m.index === 'nidhogg');
const GALE = NIDHOGG.legendary_actions[3];
const WIND = NIDHOGG.actions[3];

// Byte-duplicate of legendaryRowHasNumericMechanic (MonsterCardModal.jsx:744).
// extractDamageDiceFromDescription (:934) returns existingDamageDice FIRST, so
// with damage_dice_primary authored the formula is that byte — no parse needed.
const numericSelfResolve = (action) =>
  action.attack_bonus != null || Number(action.save_dc) > 0
  || canRollExpression(action.damage_dice_primary ?? '');

describe('MA-1952 disk fingerprint: Nidhogg Grave Gale self-resolves DC 24 STR 4d8', () => {
  it('authors the row prose numerics — DC 24 Strength, 4d8 Necrotic, nothing on success', () => {
    expect(NIDHOGG.name).toBe('Nidhogg');
    expect(GALE.name).toBe('Grave Gale (Costs 2 Actions)');
    expect(GALE.save_dc).toBe(24);
    expect(GALE.save_type).toBe('Strength');
    expect(GALE.damage_dice_primary).toBe('4d8');
    expect(GALE.damage_type_primary).toBe('Necrotic');
    expect(GALE.dc_success).toBe('none');
    expect(canRollExpression(GALE.damage_dice_primary)).toBe(true);
  });

  it('dc_success:"none" justified from the row prose — save-or-suck, no half clause', () => {
    // Disk prose byte (anchor): "must succeed … or take 18 (4d8) Necrotic damage and be pushed 30 ft."
    expect(GALE.description).toBe(
      'Nidhogg beats his wings, exhaling a blast of corpse-light wind: one creature within 60 ft. must succeed on a DC 24 Strength saving throw or take 18 (4d8) Necrotic damage and be pushed 30 ft.'
    );
    expect(/half/i.test(GALE.description)).toBe(false); // zero half-on-success wording → authored "none" is honest
    // resolveBlockSaveDcSuccess twin (MonsterCardModal.jsx:286): authored wins over the half-default.
    expect(GALE.dc_success ?? 'half').toBe('none');
  });

  it('numeric self-resolve predicate is TRUE on the child — delegate leg :895 guarded off', () => {
    expect(numericSelfResolve(GALE)).toBe(true);
    // resolveLegendaryRow (:895) enters the delegate branch ONLY when the
    // predicate is false — with save_dc 24 authored the child reaches
    // resolveLegendaryRowMechanic as itself: handleSaveRoll(action, "4d8") →
    // DC 24 STRENGTH 4d8, popup/header "Grave Gale (Costs 2 Actions)".
    const entersDelegateLeg = !numericSelfResolve(GALE) && Boolean(GALE.delegates_to);
    expect(entersDelegateLeg).toBe(false);
  });

  it('delegates_to kept byte-unchanged (sanctioned, predicate provably precedes)', () => {
    expect(GALE.delegates_to).toBe('Corpse Wind (Recharge 5-6)');
    // The delegate still RESOLVES (data intact for the byte-shape) — it is the
    // routing guard that never reaches it. legendaryDelegateAttackName's mislead
    // "(Corpse Wind (Recharge 5-6) save)" spend suffix is delegate-leg-only.
    expect(legendaryDelegateAction(NIDHOGG, GALE)).toBe(WIND);
  });

  it('key order: structured keys authored after description; no save_effect / hit_conditions bait', () => {
    expect(Object.keys(GALE)).toEqual([
      'name',
      'delegates_to',
      'description',
      'save_dc',
      'save_type',
      'damage_dice_primary',
      'damage_type_primary',
      'dc_success',
    ]);
    // No canonical condition word on the row ("pushed" is advisory §70) — save_effect
    // stays absent; hit_conditions is attack-lane bait (§153/MA-1898).
    expect(GALE.save_effect).toBeUndefined();
    expect(GALE.hit_conditions).toBeUndefined();
    expect(GALE.attack_bonus).toBeUndefined();
    expect(GALE.recharge).toBeUndefined(); // Corpse Wind's recharge must NOT ride the legendary lane
  });

  it('Corpse Wind actions[3] byte-guard — MA-1948 recharge fix intact, untouched', () => {
    expect(WIND.name).toBe('Corpse Wind (Recharge 5-6)');
    expect(WIND.recharge).toBe('5-6');
    expect(WIND.save_dc).toBe(24);
    expect(WIND.save_type).toBe('Constitution');
    expect(WIND.damage_dice_primary).toBe('12d10');
    expect(WIND.damage_type_primary).toBe('Necrotic');
    expect(WIND.dc_success).toBeUndefined(); // half-default RAW-correct for the master (MA-1948 pin)
  });

  it('header + pure-delegate siblings byte-inert: uses:3 header, Bite/Claw stay delegate children', () => {
    const [header, bite, claw] = NIDHOGG.legendary_actions;
    expect(header.name).toBe('Legendary Action Uses: 3');
    expect(header.uses).toBe(3);
    expect(header.save_dc).toBeUndefined();
    expect(bite.name).toBe('Bite');
    expect(bite.delegates_to).toBe('Bite');
    expect(numericSelfResolve(bite)).toBe(false); // stays a delegate — only Grave Gale self-resolves
    expect(claw.name).toBe('Claw');
    expect(claw.delegates_to).toBe('Claw');
    expect(claw.save_dc).toBeUndefined();
  });
});
