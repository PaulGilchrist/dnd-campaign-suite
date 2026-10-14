import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BulwarkOfForceModal from './BulwarkOfForceModal.jsx';

// ── Mock CreatureSelectionModal ──

const mockToggleTarget = vi.fn();
const mockHandleConfirm = vi.fn();
const mockHandleSkip = vi.fn();

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
  default: vi.fn((props) => {
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
            const atMax =
              props.maxTargets &&
              typeof props.maxTargets === 'number' &&
              selected.length >= props.maxTargets &&
              !isSelected;
            return (
              <label
                key={i}
                className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''} ${atMax ? 'secondary-target-disabled' : ''}`}
                data-testid={`target-${i}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={atMax}
                  onChange={() => mockToggleTarget(name)}
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
            onClick={() => mockHandleConfirm(selected)}
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
  }),
}));

// ── Re-import mocked module for assertions ──

import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

// ── Test helpers ──

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const defaultTargets = [
  { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
  { name: 'Ally2', type: 'player', currentHp: 30, maxHp: 30 },
  { name: 'Ally3', type: 'player', currentHp: 5, maxHp: 25 },
];

function makeProps(overrides) {
  return {
    targets: defaultTargets,
    maxTargets: 2,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('BulwarkOfForceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToggleTarget.mockClear();
    mockHandleConfirm.mockClear();
    mockHandleSkip.mockClear();
  });

  it('renders CreatureSelectionModal with fixed and passed-through props', () => {
    render(<BulwarkOfForceModal {...makeProps()} />);
    const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
    expect(props.title).toBe('Bulwark of Force');
    expect(props.icon).toBe('fa-shield-halved');
    expect(props.description).toBe('Choose allies to grant Half Cover');
    expect(props.confirmLabel).toBe('Grant Half Cover');
    expect(props.confirmIcon).toBe('fa-shield-halved');
    expect(props.targets).toEqual(defaultTargets);
    expect(props.maxTargets).toBe(2);
    expect(props.onConfirm).toBe(mockOnConfirm);
    expect(props.onSkip).toBe(mockOnSkip);
  });

  it('renders targets in object, string, and empty formats', () => {
    const stringTargets = ['TargetA', 'TargetB'];
    const testCases = [
      { targets: defaultTargets, expected: ['Ally1', 'Ally2', 'Ally3'] },
      { targets: stringTargets, expected: ['TargetA', 'TargetB'] },
      { targets: [], expected: ['No targets available.'] },
    ];
    for (const { targets, expected } of testCases) {
      render(<BulwarkOfForceModal {...makeProps({ targets })} />);
      for (const text of expected) {
        expect(screen.getByText(text)).toBeInTheDocument();
      }
    }
  });

  it('calls onSkip when Skip button is clicked', () => {
    render(<BulwarkOfForceModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('does not call onConfirm when confirm button is disabled (no selection)', () => {
    render(<BulwarkOfForceModal {...makeProps()} />);
    const confirmBtn = screen.getByRole('button', { name: /Grant Half Cover \(0\)/ });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
