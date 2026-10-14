import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MassCureWoundsModal from './MassCureWoundsModal.jsx';

// ── Mock CreatureSelectionModal ──

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
  default: (props) => {
    const selected = props.defaultSelected || [];
    return (
      <div data-testid="creature-selection-modal">
        <div className="sp-header">
          <i className={`fa-solid ${props.icon}`}></i> {props.title}
        </div>
        {props.description && <p>{props.description}</p>}
        <div className="secondary-target-list">
          {props.targets.map((target, i) => {
            const name = target.name || target;
            const isSelected = selected.includes(name);
            return (
              <label
                key={i}
                className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
                data-testid={`target-${i}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                />
                <span className="secondary-target-name">
                  <strong>{name}</strong>
                </span>
              </label>
            );
          })}
          {props.targets.length === 0 && (
            <p className="sp-note">No targets available.</p>
          )}
        </div>
        <div className="sp-actions">
          <button
            className="sp-roll-btn"
            onClick={() => {}}
            disabled={selected.length === 0}
            type="button"
          >
            <i className={`fa-solid ${props.confirmIcon || 'fa-crosshairs'}`}></i> {props.confirmLabel || 'Confirm'} ({selected.length})
          </button>
          <button className="sp-dismiss-btn" onClick={props.onSkip} type="button">
            Skip
          </button>
        </div>
      </div>
    );
  },
}));

// ── Tests ──

describe('MassCureWoundsModal', () => {
  it('renders with correct title, icon, description, and buttons', () => {
    render(<MassCureWoundsModal
      creatureTargets={[
        { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
        { name: 'Ally2', type: 'player', currentHp: 30, maxHp: 30 },
      ]}
      maxTargets={3}
      onConfirm={() => {}}
      onSkip={() => {}}
    />);
    expect(screen.getByText('Mass Cure Wounds')).toBeInTheDocument();
    expect(document.querySelector('.fa-heart')).toBeInTheDocument();
    expect(screen.getByText('Choose up to 6 allies within 30 feet to heal.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cure \(0\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('renders creature targets', () => {
    render(<MassCureWoundsModal
      creatureTargets={[
        { name: 'Ally1', type: 'player' },
        { name: 'Ally2', type: 'player' },
        { name: 'Enemy1', type: 'npc' },
      ]}
      onConfirm={() => {}}
      onSkip={() => {}}
    />);
    expect(screen.getByText('Ally1')).toBeInTheDocument();
    expect(screen.getByText('Ally2')).toBeInTheDocument();
    expect(screen.getByText('Enemy1')).toBeInTheDocument();
  });

  it('shows "No targets available." when creatureTargets is empty', () => {
    render(<MassCureWoundsModal
      creatureTargets={[]}
      onConfirm={() => {}}
      onSkip={() => {}}
    />);
    expect(screen.getByText('No targets available.')).toBeInTheDocument();
  });

  it('renders with string targets', () => {
    render(<MassCureWoundsModal
      creatureTargets={['TargetA', 'TargetB']}
      onConfirm={() => {}}
      onSkip={() => {}}
    />);
    expect(screen.getByText('TargetA')).toBeInTheDocument();
    expect(screen.getByText('TargetB')).toBeInTheDocument();
  });

  it('renders without optional maxTargets prop', () => {
    render(<MassCureWoundsModal
      creatureTargets={[{ name: 'Ally1' }]}
      onConfirm={() => {}}
      onSkip={() => {}}
    />);
    expect(screen.getByText('Mass Cure Wounds')).toBeInTheDocument();
  });

  it('renders without optional onConfirm and onSkip props', () => {
    render(<MassCureWoundsModal
      creatureTargets={[{ name: 'Ally1' }]}
    />);
    expect(screen.getByText('Mass Cure Wounds')).toBeInTheDocument();
  });
});
