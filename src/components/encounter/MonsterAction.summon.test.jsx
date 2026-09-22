// MA-0648: Drow Mage "Summon Demon" chip — automation:{type:"monster_summon"}
// arms a clickable .mc-dice-link-summon affordance on the formerly inert row,
// routing the modal's coin-flip summon adjudication. The 1/Day counter rides
// the MA-0020 monsterSpellUses gate; exhausted chips keep the spent class and
// stay clickable so the click routes the honest refusal (zone-aura precedent).
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const drowMage = monsters.find(m => m.index === 'drow-mage');
const SUMMON_ROW = drowMage.actions.find(a => a.name === 'Summon Demon');

function renderRow(action, overrides = {}) {
  const onSummonRow = vi.fn();
  const utils = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={vi.fn()}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      onSummonRow={onSummonRow}
      {...overrides}
    />
  );
  return { ...utils, onSummonRow };
}

describe('MA-0648 Summon Demon chip', () => {
  it('arms a clickable summon chip with the 1/Day counter', () => {
    const { container, onSummonRow } = renderRow(SUMMON_ROW);
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.textContent).toContain('Summon');
    expect(chip.textContent).toContain('(1/Day · 1 left)');
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
    expect(onSummonRow.mock.calls[0][0]).toBe(SUMMON_ROW);
  });

  it('spent row shows 0 left + spent class and stays clickable for honest refusal', () => {
    const { container, onSummonRow } = renderRow(SUMMON_ROW, { spellUsesUsed: { 'Summon Demon': 1 } });
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(chip.textContent).toContain('0 left');
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
  });

  it('incapacitated attacker: chip inert', () => {
    const { container, onSummonRow } = renderRow(SUMMON_ROW, { attackerCannotAct: true });
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onSummonRow).not.toHaveBeenCalled();
  });

  it('non-summon rows arm no summon chip (Staff row byte-inert)', () => {
    const staff = drowMage.actions.find(a => a.name === 'Staff');
    const { container } = renderRow(staff);
    expect(container.querySelector('.mc-dice-link-summon')).toBeNull();
  });
});

// MA-0651: Drow Priestess of Lolth "Summon Demon" rides the SAME
// monster_summon seam — single chance-option (yochlol 30%) with self-damage
// on fail. Chip arms identically; the 3/Day counter reads uses/maxUses.
const priestess = monsters.find(m => m.index === 'drow-priestess-of-lolth');
const PRIESTESS_ROW = priestess.actions.find(a => a.name === 'Summon Demon');

describe('MA-0651 Priestess Summon Demon chip', () => {
  it('data authors single yochlol chance-option + self-damage + 3/Day', () => {
    expect(PRIESTESS_ROW.automation).toEqual({
      type: 'monster_summon',
      options: [{ monster: 'yochlol', chance: 0.3 }],
      self_damage_formula: '1d10',
      self_damage_type: 'psychic',
      range_ft: 60,
      duration_minutes: 10,
    });
    expect(PRIESTESS_ROW.uses).toBe(3);
    expect(PRIESTESS_ROW.maxUses).toBe(3);
    expect(PRIESTESS_ROW.description).toContain('1d10');
    expect(PRIESTESS_ROW.description).not.toContain('1dlO');
  });

  it('arms a clickable summon chip counting down from 3/Day', () => {
    const { container, onSummonRow } = renderRow(PRIESTESS_ROW);
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('Summon');
    expect(chip.textContent).toContain('(3/Day · 3 left)');
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
    expect(onSummonRow.mock.calls[0][0]).toBe(PRIESTESS_ROW);
  });

  it('two uses spent: 1 left; exhausted: spent class + still clickable', () => {
    const { container } = renderRow(PRIESTESS_ROW, { spellUsesUsed: { 'Summon Demon': 2 } });
    expect(container.querySelector('.mc-dice-link-summon').textContent).toContain('1 left');
    const spent = renderRow(PRIESTESS_ROW, { spellUsesUsed: { 'Summon Demon': 3 } });
    const chip = spent.container.querySelector('.mc-dice-link-summon');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(chip.textContent).toContain('0 left');
    fireEvent.click(chip);
    expect(spent.onSummonRow).toHaveBeenCalledTimes(1);
  });
});

