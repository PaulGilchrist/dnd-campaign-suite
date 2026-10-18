// @maintained-by-ai
// MA-1620: Tyrannosaurus Rex "Bite" — prose carries "If the target is a
// Large or smaller creature, it has the Grappled condition (escape DC 17)"
// but the row shipped WITHOUT hit_conditions/escape_dc, so the grapple rider
// was structurally inert (buildHitConditionClause reads hit_conditions/
// escape_dc keys only, NEVER description; consumer live in handlePlainDamage.
// applyHitClauseConditions w/ size gate isLargeOrSmallerTarget at :836).
// Two-field DATA fix mirroring the MA-0909/MA-1274 byte-shape (MA-0010
// seam): hit_conditions:["grappled"] + escape_dc:17 placed after
// damage_type_primary. tyrannosaurus-rex is NOT in handlePlainDamage.hit
// Clause HIT_CLAUSE_ROWS :224-282 (grep-verified BY NAME — no tyrannosaurus
// row, and grappled+escape_dc 17 appears nowhere in the table; honest tuple
// read: nearest grappled-escape twins sit at DC 12-14, e.g. aboleth 14
// :227, ankheg 13 :232, bugbear-warrior 12 :240) → THIS file is the sole
// byte-owner: one fused test locks disk row keys BY NAME + exact bytes
// (verbatim toEqual absorbs the no-save-fields absence check, the
// restrained-NEVER-joins §70 advisory, and every numerics/description pin),
// arms the tuple-miss clause locally, then the "+10" chip press delivers
// that exact row through onAttack (identity — payload IS the disk object).
// OWNERS OUTSIDE THIS FILE (trimmed, cited):
//  - attackRowMissingToHit suppression gate OFF leg + whole-database live-
//    chip census → MonsterAction.ma0286-slam-suppression.test.jsx (armed
//    attack_bonus rows keep their chip; tyrannosaurus Bite sits in census)
//  - DC0 save-chip gate → MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx
//  - generic conditions+escapeDc clause passthrough → handlePlainDamage.hit
//    Clause.test.js:183-216 (and its grappled-escape twin table lane)
//  - Tail row prone pin + Bite-untouched inverted pin → MA-1621 sibling
//    (MonsterAction.ma1621-tyrannosaurus-rex-tail-hit-conditions.test.jsx)
// "While Grappled → Restrained + Tail immunity" stays the sustained-grapple
// state machine with zero producers (§70) — GM-adjudicated residual; the
// verbatim ['grappled'] bytes here are the ceiling.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'tyrannosaurus-rex').actions[1];

const BITE_EXACT = {
  name: 'Bite',
  description: "Melee Attack Roll: +10, reach 10 ft. Hit: 33 (4d12 + 7) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17). While Grappled, the target has the Restrained condition and can't be targeted by the tyrannosaurus's Tail.",
  attack_bonus: 10,
  reach: '10 ft.',
  damage_dice_primary: '4d12 + 7',
  damage_type_primary: 'Piercing',
  hit_conditions: ['grappled'],
  escape_dc: 17,
};

describe('MA-1620 disk fingerprint: tyrannosaurus-rex Bite grapple rider fix', () => {
  it('sole-owner row fingerprint + tuple-miss clause arm + live "+10" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions + escape_dc
    // sit immediately after damage_type_primary (MA-0909/MA-1274 byte-shape).
    expect(Object.keys(BITE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
      'escape_dc',
    ]);
    // Exact bytes: any added save_dc/save_type/hit_target_effect, any
    // restrained join (§70 ceiling), or drifted numeric (+10 attack bonus,
    // 10 ft. reach, 4d12 + 7 Piercing, escape DC 17) breaks this one
    // assertion (absorbs field-absence + prose "escape DC 17"/"Grappled
    // condition" pins).
    expect(BITE).toEqual(BITE_EXACT);

    // Tuple-miss delta: no HIT_CLAUSE_ROWS twin arms this exact
    // grappled+escapeDc 17 clause — pin the arm locally (was null pre-fix).
    expect(buildHitConditionClause(BITE)).toEqual({
      conditions: ['grappled'],
      escapeDc: 17,
      attackName: 'Bite',
      targetEffect: null,
    });

    // Chip-level dispatch: exactly one "+10" attack chip (no damage chip —
    // attack_bonus arms the attack lane), press routes name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BITE}
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
    expect(chips).toEqual(['+10']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 10, BITE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions + escape_dc
    // bytes ride the attack lane untouched (no copy/strip) into the clause
    // consumer.
    expect(onAttack.mock.calls[0][2]).toBe(BITE);
  });
});
