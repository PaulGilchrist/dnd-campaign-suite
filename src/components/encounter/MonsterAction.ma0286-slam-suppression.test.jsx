// @maintained-by-ai
// MA-0286: Animated Object (Medium) Slam (attack_bonus null, rollable
// "1d4+3", "Melee Spell Attack" wording) rendered a clickable damage chip
// that auto-hit — click rolled damage + hp_change with NO attack roll / AC
// check. Canonical: every attack needs a to-hit roll; caster-dependent
// bonuses are unauthored (MA-0284), so honest suppression (attackRowMissingToHit)
// renders the row as plain text. Damage-only rows (breath/aura/swallow,
// no attack wording) keep their chips — OFF leg + boundary (armed attack_bonus)
// pinned here once, plus a whole-database census so the gate never silently
// strips a legit damage-only affordance. Huge/Large siblings are byte-inert
// via unrollable formulas — owned by MA-0285 (summonSpiritHandler.mao-huge-slam.test.js).
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { attackRowMissingToHit } from './MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';
import { extractDamageDiceFromDescription } from './MonsterCardModal.jsx';

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

describe('MA-0286 suppression gate — MonsterAction damage chip', () => {
  it('ON: Animated Object (Medium) Slam (disk verbatim) — null bonus + rollable 1d4+3 attack row renders text-only, zero dispatch', () => {
    const slam = diskRow('animated-object-medium', 'Slam');
    expect(slam.attack_bonus).toBeNull();
    expect(slam.damage_dice_primary).toBe('1d4+3');
    expect(canRollExpression(slam.damage_dice_primary)).toBe(true);
    expect(slam.description).toBe('Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d4+3 Force damage.');
    const { container, onDamage, onAttack } = renderRow(slam);
    expect(container.querySelectorAll('.mc-dice-link').length).toBe(0);
    expect(container.querySelectorAll('[role="button"]').length).toBe(0);
    expect(container.textContent).toContain('Slam');
    expect(container.textContent).toContain('1d4+3');
    expect(container.textContent).toContain('+spell attack modifier');
    expect(onDamage).not.toHaveBeenCalled();
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('OFF: damage-only row (giant-frog Swallow) keeps its exact-byte damage chip and rolls once', () => {
    const row = diskRow('giant-frog', 'Swallow');
    expect(attackRowMissingToHit(row)).toBe(false);
    const { getAllByRole, onDamage, onAttack } = renderRow(row);
    const chips = getAllByRole('button');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('2d4');
    fireEvent.click(chips[0]);
    expect(onDamage).toHaveBeenCalledTimes(1);
    expect(onDamage).toHaveBeenCalledWith('Swallow', '2d4', 'Acid', row);
    expect(onAttack).not.toHaveBeenCalled();
  });

  it('boundary: authored attack_bonus (Drow Mage Staff +2, MA-0647) arms the attack chip only — rollable secondary never becomes an auto-hit damage chip', () => {
    const staff = diskRow('drow-mage', 'Staff');
    expect(staff.attack_bonus).toBe(2);
    expect(staff.damage_dice_secondary).toBe('1d6');
    const { getAllByRole, onAttack, onDamage } = renderRow(staff);
    const chips = getAllByRole('button');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('+2');
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Staff', 2, staff);
    expect(onDamage).not.toHaveBeenCalled();
  });
});

describe('MA-0286 attackRowMissingToHit truth table (helper owner — Huge/Large sibling guards live in summonSpiritHandler.mao-huge-slam.test.js)', () => {
  it.each([
    ['attack wording, null bonus — the auto-hit defect', { name: 'Slam', attack_bonus: null, description: 'Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d4+3 Force damage.' }, true],
    ['structured attackType alone, null bonus', { name: 'X', attackType: 'melee weapon attack', description: 'Hit: 2d6 damage.' }, true],
    ['authored attack_bonus — armed attack stays live', { name: 'Rend', attack_bonus: 9, description: 'Melee Weapon Attack: +9 to hit. Hit: 2d6+5.' }, false],
    ['damage-only row — legit chip kept', { name: 'Heat Aura', description: 'At the end of each of its turns, each creature takes 2d10 Fire damage.' }, false],
    ['null input', null, false],
  ])('%s → %s', (_leg, action, expected) => {
    expect(attackRowMissingToHit(action)).toBe(expected);
  });
});

describe('MA-0286 suppression-gate census — whole monsters.json', () => {
  it('suppresses exactly the auto-hit attack rows app-wide; every legit damage-only affordance is kept', () => {
    const suppressed = [];
    const kept = [];
    for (const mo of monsters) {
      for (const key of ['actions', 'legendary_actions', 'reactions']) {
        for (const a of Array.isArray(mo[key]) ? mo[key] : []) {
          if (!a || typeof a !== 'object') continue;
          if (a.save_dc != null || a.attack_bonus != null) continue;
          const formula = extractDamageDiceFromDescription(a.description, a.damage_dice_primary);
          const rollable = (formula && canRollExpression(formula)) || (a.damage_dice_secondary != null && canRollExpression(a.damage_dice_secondary));
          if (!rollable) continue;
          if (attackRowMissingToHit(a)) suppressed.push(`${mo.index}/${a.name}`);
          else kept.push(`${mo.index}/${a.name}`);
        }
      }
    }
    // CLA-130: otherworldly-steed/Hooves is a summon-lane caster-fold row
    // (owner: summonSpiritHandler); MA-0286 suppression is correct for it
    // on EB-direct join, same as animated-object-medium.
    expect(suppressed).toEqual(['animated-object-medium/Slam', 'otherworldly-steed/Hooves']);
    expect(kept).toEqual(expect.arrayContaining(['giant-frog/Swallow', 'young-remorhaz/Heat Aura']));
  });
});
