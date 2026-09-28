// MA-1450: Seahorse "Bubble Dash" render lock — pre-fix disk row carried
// junk attack_bonus:0 → MonsterAction.jsx attack_bonus != null admitted 0 and
// rendered a clickable "+0" mc-dice-link routing onAttack (bogus to-hit).
// Post-fix advisory fields arm AdvisoryLink: exactly ONE chip on the row,
// class mc-dice-link-advisory, NO plain "+0" mc-dice-link; press routes
// onAdvisoryRow (resolver: record-only ability_use, zero rolls) never
// onAttack/onSaveRoll/onDamage.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { resolveMonsterActionAdvisoryRow } from '../../services/encounters/monsterActionAdvisory.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SEAHORSE = monsters.find((m) => m.index === 'seahorse');
const BUBBLE_DASH = SEAHORSE.actions[0];

const renderRow = (action, extra = {}) => {
  const onAttack = vi.fn();
  const onAdvisoryRow = vi.fn();
  const onSaveRoll = vi.fn();
  const onDamage = vi.fn();
  const { container } = render(
    <MonsterAction
      action={action}
      index={0}
      attackerCannotAct={false}
      onAttack={onAttack}
      onDamage={onDamage}
      onSaveRoll={onSaveRoll}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={vi.fn()}
      onAdvisoryRow={onAdvisoryRow}
      {...extra}
    />
  );
  return { container, onAttack, onAdvisoryRow, onSaveRoll, onDamage };
};

describe('MA-1450 MonsterAction render: advisory chip replaces the junk "+0"', () => {
  it('Bubble Dash row: advisory chip present labelled "Bubble Dash", honest title, NO "+0" attack chip', () => {
    const { container } = renderRow(BUBBLE_DASH);
    const chip = container.querySelector('.mc-dice-link-advisory');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Bubble Dash');
    expect(chip.getAttribute('title')).toMatch(/moves up to its Swim Speed/);
    expect(chip.getAttribute('title')).toMatch(/GM-enforced/);
    expect(chip.getAttribute('title')).toMatch(/No attack roll, no saving throw, no dice\./);
    expect(Array.from(container.querySelectorAll('.mc-dice-link')).filter((c) => c !== chip)).toHaveLength(0);
    expect(container.textContent).not.toContain('+0');
  });

  it('advisory chip press routes onAdvisoryRow with the row, never onAttack/onSaveRoll/onDamage', () => {
    const { container, onAttack, onAdvisoryRow, onSaveRoll, onDamage } = renderRow(BUBBLE_DASH);
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).toHaveBeenCalledTimes(1);
    expect(onAdvisoryRow.mock.calls[0][0]).toBe(BUBBLE_DASH);
    expect(onAttack).not.toHaveBeenCalled();
    expect(onSaveRoll).not.toHaveBeenCalled();
    expect(onDamage).not.toHaveBeenCalled();
  });

  it('incapacitated adviser chip is inert (no click route)', () => {
    const { container, onAdvisoryRow } = renderRow(BUBBLE_DASH, { attackerCannotAct: true });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    expect(onAdvisoryRow).not.toHaveBeenCalled();
  });

  it('without a resolver wired the chip is inert (no crash, no route)', () => {
    const { container } = renderRow(BUBBLE_DASH, { onAdvisoryRow: undefined });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
  });
});

describe('MA-1450 press→resolver end-to-end: record-only ability_use, zero roll entries', () => {
  it('chip press invokes the MA-1223 advisory resolver: popup + ONE ability_use, no rolls', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    let pending = null;
    const { container } = renderRow(BUBBLE_DASH, {
      onAdvisoryRow: (action) => {
        pending = resolveMonsterActionAdvisoryRow({ action, monsterName: 'Seahorse 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
        return pending;
      },
    });
    fireEvent.click(container.querySelector('.mc-dice-link-advisory'));
    await pending;
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
  });
});
