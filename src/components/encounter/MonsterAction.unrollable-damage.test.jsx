// MA-0014: damage chips for unparseable formulas (e.g. Aberrant Spirit
// (Beholderkin) Eye Ray "1d8+3+spell level") must not render as clickable
// affordances — MV-6: static text only, no dead links. Parseable numeric
// formulas must still render and roll.
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const EYE_RAY = {
  name: 'Eye Ray',
  description: 'Ranged Spell Attack: +spell attack modifier, range 150 ft. Hit: 1d8+3+spell level Psychic damage.',
  attack_bonus: null,
  damage_dice_primary: '1d8+3+spell level',
  damage_type_primary: 'Psychic',
  damage_dice_secondary: null,
  range: '150 ft.',
};

function renderRow(action, overrides = {}) {
  const onDamage = vi.fn();
  const onAttack = vi.fn();
  const utils = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={onAttack}
      onDamage={onDamage}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      {...overrides}
    />
  );
  return { ...utils, onDamage, onAttack };
}

describe('MA-0014 canRollExpression', () => {
  it('rejects dynamic-token formulas and empty/null input', () => {
    expect(canRollExpression('1d8+3+spell level')).toBe(false);
    expect(canRollExpression('+spell attack modifier')).toBe(false);
    expect(canRollExpression('')).toBe(false);
    expect(canRollExpression(null)).toBe(false);
  });

  it('accepts numeric dice formulas', () => {
    expect(canRollExpression('1d6+2')).toBe(true);
    expect(canRollExpression('2d6')).toBe(true);
    expect(canRollExpression('1d8+3')).toBe(true);
    expect(canRollExpression('1d6 [fire]')).toBe(true);
  });
});

describe('MA-0014 MonsterAction damage chip gating', () => {
  it('does not render a clickable chip for unparseable damage_dice_primary', () => {
    const { container } = renderRow(EYE_RAY);
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.some(el => el.textContent.includes('spell level'))).toBe(false);
    expect(container.textContent).toContain('Ranged Spell Attack');
  });

  it('does not render a clickable chip for unparseable damage_dice_secondary', () => {
    const { container } = renderRow({ ...EYE_RAY, damage_dice_secondary: '1d4+spell level' });
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.some(el => el.textContent.includes('1d4'))).toBe(false);
  });

  it('still renders and rolls parseable numeric damage chips', () => {
    const { container, onDamage } = renderRow({
      name: 'Club',
      description: 'Melee Weapon Attack. Hit: 1 (1d6+2) bludgeoning damage.',
      attack_bonus: null,
      damage_dice_primary: '1d6+2',
      damage_type_primary: 'Bludgeoning',
    });
    const chip = [...container.querySelectorAll('.mc-dice-link')].find(el => el.textContent.includes('1d6+2'));
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onDamage).toHaveBeenCalledWith('Club', '1d6+2', 'Bludgeoning', expect.objectContaining({ name: 'Club' }));
  });
});

describe('MA-0015 Aberrant Spirit (Mind Flayer) Psychic Slam', () => {
  const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
  const spirit = monsters.find(m => m.index === 'aberrant-spirit-mind-flayer');
  const psychicSlam = spirit.actions.find(a => a.name === 'Psychic Slam');

  it('authored row keeps caster-dependent tokens (no fabricated numerics)', () => {
    expect(psychicSlam.attack_bonus).toBeNull();
    expect(psychicSlam.damage_dice_primary).toBe('1d8+3+spell level');
    expect(canRollExpression(psychicSlam.damage_dice_primary)).toBe(false);
  });

  it('renders the row as fully static text — no to-hit link, no damage chip', () => {
    const { container, onDamage, onAttack } = renderRow(psychicSlam);
    expect(container.querySelectorAll('.mc-dice-link').length).toBe(0);
    expect(container.querySelectorAll('[role="button"]').length).toBe(0);
    expect(container.textContent).toContain('Psychic Slam');
    expect(container.textContent).toContain('+spell attack modifier');
    expect(onDamage).not.toHaveBeenCalled();
    expect(onAttack).not.toHaveBeenCalled();
  });
});
