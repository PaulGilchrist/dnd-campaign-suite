// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MassHealingWordModal from './MassHealingWordModal.jsx';

// MassHealingWordModal is a thin props adapter over CreatureSelectionModal.
// The shared modal's own behavior (target rendering, string targets, empty
// list, selection, maxTargets clamping, confirm/skip semantics) is covered
// by shared/CreatureSelectionModal.test.jsx, and the confirm flow through
// CharActionModals.healing-handlers.test.jsx — these tests pin only the
// wrapper's contract: the fixed Mass Healing Word configuration it supplies
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

describe('MassHealingWordModal', () => {
  it('supplies the Mass Healing Word spell configuration to CreatureSelectionModal', () => {
    render(<MassHealingWordModal
      creatureTargets={[{ name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 }]}
      maxTargets={6}
      onConfirm={() => {}}
      onSkip={() => {}}
    />);

    expect(capturedProps).toMatchObject({
      title: 'Mass Healing Word',
      icon: 'fa-feather',
      description: 'Choose up to 6 creatures to heal.',
      confirmLabel: 'Heal',
      confirmIcon: 'fa-feather',
    });

    // Rendered output sanity: the fixed config reaches the DOM.
    expect(screen.getByText('Mass Healing Word')).toBeInTheDocument();
    expect(document.querySelector('.fa-feather')).toBeInTheDocument();
    expect(screen.getByText('Choose up to 6 creatures to heal.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Heal/ })).toBeInTheDocument();
  });

  it('forwards targets, maxTargets, and callbacks to CreatureSelectionModal', () => {
    const targets = [
      { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
      'TargetB',
    ];
    const onConfirm = vi.fn();
    const onSkip = vi.fn();

    render(<MassHealingWordModal
      creatureTargets={targets}
      maxTargets={3}
      onConfirm={onConfirm}
      onSkip={onSkip}
    />);

    expect(capturedProps.targets).toBe(targets);
    expect(capturedProps.maxTargets).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Ally1']);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalled();
  });
});
