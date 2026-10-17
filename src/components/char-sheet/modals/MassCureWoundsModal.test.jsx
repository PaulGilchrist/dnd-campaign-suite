// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MassCureWoundsModal from './MassCureWoundsModal.jsx';

// MassCureWoundsModal is a thin props adapter over CreatureSelectionModal.
// The shared modal's own behavior (target rendering, string targets, empty
// list, selection, maxTargets clamping, confirm/skip semantics) is covered
// by shared/CreatureSelectionModal.test.jsx — these tests pin only the
// wrapper's contract: the fixed Mass Cure Wounds configuration it supplies
// and the props it forwards unchanged.

const { capturedProps } = vi.hoisted(() => ({ capturedProps: {} }));

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
  default: (props) => {
    Object.assign(capturedProps, props);
    return (
      <div data-testid="creature-selection-modal">
        <div className="sp-header">
          <i className={`fa-solid ${props.icon}`}></i> {props.title}
        </div>
        {props.description && <p>{props.description}</p>}
        <button type="button" onClick={() => props.onConfirm?.(['Ally1'])}>
          <i className={`fa-solid ${props.confirmIcon || 'fa-crosshairs'}`}></i> {props.confirmLabel || 'Confirm'}
        </button>
        <button type="button" onClick={() => props.onSkip?.()}>Skip</button>
      </div>
    );
  },
}));

beforeEach(() => {
  Object.keys(capturedProps).forEach((key) => delete capturedProps[key]);
});

describe('MassCureWoundsModal', () => {
  it('supplies the Mass Cure Wounds spell configuration to CreatureSelectionModal', () => {
    render(<MassCureWoundsModal
      creatureTargets={[{ name: 'Ally1', type: 'player' }]}
      maxTargets={3}
      onConfirm={() => {}}
      onSkip={() => {}}
    />);

    expect(capturedProps).toMatchObject({
      title: 'Mass Cure Wounds',
      icon: 'fa-heart',
      description: 'Choose up to 6 allies within 30 feet to heal.',
      confirmLabel: 'Cure',
      confirmIcon: 'fa-heart',
    });

    // Rendered output sanity: the fixed config reaches the DOM.
    expect(screen.getByText('Mass Cure Wounds')).toBeInTheDocument();
    expect(document.querySelector('.fa-heart')).toBeInTheDocument();
    expect(screen.getByText('Choose up to 6 allies within 30 feet to heal.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cure/ })).toBeInTheDocument();
  });

  it('forwards targets, maxTargets, and callbacks to CreatureSelectionModal', () => {
    const targets = [
      { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
      'TargetB',
    ];
    const onConfirm = vi.fn();
    const onSkip = vi.fn();

    render(<MassCureWoundsModal
      creatureTargets={targets}
      maxTargets={3}
      onConfirm={onConfirm}
      onSkip={onSkip}
    />);

    expect(capturedProps.targets).toBe(targets);
    expect(capturedProps.maxTargets).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: /Cure/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Ally1']);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalled();
  });
});
