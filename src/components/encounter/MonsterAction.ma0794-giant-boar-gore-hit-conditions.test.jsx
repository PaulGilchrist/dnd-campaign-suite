// @maintained-by-ai
// MA-0794: Giant Boar "Gore" — prose carries "the target ... has the Prone
// condition" but the row shipped WITHOUT hit_conditions, so the condition
// rider was structurally inert (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions
// with isLargeOrSmallerTarget gate). One-field DATA fix:
// hit_conditions:["prone"] placed after damage_type_secondary — transport
// keys grouped, matching the closest authored siblings that carry BOTH
// damage_dice_secondary AND hit_conditions (Tentacle Lash / Shortsword /
// Flame Whip byte-shape). giant-boar is NOT in handlePlainDamage.hitClause
// HIT_CLAUSE_ROWS (grep-verified) and no other lane pins this chip, so
// THIS file is the sole byte-owner: one fused test locks disk row shape +
// key placement + full row bytes, then the "+5" chip press delivers that
// exact row through onAttack (identity — payload IS the disk object).
// Clause arm for a ["prone"]/null-DC row is owned generically by the
// hitClause mega-lane (:183-216 shapes + table data-locks :289-301 via
// prone siblings ankylosaurus Tail :228 etc.); secondary charge-extra
// transport rides PRIMARY every hit via buildSecondaryDamageTransport
// (ChargeBonusOffer NOT required per §531 gridless) — bytes pinned here.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GORE = monsters.find((m) => m.index === 'giant-boar').actions[0];

const GORE_EXACT = {
  name: 'Gore',
  description: 'Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Piercing damage. If the target is a Large or smaller creature and the boar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 7 (2d6) Piercing damage and has the <strong>Prone</strong> condition.',
  attack_bonus: 5,
  reach: '5 ft.',
  damage_dice_primary: '2d6 + 3',
  damage_type_primary: 'Piercing',
  damage_dice_secondary: '2d6',
  damage_type_secondary: 'Piercing',
  hit_conditions: ['prone'],
};

describe('MA-0794 disk fingerprint: giant-boar Gore hit_conditions fix', () => {
  it('sole-owner row fingerprint + live "+5" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions sits
    // immediately after damage_type_secondary (siblings byte-shape).
    expect(Object.keys(GORE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'damage_dice_secondary',
      'damage_type_secondary',
      'hit_conditions',
    ]);
    expect(GORE).toEqual(GORE_EXACT);

    // Chip-level dispatch: exactly one "+5" attack chip (no damage chip —
    // attack_bonus arms the attack lane), press routes name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={GORE}
        index={0}
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
    expect(chips).toEqual(['+5']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Gore', 5, GORE_EXACT);
    // Identity: the payload IS the disk row — secondary charge-extra and
    // hit_conditions bytes ride the attack lane untouched (no copy/strip).
    expect(onAttack.mock.calls[0][2]).toBe(GORE);
  });
});
