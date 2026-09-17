// MA-0300: Arcanaloth Counterspell reaction row must expose the gated
// reaction chip (was prose-only inert — zero affordance). Mirrors
// MonsterAction.gated-reaction.test.jsx, on the REAL monsters.json row.
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';
import monsters from '../../../public/data/monsters.json';

const ARCANA_ACTION = monsters.find(m => m.index === 'arcanaloth').reactions[0];

function renderRow(overrides = {}) {
  const onGatedReaction = vi.fn();
  const utils = render(
    <MonsterAction
      action={ARCANA_ACTION}
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

describe('MA-0300 MonsterAction arcanaloth Counterspell chip', () => {
  it('renders a clickable Counterspell gated-reaction link', () => {
    const { onGatedReaction } = renderRow();
    const link = Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.querySelector('.fa-shield'));
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Counterspell');
    fireEvent.click(link);
    expect(onGatedReaction).toHaveBeenCalledWith(ARCANA_ACTION);
  });

  it('shows sentinel remaining uses and the honest "At Will" usage echo', () => {
    renderRow();
    expect(screen.getByText('(999 left)')).toBeTruthy();
    expect(screen.getByText('(At Will)')).toBeTruthy();
  });

  it('counts down after spends and only marks spent at 0 (RAW-unlinked to 1/Day)', () => {
    const { container } = renderRow({ reactionUsesUsed: { counterspell: 3 } });
    expect(screen.getByText('(996 left)')).toBeTruthy();
    expect(container.querySelector('.mc-dice-link-spell-spent')).toBeNull();
  });
});
