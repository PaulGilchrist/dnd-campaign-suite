// @maintained-by-ai
// MA-0014/MA-0015 unrollable-damage lane: rows whose damage formula fails
// canRollExpression (dynamic tokens "spell level"/"spell attack modifier"/
// "spellcasting modifier"/"WIS modifier", empty/null) must render as static
// text only — never a clickable chip that dies silently (MV-6: no dead links).
// Discriminator here is ROLLABILITY alone: the synthetic legs carry NO attack
// wording (attackRowMissingToHit false) so zero-chip is attributable to
// canRollExpression only. The attack-row suppression gate is owned by
// MA-0286 (MonsterAction.ma0286-slam-suppression.test.jsx) whose census
// SKIPS unrollable formulas ("if (!rollable) continue") — the two lanes are
// disjoint complements. Deleted twins (covered stronger by the owner):
//   - Club attack-row suppression leg → MA-0286 ON leg :45 (disk verbatim,
//     byte description-pin + exact rollable precondition + zero chips +
//     zero role=button + zero dispatch).
//   - Heat Aura rollable-rolls-positive leg → MA-0286 OFF leg :61 (disk
//     giant-frog Swallow: exact chip count + exact payload + identity +
//     single dispatch, vs fabricated fixture + objectContaining here).
// canRollExpression direct-call census kept (ONE test): diceRoller.test.js
// has no canRollExpression coverage and every other caller pins only its own
// feature formula string — the empty/null + token-family false legs live here.
// Huge/Large Animated Object slam formula false-legs: summonSpiritHandler.mao-huge-slam.
import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { attackRowMissingToHit } from './MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const diskRow = (monsterIndex, actionName) =>
  monsters.find(m => m.index === monsterIndex).actions.find(a => a.name === actionName);

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

describe('MA-0014 canRollExpression lane census (owner: no unit coverage in diceRoller.test.js)', () => {
  it('dynamic-token/prose/empty formulas unrollable; numeric formulas rollable', () => {
    // False legs: the four token families of the 32 unrollable disk rows.
    for (const formula of ['1d8+3+spell level', '+spell attack modifier', '2d6+3+spellcasting modifier', '1d8+2+WIS modifier', '1d4+spell level', '', null]) {
      expect(canRollExpression(formula)).toBe(false);
    }
    for (const formula of ['1d6+2', '2d6', '1d8+3', '1d6 [fire]']) {
      expect(canRollExpression(formula)).toBe(true);
    }
  });
});

describe('MA-0014 unrollable formula never arms a damage chip (rollability-isolated legs)', () => {
  // attackRowMissingToHit false on every leg → if canRollExpression ever
  // accepted a token formula, a chip WOULD appear; zero chips discriminates
  // the rollability gate alone (the MA-0286 attack-row gate cannot mask it).
  it.each([
    ['unrollable primary', { name: 'Psychic Barrage', description: 'The target takes 1d8+3+spell level Psychic damage.', attack_bonus: null, damage_dice_primary: '1d8+3+spell level', damage_type_primary: 'Psychic' }, '1d8+3+spell level'],
    ['unrollable secondary', { name: 'Mind Blast Echo', description: 'The target takes 1d4+spell level Psychic damage.', attack_bonus: null, damage_dice_primary: null, damage_dice_secondary: '1d4+spell level', damage_type_primary: 'Psychic' }, '1d4+spell level'],
  ])('%s renders static text only — zero chips, zero dispatch', (_leg, row, formula) => {
    expect(attackRowMissingToHit(row)).toBe(false);
    expect(canRollExpression(formula)).toBe(false);
    const { container, onDamage } = renderRow(row);
    expect(container.querySelectorAll('.mc-dice-link').length).toBe(0);
    expect(container.textContent).toContain(formula);
    expect(onDamage).not.toHaveBeenCalled();
  });
});

describe('MA-0014/MA-0015 unrollable disk rows verbatim — fully static, zero affordance', () => {
  it.each([
    ['aberrant-spirit-beholderkin', 'Eye Ray'],
    ['aberrant-spirit-mind-flayer', 'Psychic Slam'],
  ])('%s / %s — caster-dependent tokens kept as authored, no fabricated numerics, no clickable affordance', (monsterIndex, actionName) => {
    const row = diskRow(monsterIndex, actionName);
    expect(row.attack_bonus).toBeNull();
    expect(row.damage_dice_primary).toBe('1d8+3+spell level');
    expect(canRollExpression(row.damage_dice_primary)).toBe(false);
    const { container, onDamage, onAttack } = renderRow(row);
    expect(container.querySelectorAll('.mc-dice-link').length).toBe(0);
    expect(container.querySelectorAll('[role="button"]').length).toBe(0);
    expect(container.textContent).toContain(actionName);
    expect(container.textContent).toContain('+spell attack modifier');
    expect(container.textContent).toContain('1d8+3+spell level');
    expect(onDamage).not.toHaveBeenCalled();
    expect(onAttack).not.toHaveBeenCalled();
  });
});
