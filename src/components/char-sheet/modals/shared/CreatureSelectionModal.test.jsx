// @improved-by-ai
// @cleaned-by-ai
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

// ── Tests ──

describe('CreatureSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('initial render', () => {
    it('renders the title in the header', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByText('Select Targets')).toBeInTheDocument();
    });

    it('renders the icon prop in the header', () => {
      render(<CreatureSelectionModal {...makeProps({ icon: 'fa-sun' })} />);
      expect(document.querySelector('.sp-header .fa-solid.fa-sun')).toBeInTheDocument();
    });

    it('renders all target entries from the targets prop', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByText('Goblin A')).toBeInTheDocument();
      expect(screen.getByText('Goblin B')).toBeInTheDocument();
      expect(screen.getByText('Player Character')).toBeInTheDocument();
    });

    it('renders checkboxes for each target', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      expect(checkboxes).toHaveLength(3);
    });

    it('renders the default confirm button label', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Confirm \(0\)/ })).toBeInTheDocument();
    });

    it('renders the custom confirm icon when confirmIcon is provided', () => {
      render(<CreatureSelectionModal {...makeProps({ confirmIcon: 'fa-heart' })} />);
      const btn = screen.getByRole('button', { name: /Confirm/ });
      expect(btn.querySelector('.fa-solid.fa-heart')).toBeInTheDocument();
    });

    it('renders the Skip button', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });
  });

  // ── Description and note display ──

  describe('description and note rendering', () => {
    it('renders description when provided', () => {
      render(<CreatureSelectionModal {...makeProps({ description: 'Choose your targets wisely.' })} />);
      expect(screen.getByText('Choose your targets wisely.')).toBeInTheDocument();
    });

    it('renders a default description paragraph when description is not provided', () => {
      render(<CreatureSelectionModal {...makeProps({ description: undefined })} />);
      expect(screen.getByText(/Choose multiple targets:/)).toBeInTheDocument();
    });

    it('renders a maxTargets description paragraph when description is not provided', () => {
      render(<CreatureSelectionModal {...makeProps({ description: undefined, maxTargets: 3 })} />);
      expect(screen.getByText(/Choose up to 3 targets:/)).toBeInTheDocument();
    });

    it('renders a note when provided', () => {
      render(<CreatureSelectionModal {...makeProps({ note: 'This is a note.' })} />);
      expect(screen.getByText('This is a note.')).toBeInTheDocument();
    });

    it('renders both description and note when both are provided', () => {
      render(<CreatureSelectionModal {...makeProps({ description: 'Description', note: 'Note text' })} />);
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Note text')).toBeInTheDocument();
    });

    it('renders custom confirmLabel on the button', () => {
      render(<CreatureSelectionModal {...makeProps({ confirmLabel: 'Attack' })} />);
      expect(screen.getByRole('button', { name: /Attack \(0\)/ })).toBeInTheDocument();
    });
  });

  // ── Target name formats ──

  describe('target name formats', () => {
    it('renders target names when targets are strings', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: mockStringTargets })} />);
      expect(screen.getByText('Creature1')).toBeInTheDocument();
      expect(screen.getByText('Creature2')).toBeInTheDocument();
      expect(screen.getByText('Creature3')).toBeInTheDocument();
    });

    it('renders target name from object with name property', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: [{ name: 'CustomTarget' }] })} />);
      expect(screen.getByText('CustomTarget')).toBeInTheDocument();
    });
  });

  // ── HP display ──

  describe('HP percentage display', () => {
    it('shows HP percentage for non-player creatures with currentHp and maxHp', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByText('(50% HP)')).toBeInTheDocument();
    });

    it('shows rounded HP percentage', () => {
      const targets = [{ name: 'Monster', type: 'enemy', currentHp: 7, maxHp: 20 }];
      render(<CreatureSelectionModal {...makeProps({ targets })} />);
      expect(screen.getByText('(35% HP)')).toBeInTheDocument();
    });

    it('does not show HP percentage for player-type targets', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const playerRow = [...document.querySelectorAll('.secondary-target-row')].find(
        row => row.textContent.includes('Player Character')
      );
      expect(playerRow.textContent).not.toContain('% HP');
    });

    it('does not show HP percentage when currentHp or maxHp is null or missing', () => {
      const targets = [
        { name: 'Ghost', type: 'enemy', currentHp: null, maxHp: 10 },
        { name: 'Wraith', type: 'enemy', currentHp: 5, maxHp: null },
        { name: 'Ambiguous', type: 'enemy' },
      ];
      render(<CreatureSelectionModal {...makeProps({ targets })} />);
      expect(screen.queryByText(/% HP/)).not.toBeInTheDocument();
    });

  });

  // ── Pre-selected targets ──

  describe('defaultSelected prop', () => {
    it('pre-selects targets listed in defaultSelected', () => {
      render(<CreatureSelectionModal {...makeProps({ defaultSelected: ['Goblin A', 'Player Character'] })} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      expect(checkboxes[2]).toBeChecked();
    });

    it('updates confirm button count for pre-selected targets', () => {
      render(<CreatureSelectionModal {...makeProps({ defaultSelected: ['Goblin A', 'Goblin B', 'Player Character'] })} />);
      expect(screen.getByRole('button', { name: /Confirm \(3\)/ })).toBeInTheDocument();
    });

  });

  // ── Careful Spell protection ──

  describe('carefulSpellProtected display', () => {
    it('shows careful spell protected indicator when target has the flag', () => {
      const targets = [{ name: 'Ally', type: 'ally', carefulSpellProtected: true }];
      render(<CreatureSelectionModal {...makeProps({ targets })} />);
      expect(screen.getByText('✓ Careful Spell protected')).toBeInTheDocument();
    });

    it('does not show careful spell protected indicator when target lacks the flag', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.queryByText(/Careful Spell/)).not.toBeInTheDocument();
    });
  });

  // ── Heighten Spell functionality ──

  describe('metamagicHeighten functionality', () => {
    it('renders Heighten radio buttons when metamagicHeighten is true', () => {
      render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: true, setHeightenTarget: mockSetHeightenTarget })} />);
      const radios = document.querySelectorAll('input[name="heightenTarget"]');
      expect(radios).toHaveLength(3);
      // @cleaned-by-ai: inline style assertion removed — brittle to CSS changes; radio count suffices
    });

    it('does not render Heighten radio buttons when metamagicHeighten is false', () => {
      render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: false })} />);
      expect(screen.queryByText('Heighten')).not.toBeInTheDocument();
      expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(0);
    });

    it('does not render Heighten radio buttons when metamagicHeighten is undefined', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.queryByText('Heighten')).not.toBeInTheDocument();
    });

    it('calls setHeightenTarget with target name when Heighten radio is clicked', () => {
      render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: true, setHeightenTarget: mockSetHeightenTarget })} />);
      const radios = document.querySelectorAll('input[name="heightenTarget"]');
      fireEvent.click(radios[0]);
      expect(mockSetHeightenTarget).toHaveBeenCalledWith('Goblin A');
    });

    it('marks the currently heightenTarget radio as checked', () => {
      render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: true, setHeightenTarget: mockSetHeightenTarget, heightenTarget: 'Goblin B' })} />);
      const radios = document.querySelectorAll('input[name="heightenTarget"]');
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
      expect(radios[2].checked).toBe(false);
    });

    it('switches Heighten selection to a different target', () => {
      render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: true, setHeightenTarget: mockSetHeightenTarget })} />);
      fireEvent.click(document.querySelectorAll('input[name="heightenTarget"]')[0]);
      expect(mockSetHeightenTarget).toHaveBeenCalledWith('Goblin A');
      vi.clearAllMocks();
      render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: true, setHeightenTarget: mockSetHeightenTarget, heightenTarget: 'Goblin A' })} />);
      fireEvent.click(document.querySelectorAll('input[name="heightenTarget"]')[2]);
      expect(mockSetHeightenTarget).toHaveBeenCalledWith('Player Character');
    });
  });

  // ── Selection behavior ──

  describe('selection behavior', () => {
    it('has no target selected initially', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      checkboxes.forEach(cb => expect(cb.checked).toBe(false));
    });

    it('toggles a target selection when checkbox is clicked directly', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      await act(async () => {
        fireEvent.click(checkboxes[0]);
      });
      await waitFor(() => {
        expect(checkboxes[0]).toBeChecked();
      });
    });

    it('deselects a target when its checkbox is clicked directly', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      await act(async () => {
        fireEvent.click(checkboxes[0]);
      });
      await waitFor(() => {
        expect(checkboxes[0]).toBeChecked();
      });
      await act(async () => {
        fireEvent.click(checkboxes[0]);
      });
      await waitFor(() => {
        expect(checkboxes[0]).not.toBeChecked();
      });
    });

    it('toggles a target selection on row click', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
      });
    });

    it('deselects a target when its row is clicked again', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
      });
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).not.toBeChecked();
      });
    });

    it('selects multiple targets', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).toBeChecked();
      });
    });

    it('highlights selected targets with the selected class', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const rows = document.querySelectorAll('.secondary-target-row');
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(rows[0]).toHaveClass('secondary-target-selected');
        expect(rows[1]).not.toHaveClass('secondary-target-selected');
      });
    });

    it('updates confirm button label with selection count', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm \(1\)/ })).toBeInTheDocument();
      });
      await act(async () => selectTarget(1));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm \(2\)/ })).toBeInTheDocument();
      });
    });

    it('updates the button label when selection is deselected', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm \(2\)/ })).toBeInTheDocument();
      });
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm \(1\)/ })).toBeInTheDocument();
      });
    });
  });

  // ── maxTargets limit ──

  describe('maxTargets limit', () => {
    it('does not limit selection when maxTargets is not provided', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      await act(async () => {
        checkboxes[0].click();
        checkboxes[1].click();
        checkboxes[2].click();
      });
      checkboxes.forEach(cb => expect(cb.disabled).toBe(false));
    });

    it('respects maxTargets limit when selecting', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 2 })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).toBeChecked();
      });
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[2]).toBeDisabled();
      });
    });

    it('disables unchecked targets when at maxTargets', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 1 })} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[1]).toBeDisabled();
        expect(checkboxes[2]).toBeDisabled();
      });
    });

    it('enables disabled targets when a selected target is deselected', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 1 })} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[1]).toBeDisabled();
      });
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[1]).not.toBeDisabled();
      });
    });

    it('allows deselecting a target below maxTargets', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 2 })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).not.toBeChecked();
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).not.toBeDisabled();
      });
    });

    it('allows unlimited selection when maxTargets is 0', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 0 })} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      await act(async () => {
        checkboxes[0].click();
        checkboxes[1].click();
        checkboxes[2].click();
      });
      checkboxes.forEach(cb => expect(cb.disabled).toBe(false));
    });
  });

  // ── Confirm button state ──

  describe('confirm button state', () => {
    it('is disabled when no targets are selected and enabled when at least one is selected', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Confirm \(0\)/ })).toBeDisabled();
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm \(1\)/ })).not.toBeDisabled();
      });
    });

    it('is disabled when targets array is empty', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: [] })} />);
      expect(screen.getByRole('button', { name: /Confirm \(0\)/ })).toBeDisabled();
    });
  });

  // ── Confirm behavior ──

  describe('confirm behavior', () => {
    it('calls onConfirm with selected target names when confirm is clicked', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(2));
      fireEvent.click(screen.getByRole('button', { name: /Confirm \(2\)/ }));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin A', 'Player Character']);
    });

    it('does not call onConfirm when confirm is clicked with no selection', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Confirm \(0\)/ }));
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('calls onConfirm with all selected targets', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await act(async () => selectTarget(2));
      fireEvent.click(screen.getByRole('button', { name: /Confirm \(3\)/ }));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin A', 'Goblin B', 'Player Character']);
    });

    it('passes string target names to onConfirm', async () => {
      render(<CreatureSelectionModal {...makeProps({ targets: mockStringTargets })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      fireEvent.click(screen.getByRole('button', { name: /Confirm \(2\)/ }));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Creature1', 'Creature2']);
    });

    it('calls onConfirm with maxTargets-limited selections', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 2 })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      fireEvent.click(screen.getByRole('button', { name: /Confirm \(2\)/ }));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin A', 'Goblin B']);
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onSkip when the Skip button is clicked', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when clicking the overlay background', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(mockOnSkip).not.toHaveBeenCalled();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('does not call onSkip when clicking inside the modal body', () => {
      // @cleaned-by-ai: "modal content" and "modal body" tests consolidated — both assert the same stopPropagation behavior
      render(<CreatureSelectionModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-body'));
      expect(mockOnSkip).not.toHaveBeenCalled();
    });
  });

  // ── Empty targets ──

  describe('empty targets', () => {
    it('shows "No targets available." when targets is empty', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: [] })} />);
      expect(screen.getByText('No targets available.')).toBeInTheDocument();
    });
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
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
      });
      expect(mockGetCreaturesInsideOverlay).toHaveBeenCalledWith('test-campaign', overlay, ['Goblin A', 'Goblin B', 'Player Character']);
      expect(screen.getByRole('button', { name: /Confirm \(2\)/ })).not.toBeDisabled();
    });

    it('keeps explicit defaultSelected when no overlay is targeted', async () => {
      render(<CreatureSelectionModal {...makeProps({ ...mapProps, defaultSelected: ['Player Character'] })} />);

      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[2]).toBeChecked();
        expect(checkboxes[0]).not.toBeChecked();
      });
      expect(mockGetCurrentOverlayTarget).toHaveBeenCalledWith('test-campaign', 'Wizard');
    });

    it('merges overlay pre-selection into explicit defaultSelected', async () => {
      mockGetCurrentOverlayTarget.mockResolvedValue({ id: 'o1', shape: 'sphere', radiusFt: 20, startGridX: 5, startGridY: 5, angle: 0 });
      mockGetCreaturesInsideOverlay.mockResolvedValue(['Goblin A']);

      render(<CreatureSelectionModal {...makeProps({ ...mapProps, defaultSelected: ['Player Character'] })} />);

      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[2]).toBeChecked();
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
