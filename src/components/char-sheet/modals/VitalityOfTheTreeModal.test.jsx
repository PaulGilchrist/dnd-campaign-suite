import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VitalityOfTheTreeModal from './VitalityOfTheTreeModal.jsx';

// ── Minimal mock — only renders structure, no selection logic.
//     Selection behavior is fully covered by CreatureSelectionModal.test.jsx.

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
  default: vi.fn((props) => {
    const selected = props.defaultSelected || [];
    return (
      <div data-testid="creature-selection-modal">
        <div className="sp-header">
          <i className={`fa-solid ${props.icon}`}></i> {props.title}
        </div>
        {props.description && <p>{props.description}</p>}
        {props.note && <p className="sp-note">{props.note}</p>}
        <div className="secondary-target-list">
          {props.targets.map((target, i) => {
            const name = target.name || target;
            return (
              <label key={i} className="secondary-target-row" data-testid={`target-${i}`}>
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

// Re-import mocked module for prop assertions
import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

// ── Test helpers ──

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const objectTargets = [
  { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
  { name: 'Ally2', type: 'player', currentHp: 30, maxHp: 30 },
  { name: 'Enemy1', type: 'npc', currentHp: 20, maxHp: 40 },
];

// ── Tests ──

describe('VitalityOfTheTreeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes correct hardcoded and runtime props to CreatureSelectionModal', () => {
    render(
      <VitalityOfTheTreeModal
        creatureTargets={objectTargets}
        tempHp={7}
        maxTargets={3}
        onConfirm={mockOnConfirm}
        onSkip={mockOnSkip}
      />
    );
    const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
    expect(props.title).toBe('Vitality of the Tree');
    expect(props.icon).toBe('fa-tree');
    expect(props.description).toBe('Choose up to 3 creatures to grant temporary hit points');
    expect(props.note).toBe("Each target gains 7 temp HP from the World Tree's life force.");
    expect(props.confirmLabel).toBe('Grant Vitality');
    expect(props.confirmIcon).toBe('fa-tree');
    expect(props.targets).toEqual(objectTargets);
    expect(props.maxTargets).toBe(3);
    expect(props.onConfirm).toBe(mockOnConfirm);
    expect(props.onSkip).toBe(mockOnSkip);
  });

  it('renders targets in object, string, and empty formats', () => {
    const stringTargets = ['TargetA', 'TargetB'];
    const testCases = [
      { targets: objectTargets, expected: ['Ally1', 'Ally2', 'Enemy1'] },
      { targets: stringTargets, expected: ['TargetA', 'TargetB'] },
      { targets: [], expected: ['No targets available.'] },
    ];
    for (const { targets, expected } of testCases) {
      render(
        <VitalityOfTheTreeModal
          creatureTargets={targets}
          tempHp={5}
          maxTargets={2}
          onConfirm={() => {}}
          onSkip={() => {}}
        />
      );
      for (const text of expected) {
        expect(screen.getByText(text)).toBeInTheDocument();
      }
    }
  });

  it('renders with tempHp of 0', () => {
    render(
      <VitalityOfTheTreeModal
        creatureTargets={[{ name: 'Ally1' }]}
        tempHp={0}
        maxTargets={1}
        onConfirm={() => {}}
        onSkip={() => {}}
      />
    );
    expect(
      screen.getByText("Each target gains 0 temp HP from the World Tree's life force.")
    ).toBeInTheDocument();
  });
});
