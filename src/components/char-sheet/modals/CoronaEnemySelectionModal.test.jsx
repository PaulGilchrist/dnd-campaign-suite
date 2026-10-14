import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CoronaEnemySelectionModal from './CoronaEnemySelectionModal.jsx';

// ── Mock CreatureSelectionModal ──

// Minimal mock that renders enough structure for interaction tests
// without coupling to the real component's internal DOM structure.
vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
  default: vi.fn(({ title, icon, targets, description, confirmLabel, confirmIcon: _confirmIcon, onConfirm, onSkip }) => (
    <div data-testid="creature-selection-modal">
      <div className="sp-header">
        <i className={`fa-solid ${icon || 'fa-crosshairs'}`}></i> {title}
      </div>
      {description && <p>{description}</p>}
      <div className="secondary-target-list">
        {targets.map((target, i) => (
          <div key={i} data-testid={`target-${i}`}>
            {typeof target === 'string' ? target : target.name || target}
          </div>
        ))}
      </div>
      <div className="sp-actions">
        <button
          className="sp-roll-btn"
          onClick={onConfirm}
          type="button"
        >
          {confirmLabel || 'Confirm'}
        </button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">
          Skip
        </button>
      </div>
    </div>
  )),
}));

import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

// ── Test helpers ──

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const mockTargets = [
  { name: 'Goblin A', type: 'enemy', currentHp: 5, maxHp: 10 },
  { name: 'Goblin B', type: 'enemy', currentHp: 3, maxHp: 10 },
  { name: 'Player Character', type: 'player', currentHp: 20, maxHp: 30 },
];

function makeProps(overrides) {
  return {
    creatureTargets: mockTargets,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('CoronaEnemySelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('prop passthrough', () => {
    it('passes correct hardcoded props and forwards runtime props to CreatureSelectionModal', () => {
      render(<CoronaEnemySelectionModal {...makeProps()} />);

      const passedProps = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(passedProps.title).toBe('Corona of Light');
      expect(passedProps.icon).toBe('fa-sun');
      expect(passedProps.confirmIcon).toBe('fa-sun');
      expect(passedProps.confirmLabel).toBe('Activate Corona');
      expect(passedProps.description).toBe(
        'Select which creatures are enemies of the caster. Enemies in the bright light have Disadvantage on saving throws against Fire and Radiant damage:'
      );
      expect(passedProps.targets).toEqual(mockTargets);
      expect(passedProps.onConfirm).toBe(mockOnConfirm);
      expect(passedProps.onSkip).toBe(mockOnSkip);
    });

    it('forwards empty targets and undefined callbacks', () => {
      render(<CoronaEnemySelectionModal {...makeProps({ creatureTargets: [], onConfirm: undefined, onSkip: undefined })} />);

      const passedProps = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(passedProps.targets).toEqual([]);
      expect(passedProps.onConfirm).toBeUndefined();
      expect(passedProps.onSkip).toBeUndefined();
    });
  });

  describe('user interactions', () => {
    it('calls onConfirm when the confirm button is clicked', () => {
      render(<CoronaEnemySelectionModal {...makeProps()} />);
      screen.getByRole('button', { name: /activate corona/i }).click();
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when the skip button is clicked', () => {
      render(<CoronaEnemySelectionModal {...makeProps()} />);
      screen.getByRole('button', { name: /skip/i }).click();
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });
  });
});
