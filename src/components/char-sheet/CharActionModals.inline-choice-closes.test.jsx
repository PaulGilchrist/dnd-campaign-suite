// @maintained-by-ai
// Tests for inline choice modals rendered by CharActionModals (InlineChoiceModals.jsx):
// - divineFuryChoice: dispatches damage type selection / skip
// - damageTypeChoice: routes clicks to generic | enhancedUnarmed | damageTypeModifier
//   handlers based on pendingDamage flags (the 3-way dispatch is the behavior under test)
// - featureChoice: renders heading, dispatches selection / cancel
//
// Modal close handlers for CombatStanceModal, RevelationInFleshModal, TeleportModal,
// and wildMagicSurgeModal are covered in CharActionModals.modal-closes-*.test.jsx.
// Handler implementations (state clearing, dice rolling) are covered in
// useModalHandlers-damage.test.js — this file only verifies host dispatch.

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

  it('divineFuryChoice dispatches damage type selection and skip handlers', () => {
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

  // damageTypeChoice dispatches on pendingDamage flags: _attackRider → enhancedUnarmed,
  // _damageTypeModifier → damageTypeModifier, otherwise → generic. Only the routed-to
  // handler may fire — routing to the wrong one silently swallows the roll.
  const dispatchCases = [
    {
      name: 'routes to generic handlers when no pendingDamage flag is set',
      pendingDamage: null,
      choice: 'handleGenericDamageTypeChoice',
      skip: 'handleGenericDamageTypeSkip',
    },
    {
      name: 'routes to enhancedUnarmed handlers when pendingDamage._attackRider is set',
      pendingDamage: { _attackRider: true },
      choice: 'handleEnhancedUnarmedChoice',
      skip: 'handleEnhancedUnarmedSkip',
    },
    {
      name: 'routes to damageTypeModifier handlers when pendingDamage._damageTypeModifier is set',
      pendingDamage: { _damageTypeModifier: { name: 'Empowered Strikes' } },
      choice: 'handleDamageTypeModifierChoice',
      skip: 'handleDamageTypeModifierSkip',
    },
  ];
  const allDispatchHandlers = dispatchCases.flatMap(({ choice, skip }) => [choice, skip]);

  for (const { name, pendingDamage, choice, skip } of dispatchCases) {
    it(`damageTypeChoice ${name}`, () => {
      const handlers = Object.fromEntries(allDispatchHandlers.map((h) => [h, vi.fn()]));
      render(
        <CharActionModals
          {...createBaseProps({ ...handlers, pendingDamage })}
          modalState={{ damageTypeChoice: { title: 'Choose Damage Type', types: ['Fire', 'Cold'] } }}
          setModalState={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('Fire'));
      expect(handlers[choice]).toHaveBeenCalledWith('Fire');

      fireEvent.click(screen.getByText('Cold'));
      expect(handlers[choice]).toHaveBeenCalledWith('Cold');

      fireEvent.click(screen.getByText('Skip'));
      expect(handlers[skip]).toHaveBeenCalled();

      for (const other of allDispatchHandlers.filter((h) => h !== choice && h !== skip)) {
        expect(handlers[other]).not.toHaveBeenCalled();
      }
    });
  }

  it('featureChoice renders the feature name and dispatches selection and cancel', () => {
    const handleFeatureChoiceConfirm = vi.fn();
    const handleFeatureChoiceSkip = vi.fn();
    render(
      <CharActionModals
        {...createBaseProps({ handleFeatureChoiceConfirm, handleFeatureChoiceSkip })}
        modalState={{ featureChoice: { action: { name: 'Test Feature', description: 'Test desc' }, options: ['Option A', 'Option B'] } }}
        setModalState={vi.fn()}
      />
    );

    expect(screen.getByText('Test Feature')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Option B'));
    expect(handleFeatureChoiceConfirm).toHaveBeenCalledWith('Option B');

    fireEvent.click(screen.getByText('Cancel'));
    expect(handleFeatureChoiceSkip).toHaveBeenCalled();
  });
});
