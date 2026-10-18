// @maintained-by-ai: 2026-10-18
// MA-1638: Vampire "Grave Strike" — prose carries "If the target is a
// Large or smaller creature, it has the Grappled condition (escape DC 14)
// from one of two hands" but the row shipped WITHOUT hit_conditions/
// escape_dc, so the grapple rider was structurally inert (buildHitCondition-
// Clause reads hit_conditions/escape_dc keys only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions w/ size gate
// isLargeOrSmallerTarget). Two-field DATA fix mirroring the MA-0909 dual-
// damage byte-shape (MA-0010 seam): hit_conditions:["grappled"] + escape_dc:14
// placed AFTER the last damage key (damage_type_secondary), unlike the
// MA-1620 single-damage tyrannosaurus twin which lands them after
// damage_type_primary. Absorption grep BY NAME: handlePlainDamage.hitClause
// HIT_CLAUSE_ROWS :224-282 "vampire" hits are vampire-SPAWN Claw :273
// (grappled/escape_dc 13 — the spawn, NOT this row) and vampire-umbral-lord
// Sickening Ray :274 (poisoned, te lane); no ['vampire','Grave Strike']
// tuple, no grappled+escape_dc 14 attack row (honest nearest twins: aboleth
// Tentacle 14 :227, ankheg 13 :232) → THIS file is the sole byte-owner: one
// fused test locks disk row keys BY NAME + exact bytes (verbatim toEqual
// absorbs the no-save-fields absence check, the restrained-NEVER-joins §70
// advisory — "from one of two hands" is flavor, sustained-grapple state
// machine has zero producers — and every numerics/description pin), arms
// the tuple-miss clause locally, then the "+9" chip press delivers that
// exact row through onAttack (identity — payload IS the disk object).
// OWNERS OUTSIDE THIS FILE (trimmed, cited):
//  - attackRowMissingToHit truth table + whole-database live-chip census →
//    MonsterAction.ma0286-slam-suppression.test.jsx (:89-113)
//  - DC0 save-chip gate → MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx
//  - generic conditions+escapeDc clause passthrough → handlePlainDamage.hit
//    Clause.test.js:183-216
//  - vampire Bite save row bytes (DC 17 CON, drain/regain riders) →
//    MonsterCardHelpers.ma1639-vampire-bite-recover.test.jsx
//  - Deathless/Umbral Strike delegates_to Grave Strike + Expend-Legendary
//    chip routing → MonsterCardModal.legendary-uses-vampire-ma1641.test.jsx,
//    MonsterCardModal.legendary-uses-umbral-lord.test.jsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const VAMPIRE = monsters.find((m) => m.index === 'vampire');
const GRAVE = VAMPIRE.actions[1];
const BITE = VAMPIRE.actions[2];

const GRAVE_EXACT = {
  name: 'Grave Strike',
  description: 'Melee Attack Roll: +9, reach 5 ft. Hit: 8 (1d8 + 4) Bludgeoning damage plus 7 (2d6) Necrotic damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two hands.',
  attack_bonus: 9,
  reach: '5 ft.',
  damage_dice_primary: '1d8 + 4',
  damage_type_primary: 'Bludgeoning',
  damage_dice_secondary: '2d6',
  damage_type_secondary: 'Necrotic',
  hit_conditions: ['grappled'],
  escape_dc: 14,
};

describe('MA-1638 disk fingerprint: vampire Grave Strike grapple rider fix', () => {
  it('sole-owner row fingerprint + tuple-miss clause arm + live "+9" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order — hit_conditions + escape_dc
    // sit immediately after damage_type_secondary (MA-0909 dual-damage shape,
    // distinct from the MA-1620 single-damage twin's damage_type_primary anchor).
    expect(Object.keys(GRAVE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'damage_dice_secondary',
      'damage_type_secondary',
      'hit_conditions',
      'escape_dc',
    ]);
    // Exact bytes: any added save_dc/save_type/hit_target_effect, any
    // restrained join (§70 ceiling), or drifted numeric (+9 attack bonus,
    // 5 ft. reach, 1d8 + 4 Bludgeoning + 2d6 Necrotic, escape DC 14) breaks
    // this one assertion (absorbs field-absence + prose "escape DC 14"/
    // "Grappled condition"/"from one of two hands" pins).
    expect(GRAVE).toEqual(GRAVE_EXACT);
    // Inverted cross-row pin: the fix never spilled onto the Bite save row
    // (whose own bytes are MA-1639-owned).
    expect(BITE.name).toBe('Bite');
    expect(BITE.hit_conditions).toBeUndefined();

    // Tuple-miss delta: no HIT_CLAUSE_ROWS twin arms this exact
    // grappled+escapeDc 14 clause — pin the arm locally (was null pre-fix).
    expect(buildHitConditionClause(GRAVE)).toEqual({
      conditions: ['grappled'],
      escapeDc: 14,
      attackName: 'Grave Strike',
      targetEffect: null,
    });

    // Chip-level dispatch: exactly one "+9" attack chip (dual damage keys
    // render NO damage chip — attack_bonus arms the attack lane; no Bite /
    // Expend-Legendary decoys join this row's chip set), press routes
    // name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={GRAVE}
        index={1}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+9']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Grave Strike', 9, GRAVE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions + escape_dc
    // bytes ride the attack lane untouched (no copy/strip) into the clause
    // consumer.
    expect(onAttack.mock.calls[0][2]).toBe(GRAVE);
  });
});
