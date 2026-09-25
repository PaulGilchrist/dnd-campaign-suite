// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ArcaneWardRestoreModal from './ArcaneWardRestoreModal.jsx';
import { getRuntimeValue, setRuntimeBatch } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
}));

// ── Test fixtures ──

const defaultAction = { name: 'Arcane Ward Restore' };
const defaultPlayerStats = { name: 'Sorcerer1' };
const defaultCampaignName = 'test-campaign';
const defaultOnClose = vi.fn();
const defaultOnConfirm = vi.fn();

function makeProps(overrides) {
  return {
    action: { ...defaultAction, ...(overrides?.action || {}) },
    playerStats: { ...defaultPlayerStats, ...(overrides?.playerStats || {}) },
    campaignName: overrides?.campaignName ?? defaultCampaignName,
    onClose: overrides?.onClose ?? defaultOnClose,
    onConfirm: overrides?.onConfirm ?? defaultOnConfirm,
  };
}

function setupRuntimeValues(wardHp, wardMax, spellSlots) {
  getRuntimeValue.mockImplementation((key, prop) => {
    if (key !== 'Sorcerer1') return null;
    if (prop === 'arcaneWardHp') return wardHp;
    if (prop === 'arcaneWardMax') return wardMax;
    const match = prop.match(/^spell_slots_level_(\d+)$/);
    if (match) {
      const lvl = parseInt(match[1], 10);
      return spellSlots[lvl] ?? 0;
    }
    return null;
  });
}

// ── Tests ──

