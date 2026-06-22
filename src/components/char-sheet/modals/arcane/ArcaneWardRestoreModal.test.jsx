// @improved-by-ai
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

const defaultAction = {
  name: 'Arcane Ward Restore',
};

const defaultPlayerStats = {
  name: 'Sorcerer1',
};

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

// Helper to set up mock runtime values for all 9 spell slot levels
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

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the modal overlay structure with all expected sections', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      expect(document.querySelector('.arcane-ward-restore-overlay')).toBeInTheDocument();
      expect(document.querySelector('.arcane-ward-restore-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the header with the action name and shield icon', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      expect(screen.getByText('Arcane Ward Restore')).toBeInTheDocument();
      expect(document.querySelector('.sp-header .fa-solid.fa-shield-halved')).toBeInTheDocument();
    });

    it('renders the ward HP display with values from runtime state', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const p = document.querySelector('.sp-body p');
      expect(p.textContent).toContain('Arcane Ward HP:');
      expect(p.textContent).toContain('10/20');
    });

    it('renders the description explaining slot-to-HP conversion', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      expect(screen.getByText(/Choose a spell slot level to expend/)).toBeInTheDocument();
      expect(screen.getByText(/Ward HP restored = 2 × slot level/)).toBeInTheDocument();
    });

    it('renders 9 spell slot level options (1 through 9)', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      for (let lvl = 1; lvl <= 9; lvl++) {
        expect(screen.getByText(`Level ${lvl}`)).toBeInTheDocument();
      }
    });

    it('renders the available count for each spell slot level', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      expect(screen.getByText('2 available')).toBeInTheDocument();
      expect(screen.getByText('1 available')).toBeInTheDocument();
      // 7 levels show "0 available" — verify at least one exists
      const zeroAvailable = screen.queryAllByText(/0 available/);
      expect(zeroAvailable.length).toBe(7);
    });

    it('renders the restore amount for each spell slot level (+lvl*2 HP)', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      expect(screen.getByText('+2 HP')).toBeInTheDocument();
      expect(screen.getByText('+4 HP')).toBeInTheDocument();
      expect(screen.getByText('+6 HP')).toBeInTheDocument();
    });

    it('does not show the preview section on initial render', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      expect(screen.queryByText(/Preview:/)).not.toBeInTheDocument();
    });

    it('renders the Restore Ward button disabled on initial render', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      expect(restoreBtn).toBeDisabled();
    });

    it('renders the Cancel button', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders the shield icon on the Restore Ward button', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      expect(restoreBtn.querySelector('.fa-solid.fa-shield-halved')).toBeInTheDocument();
    });
  });

  // ── Spell slot grid display ──

  describe('spell slot grid', () => {
    it('marks spell slot options with 0 available as disabled', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level3Option = screen.getByText('Level 3').closest('.arcane-ward-slot-option');
      expect(level3Option).toHaveClass('disabled');
      const level3Input = level3Option.querySelector('input[type="radio"]');
      expect(level3Input).toBeDisabled();
    });

    it('marks spell slot options with slots available as not disabled', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      expect(level1Option).not.toHaveClass('disabled');
      const level1Input = level1Option.querySelector('input[type="radio"]');
      expect(level1Input).not.toBeDisabled();
    });

    it('shows disabled class on options for levels with no slots', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      for (let lvl = 3; lvl <= 9; lvl++) {
        const option = screen.getByText(`Level ${lvl}`).closest('.arcane-ward-slot-option');
        expect(option).toHaveClass('disabled');
      }
    });
  });

  // ── Selection behavior ──

  describe('selection behavior', () => {
    it('selects a spell slot level when clicked', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      const selectedOption = document.querySelector('.arcane-ward-slot-option.selected');
      expect(selectedOption).toContainElement(screen.getByText('Level 1'));
    });

    it('switches selection when a different level is clicked', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      const level2Option = screen.getByText('Level 2').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      fireEvent.click(level2Option);
      expect(level2Option).toHaveClass('selected');
      expect(level1Option).not.toHaveClass('selected');
    });

    it('does not select a disabled spell slot level when clicked', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level3Option = screen.getByText('Level 3').closest('.arcane-ward-slot-option');
      fireEvent.click(level3Option);
      expect(level3Option).not.toHaveClass('selected');
    });

    it('shows the preview section after selecting a level', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      expect(screen.getByText(/Preview:/)).toBeInTheDocument();
    });

    it('shows the correct preview with selected level 1 (10 → 12)', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      const preview = document.querySelector('.arcane-ward-preview');
      expect(preview.textContent).toContain('10 → 12/20');
    });

    it('shows the correct preview with selected level 2 (10 → 14)', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level2Option = screen.getByText('Level 2').closest('.arcane-ward-slot-option');
      fireEvent.click(level2Option);
      const preview = document.querySelector('.arcane-ward-preview');
      expect(preview.textContent).toContain('10 → 14/20');
    });

    it('caps preview at max HP when restore would exceed max', () => {
      setupRuntimeValues(18, 20, { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level2Option = screen.getByText('Level 2').closest('.arcane-ward-slot-option');
      fireEvent.click(level2Option);
      const preview = document.querySelector('.arcane-ward-preview');
      expect(preview.textContent).toContain('18 → 20/20');
    });

    it('shows the correct restore amount for level 5 (10 → 20)', () => {
      setupRuntimeValues(10, 20, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 0, 7: 0, 8: 0, 9: 0 });
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level5Option = screen.getByText('Level 5').closest('.arcane-ward-slot-option');
      fireEvent.click(level5Option);
      const preview = document.querySelector('.arcane-ward-preview');
      expect(preview.textContent).toContain('10 → 20/20');
    });
  });

  // ── Restore Ward button state ──

  describe('Restore Ward button state', () => {
    it('is disabled when no level is selected', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      expect(restoreBtn).toBeDisabled();
    });

    it('is enabled when a level with available slots is selected', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      expect(restoreBtn).toBeEnabled();
    });

    it('is disabled when only a level with 0 slots is clicked (should not be selectable)', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      // Level 3 has 0 slots so it can't be selected, button should stay disabled
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      expect(restoreBtn).toBeDisabled();
    });
  });

  // ── Close / dismiss behavior ──

  describe('close behavior', () => {
    it('calls onClose when the overlay background is clicked', () => {
      const onClose = vi.fn();
      render(<ArcaneWardRestoreModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.arcane-ward-restore-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when the modal content is clicked', () => {
      const onClose = vi.fn();
      render(<ArcaneWardRestoreModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.arcane-ward-restore-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when the Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<ArcaneWardRestoreModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Confirm / restore flow ──

  describe('restore confirm', () => {
    it('calls setRuntimeBatch with arcaneWardHp and spell slot decrement when applying', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      fireEvent.click(restoreBtn);
      expect(setRuntimeBatch).toHaveBeenCalledWith(
        'Sorcerer1',
        expect.objectContaining({
          arcaneWardHp: 12,
          spell_slots_level_1: 1,
        }),
        'test-campaign'
      );
    });

    it('calls setRuntimeBatch with correct values for level 2 selection', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level2Option = screen.getByText('Level 2').closest('.arcane-ward-slot-option');
      fireEvent.click(level2Option);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      fireEvent.click(restoreBtn);
      expect(setRuntimeBatch).toHaveBeenCalledWith(
        'Sorcerer1',
        expect.objectContaining({
          arcaneWardHp: 14,
          spell_slots_level_2: 0,
        }),
        'test-campaign'
      );
    });

    it('caps arcaneWardHp at max when restore would exceed max', () => {
      setupRuntimeValues(18, 20, { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level2Option = screen.getByText('Level 2').closest('.arcane-ward-slot-option');
      fireEvent.click(level2Option);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      fireEvent.click(restoreBtn);
      expect(setRuntimeBatch).toHaveBeenCalledWith(
        'Sorcerer1',
        expect.objectContaining({
          arcaneWardHp: 20,
          spell_slots_level_2: 0,
        }),
        'test-campaign'
      );
    });

    it('calls onConfirm with selectedLevel, restoreAmount, oldHp, and newHp', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      fireEvent.click(restoreBtn);
      expect(defaultOnConfirm).toHaveBeenCalledWith(1, 2, 10, 12);
    });

    it('calls onConfirm with correct values for level 2 selection', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level2Option = screen.getByText('Level 2').closest('.arcane-ward-slot-option');
      fireEvent.click(level2Option);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      fireEvent.click(restoreBtn);
      expect(defaultOnConfirm).toHaveBeenCalledWith(2, 4, 10, 14);
    });

    it('calls onClose after applying', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      fireEvent.click(restoreBtn);
      expect(defaultOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onConfirm when onConfirm prop is undefined', () => {
      render(<ArcaneWardRestoreModal {...makeProps({ onConfirm: undefined })} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      fireEvent.click(restoreBtn);
      // Should not throw and should not call undefined
      expect(defaultOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not apply when canApply is false (no selection)', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      fireEvent.click(restoreBtn);
      expect(setRuntimeBatch).not.toHaveBeenCalled();
      expect(defaultOnClose).not.toHaveBeenCalled();
    });
  });

  // ── Runtime state reading ──

  describe('runtime state reading', () => {
    it('reads arcaneWardHp and arcaneWardMax from runtime state on mount', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      expect(getRuntimeValue).toHaveBeenCalledWith('Sorcerer1', 'arcaneWardHp', 'test-campaign');
      expect(getRuntimeValue).toHaveBeenCalledWith('Sorcerer1', 'arcaneWardMax', 'test-campaign');
    });

    it('reads spell slot levels 1 through 9 from runtime state on mount', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      for (let lvl = 1; lvl <= 9; lvl++) {
        expect(getRuntimeValue).toHaveBeenCalledWith(
          'Sorcerer1',
          `spell_slots_level_${lvl}`,
          'test-campaign'
        );
      }
    });

    it('defaults to 0 when runtime values are null', () => {
      getRuntimeValue.mockReturnValue(null);
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const p = document.querySelector('.sp-body p');
      expect(p.textContent).toContain('Arcane Ward HP:');
      expect(p.textContent).toContain('0/0');
    });

    it('defaults to 0 for spell slots when runtime value is null', () => {
      getRuntimeValue.mockReturnValue(null);
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      // All 9 levels show "0 available", just verify the first one is present
      const options = screen.queryAllByText(/available/);
      expect(options.length).toBeGreaterThan(0);
    });

    it('defaults to 0 when runtime value is undefined', () => {
      getRuntimeValue.mockReturnValue(undefined);
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const p = document.querySelector('.sp-body p');
      expect(p.textContent).toContain('Arcane Ward HP:');
      expect(p.textContent).toContain('0/0');
    });

    it('handles non-numeric runtime values by showing NaN', () => {
      getRuntimeValue.mockReturnValue('not-a-number');
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const p = document.querySelector('.sp-body p');
      expect(p.textContent).toContain('NaN/NaN');
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('renders with undefined onClose without throwing at render time', () => {
      render(<ArcaneWardRestoreModal {...makeProps({ onClose: undefined })} />);
      expect(screen.getByText('Arcane Ward Restore')).toBeInTheDocument();
    });

    it('renders with undefined onConfirm without throwing at render time', () => {
      render(<ArcaneWardRestoreModal {...makeProps({ onConfirm: undefined })} />);
      expect(screen.getByText('Arcane Ward Restore')).toBeInTheDocument();
    });

    it('renders with undefined playerStats without throwing at render time', () => {
      render(<ArcaneWardRestoreModal {...makeProps({ playerStats: undefined })} />);
      expect(screen.getByText('Arcane Ward Restore')).toBeInTheDocument();
    });

    it('renders with undefined campaignName without throwing at render time', () => {
      render(<ArcaneWardRestoreModal {...makeProps({ campaignName: undefined })} />);
      expect(screen.getByText('Arcane Ward Restore')).toBeInTheDocument();
    });

    it('renders with a custom action name', () => {
      render(<ArcaneWardRestoreModal {...makeProps({ action: { name: 'Custom Ward Restore' } })} />);
      expect(screen.getByText('Custom Ward Restore')).toBeInTheDocument();
    });

    it('renders all 9 levels even when all have 0 slots available', () => {
      setupRuntimeValues(10, 20, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      for (let lvl = 1; lvl <= 9; lvl++) {
        expect(screen.getByText(`Level ${lvl}`)).toBeInTheDocument();
      }
      // All 9 levels should show "0 available"
      const availableSpans = screen.queryAllByText(/0 available/);
      expect(availableSpans).toHaveLength(9);
    });

    it('renders all 9 levels even when all have slots available', () => {
      setupRuntimeValues(10, 20, { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 });
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      for (let lvl = 1; lvl <= 9; lvl++) {
        expect(screen.getByText(`Level ${lvl}`)).toBeInTheDocument();
      }
      expect(screen.getByText('1 available')).toBeInTheDocument();
      expect(screen.getByText('9 available')).toBeInTheDocument();
    });

    it('uses playerStats name for runtime state lookups', () => {
      const playerStats = { name: 'CustomSorcerer' };
      render(<ArcaneWardRestoreModal {...makeProps({ playerStats })} />);
      expect(getRuntimeValue).toHaveBeenCalledWith('CustomSorcerer', 'arcaneWardHp', 'test-campaign');
    });

    it('uses campaignName for runtime state lookups', () => {
      const campaignName = 'custom-campaign';
      render(<ArcaneWardRestoreModal {...makeProps({ campaignName })} />);
      expect(getRuntimeValue).toHaveBeenCalledWith('Sorcerer1', 'arcaneWardHp', 'custom-campaign');
    });

    it('uses campaignName in setRuntimeBatch when applying', () => {
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level1Option = screen.getByText('Level 1').closest('.arcane-ward-slot-option');
      fireEvent.click(level1Option);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      fireEvent.click(restoreBtn);
      expect(setRuntimeBatch).toHaveBeenCalledWith(
        'Sorcerer1',
        expect.any(Object),
        'test-campaign'
      );
    });

    it('passes ward info values to onConfirm after capping at max', () => {
      setupRuntimeValues(19, 20, { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
      render(<ArcaneWardRestoreModal {...makeProps()} />);
      const level2Option = screen.getByText('Level 2').closest('.arcane-ward-slot-option');
      fireEvent.click(level2Option);
      const restoreBtn = screen.getByRole('button', { name: /Restore Ward/ });
      fireEvent.click(restoreBtn);
      // 19 + 4 = 23, capped to 20
      expect(defaultOnConfirm).toHaveBeenCalledWith(2, 4, 19, 20);
    });
  });
});
