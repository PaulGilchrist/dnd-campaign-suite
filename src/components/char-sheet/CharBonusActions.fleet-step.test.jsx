// @maintained-by-ai
// CLA-405 (CharBonusActions half): the "Step of the Wind (Fleet Step)" row
// surfaces ONLY when the holder-keyed grant latch matches the current combat
// round for an eligible character, and its click consumes the grant BEFORE
// dispatching the canonical step_of_the_wind lane (dispatching nothing when
// consumption refuses or the character cannot act). Grant stamping, eligibility
// internals, and latch clearing are covered by fleetStepService.test.js and
// useCharActions*.fleetStep.test.js — not re-tested here.
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
import { consumeFleetStep, isFleetStepEligible, FLEET_STEP_GRANT_KEY } from '../../services/rules/features/fleetStepService.js';

const campaignName = 'test-campaign';
const ROW_LABEL = 'Step of the Wind (Fleet Step):';

const monkStats = {
  name: 'Disciplined_Monk',
  rules: '2024',
  level: 20,
  class: { name: 'Monk', major: { name: 'Warrior of the Open Hand', features: [{ name: 'Fleet Step', level: 11 }] } },
  attacks: [{ name: 'Unarmed Strike', range: '5 ft.', hitBonus: 11, damage: '1d12+5', damageType: 'Bludgeoning', type: 'Bonus Action' }],
  bonusActions: [{ name: 'Patient Defense', description: 'Dodge' }],
  spellAbilities: { spells: [] },
};

function renderRow({ cannotAct = false, grantRound = 3, eligible = true, onAutomationAction = vi.fn() } = {}) {
  vi.mocked(isFleetStepEligible).mockReturnValue(eligible);
  vi.mocked(useRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? grantRound : null));
  const utils = render(
    <CharBonusActions
      playerStats={monkStats}
      campaignName={campaignName}
      cannotAct={cannotAct}
      onAutomationAction={onAutomationAction}
    />
  );
  return { onAutomationAction, ...utils };
}

describe('CharBonusActions — Fleet Step row (CLA-405)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFleetStepEligible).mockReturnValue(true);
    vi.mocked(consumeFleetStep).mockResolvedValue(true);
    vi.mocked(useRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? 3 : null));
  });

  it('renders the Step of the Wind (Fleet Step) row when the grant matches the current round', () => {
    renderRow();
    expect(screen.getByText(ROW_LABEL)).toBeTruthy();
    expect(screen.getByText(/Granted by Fleet Step/)).toBeTruthy();
  });

  it('does NOT render the row without a live grant — missing, stale, or ineligible', () => {
    const cases = [
      ['no grant stamped', { grantRound: null }],
      ['grant stamped on a previous round (stale)', { grantRound: 2 }],
      ['grant stamped but character ineligible', { grantRound: 3, eligible: false }],
    ];
    for (const [cause, props] of cases) {
      const { unmount } = renderRow(props);
      expect(screen.queryByText(ROW_LABEL), `expected no row: ${cause}`).toBeNull();
      unmount();
    }
  });

  it('click consumes the grant BEFORE dispatching the canonical step_of_the_wind lane', async () => {
    const order = [];
    consumeFleetStep.mockImplementationOnce(async () => { order.push('consume'); return true; });
    const onDispatch = vi.fn(() => order.push('dispatch'));
    renderRow({ onAutomationAction: onDispatch });

    fireEvent.click(screen.getByText(ROW_LABEL));

    await waitFor(() => expect(onDispatch).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['consume', 'dispatch']);
    expect(consumeFleetStep).toHaveBeenCalledWith(monkStats, campaignName);
    const action = onDispatch.mock.calls[0][0];
    expect(action.name).toBe('Step of the Wind');
    expect(action.automation).toMatchObject({
      type: 'step_of_the_wind',
      action: 'bonus_action',
      casting_time: '1 bonus action',
      cost: { resource: 'focus_points', amount: 1 },
    });
    // Fleet Step IS the grant — no after_attack_action trigger gate on the lane.
    expect(action.automation.trigger).toBeUndefined();
  });

  it('does NOT dispatch when consumption refuses, NOR consume at all when the character cannot act', async () => {
    consumeFleetStep.mockResolvedValueOnce(false);
    const refused = renderRow();
    fireEvent.click(screen.getByText(ROW_LABEL));
    await waitFor(() => expect(consumeFleetStep).toHaveBeenCalledTimes(1));
    expect(refused.onAutomationAction).not.toHaveBeenCalled();
    refused.unmount();

    const blocked = renderRow({ cannotAct: true });
    fireEvent.click(screen.getByText(ROW_LABEL));
    await waitFor(() => expect(blocked.getByText(ROW_LABEL)).toBeTruthy());
    expect(consumeFleetStep).toHaveBeenCalledTimes(1);
    expect(blocked.onAutomationAction).not.toHaveBeenCalled();
  });
});
