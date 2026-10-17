// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PrayerOfHealingModal from './PrayerOfHealingModal.jsx';

// PrayerOfHealingModal is a thin props adapter over CreatureSelectionModal.
// The shared modal's own behavior (target rendering, selection, maxTargets
// clamping, confirm/skip semantics) is covered by
// shared/CreatureSelectionModal.test.jsx, and the host wiring by
// CharActionModals.healing-handlers.test.jsx — these tests pin only the
// wrapper's contract: the fixed Prayer of Healing configuration it supplies
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
        <div className="secondary-target-list">
          {props.targets.map((target, i) => (
            <span key={i}>{target.name || target}</span>
          ))}
        </div>
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

describe('PrayerOfHealingModal', () => {
  it('supplies the Prayer of Healing configuration to CreatureSelectionModal', () => {
    render(<PrayerOfHealingModal
      creatureTargets={[{ name: 'Ally1', type: 'player' }]}
      maxTargets={3}
      onConfirm={() => {}}
      onSkip={() => {}}
    />);

    expect(capturedProps).toMatchObject({
      title: 'Prayer of Healing',
      icon: 'fa-hands-praying',
      description: 'Choose up to 5 creatures to heal.',
      confirmLabel: 'Heal',
      confirmIcon: 'fa-hands-praying',
    });

    // Rendered output sanity: the fixed config reaches the DOM.
    expect(screen.getByText('Prayer of Healing')).toBeInTheDocument();
    expect(document.querySelector('.fa-hands-praying')).toBeInTheDocument();
    expect(screen.getByText('Choose up to 5 creatures to heal.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Heal/ })).toBeInTheDocument();
  });

  it('forwards targets, maxTargets, and callbacks to CreatureSelectionModal', () => {
    const targets = [
      { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
      { name: 'Ally2', type: 'player', currentHp: 30, maxHp: 30 },
    ];
    const onConfirm = vi.fn();
    const onSkip = vi.fn();

    render(<PrayerOfHealingModal
      creatureTargets={targets}
      maxTargets={3}
      onConfirm={onConfirm}
      onSkip={onSkip}
    />);

    expect(capturedProps.targets).toBe(targets);
    expect(capturedProps.maxTargets).toBe(3);

    // Targets reach the DOM and the callbacks fire through the modal.
    expect(screen.getByText('Ally1')).toBeInTheDocument();
    expect(screen.getByText('Ally2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    expect(onConfirm).toHaveBeenCalledWith(['Ally1']);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalled();
  });
});
