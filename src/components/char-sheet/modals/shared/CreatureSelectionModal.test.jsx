// @maintained-by-ai 2026-11-27
// Component-seam lane for the generic creature picker: candidate rows, select /
// confirm / cancel, empty list, HP-affordance law, Heighten radio semantics,
// maxTargets cap, and the overlay/distance effect's own prop threading
// (campaignName/attackerName/rangeFt). Consumer wiring through
// SaveAttackAoeModal is owned by SaveAttackAoeModal.overlay-auto-select.test.jsx;
// distanceBadgeText copy is owned by services/maps/spellOverlayService.test.js,
// so badges are pinned by status class + shape, not exact wording.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCurrentOverlayTarget = vi.fn();
const mockGetCreaturesInsideOverlay = vi.fn();
const mockGetTargetMapStatuses = vi.fn();
const mockGetRuntimeValue = vi.fn();

vi.mock('../../../../services/maps/spellOverlayService.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getCurrentOverlayTarget: (...args) => mockGetCurrentOverlayTarget(...args),
        getCreaturesInsideOverlay: (...args) => mockGetCreaturesInsideOverlay(...args),
        getTargetMapStatuses: (...args) => mockGetTargetMapStatuses(...args),
    };
});

// PC rows read their HP affordance from the character buckets
// (currentHitPoints/hitPoints) — drive that store per-test.
vi.mock('../../../../hooks/runtime/useRuntimeState.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getRuntimeValue: (...args) => mockGetRuntimeValue(...args),
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

function rowNamed(name) {
  return [...document.querySelectorAll('.secondary-target-row')]
    .find(row => row.textContent.includes(name));
}

// ── Tests ──

describe('CreatureSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no bucket data anywhere — PC rows degrade to bare names unless a
    // test seeds getRuntimeValue.
    mockGetRuntimeValue.mockReset().mockReturnValue(null);
    mockGetCurrentOverlayTarget.mockReset().mockResolvedValue(null);
    mockGetCreaturesInsideOverlay.mockReset().mockResolvedValue([]);
    mockGetTargetMapStatuses.mockReset().mockResolvedValue(null);
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

  it('renders the custom confirm label/icon and the provided description and note', () => {
    render(<CreatureSelectionModal {...makeProps({
      confirmLabel: 'Attack',
      confirmIcon: 'fa-heart',
      description: 'Choose your targets wisely.',
      note: 'This is a note.',
    })} />);
    const btn = screen.getByRole('button', { name: /Attack \(0\)/ });
    expect(btn.querySelector('.fa-solid.fa-heart')).toBeInTheDocument();
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

  // Row HP affordance law (backlog 2026-11-24 improve picker-hp-affordance):
  // monster rows read their cs-row pair; PC rows read ONLY the character
  // buckets so a `currentHp: 1` placeholder cs row can never print a
  // fabricated percentage.

  it('shows rounded HP percent for damaged monster rows from their row values', () => {
    const targets = [
      { name: 'Goblin', type: 'enemy', currentHp: 5, maxHp: 10 },
      { name: 'Monster', type: 'enemy', currentHp: 7, maxHp: 20 },
      { name: 'Ghost', type: 'enemy', currentHp: null, maxHp: 10 },
      { name: 'Wraith', type: 'enemy', currentHp: 5 },
      { name: 'Ambiguous', type: 'enemy' },
    ];
    render(<CreatureSelectionModal {...makeProps({ targets })} />);
    expect(screen.getByText('(50% HP)')).toBeInTheDocument();
    expect(screen.getByText('(35% HP)')).toBeInTheDocument();
    expect(rowNamed('Ghost').textContent).not.toContain('% HP');
    expect(rowNamed('Wraith').textContent).not.toContain('% HP');
    expect(rowNamed('Ambiguous').textContent).not.toContain('% HP');
  });

  it('resolves PC-row HP only from the character buckets, degrading honestly', () => {
    mockGetRuntimeValue.mockImplementation((name, key) => {
      if (name === 'FullAlly') return 28;
      if (name === 'HurtAlly') return key === 'currentHitPoints' ? 10 : 28;
      if (name === 'Mismatch') return key === 'currentHitPoints' ? 60 : 1;
      if (name === 'EmptyStr') return ''; // '' is the app's "no data" fingerprint
      return null; // NoBucketAlly: no buckets at all
    });
    const targets = [
      { name: 'FullAlly', type: 'player' },
      { name: 'HurtAlly', type: 'player', currentHp: 1, maxHp: 1 },
      { name: 'NoBucketAlly', type: 'player', currentHp: 20, maxHp: 30 },
      { name: 'Mismatch', type: 'player', currentHp: 60, maxHp: 112 },
      { name: 'EmptyStr', type: 'player', currentHp: 20, maxHp: 30 },
    ];
    render(<CreatureSelectionModal {...makeProps({ targets })} />);
    // FullAlly: full bucket pair → 100%.
    expect(rowNamed('FullAlly').textContent).toContain('(100% HP)');
    // HurtAlly: 10 of 28 → 36%, not the placeholder row's 100%.
    expect(rowNamed('HurtAlly').textContent).toContain('(36% HP)');
    // No bucket pair, dishonest pair (current > max), and '' values all
    // degrade to the bare name — never a fabricated percentage.
    expect(rowNamed('NoBucketAlly').textContent).not.toContain('% HP');
    expect(rowNamed('Mismatch').textContent).not.toContain('% HP');
    expect(rowNamed('EmptyStr').textContent).not.toContain('% HP');
  });

  it('renders string targets and passes their names to onConfirm', async () => {
    render(<CreatureSelectionModal {...makeProps({ targets: mockStringTargets })} />);
    expect(screen.getByText('Creature1')).toBeInTheDocument();
    expect(screen.getByText('Creature2')).toBeInTheDocument();
    expect(screen.getByText('Creature3')).toBeInTheDocument();
    await act(async () => selectTarget(0));
    await act(async () => selectTarget(1));
    fireEvent.click(screen.getByRole('button', { name: /Confirm \(2\)/ }));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).toHaveBeenCalledWith(['Creature1', 'Creature2']);
  });

  it('pre-selects defaultSelected targets and counts them on Confirm', () => {
    render(<CreatureSelectionModal {...makeProps({ defaultSelected: ['Goblin A', 'Player Character'] })} />);
    const boxes = checkboxes();
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    expect(boxes[2]).toBeChecked();
    expect(screen.getByRole('button', { name: /Confirm \(2\)/ })).not.toBeDisabled();
  });

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

  it('reflects heightenTarget in the checked radio and routes clicks to setHeightenTarget without toggling selection', () => {
    render(<CreatureSelectionModal {...makeProps({ metamagicHeighten: true, setHeightenTarget: mockSetHeightenTarget, heightenTarget: 'Goblin B' })} />);
    const radios = heightenRadios();
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
    expect(radios[2].checked).toBe(false);
    // Single-select: clicking a different unchecked radio selects it via the
    // change event — the pointerdown snapshot stays inert so no spurious null
    // is emitted, and the row's selection checkbox is untouched.
    fireEvent.pointerDown(radios[0]);
    fireEvent.click(radios[0]);
    expect(mockSetHeightenTarget).toHaveBeenCalledTimes(1);
    expect(mockSetHeightenTarget).toHaveBeenCalledWith('Goblin A');
    expect(checkboxes()[0]).not.toBeChecked();
  });

  // Deselect regression: browsers (and jsdom) never fire change on a re-click of an
  // already-checked radio, so click-to-deselect must ride the click event. A
  // pointerdown snapshot of native checkedness keeps the deselect inert when the same
  // click newly selected the radio (browsers dispatch change before click).

  it('deselects through a real parent: one null call, parent state clears, every radio renders unchecked', () => {
    const setter = vi.fn();
    function Harness() {
      const [heighten, setHeighten] = useState('Goblin B');
      setter.mockImplementation(setHeighten);
      return (
        <>
          <CreatureSelectionModal {...makeProps({ metamagicHeighten: true, heightenTarget: heighten, setHeightenTarget: setter })} />
          <span data-testid="heighten-state">{heighten === null ? 'null' : heighten}</span>
        </>
      );
    }
    render(<Harness />);
    const radios = heightenRadios();
    expect(radios[1].checked).toBe(true);
    fireEvent.pointerDown(radios[1]);
    fireEvent.click(radios[1]);
    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('heighten-state').textContent).toBe('null');
    heightenRadios().forEach(radio => expect(radio.checked).toBe(false));
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

  it.each([undefined, 0])('allows unlimited selection when maxTargets is %s', async (maxTargets) => {
    render(<CreatureSelectionModal {...makeProps({ maxTargets })} />);
    const boxes = checkboxes();
    await act(async () => {
      boxes[0].click();
      boxes[1].click();
      boxes[2].click();
    });
    boxes.forEach(cb => expect(cb).toBeChecked());
    expect(screen.getByRole('button', { name: /Confirm \(3\)/ })).not.toBeDisabled();
  });

  it('caps selection at maxTargets: disables and rejects unselected rows, re-enables on deselect', async () => {
    render(<CreatureSelectionModal {...makeProps({ maxTargets: 2 })} />);
    await act(async () => selectTarget(0));
    await act(async () => selectTarget(1));
    const boxes = checkboxes();
    await waitFor(() => expect(boxes[2]).toBeDisabled());
    await act(async () => {
      fireEvent.click(boxes[2]);
    });
    expect(boxes[2]).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Confirm \(2\)/ })).toBeInTheDocument();
    // Deselecting one frees a slot for the previously blocked row.
    await act(async () => selectTarget(0));
    await waitFor(() => {
      expect(boxes[0]).not.toBeChecked();
      expect(boxes[1]).toBeChecked();
      expect(boxes[2]).not.toBeDisabled();
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

  it('confirms selected names in selection order and stays inert while disabled (empty or confirmDisabled)', async () => {
    // picker-confirm-live-while-prompts-stack: confirmDisabled latches the
    // button even with a real selection in flight.
    const { unmount } = render(<CreatureSelectionModal {...makeProps({ defaultSelected: ['Goblin A'], confirmDisabled: true })} />);
    const locked = screen.getByRole('button', { name: /Confirm \(1\)/ });
    expect(locked).toBeDisabled();
    fireEvent.click(locked);
    expect(mockOnConfirm).not.toHaveBeenCalled();
    unmount();

    render(<CreatureSelectionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirm \(0\)/ }));
    expect(mockOnConfirm).not.toHaveBeenCalled();
    await act(async () => selectTarget(0));
    await act(async () => selectTarget(2));
    fireEvent.click(screen.getByRole('button', { name: /Confirm \(2\)/ }));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
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
    const mapProps = { campaignName: 'test-campaign', attackerName: 'Wizard' };

    it('pre-selects creatures inside the current overlay target, merged into defaultSelected', async () => {
      const overlay = { id: 'o1', shape: 'sphere', radiusFt: 20, startGridX: 5, startGridY: 5, angle: 0 };
      mockGetCurrentOverlayTarget.mockResolvedValue(overlay);
      mockGetCreaturesInsideOverlay.mockResolvedValue(['Goblin A']);

      render(<CreatureSelectionModal {...makeProps({ ...mapProps, defaultSelected: ['Player Character'] })} />);

      await waitFor(() => {
        expect(checkboxes()[0]).toBeChecked();
        expect(checkboxes()[2]).toBeChecked();
      });
      expect(checkboxes()[1]).not.toBeChecked();
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

    it('threads campaignName/attackerName/names/rangeFt into the distance lookup and badges each row by status', async () => {
      mockGetTargetMapStatuses.mockResolvedValue({
        'Goblin A': { status: 'in', distFt: 10 },
        'Goblin B': { status: 'out', distFt: 90 },
        'Player Character': { status: 'off-map', distFt: null },
      });

      render(<CreatureSelectionModal {...makeProps({ ...mapProps, rangeFt: 60 })} />);

      await waitFor(() => {
        expect(document.querySelectorAll('.secondary-target-dist')).toHaveLength(3);
      });
      expect(mockGetTargetMapStatuses).toHaveBeenCalledWith(
        'test-campaign', 'Wizard', ['Goblin A', 'Goblin B', 'Player Character'], 60);
      // Badge copy is owned by spellOverlayService.test.js (distanceBadgeText) —
      // pinned here only by the component's own status class + a shape match
      // proving the mocked status payload reached the row.
      expect(rowNamed('Goblin A').querySelector('.secondary-target-dist-in').textContent).toMatch(/10 ft/);
      expect(rowNamed('Goblin B').querySelector('.secondary-target-dist-out').textContent).toMatch(/90 ft/);
      expect(rowNamed('Player Character').querySelector('.secondary-target-dist-off-map').textContent).not.toBe('');
    });

    it('renders no badges when no map is active', async () => {
      mockGetTargetMapStatuses.mockResolvedValue(null);

      render(<CreatureSelectionModal {...makeProps(mapProps)} />);

      await waitFor(() => {
        expect(mockGetTargetMapStatuses).toHaveBeenCalled();
      });
      expect(document.querySelector('.secondary-target-dist')).toBeNull();
    });

    it('skips overlay and distance lookups without campaignName/attackerName', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);

      await waitFor(() => {
        expect(screen.getByText('Goblin A')).toBeInTheDocument();
      });
      expect(mockGetCurrentOverlayTarget).not.toHaveBeenCalled();
      expect(mockGetTargetMapStatuses).not.toHaveBeenCalled();
      expect(document.querySelector('.secondary-target-dist')).toBeNull();
    });
  });

});
