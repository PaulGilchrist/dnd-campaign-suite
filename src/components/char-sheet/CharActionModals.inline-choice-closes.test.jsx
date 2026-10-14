// Tests for inline choice modals in CharActionModals.jsx:
// - divineFuryChoice inline modal
// - damageTypeChoice inline modal (generic + enhancedUnarmed dispatching)
// - featureChoice inline modal
//
// Modal close handlers for CombatStanceModal, RevelationInFleshModal, TeleportModal,
// and wildMagicSurgeModal are covered in CharActionModals.modal-closes-*.test.jsx.
//
// Cleaned: Removed redundant negative test for generic handlers (covered by
// enhancedUnarmed positive test). Consolidated featureChoice selection+skip
// into a single test.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Minimal mocks — only what the inline choice modals need ──

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Tests ──

describe('CharActionModals — inline choice modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('divineFuryChoice inline modal', () => {
    it('dispatches damage type selection and skip handlers', () => {
      const handleDivineFuryDamageType = vi.fn();
      const handleDivineFurySkip = vi.fn();
      render(
        <CharActionModals
          {...createBaseProps({ handleDivineFuryDamageType, handleDivineFurySkip })}
          modalState={{ divineFuryChoice: {} }}
          setModalState={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('Necrotic'));
      expect(handleDivineFuryDamageType).toHaveBeenCalledWith('Necrotic');

      fireEvent.click(screen.getByText('Radiant'));
      expect(handleDivineFuryDamageType).toHaveBeenCalledWith('Radiant');

      fireEvent.click(screen.getByText('Skip'));
      expect(handleDivineFurySkip).toHaveBeenCalled();
    });
  });

  describe('damageTypeChoice inline modal', () => {
    it('dispatches to generic handlers by default', () => {
      const handleGenericDamageTypeChoice = vi.fn();
      const handleGenericDamageTypeSkip = vi.fn();
      render(
        <CharActionModals
          {...createBaseProps({
            handleGenericDamageTypeChoice,
            handleGenericDamageTypeSkip,
            handleEnhancedUnarmedChoice: vi.fn(),
            handleEnhancedUnarmedSkip: vi.fn(),
            handleDamageTypeModifierChoice: vi.fn(),
            handleDamageTypeModifierSkip: vi.fn(),
          })}
          modalState={{ damageTypeChoice: { title: 'Test', types: ['Fire', 'Cold'] } }}
          setModalState={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('Fire'));
      expect(handleGenericDamageTypeChoice).toHaveBeenCalledWith('Fire');

      fireEvent.click(screen.getByText('Skip'));
      expect(handleGenericDamageTypeSkip).toHaveBeenCalled();
    });

    it('dispatches to enhancedUnarmed handlers when pendingDamage._attackRider is set', () => {
      const handleEnhancedUnarmedChoice = vi.fn();
      const handleEnhancedUnarmedSkip = vi.fn();
      render(
        <CharActionModals
          {...createBaseProps({
            handleEnhancedUnarmedChoice,
            handleEnhancedUnarmedSkip,
            handleGenericDamageTypeChoice: vi.fn(),
            handleGenericDamageTypeSkip: vi.fn(),
            handleDamageTypeModifierChoice: vi.fn(),
            handleDamageTypeModifierSkip: vi.fn(),
            pendingDamage: { _attackRider: true },
          })}
          modalState={{ damageTypeChoice: { title: 'Test', types: ['Fire'] } }}
          setModalState={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('Fire'));
      expect(handleEnhancedUnarmedChoice).toHaveBeenCalledWith('Fire');

      fireEvent.click(screen.getByText('Skip'));
      expect(handleEnhancedUnarmedSkip).toHaveBeenCalled();
    });

  });

  describe('featureChoice inline modal', () => {
    it('dispatches feature selection and skip handlers', () => {
      const handleFeatureChoiceConfirm = vi.fn();
      const handleFeatureChoiceSkip = vi.fn();
      render(
        <CharActionModals
          {...createBaseProps({ handleFeatureChoiceConfirm, handleFeatureChoiceSkip })}
          modalState={{ featureChoice: { action: { name: 'Test Feature', description: 'Test desc' }, options: ['Option A', 'Option B'] } }}
          setModalState={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('Option A'));
      expect(handleFeatureChoiceConfirm).toHaveBeenCalledWith('Option A');

      fireEvent.click(screen.getByText('Cancel'));
      expect(handleFeatureChoiceSkip).toHaveBeenCalled();
    });

    it('renders the feature name in the modal heading', () => {
      render(
        <CharActionModals
          {...createBaseProps({ handleFeatureChoiceConfirm: vi.fn(), handleFeatureChoiceSkip: vi.fn() })}
          modalState={{ featureChoice: { action: { name: 'Test Feature' }, options: ['Option A'] } }}
          setModalState={vi.fn()}
        />
      );

      expect(screen.getByText('Test Feature')).toBeInTheDocument();
    });
  });
});
