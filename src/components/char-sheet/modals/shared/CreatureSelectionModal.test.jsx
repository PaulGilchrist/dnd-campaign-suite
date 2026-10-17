// @maintained-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCurrentOverlayTarget = vi.fn();
const mockGetCreaturesInsideOverlay = vi.fn();
const mockGetTargetMapStatuses = vi.fn();

vi.mock('../../../../services/maps/spellOverlayService.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getCurrentOverlayTarget: (...args) => mockGetCurrentOverlayTarget(...args),
        getCreaturesInsideOverlay: (...args) => mockGetCreaturesInsideOverlay(...args),
        getTargetMapStatuses: (...args) => mockGetTargetMapStatuses(...args),
    };
});

import CreatureSelectionModal from './CreatureSelectionModal.jsx';

// ── Test fixtures ──

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();
const mockSetHeightenTarget = vi.fn();

const mockObjectTargets = [
  { name: 'Goblin A', type: 'enemy', currentHp: 5, maxHp: 10 },
  { name: 'Goblin B', type: 'enemy', currentHp: 3, maxHp: 10 },
  { name: 'Player Character', type: 'player', currentHp: 20, maxHp: 30 },
];

const mockStringTargets = ['Creature1', 'Creature2', 'Creature3'];

const defaultProps = {
  title: 'Select Targets',
  icon: 'fa-crosshairs',
  targets: mockObjectTargets,
  onConfirm: mockOnConfirm,
  onSkip: mockOnSkip,
};

function makeProps(overrides) {
  return { ...defaultProps, ...overrides };
}

function selectTarget(index) {
  const labels = document.querySelectorAll('.secondary-target-row');
  fireEvent.click(labels[index]);
}

function checkboxes() {
  return document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
}

function heightenRadios() {
  return document.querySelectorAll('input[name="heightenTarget"]');
}

// ── Tests ──

