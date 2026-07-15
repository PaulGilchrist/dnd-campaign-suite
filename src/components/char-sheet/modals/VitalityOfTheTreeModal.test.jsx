import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./shared/CreatureSelectionModal.jsx', () => {
  const Mock = ({ title, icon, _targets, maxTargets, description, note, _confirmLabel, _confirmIcon, onConfirm, onSkip }) => (
    <div data-testid="creature-selection-modal">
      <h2 data-testid="modal-title">{title}</h2>
      <span data-testid="modal-icon">{icon}</span>
      <span data-testid="modal-description">{description}</span>
      <span data-testid="modal-note">{note}</span>
      <span data-testid="modal-max-targets">{maxTargets}</span>
      <button data-testid="confirm-btn" onClick={() => onConfirm(['Target1'])}>Confirm</button>
      <button data-testid="skip-btn" onClick={onSkip}>Skip</button>
    </div>
  );
  return { default: Mock };
});

import VitalityOfTheTreeModal from './VitalityOfTheTreeModal.jsx';

describe('VitalityOfTheTreeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with correct title', () => {
    render(
      <VitalityOfTheTreeModal
        creatureTargets={[{ name: 'Ally1' }]}
        tempHp={5}
        maxTargets={2}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Vitality of the Tree');
  });

  it('renders the correct icon', () => {
    render(
      <VitalityOfTheTreeModal
        creatureTargets={[{ name: 'Ally1' }]}
        tempHp={5}
        maxTargets={2}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByTestId('modal-icon')).toHaveTextContent('fa-tree');
  });

  it('displays correct description with max targets', () => {
    render(
      <VitalityOfTheTreeModal
        creatureTargets={[{ name: 'Ally1' }]}
        tempHp={5}
        maxTargets={3}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByTestId('modal-description')).toHaveTextContent('Choose up to 3 creatures to grant temporary hit points');
  });

  it('displays correct note with temp HP amount', () => {
    render(
      <VitalityOfTheTreeModal
        creatureTargets={[{ name: 'Ally1' }]}
        tempHp={7}
        maxTargets={2}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByTestId('modal-note')).toHaveTextContent('Each target gains 7 temp HP from the World Tree\'s life force.');
  });

  it('calls onConfirm with selected targets when confirm is clicked', () => {
    const onConfirm = vi.fn();
    const onSkip = vi.fn();

    render(
      <VitalityOfTheTreeModal
        creatureTargets={[{ name: 'Ally1' }]}
        tempHp={5}
        maxTargets={2}
        onConfirm={onConfirm}
        onSkip={onSkip}
      />
    );

    screen.getByTestId('confirm-btn').click();

    expect(onConfirm).toHaveBeenCalledWith(['Target1']);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('calls onSkip when skip is clicked', () => {
    const onConfirm = vi.fn();
    const onSkip = vi.fn();

    render(
      <VitalityOfTheTreeModal
        creatureTargets={[{ name: 'Ally1' }]}
        tempHp={5}
        maxTargets={2}
        onConfirm={onConfirm}
        onSkip={onSkip}
      />
    );

    screen.getByTestId('skip-btn').click();

    expect(onSkip).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
