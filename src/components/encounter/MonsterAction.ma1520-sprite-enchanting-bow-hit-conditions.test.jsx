// @maintained-by-ai
// MA-1520: Sprite "Enchanting Bow" — the row's OWN Hit clause carries the
// Charmed rider ("Hit: 1 Piercing damage, and the target has the Charmed
// condition until the start of the sprite's next turn") but the row authored
// NO hit_conditions (§59/§950 fingerprint — buildHitConditionClause reads
// hit_conditions / hit_target_effect / hit_condition_roll only, NEVER
// description prose on the attack-hit path), so the rider was inert
// zero-state FAIL(a). Fix: DATA one-field hit_conditions:["charmed"] after
// range (MA-0984 Trash Lob / MA-1274 otyugh byte-shape). Flat-damage row
// stays byte-unchanged: damage_dice_primary ABSENT → extractFlatHitDamage
// supplies the constant "1" (MA-0322 lineage, owner flat-hit-damage.test.js;
// flat never doubles on crit). §108 residual: engine-wide took-damage clears
// Charmed inside applyDamage BEFORE the hit clause re-grants (handlePlain-
// Damage.js:1154 → :1181) — live ledger shows removed→applied pairs per hit;
// accepted. sprite is NOT in handlePlainDamage.hitClause HIT_CLAUSE_ROWS
// :224-282 (grep-verified), so THIS file is the sole byte-owner: one fused
// test locks disk row keys BY NAME in transport order + exact bytes (exact
// toEqual absorbs name/attack_bonus/range, the prose Charmed word, flat-
// damage-dice absence, and every save-decoy/hit_target_effect/hit_condition_
// roll field-absence check — this row carries NO 0/"" save decoys, disk keys
// decide shape), then the "+6" chip press delivers that exact row through
// onAttack (identity — payload IS the disk object, MonsterAction.jsx:480
// passthrough). Clause arm for the ["charmed"]+escapeDc-null shape and the
// attack suppression gate are owned generically: hitClause mega-lane data-
// locks via byte-twins satyr-revelmaster Prance :270 and noble-prodigy
// Beguiling Strike :266 (charmed, escapeDc null) + clause arm :289-301,
// suppression census ma0286:95-121, DC0 save gate ma1071 — per-census (#419,
// cf. ma1357:17-22) no local buildHitConditionClause/attackRowMissingToHit
// re-derivation here — exact-bytes + live chip are the tighter pin. Needle
// Sword twin's rider absence is a foreign row: its inert-bytes belong to
// MA-1522 monsterSelfBuff.sprite-invisibility.test.js disk[1]-discriminator
// :114-117 (old :127 cite drifted; header map :43 records disk[4]->disk[1]),
// not re-derived here. (fix#366 cite-retarget #1144)
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BOW = monsters.find((m) => m.index === 'sprite').actions[1];

const BOW_EXACT = {
  name: 'Enchanting Bow',
  description: "Ranged Attack Roll: +6, range 40/160 ft. Hit: 1 Piercing damage, and the target has the Charmed condition until the start of the sprite's next turn.",
  attack_bonus: 6,
  range: '40/160 ft.',
  hit_conditions: ['charmed'],
};

describe('MA-1520 disk fingerprint: sprite Enchanting Bow hit_conditions fix', () => {
  it('sole-owner row fingerprint + live "+6" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions sits
    // immediately after range (MA-0984/MA-0010 byte-shape); this row carries
    // NO save_dc/save_type/save_effect decoys, NO damage dice (flat "1" via
    // extractFlatHitDamage), NO escape_dc/hit_target_effect/hit_condition_roll.
    expect(Object.keys(BOW)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'range',
      'hit_conditions',
    ]);
    // Exact bytes: any drifted numeric, added save decoy, prose drift, or
    // added/dropped key breaks this one assertion (absorbs all field-absence
    // and prose checks, including the canonical Charmed word on the Hit).
    expect(BOW).toEqual(BOW_EXACT);

    // Chip-level dispatch: exactly one "+6" attack chip (no save/DC decoy
    // chip, no damage chip — attack_bonus arms the attack lane), press routes
    // name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BOW}
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
    expect(chips).toEqual(['+6']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Enchanting Bow', 6, BOW_EXACT);
    // Identity: the payload IS the disk row — hit_conditions bytes ride the
    // attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(BOW);
  });
});
