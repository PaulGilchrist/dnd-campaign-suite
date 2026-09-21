// MA-0286: Animated Object (Medium) Slam (attack_bonus null, rollable
// "1d4+3", "Melee Spell Attack" wording) rendered a clickable damage chip
// that auto-hit — click rolled damage + hp_change with NO attack roll / AC
// check. Canonical: every attack needs a to-hit roll; caster-dependent
// bonuses are unauthored (MA-0284), so honest suppression renders the row
// as plain text, exactly like the Huge/Large siblings. Damage-only rows
// (breath/aura/swallow, no attack wording) keep their chips — locked here
// plus a whole-database scan so the suppression gate never silently strips
// a legit damage-only affordance.
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import { attackRowMissingToHit } from './MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const byIndex = i => monsters.find(m => m.index === i);
const diskRow = (monsterIndex, actionName) => byIndex(monsterIndex).actions.find(a => a.name === actionName);

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

describe('MA-0286 disk fingerprint — Animated Object (Medium) Slam', () => {
  const slam = diskRow('animated-object-medium', 'Slam');

  it('authored row: null attack_bonus, rollable 1d4+3, attack wording — no fabricated bonus', () => {
    expect(slam.attack_bonus).toBeNull();
    expect(slam.damage_dice_primary).toBe('1d4+3');
    expect(canRollExpression(slam.damage_dice_primary)).toBe(true);
    expect(slam.description).toMatch(/Melee Spell Attack/i);
  });

  it('renders text-only — no damage link, no role=button, zero-click affordance', () => {
    const { container, onDamage, onAttack } = renderRow(slam);
    expect(container.querySelectorAll('.mc-dice-link').length).toBe(0);
    expect(container.querySelectorAll('[role="button"]').length).toBe(0);
    expect(container.textContent).toContain('Slam');
    expect(container.textContent).toContain('1d4+3');
    expect(container.textContent).toContain('+spell attack modifier');
    expect(onDamage).not.toHaveBeenCalled();
    expect(onAttack).not.toHaveBeenCalled();
  });
});

describe('MA-0286 Huge/Large siblings unchanged (MA-0284 fingerprint intact)', () => {
  it.each([
    ['animated-object-huge', '2d12+3+spellcasting modifier'],
    ['animated-object-large', '2d6+3+spellcasting modifier'],
  ])('%s Slam stays byte-clean inert: null bonus, unrollable formula, no affordance', (index, formula) => {
    const slam = diskRow(index, 'Slam');
    expect(slam.attack_bonus).toBeNull();
    expect(slam.damage_dice_primary).toBe(formula);
    expect(canRollExpression(slam.damage_dice_primary)).toBe(false);
    const { container, onDamage } = renderRow(slam);
    expect(container.querySelectorAll('.mc-dice-link').length).toBe(0);
    expect(container.querySelectorAll('[role="button"]').length).toBe(0);
    expect(onDamage).not.toHaveBeenCalled();
  });
});

describe('MA-0286 attackRowMissingToHit helper', () => {
  it('flags attack-wording and attackType rows with null attack_bonus', () => {
    expect(attackRowMissingToHit({ name: 'Slam', attack_bonus: null, description: 'Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d4+3 Force damage.' })).toBe(true);
    expect(attackRowMissingToHit({ name: 'X', description: 'Ranged Weapon Attack blah' })).toBe(true);
    expect(attackRowMissingToHit({ name: 'X', attackType: 'melee weapon attack', description: 'Hit: 2d6 damage.' })).toBe(true);
  });

  it('passes damage-only rows and rows with an authored to-hit bonus', () => {
    expect(attackRowMissingToHit({ name: 'Heat Aura', description: 'At the end of each of its turns, each creature takes 2d10 Fire damage.' })).toBe(false);
    expect(attackRowMissingToHit({ name: 'Rend', attack_bonus: 9, description: 'Melee Weapon Attack: +9 to hit. Hit: 2d6+5.' })).toBe(false);
    expect(attackRowMissingToHit(null)).toBe(false);
  });
});

describe('MA-0286 damage-only rows keep their clickable damage chips', () => {
  it.each([
    ['giant-frog', 'Swallow', '2d4'],
    ['young-remorhaz', 'Heat Aura', '2d10'],
  ])('%s %s renders a live damage chip that rolls', (monsterIndex, actionName, formula) => {
    const row = diskRow(monsterIndex, actionName);
    expect(attackRowMissingToHit(row)).toBe(false);
    const { container, onDamage } = renderRow(row);
    const chip = [...container.querySelectorAll('.mc-dice-link')].find(el => el.textContent.includes(formula));
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onDamage).toHaveBeenCalledWith(actionName, formula, expect.any(String), expect.objectContaining({ name: actionName }));
  });
});

describe('MA-0286 suppression-gate collateral scan — whole monsters.json', () => {
  const extract = (d, existing) => {
    if (existing) return existing;
    if (!d) return null;
    const hm = d.match(/(?:Hit|Failure|Success):\s*\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/i);
    return hm ? hm[1].replace(/\s+/g, ' ').trim() : null;
  };

  it('suppresses EXACTLY the one auto-hit attack row app-wide (AO Medium Slam; Drow Mage Staff armed by MA-0647)', () => {
    const suppressed = [];
    const kept = [];
    for (const mo of monsters) {
      for (const key of ['actions', 'legendary_actions', 'reactions']) {
        for (const a of Array.isArray(mo[key]) ? mo[key] : []) {
          if (!a || typeof a !== 'object') continue;
          if (a.save_dc != null || a.attack_bonus != null) continue;
          const formula = extract(a.description, a.damage_dice_primary);
          const rollable = (formula && canRollExpression(formula)) || (a.damage_dice_secondary != null && canRollExpression(a.damage_dice_secondary));
          if (!rollable) continue;
          if (attackRowMissingToHit(a)) suppressed.push(`${mo.index}/${a.name}`);
          else kept.push(`${mo.index}/${a.name}`);
        }
      }
    }
    expect(suppressed).toEqual(['animated-object-medium/Slam']);
    expect(kept).toEqual(expect.arrayContaining(['giant-frog/Swallow', 'young-remorhaz/Heat Aura']));
    expect(kept.every(k => !/attack/i.test(k))).toBe(true);
  });

  it('MA-0647: Drow Mage Staff armed with attack_bonus 2 — renders the +2 attack chip, no auto-hit damage chip', () => {
    const staff = diskRow('drow-mage', 'Staff');
    expect(staff.attack_bonus).toBe(2);
    expect(attackRowMissingToHit(staff)).toBe(false);
    expect(staff.description).toMatch(/Melee Weapon Attack/i);
    const { container, onDamage, onAttack } = renderRow(staff);
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('+2');
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledWith('Staff', 2, expect.objectContaining({ name: 'Staff' }));
    expect(onDamage).not.toHaveBeenCalled();
    expect(container.textContent).toContain('1d6 - 1');
  });
});
