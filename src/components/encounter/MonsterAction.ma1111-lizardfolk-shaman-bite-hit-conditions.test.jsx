// @maintained-by-ai
// MA-1111: Lizardfolk Shaman "Bite" — description carries "7 (1dlO + 2)
// piercing damage in crocodile form" (OCR defect family §23) plus the grapple
// rider "Ifthe lizardfolk is in crocodile form and the target is a Large or
// smaller creature, the target is grappled (escape DC 12). Until this grapple
// ends, the target is restrained…" but the row shipped WITHOUT
// hit_conditions/escape_dc, so the rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// Two-field DATA fix + OCR patch mirroring giant-crocodile Bite byte-shape
// (MA-0801): "1dlO + 2"→"1d10 + 2" in description (cosmetic "Ifthe" run-on
// left untouched — byte-minimal) + hit_conditions:["grappled","restrained"] +
// escape_dc:12 placed after damage_type_primary. FUSED-1 (MA-0801 recipe):
// lizardfolk-shaman is NOT in handlePlainDamage.hitClause HIT_CLAUSE_ROWS
// :224-282 (grep-verified — only crocodile Bite :248 sits there) and the
// MA-1113 lane pins Change Shape only, so THIS file is the sole byte-owner:
// one fused test locks disk row shape + key placement + full row bytes
// (exact-bytes toEqual absorbs the OCR fix "1d10 + 2" / no "1dlO", the
// byte-intact cosmetic "Ifthe" run-on, the no-save-fields absence check —
// attack ride, no save leg — and every numerics pin), then the "+4" chip
// press delivers that exact row through onAttack (identity — payload IS the
// disk object). Clause arm for a conditions+escapeDc row is owned generically
// by the hitClause mega-lane (:184-191 arms escapeDc from hit_conditions +
// escape_dc; :289-301 table data-locks thread escape_dc, exact twin crocodile
// Bite :248 identical grappled/restrained + escape_dc 12); attackRowMissingTo
// Hit truth table is the MA-0286 owner census (ma0286:89-98, live-bonus pin
// :93) — no local re-derivation here; exact bytes + live chip are the tighter
// pin.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'lizardfolk-shaman').actions[1];

const BITE_EXACT = {
  name: 'Bite',
  description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage, or 7 (1d10 + 2) piercing damage in crocodile form. Ifthe lizardfolk is in crocodile form and the target is a Large or smaller creature, the target is grappled (escape DC 12). Until this grapple ends, the target is restrained, and the lizardfolk can\'t bite another target. If the lizardfolk reverts to its true form, the grapple ends.',
  attack_bonus: 4,
  reach: '5 ft.',
  damage_dice_primary: '1d6 + 2',
  damage_type_primary: 'Piercing',
  hit_conditions: ['grappled', 'restrained'],
  escape_dc: 12,
};

describe('MA-1111 disk fingerprint: lizardfolk-shaman Bite grapple rider fix', () => {
  it('sole-owner row fingerprint + live "+4" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions + escape_dc
    // sit immediately after damage_type_primary (MA-0801 byte-shape).
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
    // Exact bytes: OCR fix locked (no "1dlO" letter-O), cosmetic "Ifthe"
    // run-on byte-intact; any re-injected defect, added save_dc/save_type/
    // hit_target_effect or drifted numeric (+4 attack bonus, 5 ft. reach,
    // 1d6 + 2 Piercing, escape DC 12) breaks this one assertion (absorbs
    // field-absence).
    expect(BITE).toEqual(BITE_EXACT);

    // Chip-level dispatch: exactly one "+4" attack chip, no stale suppression
    // (attack_bonus arms the attack lane), press routes name/bonus/row once.
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
    expect(chips).toEqual(['+4']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 4, BITE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions + escape_dc
    // bytes ride the attack lane untouched (no copy/strip) into the clause
    // consumer.
    expect(onAttack.mock.calls[0][2]).toBe(BITE);
  });
});
