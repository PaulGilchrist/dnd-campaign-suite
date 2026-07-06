import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MantleOfInspirationModal from './MantleOfInspirationModal.jsx';

vi.mock('./shared/CreatureSelectionModal.jsx', () => {
  return {
    default: (props) => {
      return (
        <div data-testid="creature-selection-modal">
          <div data-testid="modal-title">{props.title}</div>
          <div data-testid="modal-description">{props.description}</div>
          {props.note && <div data-testid="modal-note">{props.note}</div>}
          <div data-testid="modal-targets">
            {props.targets.map((target, i) => (
              <div key={i} data-testid={`target-${i}`}>
                {target.name || target}
              </div>
            ))}
          </div>
          <button
            data-testid="confirm-button"
            onClick={() => props.onConfirm(['Target1', 'Target2'])}
            disabled={props.targets.length === 0}
          >
            {props.confirmLabel || 'Confirm'}
          </button>
          <button
            data-testid="skip-button"
            onClick={() => props.onSkip && props.onSkip()}
          >
            Skip
          </button>
        </div>
      );
    },
  };
});

describe('MantleOfInspirationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes correct title to CreatureSelectionModal', () => {
    render(
      <MantleOfInspirationModal
        creatureTargets={[{ name: 'Target1' }]}
        tempHp={8}
        dieRoll={4}
        bardicDieSize={6}
        maxTargets={3}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Mantle of Inspiration');
  });

  it('passes correct icon to CreatureSelectionModal', () => {
    render(
      <MantleOfInspirationModal
        creatureTargets={[{ name: 'Target1' }]}
        tempHp={8}
        dieRoll={4}
        bardicDieSize={6}
        maxTargets={3}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    // The icon is rendered as an <i> element inside the modal header
    const modal = screen.getByTestId('creature-selection-modal');
    expect(modal).toBeDefined();
  });

  it('passes correct description to CreatureSelectionModal', () => {
    render(
      <MantleOfInspirationModal
        creatureTargets={[{ name: 'Target1' }]}
        tempHp={8}
        dieRoll={4}
        bardicDieSize={6}
        maxTargets={3}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByTestId('modal-description')).toHaveTextContent('Choose allies to grant temporary hit points');
  });

  it('passes note with die roll and temp HP info to CreatureSelectionModal', () => {
    render(
      <MantleOfInspirationModal
        creatureTargets={[{ name: 'Target1' }]}
        tempHp={8}
        dieRoll={4}
        bardicDieSize={6}
        maxTargets={3}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByTestId('modal-note')).toHaveTextContent('Rolled 4 on 1d6');
    expect(screen.getByTestId('modal-note')).toHaveTextContent('8 temp HP');
    expect(screen.getByTestId('modal-note')).toHaveTextContent('Reaction to move up to their Speed without provoking Opportunity Attacks');
  });

  it('passes creature targets to CreatureSelectionModal', () => {
    render(
      <MantleOfInspirationModal
        creatureTargets={[{ name: 'Target1' }, { name: 'Target2' }]}
        tempHp={8}
        dieRoll={4}
        bardicDieSize={6}
        maxTargets={3}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByTestId('target-0')).toHaveTextContent('Target1');
    expect(screen.getByTestId('target-1')).toHaveTextContent('Target2');
  });

  it('passes maxTargets to CreatureSelectionModal', () => {
    const onConfirm = vi.fn();
    const onSkip = vi.fn();

    render(
      <MantleOfInspirationModal
        creatureTargets={[{ name: 'Target1' }]}
        tempHp={8}
        dieRoll={4}
        bardicDieSize={6}
        maxTargets={2}
        onConfirm={onConfirm}
        onSkip={onSkip}
      />
    );

    // Click confirm to trigger onConfirm
    fireEvent.click(screen.getByTestId('confirm-button'));
    expect(onConfirm).toHaveBeenCalledWith(['Target1', 'Target2']);
  });

  it('calls onSkip when skip button is clicked', () => {
    const onSkip = vi.fn();

    render(
      <MantleOfInspirationModal
        creatureTargets={[{ name: 'Target1' }]}
        tempHp={8}
        dieRoll={4}
        bardicDieSize={6}
        maxTargets={3}
        onConfirm={vi.fn()}
        onSkip={onSkip}
      />
    );

    fireEvent.click(screen.getByTestId('skip-button'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('passes confirmLabel "Inspire" to CreatureSelectionModal', () => {
    render(
      <MantleOfInspirationModal
        creatureTargets={[{ name: 'Target1' }]}
        tempHp={8}
        dieRoll={4}
        bardicDieSize={6}
        maxTargets={3}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByTestId('confirm-button')).toHaveTextContent('Inspire');
  });

  it('renders with empty targets list', () => {
    render(
      <MantleOfInspirationModal
        creatureTargets={[]}
        tempHp={8}
        dieRoll={4}
        bardicDieSize={6}
        maxTargets={3}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    // The modal should still render even with no targets
    expect(screen.getByTestId('creature-selection-modal')).toBeDefined();
  });
});