// MA-0757: Galeb Duhr "Animate Boulders" — the formerly zero-affordance
// OTHER-type row (usage-only + ignored uses:"1/Day" STRING) now authors
// monster_summon automation with a CONSTANT numeric count:2 (RAW "one or
// two" GM choice; no chooser seam app-wide → adjudicable max spawns two).
// Chip arms off automation.type with the numeric 1/Day counter; exhausted
// chips stay clickable so the click routes the honest refusal (MA-0648
// precedent). The Avalanche Slam attack row arms NO summon chip.
const galebDuhr = monsters.find(m => m.index === 'galeb-duhr');
const ANIMATE_ROW = galebDuhr.actions.find(a => a.name === 'Animate Boulders');

describe('MA-0757 Galeb Duhr Animate Boulders chip', () => {
  it('arms a clickable summon chip counting 1/Day with honest boulder tooltip', () => {
    const { container, onSummonRow } = renderRow(ANIMATE_ROW);
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.textContent).toContain('Summon');
    expect(chip.textContent).toContain('(1/Day · 1 left)');
    const title = chip.getAttribute('title');
    expect(title).toContain('galeb-duhr');
    expect(title).toContain('count 2');
    expect(title).not.toContain('demon');
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
    expect(onSummonRow.mock.calls[0][0]).toBe(ANIMATE_ROW);
  });

  it('spent row: 0 left + spent class, stays clickable for honest refusal', () => {
    const { container, onSummonRow } = renderRow(ANIMATE_ROW, { spellUsesUsed: { 'Animate Boulders': 1 } });
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(chip.textContent).toContain('0 left');
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
  });

  it('incapacitated duhr: chip inert', () => {
    const { container, onSummonRow } = renderRow(ANIMATE_ROW, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-summon'));
    expect(onSummonRow).not.toHaveBeenCalled();
  });

  it('Avalanche Slam row arms no summon chip', () => {
    const slam = galebDuhr.actions.find(a => a.name === 'Avalanche Slam');
    const { container } = renderRow(slam);
    expect(container.querySelector('.mc-dice-link-summon')).toBeNull();
  });
});

// MA-0759: Galib Duhr "Animate Boulders" — galeb-duhr twin chip test. The
// formerly zero-affordance row (usage DICT rendering cosmetic "(1/Day)"
// only, §241 discriminator) now arms the same summon chip with the numeric
// gate counter; its Slam attack row arms no summon chip.
const galibDuhr = monsters.find(m => m.index === 'galib-duhr');
const GALIB_ANIMATE_ROW = galibDuhr.actions.find(a => a.name === 'Animate Boulders');

describe('MA-0759 Galib Duhr Animate Boulders chip', () => {
  it('arms a clickable summon chip counting 1/Day with honest boulder tooltip', () => {
    const { container, onSummonRow } = renderRow(GALIB_ANIMATE_ROW);
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.textContent).toContain('Summon');
    expect(chip.textContent).toContain('(1/Day · 1 left)');
    const title = chip.getAttribute('title');
    expect(title).toContain('galib-duhr');
    expect(title).toContain('count 2');
    expect(title).not.toContain('demon');
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
    expect(onSummonRow.mock.calls[0][0]).toBe(GALIB_ANIMATE_ROW);
  });

  it('spent row: 0 left + spent class, stays clickable for honest refusal', () => {
    const { container, onSummonRow } = renderRow(GALIB_ANIMATE_ROW, { spellUsesUsed: { 'Animate Boulders': 1 } });
    const chip = container.querySelector('.mc-dice-link-summon');
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(chip.textContent).toContain('0 left');
    fireEvent.click(chip);
    expect(onSummonRow).toHaveBeenCalledTimes(1);
  });

  it('Slam attack row arms no summon chip', () => {
    const slam = galibDuhr.actions.find(a => a.name === 'Slam');
    const { container } = renderRow(slam);
    expect(container.querySelector('.mc-dice-link-summon')).toBeNull();
  });
});
