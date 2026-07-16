// Shared fixtures for CharActionModals test files.
// Each test file must declare its own vi.mock() calls for proper Vitest hoisting.
// Modal rendering is covered by CharActionModals.rendering.test.jsx;
// handler callbacks are covered by CharActionModals.handlers.test.jsx,
// CharActionModals.inline-modals.test.jsx, and
// CharActionModals.inline-choice-modals.test.jsx.

// ── Test fixtures ──

export function createBaseProps(overrides) {
  const modalState = {};
  return {
    playerStats: { name: 'Test Character' },
    campaignName: 'test-campaign',
    characters: [],
    modalState,
    setModalState: vi.fn((fn) => {
      if (typeof fn === 'function') {
        return fn(modalState);
      }
      Object.assign(modalState, fn);
    }),
    handleMasteryClose: vi.fn(),
    handleWeaponMasteryChoice: vi.fn(),
    handleWeaponKindMasteryClose: vi.fn(),
    handleCleaveAttack: vi.fn(),
    handleCleaveSkip: vi.fn(),
    handleDivineFuryDamageType: vi.fn(),
    handleDivineFurySkip: vi.fn(),
    handleGenericDamageTypeChoice: vi.fn(),
    handleGenericDamageTypeSkip: vi.fn(),
    handleDamageTypeModifierChoice: vi.fn(),
    handleDamageTypeModifierSkip: vi.fn(),
    handleEnhancedUnarmedChoice: vi.fn(),
    handleEnhancedUnarmedSkip: vi.fn(),
    handleFeatureChoiceConfirm: vi.fn(),
    handleFeatureChoiceSkip: vi.fn(),
    handleConstellationSelect: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleAttackRiderManeuverUse: vi.fn(),
    handleAttackRiderManeuverSkip: vi.fn(),
    handleDivineInterventionCast: vi.fn(),
    handleDivinationSavantConfirm: vi.fn(),
    handleIllusionSavantConfirm: vi.fn(),
    pendingDamage: null,
    ...overrides,
  };
}