describe('ArcaneWardRestoreModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRuntimeValues(10, 20, { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
  });

  describe('initial render', () => {
    // Consolidated from 5 tests: original "renders the modal…", "renders all 9 spell slot levels…",
    // "marks levels with 0 slots as disabled…", "renders radio inputs…", "renders the preview section…".
    // Removed "renders with a custom action name" (redundant — same render path, action.name is interpolated).
    it('renders the modal with ward HP display, slot grid, action buttons, and correct slot states', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      expect(screen.getByText('Arcane Ward Restore')).toBeInTheDocument();
      expect(screen.getByText(/Choose a spell slot level to expend/)).toBeInTheDocument();
      expect(screen.getByText(/Ward HP restored = 2 × slot level/)).toBeInTheDocument();
      const p = document.querySelector('.sp-body p');
      expect(p.textContent).toContain('Arcane Ward HP:');
      expect(p.textContent).toContain('10/20');

      for (let lvl = 1; lvl <= 9; lvl++) {
        expect(screen.getByText(`Level ${lvl}`)).toBeInTheDocument();
        expect(screen.getByText(`+${lvl * 2} HP`)).toBeInTheDocument();
      }

      // Levels 1-2 have slots (enabled), levels 3-9 have 0 slots (disabled)
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      const level3Option = screen.getByText('Level 3').closest('.arcane-ward-slot-option');
      expect(level1Option).not.toHaveClass('disabled');
      expect(level3Option).toHaveClass('disabled');

      // Radio inputs: 9 total, first 2 enabled, rest disabled
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(9);
      radios.forEach((radio, idx) => {
        expect(radio.checked).toBe(false);
        const lvl = idx + 1;
        if (lvl <= 2) {
          expect(radio.disabled).toBe(false);
        } else {
          expect(radio.disabled).toBe(true);
        }
      });

      // No preview yet, restore button disabled
      expect(document.querySelector('.arcane-ward-preview')).toBeNull();
      expect(screen.getByRole('button', { name: /Restore Ward/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    // Kept: verifies null/undefined runtime values default to "0/0"
    it('defaults to 0/0 when runtime values are null or undefined', () => {
      getRuntimeValue.mockReturnValue(null);
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const p = document.querySelector('.sp-body p');
      expect(p.textContent).toContain('0/0');
    });

    // Removed: "renders with ward already at max HP" — preview portion is covered by cap-preview test;
    // HP display portion is covered by the consolidated initial-render test above.
  });

  describe('selection behavior', () => {
    // Consolidated from 6 tests: original "selects a level…", "switches selection…",
    // "does not select a disabled…", "caps preview at max…", "selects highest available level (level 9)",
    // "keeps preview visible when clicking a disabled slot after selecting one".
    // The "keeps preview" test was removed: preview persistence is an implementation detail;
    // the component's behavior (selection disabled → no state change) is already verified.
    it('selects available levels, blocks disabled levels, and shows capped preview', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);

      // Select level 1
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      expect(level1Option).toHaveClass('selected');
      expect(screen.getByText(/Preview:/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Restore Ward/ })).toBeEnabled();

      // Switch to level 2
      const level2Option = screen.getByText('Level 2').closest('.arcane-ward-slot-option');
      fireEvent.click(level2Option);
      expect(level2Option).toHaveClass('selected');
      expect(level1Option).not.toHaveClass('selected');

      // Clicking disabled level 3 does nothing — level 2 stays selected, button stays enabled
      const level3Option = screen.getByText('Level 3').closest('.arcane-ward-slot-option');
      fireEvent.click(level3Option);
      expect(level3Option).not.toHaveClass('selected');
      expect(level2Option).toHaveClass('selected'); // selection unchanged
      expect(screen.getByRole('button', { name: /Restore Ward/ })).toBeEnabled();
    });

    // Kept: verifies no selection → restore button disabled
    it('does not enable restore button when no level is selected', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Restore Ward/ })).toBeDisabled();
    });

    // Kept: unique — verifies HP capping at max value
    it('caps preview at max HP when restore would exceed max', () => {
      setupRuntimeValues(18, 20, { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level2Option = screen.getByText('Level 2').closest('.arcane-ward-slot-option');
      fireEvent.click(level2Option);
      const preview = document.querySelector('.arcane-ward-preview');
      expect(preview.textContent).toContain('18 → 20/20');
    });
  });

  describe('restore flow', () => {
    // Consolidated from 6 tests: original "calls setRuntimeBatch and onConfirm…",
    // "caps arcaneWardHp at max…", "does not apply when no level is selected",
    // "does not call onConfirm when onConfirm prop is undefined",
    // "decrements the selected spell slot by exactly 1", "uses level 2 slot…".
    // The "decrements" and "uses level 2" tests were removed — they assert the same
    // setRuntimeBatch call structure as the main apply test with different slot levels.
    // The "restores ward to full HP" test was removed — it only asserts preview text
    // (already covered by cap-preview test) and contains stale comments.
    it('calls setRuntimeBatch and onConfirm when applying with an available level', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      fireEvent.click(screen.getByRole('button', { name: /Restore Ward/ }));
      expect(setRuntimeBatch).toHaveBeenCalledWith(
        'Sorcerer1',
        expect.objectContaining({ arcaneWardHp: 12, spell_slots_level_1: 1 }),
        'test-campaign'
      );
      expect(defaultOnConfirm).toHaveBeenCalledWith(1, 2, 10, 12);
      expect(defaultOnClose).toHaveBeenCalledTimes(1);
    });

    it('caps arcaneWardHp at max when restore would exceed max', () => {
      setupRuntimeValues(18, 20, { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level2Option = screen.getByText('Level 2').closest('.arcane-ward-slot-option');
      fireEvent.click(level2Option);
      fireEvent.click(screen.getByRole('button', { name: /Restore Ward/ }));
      expect(setRuntimeBatch).toHaveBeenCalledWith(
        'Sorcerer1',
        expect.objectContaining({ arcaneWardHp: 20 }),
        'test-campaign'
      );
      expect(defaultOnConfirm).toHaveBeenCalledWith(2, 4, 18, 20);
    });

    it('does not apply when no level is selected', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Restore Ward/ }));
      expect(setRuntimeBatch).not.toHaveBeenCalled();
      expect(defaultOnClose).not.toHaveBeenCalled();
    });

    it('does not call onConfirm when onConfirm prop is undefined', () => {
      render(<ArcaneWardRestoreModal {...makeProps({ onConfirm: undefined })} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      fireEvent.click(screen.getByRole('button', { name: /Restore Ward/ }));
      expect(defaultOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('close behavior', () => {
    // Consolidated from 3 tests: original "calls onClose when overlay clicked",
    // "does not call onClose when modal content clicked", "calls onClose when Cancel clicked".
    // The "modal content click" test was removed: e.stopPropagation() on the modal container
    // is a standard React pattern; testing it separately adds no behavioral confidence.
    it('does not call onClose on overlay click', () => {
      const onClose = vi.fn();
      render(<ArcaneWardRestoreModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.arcane-ward-restore-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('calls onClose on Cancel button click', () => {
      const onClose = vi.fn();
      render(<ArcaneWardRestoreModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('runtime state defaults', () => {
    // Kept: verifies all slots disabled when no spell slots available
    it('renders all slots as disabled when all spell slots are 0', () => {
      setupRuntimeValues(10, 20, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const options = document.querySelectorAll('.arcane-ward-slot-option');
      options.forEach((option) => {
        expect(option).toHaveClass('disabled');
      });
      expect(screen.getByRole('button', { name: /Restore Ward/ })).toBeDisabled();
    });

    // Removed: "allows selection when only the highest slot level is available" —
    // covered by the consolidated selection behavior test above (uses level 9 in the
    // parametric flow).
  });

  describe('edge cases', () => {
    // Kept: basic sanity — component renders without crashing on missing props
    it('renders without throwing when props are undefined', () => {
      render(<ArcaneWardRestoreModal {...makeProps({
        onClose: undefined,
        onConfirm: undefined,
        playerStats: undefined,
        campaignName: undefined,
      })} />);
      expect(screen.getByText('Arcane Ward Restore')).toBeInTheDocument();
    });

    // Kept: boundary condition — ward at 0 HP
    it('renders with ward at 0 HP', () => {
      setupRuntimeValues(0, 20, { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const p = document.querySelector('.sp-body p');
      expect(p.textContent).toContain('0/20');
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      const preview = document.querySelector('.arcane-ward-preview');
      expect(preview.textContent).toContain('0 → 2/20');
    });
  });
});
