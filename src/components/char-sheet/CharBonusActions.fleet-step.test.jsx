// CLA-405: "Step of the Wind (Fleet Step)" row appears reactively when the
// grant latch matches the current round, dispatches the canonical
// step_of_the_wind lane after consuming, and never renders otherwise.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingLesserRestoration: null,
    handleLesserRestorationConfirm: vi.fn(),
    handleLesserRestorationSkip: vi.fn(),
    pendingHex: null,
    handleHexConfirm: vi.fn(),
    handleHexSkip: vi.fn(),
  })),
}));
vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({ toggleBuff: vi.fn() }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({ setTempHp: vi.fn() }));
vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 3),
}));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn(() => null),
}));
vi.mock('../../services/rules/features/fleetStepService.js', () => ({
  FLEET_STEP_GRANT_KEY: '_Fleet_Step_grantRound',
  FLEET_STEP_ROW_NAME: 'Step of the Wind (Fleet Step)',
  isFleetStepEligible: vi.fn(() => true),
  consumeFleetStep: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('./popups/MetamagicPopup.jsx', () => ({ default: () => <div /> }));
vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({ default: () => <div /> }));
vi.mock('./ArcaneVigorModal.jsx', () => ({ default: () => <div /> }));
vi.mock('./modals/WarBondChooserModal.jsx', () => ({ default: () => <div /> }));
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({ default: () => <div /> }));
vi.mock('./char-spells/TargetSpellPopups.jsx', () => ({ default: () => <div /> }));
vi.mock('./modals/weapon-kind-mastery-cache.js', () => ({ loadWeapons: vi.fn(() => Promise.resolve([])) }));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({ default: () => <div /> }));
vi.mock('./HexAbilityModal.jsx', () => ({ default: () => <div /> }));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn(h => h) }));
vi.mock('../../services/ui/spellSectionUtils.js', () => ({
  getBonusActionSpellNames: vi.fn(() => new Set()),
  applyPotentSpellcasting: vi.fn(s => s),
}));
vi.mock('../../services/character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({ featuresToIgnore: [] })),
}));
vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn(() => null),
}));
vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));
vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn(() => null),
  isAutoHitSpell: vi.fn(() => false),
  resolveHealExpression: vi.fn(() => ''),
}));
vi.mock('../../hooks/combat/useSimpleDamageRoll.js', () => ({
  useSimpleDamageRoll: vi.fn(() => vi.fn()),
}));
vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({ resolvePositions: vi.fn(), cachedPosRef: {} })),
}));
vi.mock('../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));
vi.mock('../../services/rules/features/spiritualWeaponService.js', () => ({
  resolveSpiritualWeaponMoveAndAttack: vi.fn(),
}));
vi.mock('../../services/automation/handlers/class-fighter-rogue/warBondHandler.js', () => ({
  handleBond: vi.fn(),
  inventoryWeaponNames: vi.fn(() => []),
  handle: vi.fn(),
}));

import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { consumeFleetStep, FLEET_STEP_GRANT_KEY } from '../../services/rules/features/fleetStepService.js';

const campaignName = 'test-campaign';

const monkStats = {
  name: 'Disciplined_Monk',
  rules: '2024',
  level: 20,
  class: { name: 'Monk', major: { name: 'Warrior of the Open Hand', features: [{ name: 'Fleet Step', level: 11 }] } },
  attacks: [{ name: 'Unarmed Strike', range: '5 ft.', hitBonus: 11, damage: '1d12+5', damageType: 'Bludgeoning', type: 'Bonus Action' }],
  bonusActions: [{ name: 'Patient Defense', description: 'Dodge' }],
  spellAbilities: { spells: [] },
};

function renderRow() {
  const onAutomationAction = vi.fn();
  const { container } = render(
    <CharBonusActions playerStats={monkStats} campaignName={campaignName} onAutomationAction={onAutomationAction} />
  );
  return { onAutomationAction, container };
}

describe('CharBonusActions — Fleet Step row (CLA-405)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? 3 : null));
  });

  it('renders the Step of the Wind (Fleet Step) affordance when the grant matches the current round', () => {
    renderRow();
    expect(screen.getByText('Step of the Wind (Fleet Step):')).toBeTruthy();
  });

  it('does NOT render the row when no grant is pending', () => {
    vi.mocked(useRuntimeValue).mockReturnValue(null);
    renderRow();
    expect(screen.queryByText('Step of the Wind (Fleet Step):')).toBeNull();
  });

  it('does NOT render the row when the grant latch is stale (previous round)', () => {
    vi.mocked(useRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? 2 : null));
    renderRow();
    expect(screen.queryByText('Step of the Wind (Fleet Step):')).toBeNull();
  });

  it('does NOT render for ineligible characters even with a grant stamped', async () => {
    vi.mocked(useRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? 3 : null));
    const { isFleetStepEligible } = await import('../../services/rules/features/fleetStepService.js');
    vi.mocked(isFleetStepEligible).mockReturnValueOnce(false);
    render(
      <CharBonusActions
        playerStats={{ ...monkStats, rules: '5e' }}
        campaignName={campaignName}
        onAutomationAction={vi.fn()}
      />
    );
    expect(screen.queryByText('Step of the Wind (Fleet Step):')).toBeNull();
  });

  it('consumes the grant BEFORE dispatch and routes via the canonical step_of_the_wind lane', async () => {
    const { onAutomationAction } = renderRow();
    const order = [];
    consumeFleetStep.mockImplementationOnce(async () => { order.push('consume'); return true; });
    fireEvent.click(screen.getByText('Step of the Wind (Fleet Step):'));
    await waitFor(() => expect(onAutomationAction).toHaveBeenCalledTimes(1));
    order.push('dispatch');
    expect(order).toEqual(['consume', 'dispatch']);
    const action = onAutomationAction.mock.calls[0][0];
    expect(action.automation.type).toBe('step_of_the_wind');
    expect(action.automation.trigger).toBeUndefined();
    expect(action.automation.cost).toEqual({ resource: 'focus_points', amount: 1 });
  });

  it('does NOT dispatch the Step lane when consumption refuses (no grant pending)', async () => {
    consumeFleetStep.mockImplementationOnce(async () => false);
    const { onAutomationAction } = renderRow();
    fireEvent.click(screen.getByText('Step of the Wind (Fleet Step):'));
    await waitFor(() => expect(consumeFleetStep).toHaveBeenCalledTimes(1));
    expect(onAutomationAction).not.toHaveBeenCalled();
  });
});
