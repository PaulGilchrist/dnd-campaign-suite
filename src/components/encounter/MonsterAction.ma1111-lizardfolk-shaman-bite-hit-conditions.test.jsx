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
// escape_dc:12 placed after damage_type_primary. Locks: disk row shape + key
// placement, clause arms with escapeDc:12, "+4" attack chip stays live, no
// save fields on row.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'lizardfolk-shaman').actions[1];

describe('MA-1111 disk fingerprint: lizardfolk-shaman Bite grapple rider fix', () => {
  it('description OCR fixed to 1d10 + 2 (no 1dlO), cosmetic "Ifthe" run-on untouched', () => {
    expect(BITE.name).toBe('Bite');
    expect(BITE.description).toContain('7 (1d10 + 2) piercing damage in crocodile form');
    expect(BITE.description).not.toContain('1dlO');
    expect(BITE.description).toContain('Ifthe lizardfolk is in crocodile form');
    expect(BITE.description).toContain('escape DC 12');
  });

  it('disk row carries hit_conditions ["grappled","restrained"] + escape_dc 12 after damage_type_primary (MA-0801 byte-shape)', () => {
    expect(BITE.hit_conditions).toEqual(['grappled', 'restrained']);
    expect(BITE.escape_dc).toBe(12);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(BITE.attack_bonus).toBe(4);
    expect(BITE.reach).toBe('5 ft.');
    expect(BITE.damage_dice_primary).toBe('1d6 + 2');
    expect(BITE.damage_type_primary).toBe('Piercing');
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(BITE.save_dc).toBeUndefined();
    expect(BITE.save_type).toBeUndefined();
    expect(BITE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled/Restrained rider with escapeDc 12 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BITE);
    expect(clause).toEqual({
      conditions: ['grappled', 'restrained'],
      escapeDc: 12,
      attackName: 'Bite',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+4" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(BITE)).toBe(false);
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
    expect(onAttack).toHaveBeenCalledWith('Bite', 4, expect.objectContaining({ name: 'Bite' }));
  });
});
