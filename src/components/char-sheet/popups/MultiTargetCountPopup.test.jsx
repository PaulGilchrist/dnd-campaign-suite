// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MultiTargetCountPopup from './MultiTargetCountPopup.jsx';

const spell = { name: 'Scorching Ray', level: 2 };
const creatureTargets = ['Goblin', 'Skeleton', 'Orc'];
const onConfirm = vi.fn();
const onSkip = vi.fn();

// Title is prop-distinct from spell.name so header vs spell-line copy is attributable.
function renderPopup(overrides = {}) {
  return render(
    <MultiTargetCountPopup
      spell={spell}
      creatureTargets={creatureTargets}
      maxTargets={3}
      onConfirm={onConfirm}
      onSkip={onSkip}
      icon="fa-solid fa-fire"
      title="Choose Targets"
      school="Evocation"
      defaultLevel={2}
      description="Create three rays of fire."
      {...overrides}
    />
  );
}

// Copy lives across a <strong>, so pin the whole paragraph from its strong node.
const spellLine = () =>
  screen.getByText('Scorching Ray').closest('p').textContent.replace(/\s+/g, ' ').trim();

// Selected rows render as "✓ Name"; match both states by name.
const targetRow = (name) => screen.getByText(new RegExp(`^✓? ?${name}$`));
const counter = () => screen.getByText(/^Targets \(\d\/\d\):/);

describe('MultiTargetCountPopup', () => {
  it('renders title, spell brief, description, one selectable row per target, and labelled actions', () => {
    renderPopup({ confirmLabel: 'Cast Scorching Ray', cancelLabel: 'Keep Casting Elsewhere' });

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Choose Targets');
    expect(spellLine()).toBe('Scorching Ray — Level 2 Evocation');
    expect(screen.getByText('Create three rays of fire.')).toBeInTheDocument();
    expect(screen.getAllByText(/^✓? ?(Goblin|Skeleton|Orc)$/)).toHaveLength(3);
    expect(counter().textContent).toBe('Targets (0/3):');
    expect(screen.getByRole('button', { name: 'Cast Scorching Ray' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep Casting Elsewhere' })).toBeInTheDocument();
  });

  it('defaults confirm label to "Cast <title>" and cancel label to "Cancel"', () => {
    renderPopup();

    expect(screen.getByRole('button', { name: 'Cast Choose Targets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('toggles targets on click, marking selected rows and updating the counter', () => {
    renderPopup();

    fireEvent.click(targetRow('Goblin'));
    expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
    expect(counter().textContent).toBe('Targets (1/3):');

    fireEvent.click(targetRow('Skeleton'));
    expect(counter().textContent).toBe('Targets (2/3):');

    fireEvent.click(screen.getByText('✓ Goblin'));
    expect(screen.queryByText('✓ Goblin')).not.toBeInTheDocument();
    expect(screen.getByText('✓ Skeleton')).toBeInTheDocument();
    expect(counter().textContent).toBe('Targets (1/3):');
  });

  it('clamps selection at maxTargets', () => {
    renderPopup({ maxTargets: 2 });

    fireEvent.click(targetRow('Goblin'));
    fireEvent.click(targetRow('Skeleton'));
    fireEvent.click(targetRow('Orc'));
    expect(counter().textContent).toBe('Targets (2/2):');
    expect(screen.queryByText('✓ Orc')).not.toBeInTheDocument();
  });

  it('keeps confirm disabled until at least one target is selected', () => {
    renderPopup({ confirmLabel: 'Cast Scorching Ray' });
    const cast = () => screen.getByRole('button', { name: 'Cast Scorching Ray' });

    expect(cast()).toBeDisabled();
    fireEvent.click(targetRow('Goblin'));
    expect(cast()).not.toBeDisabled();
    fireEvent.click(screen.getByText('✓ Goblin'));
    expect(cast()).toBeDisabled();
  });

  it('confirms the exact selection in click order, exactly once', () => {
    renderPopup({ confirmLabel: 'Cast Scorching Ray' });

    fireEvent.click(targetRow('Skeleton'));
    fireEvent.click(targetRow('Orc'));
    fireEvent.click(screen.getByRole('button', { name: 'Cast Scorching Ray' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(['Skeleton', 'Orc']);
  });

  it('dismisses via cancel button and Escape key, firing onSkip once each', () => {
    renderPopup();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSkip).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(2);
  });
});
