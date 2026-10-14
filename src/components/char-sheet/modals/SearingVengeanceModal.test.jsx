import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearingVengeanceModal from './SearingVengeanceModal';

// without coupling to its internal DOM structure.
vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
  default: vi.fn(({ title, icon, targets, description, note, confirmLabel, confirmIcon: _, onConfirm, onSkip }) => (
    <div data-testid="creature-selection-modal">
      <div className="sp-header">
        <i className={`fa-solid ${icon || 'fa-crosshairs'}`}></i> {title}
      </div>
      {description && <p>{description}</p>}
      {note && <p className="sp-note">{note}</p>}
      <div className="secondary-target-list">
        {targets.map((target, i) => (
          <div key={i} data-testid={`target-${i}`}>
            {typeof target === 'string' ? target : target.name || target}
          </div>
        ))}
      </div>
      <div className="sp-actions">
        <button className="sp-roll-btn" onClick={onConfirm} type="button">
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

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const mockTargets = [
  { name: 'Enemy1', type: 'npc', currentHp: 20, maxHp: 30 },
  { name: 'Enemy2', type: 'npc', currentHp: 10, maxHp: 25 },
  'Enemy3',
];

function makeProps(overrides) {
  return {
    creatureTargets: mockTargets,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    ...(overrides || {}),
  };
}

describe('SearingVengeanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('prop passthrough', () => {
    it('renders CreatureSelectionModal with correct hardcoded and passed-through props', () => {
      render(<SearingVengeanceModal {...makeProps()} />);

      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.title).toBe('Searing Vengeance');
      expect(props.icon).toBe('fa-fire');
      expect(props.description).toBe('Select creatures within 30 feet to unleash radiant energy upon.');
      expect(props.note).toBe('Each selected creature takes 2d8 + Charisma modifier Radiant damage and is Blinded until end of your turn.');
      expect(props.confirmLabel).toBe('Unleash Vengeance');
      expect(props.confirmIcon).toBe('fa-fire');
      expect(props.targets).toEqual(mockTargets);
      expect(props.onConfirm).toBe(mockOnConfirm);
      expect(props.onSkip).toBe(mockOnSkip);
    });

    it('passes empty creatureTargets array when creatureTargets is empty', () => {
      render(<SearingVengeanceModal {...makeProps({ creatureTargets: [] })} />);

      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.targets).toEqual([]);
    });

    it('passes empty array when creatureTargets is null', () => {
      render(<SearingVengeanceModal {...makeProps({ creatureTargets: null })} />);

      const props = vi.mocked(CreatureSelectionModal).mock.calls[0][0];
      expect(props.targets).toEqual([]);
    });
  });
});
