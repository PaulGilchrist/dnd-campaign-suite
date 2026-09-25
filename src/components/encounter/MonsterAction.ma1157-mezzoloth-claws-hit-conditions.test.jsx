// MA-1157: Mezzoloth "Claws" — description carries the grapple rider "If the
// target is a Large or smaller creature, it has the Grappled condition (escape
// DC 14) from two of four claws, and it has the Restrained condition until the
// grapple ends." but the row shipped WITHOUT hit_conditions/escape_dc, so the
// rider was structurally inert (buildHitConditionClause reads the
// hit_conditions/escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix mirroring
// giant-crocodile Bite byte-shape (MA-0801) / MA-1111 in-file twin:
// hit_conditions:["grappled","restrained"] + escape_dc:14 placed after
// damage_type_primary. "two of four claws" / "until the grapple ends" stay
// flavor advisory (§59/§70 grapple state-machine zero producers). Locks: disk
// row shape + key placement, clause arms with escapeDc 14, single "+7" attack
// chip, DC0 decoy stays gated off (MA-1071 — no save chip on row).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const CLAWS = monsters.find((m) => m.index === 'mezzoloth').actions[1];

describe('MA-1157 disk fingerprint: mezzoloth Claws grapple/restrained rider fix', () => {
  it('description carries the raw rider prose byte-intact', () => {
    expect(CLAWS.name).toBe('Claws');
    expect(CLAWS.description).toContain('Melee Attack Roll: +7, reach 5 ft.');
    expect(CLAWS.description).toContain('Hit: 9 (2d4 + 4) Slashing damage.');
    expect(CLAWS.description).toContain('Grappled</strong> condition (escape DC 14)');
    expect(CLAWS.description).toContain('Restrained</strong> condition until the grapple ends.');
  });

  it('disk row carries hit_conditions ["grappled","restrained"] + escape_dc 14 after damage_type_primary (MA-0801/MA-1111 byte-shape)', () => {
    expect(CLAWS.hit_conditions).toEqual(['grappled', 'restrained']);
    expect(CLAWS.escape_dc).toBe(14);
    const keys = Object.keys(CLAWS);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(CLAWS.attack_bonus).toBe(7);
    expect(CLAWS.reach).toBe('5 ft.');
    expect(CLAWS.damage_dice_primary).toBe('2d4 + 4');
    expect(CLAWS.damage_type_primary).toBe('Slashing');
  });

  it('row has NO real save fields — save_dc 0 decoy stays gated off (MA-1071)', () => {
    expect(CLAWS.save_dc).toBe(0);
    expect(CLAWS.save_type).toBe('');
    expect(CLAWS.save_effect).toBe('');
    expect(CLAWS.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled/Restrained rider with escapeDc 14 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(CLAWS);
    expect(clause).toEqual({
      conditions: ['grappled', 'restrained'],
      escapeDc: 14,
      attackName: 'Claws',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+7" chip, no DC chip, no stale suppression', () => {
    expect(attackRowMissingToHit(CLAWS)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={CLAWS}
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
    expect(chips).toEqual(['+7']);
    expect(container.querySelectorAll('.mc-dice-link-save, .mc-dice-link-save-clickable')).toHaveLength(0);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Claws', 7, expect.objectContaining({ name: 'Claws' }));
  });
});
