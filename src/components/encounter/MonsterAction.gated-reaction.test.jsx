// MA-0006: the Feather Fall reaction row must expose a clickable affordance
// on the monster card (previously inert — no affordance, zero consumers).
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonsterAction } from './MonsterAction.jsx';

const FEATHER_FALL_ACTION = {
  name: 'Feather Fall (1/Day)',
  description: 'The aarakocra casts <strong>Feather Fall</strong> in response to that spell\'s trigger.',
  usage: '1/Day',
  uses: 1,
  maxUses: 1,
  automation: { type: 'reaction', trigger: 'falling', effect: 'feather_fall' },
};

function renderRow(overrides = {}) {
  const onGatedReaction = vi.fn();
  const utils = render(
    <MonsterAction
      action={FEATHER_FALL_ACTION}
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

describe('MA-0006 MonsterAction Feather Fall affordance', () => {
  it('renders a clickable Feather Fall reaction link', () => {
    const { onGatedReaction } = renderRow();
    const link = Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.querySelector('.fa-feather'));
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Feather Fall');
    fireEvent.click(link);
    expect(onGatedReaction).toHaveBeenCalledWith(FEATHER_FALL_ACTION);
  });

  it('shows remaining uses and the usage echo', () => {
    renderRow();
    expect(screen.getByText('(1 left)')).toBeTruthy();
    expect(screen.getByText('(1/Day)')).toBeTruthy();
  });

  it('marks the row spent at 0 remaining', () => {
    const { container } = renderRow({ reactionUsesUsed: { feather_fall: 1 } });
    expect(container.querySelector('.mc-dice-link-spell-spent')).toBeTruthy();
    expect(screen.getByText('(0 left)')).toBeTruthy();
  });

  it('non-gated reaction rows gain no affordance', () => {
    const { container } = render(
      <MonsterAction
        action={{ name: 'Talon', description: 'Melee Weapon Attack.' }}
        index={0}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        onGatedReaction={vi.fn()}
      />
    );
    expect(container.querySelector('.mc-dice-link')).toBeNull();
  });
});