describe('CreatureSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  it('renders header, one checkbox row per target, and action buttons', () => {
    render(<CreatureSelectionModal {...makeProps()} />);
    expect(screen.getByText('Select Targets')).toBeInTheDocument();
    expect(document.querySelector('.sp-header .fa-solid.fa-crosshairs')).toBeInTheDocument();
    expect(screen.getByText('Goblin A')).toBeInTheDocument();
    expect(screen.getByText('Goblin B')).toBeInTheDocument();
    expect(screen.getByText('Player Character')).toBeInTheDocument();
    const boxes = checkboxes();
    expect(boxes).toHaveLength(3);
    boxes.forEach(cb => expect(cb).not.toBeChecked());
    expect(screen.getByRole('button', { name: /Confirm \(0\)/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('uses the custom confirmLabel and confirmIcon on the confirm button', () => {
    render(<CreatureSelectionModal {...makeProps({ confirmLabel: 'Attack', confirmIcon: 'fa-heart' })} />);
    const btn = screen.getByRole('button', { name: /Attack \(0\)/ });
    expect(btn.querySelector('.fa-solid.fa-heart')).toBeInTheDocument();
  });

  it('renders description and note when both are provided', () => {
    render(<CreatureSelectionModal {...makeProps({ description: 'Choose your targets wisely.', note: 'This is a note.' })} />);
    expect(screen.getByText('Choose your targets wisely.')).toBeInTheDocument();
    expect(screen.getByText('This is a note.')).toBeInTheDocument();
  });

  it('falls back to a default description mentioning the maxTargets cap', () => {
    const { unmount } = render(<CreatureSelectionModal {...makeProps()} />);
    expect(screen.getByText(/Choose multiple targets:/)).toBeInTheDocument();
    unmount();
    render(<CreatureSelectionModal {...makeProps({ maxTargets: 3 })} />);
    expect(screen.getByText(/Choose up to 3 targets:/)).toBeInTheDocument();
  });

  it('shows rounded HP percent for damaged non-player targets only', () => {
    const targets = [
      { name: 'Goblin', type: 'enemy', currentHp: 5, maxHp: 10 },
      { name: 'Monster', type: 'enemy', currentHp: 7, maxHp: 20 },
      { name: 'Player Character', type: 'player', currentHp: 20, maxHp: 30 },
      { name: 'Ghost', type: 'enemy', currentHp: null, maxHp: 10 },
      { name: 'Wraith', type: 'enemy', currentHp: 5 },
      { name: 'Ambiguous', type: 'enemy' },
    ];
    render(<CreatureSelectionModal {...makeProps({ targets })} />);
    expect(screen.getByText('(50% HP)')).toBeInTheDocument();
    expect(screen.getByText('(35% HP)')).toBeInTheDocument();
    const rowNamed = (name) => [...document.querySelectorAll('.secondary-target-row')]
      .find(row => row.textContent.includes(name));
    expect(rowNamed('Player Character').textContent).not.toContain('% HP');
    expect(rowNamed('Ghost').textContent).not.toContain('% HP');
    expect(rowNamed('Wraith').textContent).not.toContain('% HP');
    expect(rowNamed('Ambiguous').textContent).not.toContain('% HP');
  });

  it('renders string targets and passes their names to onConfirm', async () => {
    render(<CreatureSelectionModal {...makeProps({ targets: mockStringTargets })} />);
    expect(screen.getByText('Creature1')).toBeInTheDocument();
    expect(screen.getByText('Creature2')).toBeInTheDocument();
    expect(screen.getByText('Creature3')).toBeInTheDocument();
    await act(async () => selectTarget(0));
    await act(async () => selectTarget(1));
    fireEvent.click(screen.getByRole('button', { name: /Confirm \(2\)/ }));
    expect(mockOnConfirm).toHaveBeenCalledWith(['Creature1', 'Creature2']);
  });

  // ── Pre-selected targets ──

  it('pre-selects defaultSelected targets and counts them on Confirm', () => {
    render(<CreatureSelectionModal {...makeProps({ defaultSelected: ['Goblin A', 'Player Character'] })} />);
    const boxes = checkboxes();
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    expect(boxes[2]).toBeChecked();
    expect(screen.getByRole('button', { name: /Confirm \(2\)/ })).not.toBeDisabled();
  });

  // ── Careful Spell protection ──

  it('shows the Careful Spell indicator only for flagged targets', () => {
    const { unmount } = render(<CreatureSelectionModal {...makeProps()} />);
    expect(screen.queryByText(/Careful Spell/)).not.toBeInTheDocument();
    unmount();
    render(<CreatureSelectionModal {...makeProps({ targets: [{ name: 'Ally', type: 'ally', carefulSpellProtected: true }] })} />);
    expect(screen.getByText('✓ Careful Spell protected')).toBeInTheDocument();
  });

  // ── Heighten Spell functionality ──

  it('renders Heighten radio buttons only when metamagicHeighten is set', () => {
    const { unmount } = render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: true, setHeightenTarget: mockSetHeightenTarget })} />);
    expect(heightenRadios()).toHaveLength(3);
    unmount();
    render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: false, setHeightenTarget: mockSetHeightenTarget })} />);
    expect(heightenRadios()).toHaveLength(0);
  });

  it('sets Heighten target when a radio is clicked without toggling its checkbox', async () => {
    render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: true, setHeightenTarget: mockSetHeightenTarget })} />);
    await act(async () => {
      fireEvent.click(heightenRadios()[0]);
    });
    expect(mockSetHeightenTarget).toHaveBeenCalledWith('Goblin A');
    expect(checkboxes()[0]).not.toBeChecked();
  });

  it('marks the current heightenTarget radio as checked', () => {
    render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: true, setHeightenTarget: mockSetHeightenTarget, heightenTarget: 'Goblin B' })} />);
    const radios = heightenRadios();
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
    expect(radios[2].checked).toBe(false);
  });

  // ── Selection behavior ──

  it('toggles selection on row click, updating highlight and Confirm count', async () => {
    render(<CreatureSelectionModal {...makeProps()} />);
    const rows = document.querySelectorAll('.secondary-target-row');
    await act(async () => selectTarget(0));
    await waitFor(() => {
      expect(checkboxes()[0]).toBeChecked();
      expect(rows[0]).toHaveClass('secondary-target-selected');
      expect(rows[1]).not.toHaveClass('secondary-target-selected');
      expect(screen.getByRole('button', { name: /Confirm \(1\)/ })).not.toBeDisabled();
    });
    await act(async () => selectTarget(1));
    await act(async () => selectTarget(0));
    await waitFor(() => {
      expect(checkboxes()[0]).not.toBeChecked();
      expect(checkboxes()[1]).toBeChecked();
      expect(rows[0]).not.toHaveClass('secondary-target-selected');
      expect(screen.getByRole('button', { name: /Confirm \(1\)/ })).toBeInTheDocument();
    });
  });

  // ── maxTargets limit ──

  it('allows unlimited selection when maxTargets is falsy', async () => {
    for (const maxTargets of [undefined, 0]) {
      const { unmount } = render(<CreatureSelectionModal {...makeProps({ maxTargets })} />);
      const boxes = checkboxes();
      await act(async () => {
        boxes[0].click();
        boxes[1].click();
        boxes[2].click();
      });
      boxes.forEach(cb => expect(cb).toBeChecked());
      expect(screen.getByRole('button', { name: /Confirm \(3\)/ })).not.toBeDisabled();
      unmount();
    }
  });

  it('disables unselected targets at maxTargets and rejects clicks on them', async () => {
    render(<CreatureSelectionModal {...makeProps({ maxTargets: 1 })} />);
    await act(async () => selectTarget(0));
    const boxes = checkboxes();
    await waitFor(() => {
      expect(boxes[1]).toBeDisabled();
      expect(boxes[2]).toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(boxes[1]);
    });
    expect(boxes[1]).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Confirm \(1\)/ })).toBeInTheDocument();
  });

  it('re-enables unselected targets when one at maxTargets is deselected', async () => {
    render(<CreatureSelectionModal {...makeProps({ maxTargets: 2 })} />);
    await act(async () => selectTarget(0));
    await act(async () => selectTarget(1));
    await waitFor(() => {
      expect(checkboxes()[2]).toBeDisabled();
    });
    await act(async () => selectTarget(0));
    await waitFor(() => {
      expect(checkboxes()[0]).not.toBeChecked();
      expect(checkboxes()[1]).toBeChecked();
      expect(checkboxes()[2]).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /Confirm \(1\)/ })).toBeInTheDocument();
    });
  });

  // ── Empty targets ──

  it('shows the empty state with a disabled Confirm and no default prompt', () => {
    render(<CreatureSelectionModal {...makeProps({ targets: [] })} />);
    expect(screen.getByText('No targets available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm \(0\)/ })).toBeDisabled();
    expect(screen.queryByText(/Choose multiple targets:/)).not.toBeInTheDocument();
  });

  // ── Confirm behavior ──

  it('calls onConfirm with selected names in selection order and stays inert while disabled', async () => {
    render(<CreatureSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirm \(0\)/ }));
    expect(mockOnConfirm).not.toHaveBeenCalled();
    await act(async () => selectTarget(0));
    await act(async () => selectTarget(2));
    fireEvent.click(screen.getByRole('button', { name: /Confirm \(2\)/ }));
    expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin A', 'Player Character']);
  });

  // ── Close behavior ──

  it('calls onSkip only from the Skip button, not from overlay or body clicks', () => {
    render(<CreatureSelectionModal {...makeProps()} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    fireEvent.click(document.querySelector('.sp-body'));
    expect(mockOnSkip).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  // ── Overlay pre-selection and map distance badges ──

  describe('overlay pre-selection and map distance badges', () => {
    beforeEach(() => {
      mockGetCurrentOverlayTarget.mockReset().mockResolvedValue(null);
      mockGetCreaturesInsideOverlay.mockReset().mockResolvedValue([]);
      mockGetTargetMapStatuses.mockReset().mockResolvedValue(null);
    });

    const mapProps = { campaignName: 'test-campaign', attackerName: 'Wizard' };

    it('pre-selects creatures inside the current overlay target', async () => {
      const overlay = { id: 'o1', shape: 'sphere', radiusFt: 20, startGridX: 5, startGridY: 5, angle: 0 };
      mockGetCurrentOverlayTarget.mockResolvedValue(overlay);
      mockGetCreaturesInsideOverlay.mockResolvedValue(['Goblin A', 'Goblin B']);

      render(<CreatureSelectionModal {...makeProps(mapProps)} />);

      await waitFor(() => {
        expect(checkboxes()[0]).toBeChecked();
        expect(checkboxes()[1]).toBeChecked();
        expect(checkboxes()[2]).not.toBeChecked();
      });
      expect(mockGetCreaturesInsideOverlay).toHaveBeenCalledWith('test-campaign', overlay, ['Goblin A', 'Goblin B', 'Player Character']);
      expect(screen.getByRole('button', { name: /Confirm \(2\)/ })).not.toBeDisabled();
    });

    it('keeps explicit defaultSelected when no overlay is targeted', async () => {
      render(<CreatureSelectionModal {...makeProps({ ...mapProps, defaultSelected: ['Player Character'] })} />);

      await waitFor(() => {
        expect(checkboxes()[2]).toBeChecked();
        expect(checkboxes()[0]).not.toBeChecked();
      });
      expect(mockGetCurrentOverlayTarget).toHaveBeenCalledWith('test-campaign', 'Wizard');
    });

    it('merges overlay pre-selection into explicit defaultSelected', async () => {
      mockGetCurrentOverlayTarget.mockResolvedValue({ id: 'o1', shape: 'sphere', radiusFt: 20, startGridX: 5, startGridY: 5, angle: 0 });
      mockGetCreaturesInsideOverlay.mockResolvedValue(['Goblin A']);

      render(<CreatureSelectionModal {...makeProps({ ...mapProps, defaultSelected: ['Player Character'] })} />);

      await waitFor(() => {
        expect(checkboxes()[0]).toBeChecked();
        expect(checkboxes()[2]).toBeChecked();
      });
    });

    it('renders distance badges for each target', async () => {
      mockGetTargetMapStatuses.mockResolvedValue({
        'Goblin A': { status: 'in', distFt: 10 },
        'Goblin B': { status: 'out', distFt: 90 },
        'Player Character': { status: 'off-map', distFt: null },
      });

      render(<CreatureSelectionModal {...makeProps(mapProps)} />);

      await waitFor(() => {
        expect(screen.getByText('In range · 10 ft')).toBeInTheDocument();
        expect(screen.getByText('Out of range · 90 ft')).toBeInTheDocument();
        expect(screen.getByText('Off map')).toBeInTheDocument();
      });
    });

    it('renders no badges when no map is active', async () => {
      mockGetTargetMapStatuses.mockResolvedValue(null);

      render(<CreatureSelectionModal {...makeProps(mapProps)} />);

      await waitFor(() => {
        expect(mockGetTargetMapStatuses).toHaveBeenCalled();
      });
      expect(screen.queryByText(/In range|Out of range|Off map/)).not.toBeInTheDocument();
    });

    it('skips overlay and distance lookups without campaignName/attackerName', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);

      await waitFor(() => {
        expect(screen.getByText('Goblin A')).toBeInTheDocument();
      });
      expect(mockGetCurrentOverlayTarget).not.toHaveBeenCalled();
      expect(mockGetTargetMapStatuses).not.toHaveBeenCalled();
      expect(screen.queryByText(/In range|Out of range|Off map/)).not.toBeInTheDocument();
    });
  });

});
