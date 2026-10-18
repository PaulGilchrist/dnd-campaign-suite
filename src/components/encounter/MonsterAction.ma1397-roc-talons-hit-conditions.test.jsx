// @maintained-by-ai
// MA-1397: Roc "Talons" — prose carries "If the target is a Huge or smaller
// creature, it has the Grappled condition (escape DC 19) from both talons, and
// it has the Restrained condition until the grapple ends" but the row shipped
// WITHOUT hit_conditions/escape_dc, so the grapple rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// Two-field DATA fix mirroring purple-worm Bite / remorhaz Bite byte-shape
// (MA-1357/MA-1389): hit_conditions:["grappled","restrained"] + escape_dc:19
// placed after damage_type_primary. Disk prose DC 19 is canonical (disk-is-truth
// §3; 8+PB+STR would also be 19 — NOT recomputed). "+13" attack_bonus is disk-
// truth too. "From both talons" count-stacking and size-gate stay GM-advisory.
// roc is NOT in handlePlainDamage.hitClause HIT_CLAUSE_ROWS :224-282 (grep-
// verified), so THIS file is the sole byte-owner: one fused test locks disk row
// keys BY NAME in transport order + exact bytes (exact toEqual absorbs name/
// reach/attack_bonus, damage byte-unchanged, the save-decoy 0/"" check and
// hit_target_effect absence), then the "+13" chip press delivers that exact row
// through onAttack (identity — payload IS the disk object, MonsterAction.jsx:480
// passthrough). Clause arm for the ["grappled","restrained"]+escapeDc shape and
// the attack suppression gate are owned generically: hitClause mega-lane data-
// locks via byte-twins aberrant-cultist Tentacle Lash :225 (escapeDc 14) +
// crocodile Bite :248 (grappled/restrained+escape) + clause arm :296-301,
// suppression census ma0286:95-121, DC0 save gate ma1071 — per-census (#419,
// cf. ma1357:17-22) no local buildHitConditionClause/attackRowMissingToHit
// re-derivation here — exact-bytes + live chip are the tighter pin.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TALONS = monsters.find((m) => m.index === 'roc').actions[2];

const TALONS_EXACT = {
  name: 'Talons',
  description: 'Melee Attack Roll: +13, reach 5 ft. Hit: 23 (4d6 + 9) Slashing damage. If the target is a Huge or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 19) from both talons, and it has the <strong>Restrained</strong> condition until the grapple ends.',
  attack_bonus: 13,
  save_dc: 0,
  save_type: '',
  save_effect: '',
  range: '',
  reach: '5 ft.',
  recharge: '',
  damage_dice_primary: '4d6 + 9',
  damage_type_primary: 'Slashing',
  hit_conditions: ['grappled', 'restrained'],
  escape_dc: 19,
};

describe('MA-1397 disk fingerprint: roc Talons grapple rider fix', () => {
  it('sole-owner row fingerprint + live "+13" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions + escape_dc
    // sit immediately after damage_type_primary (MA-1357 byte-shape twin — the
    // purple-worm Bite this fix mirrored); no save/hit_target_effect leg added.
    expect(Object.keys(TALONS)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'save_dc',
      'save_type',
      'save_effect',
      'range',
      'reach',
      'recharge',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
      'escape_dc',
    ]);
    // Exact bytes: any drifted numeric, save decoy, or added/dropped key
    // breaks this one assertion (absorbs field-absence checks).
    expect(TALONS).toEqual(TALONS_EXACT);

    // Chip-level dispatch: exactly one "+13" attack chip (no damage chip —
    // attack_bonus arms the attack lane), press routes name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TALONS}
        index={2}
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
    expect(chips).toEqual(['+13']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Talons', 13, TALONS_EXACT);
    // Identity: the payload IS the disk row — hit_conditions/escape_dc bytes
    // ride the attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(TALONS);
  });
});
