// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
    pendingRemoveCurse: null,
    handleRemoveCurseConfirm: vi.fn(),
    handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
  onSpellSelected: vi.fn(),
}));

vi.mock('../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  }),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn((props) => <div data-testid="dice-roll-result">{props.name || 'DiceRollResult'}</div>),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="metamagic-popup">{props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name || 'SpellDetailPopup'}</div>),
}));

vi.mock('./EmpoweredSpellPopup.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="empowered-spell-popup">EmpoweredSpellPopup</div>),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => ({ baseName: name })),
  resolveSpellDamageAtLevel: vi.fn(() => '8d6'),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ maxFocusPoints: 2 })),
}));

vi.mock('../../services/character/featRangeService.js', () => ({
  computeFeatRangeEffects: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 })),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
    saveDcBonus: 0,
  })),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(),
    handleSpellAttackClick: vi.fn(),
    handleSpellDamageClick: vi.fn(),
  })),
}));

import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';
import { useActionSpellMetamagic } from '../../hooks/combat/useActionSpellMetamagic.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  actions: [],
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharActions state and modals', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([]),
    });
    useSpellMetamagicFlow.mockReturnValue({
      pendingMetamagic: null,
      gateMetamagic: vi.fn(),
      handleConfirm: vi.fn(),
      handleSkip: vi.fn(),
      pendingAid: null,
      handleAidConfirm: vi.fn(),
      handleAidSkip: vi.fn(),
      pendingGreaterRestoration: null,
      handleGreaterRestorationConfirm: vi.fn(),
      handleGreaterRestorationSkip: vi.fn(),
      pendingRemoveCurse: null,
      handleRemoveCurseConfirm: vi.fn(),
      handleRemoveCurseSkip: vi.fn(),
    });
  });

  describe('popup rendering', () => {
    it('renders the Actions section header on mount', async () => {
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });
      const stats = createStats({});
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  describe('feature choice modal', () => {
    function setupFeatureChoiceAction(actionName, automation) {
      hasAutomation.mockReturnValue(true);
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const stats = createStats({
        actions: [{ name: actionName, description: 'Choose an option.', automation }],
      });

      return stats;
    }

    it('shows feature choice modal when damage_bonus action has options and no chosen option', async () => {
      const stats = setupFeatureChoiceAction('Blessed Strikes', { type: 'damage_bonus', options: ['Lightning', 'Thunder'] });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Blessed Strikes:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => { expect(screen.getByText(/Choose your option/)).toBeInTheDocument(); });
    });

    it('shows feature choice modal for save_attack with hasOptions flag', async () => {
      const stats = setupFeatureChoiceAction('Elemental Attunement', { type: 'save_attack', hasOptions: true, options: ['Fire', 'Cold'] });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Elemental Attunement:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => { expect(screen.getByText(/Choose your option/)).toBeInTheDocument(); });
    });

    it('shows feature choice modal for hunter_prey type with predefined options', async () => {
      const stats = setupFeatureChoiceAction('Hunter\'s Prey', { type: 'hunter_prey' });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Hunter's Prey:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => { expect(screen.getByText(/Choose your option/)).toBeInTheDocument(); });
    });

    it('shows feature choice modal for defensive_tactics type with predefined options', async () => {
      const stats = setupFeatureChoiceAction('Defensive Tactics', { type: 'defensive_tactics' });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Defensive Tactics:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => { expect(screen.getByText(/Choose your option/)).toBeInTheDocument(); });
    });

    it('does not show feature choice modal when option was already chosen', async () => {
      hasAutomation.mockReturnValue(true);
      vi.mocked(getRuntimeValue).mockReturnValue('Thunder');

      const stats = createStats({
        actions: [{ name: 'Blessed Strikes', description: 'Choose a damage type.', automation: { type: 'damage_bonus', options: ['Lightning', 'Thunder'] } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Blessed Strikes:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
      });
    });

    it('saves the chosen option to runtime state on confirm', async () => {
      hasAutomation.mockReturnValue(true);
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const stats = createStats({
        actions: [{ name: 'Blessed Strikes', description: 'Choose a damage type.', automation: { type: 'damage_bonus', options: ['Lightning', 'Thunder'] } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Blessed Strikes:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => { expect(screen.getByText(/Choose your option/)).toBeInTheDocument(); });

      const lightningBtn = screen.getByText('Lightning');
      await act(async () => { fireEvent.click(lightningBtn); });

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', '_Blessed_Strikes_option', 'Lightning', undefined);
      });
    });

    it('skips feature choice modal when Cancel is clicked', async () => {
      hasAutomation.mockReturnValue(true);
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const stats = createStats({
        actions: [{ name: 'Blessed Strikes', description: 'Choose a damage type.', automation: { type: 'damage_bonus', options: ['Lightning', 'Thunder'] } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Blessed Strikes:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => { expect(screen.getByText(/Choose your option/)).toBeInTheDocument(); });

      const cancelBtn = screen.getByText('Cancel');
      await act(async () => { fireEvent.click(cancelBtn); });

      expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
    });
  });

  describe('metamagic popup', () => {
    it('renders MetamagicPopup when pendingMetamagic is set', async () => {
      useSpellMetamagicFlow.mockReturnValue({
        pendingMetamagic: { spellName: 'Fireball', spellLevel: 3, _currentSP: 5 },
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingAid: null,
        handleAidConfirm: vi.fn(),
        handleAidSkip: vi.fn(),
        pendingGreaterRestoration: null,
        handleGreaterRestorationConfirm: vi.fn(),
        handleGreaterRestorationSkip: vi.fn(),
        pendingRemoveCurse: null,
        handleRemoveCurseConfirm: vi.fn(),
        handleRemoveCurseSkip: vi.fn(),
      });

      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('renders MetamagicPopup when pendingActionMetamagic is set', async () => {
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

      useActionSpellMetamagic.mockReturnValue({
        pendingActionMetamagic: { spellName: 'Fireball', spellLevel: 3, _currentSP: 5 },
        handleActionMetamagicConfirm: vi.fn(),
        handleActionMetamagicSkip: vi.fn(),
        handleActionSpellDamageClick: vi.fn(),
        handleSpellAttackClick: vi.fn(),
        handleSpellDamageClick: vi.fn(),
      });

      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('does not render MetamagicPopup when no metamagic is pending', async () => {
      useSpellMetamagicFlow.mockReturnValue({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingAid: null,
        handleAidConfirm: vi.fn(),
        handleAidSkip: vi.fn(),
        pendingGreaterRestoration: null,
        handleGreaterRestorationConfirm: vi.fn(),
        handleGreaterRestorationSkip: vi.fn(),
        pendingRemoveCurse: null,
        handleRemoveCurseConfirm: vi.fn(),
        handleRemoveCurseSkip: vi.fn(),
      });

      useActionSpellMetamagic.mockReturnValue({
        pendingActionMetamagic: null,
        handleActionMetamagicConfirm: vi.fn(),
        handleActionMetamagicSkip: vi.fn(),
        handleActionSpellDamageClick: vi.fn(),
        handleSpellAttackClick: vi.fn(),
        handleSpellDamageClick: vi.fn(),
      });

      await act(async () => { render(<CharActions playerStats={createStats()} />); });
      expect(screen.queryByTestId('metamagic-popup')).not.toBeInTheDocument();
    });
  });
});
