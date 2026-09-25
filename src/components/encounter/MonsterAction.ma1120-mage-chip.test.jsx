// MA-1120: Mage "Protective Magic" reaction row must expose the gated
// Counterspell chip (was prose-only inert — zero affordance). Mirrors
// MonsterAction.ma0300-arcanaloth-chip.test.jsx, on the REAL monsters.json row.
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import monsters from '../../../public/data/monsters.json';

const MAGE_ACTION = monsters.find(m => m.index === 'mage').reactions[0];

function renderRow(overrides = {}) {
  const onGatedReaction = vi.fn();
  const utils = render(
    <MonsterAction
      action={MAGE_ACTION}
      index={0}
      attackerCannotAct={false}
      onAttack={vi.fn()}
      onDamage={vi.fn()}
      onSaveRoll={vi.fn()}
      onSpellCast={vi.fn()}
      reactionUsesUsed={{}}
      onGatedReaction={onGatedReaction}
      {...overrides}
    />
  );
  return { ...utils, onGatedReaction };
}

describe('MA-1120 MonsterAction mage Protective Magic chip', () => {
  it('renders a clickable Counterspell gated-reaction link', () => {
    const { onGatedReaction } = renderRow();
    const link = Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.querySelector('.fa-shield'));
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Counterspell');
    fireEvent.click(link);
    expect(onGatedReaction).toHaveBeenCalledWith(MAGE_ACTION);
  });

  it('shows sentinel remaining uses and the honest "At Will" usage echo', () => {
    renderRow();
    expect(screen.getByText('(999 left)')).toBeTruthy();
    expect(screen.getByText('(At Will)')).toBeTruthy();
  });

  it('counts down after spends and never marks spent pre-sentinel (RAW-unlimited)', () => {
    const { container } = renderRow({ reactionUsesUsed: { counterspell: 2 } });
    expect(screen.getByText('(997 left)')).toBeTruthy();
    expect(container.querySelector('.mc-dice-link-spell-spent')).toBeNull();
  });
});
