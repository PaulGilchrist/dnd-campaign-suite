// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsModalHandlers from './useCharActionsModalHandlers.js';

vi.mock('../../services/automation/common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  handle: vi.fn(),
  handleCombatSuperiorityBonusAction: vi.fn(),
  handleCombatSuperiorityReaction: vi.fn(),
  handleCombatSuperiorityGrantAttack: vi.fn(),
  handleCombatSuperiorityMovement: vi.fn(),
  handleCombatSuperioritySkillCheck: vi.fn(),
  handleCombatSuperiorityCommandingPresenceReaction: vi.fn(),
  handleCombatSuperioritySweepingAttack: vi.fn(),
  handleAttackRiderPrompt: vi.fn(),
  handleSkillCheckPrompt: vi.fn(),
  executeSweepingAttack: vi.fn(),
  executeBaitAndSwitchChoice: vi.fn(),
  executeCommanderStrikeChoice: vi.fn(),
  executeRallyChoice: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/bulwarkOfForceHandler.js', () => ({
  handle: vi.fn(),
  activateBulwarkOfForce: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-barbarian/zealousPresenceHandler.js', () => ({
  handle: vi.fn(),
  confirmZealousPresence: vi.fn(),
}));

vi.mock('../../services/automation/handlers/healing/massHealHandler.js', () => ({
  handle: vi.fn(),
  confirmMassHeal: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/clockworkCavalcadeHandler.js', () => ({
  handle: vi.fn(),
  confirmClockworkCavalcadeHeal: vi.fn(),
  confirmClockworkCavalcadeDispel: vi.fn(),
  confirmClockworkCavalcadeRepair: vi.fn(),
}));

vi.mock('../../services/automation/handlers/healing/massCureWoundsHandler.js', () => ({
  handle: vi.fn(),
  confirmMassCureWounds: vi.fn(),
}));

vi.mock('../../services/automation/handlers/healing/prayerOfHealingHandler.js', () => ({
  handle: vi.fn(),
  confirmPrayerOfHealing: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/powerWordFortifyHandler.js', () => ({
  handle: vi.fn(),
  confirmPowerWordFortify: vi.fn(),
}));

vi.mock('../../services/automation/handlers/healing/massHealingWordHandler.js', () => ({
  handle: vi.fn(),
  confirmMassHealingWord: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-ranger/naturesSanctuaryHandler.js', () => ({
  handle: vi.fn(),
  handleMove: vi.fn(),
  activateNaturesSanctuary: vi.fn(),
  moveNaturesSanctuary: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-cleric-paladin/coronaOfLightHandler.js', () => ({
  handle: vi.fn(),
  activateCoronaOfLight: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-cleric-paladin/radianceOfDawnHandler.js', () => ({
  handle: vi.fn(),
  confirmRadianceOfDawn: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpBuffHandler.js', () => ({
  handle: vi.fn(),
  confirmMantleOfInspiration: vi.fn(),
  confirmVitalityOfTheTree: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-warlock/celestialResilienceHandler.js', () => ({
  handle: vi.fn(),
  confirmCelestialResilience: vi.fn(),
  skipCelestialResilience: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-druid/oceanicGiftHandler.js', () => ({
  handle: vi.fn(),
  confirmOceanicGift: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-bard/bardicInspirationHandler.js', () => ({
  handle: vi.fn(),
  applyBardicInspiration: vi.fn(),
}));

vi.mock('../../services/automation/handlers/reactions/reactionBonusHandler.js', () => ({
  handle: vi.fn(),
  applyInspiringMovement: vi.fn(),
}));

const { toggleBuff } = await import('../../services/automation/common/buffToggle.js');
const { setTempHp } = await import('../../services/automation/handlers/buffs/tempHpService.js');
const { setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../services/ui/logService.js');
const { confirmMantleOfInspiration, confirmVitalityOfTheTree } = await import('../../services/automation/handlers/buffs/tempHpBuffHandler.js');
const { confirmCelestialResilience, skipCelestialResilience } = await import('../../services/automation/handlers/class-warlock/celestialResilienceHandler.js');

const mockSetPopupHtml = vi.fn();
const mockSetModalState = vi.fn();

function getHandlers(modalState = {}, mergedModalState = {}) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useCharActionsModalHandlers({
    setPopupHtml: mockSetPopupHtml,
    setModalState: mockSetModalState,
    modalState,
    mergedModalState,
  });
}

function makePlayerStats() {
  return { name: 'TestChar', class: { name: 'Fighter' } };
}

function makeBaseModalData(overrides = {}) {
  return {
    action: { name: 'Test Action' },
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}

describe('useCharActionsModalHandlers - buffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPopupHtml.mockClear();
    mockSetModalState.mockClear();
  });

  describe('handleMantleOfInspirationConfirm', () => {
    it.each([null, undefined])('returns early without side effects when selectedTargets is %s', async (selectedTargets) => {
      const handlers = getHandlers();
      await handlers.handleMantleOfInspirationConfirm(selectedTargets);
      expect(confirmMantleOfInspiration).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early without side effects when mantleOfInspirationTarget is not in modalState', async () => {
      const handlers = getHandlers();
      await handlers.handleMantleOfInspirationConfirm(['target']);
      expect(confirmMantleOfInspiration).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmMantleOfInspiration with all parameters and clears the modal', async () => {
      confirmMantleOfInspiration.mockResolvedValue({ payload: '<p>Inspired!</p>' });
      const modalState = {
        mantleOfInspirationTarget: {
          action: { name: 'Mantle of Inspiration' },
          playerStats: makePlayerStats(),
          campaignName: 'test-campaign',
          dieRoll: 7,
          bardicDieSize: 'd8',
          tempHp: 5,
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleMantleOfInspirationConfirm(['Ally1']);
      expect(confirmMantleOfInspiration).toHaveBeenCalledWith({
        action: modalState.mantleOfInspirationTarget.action,
        playerStats: modalState.mantleOfInspirationTarget.playerStats,
        campaignName: modalState.mantleOfInspirationTarget.campaignName,
        selectedTargets: ['Ally1'],
        dieRoll: 7,
        bardicDieSize: 'd8',
        tempHp: 5,
      });
      expect(mockSetModalState).toHaveBeenCalledWith({ mantleOfInspirationTarget: null });
    });

    it('shows popup when confirmMantleOfInspiration returns a payload', async () => {
      confirmMantleOfInspiration.mockResolvedValue({ payload: '<p>Healed!</p>' });
      const handlers = getHandlers({
        mantleOfInspirationTarget: makeBaseModalData({ dieRoll: 5, bardicDieSize: 'd6', tempHp: 3 }),
      });
      await handlers.handleMantleOfInspirationConfirm(['Ally1']);
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Healed!</p>');
      expect(mockSetModalState).toHaveBeenCalledWith({ mantleOfInspirationTarget: null });
    });

    it('skips popup when confirmMantleOfInspiration returns no payload', async () => {
      confirmMantleOfInspiration.mockResolvedValue({});
      const handlers = getHandlers({
        mantleOfInspirationTarget: makeBaseModalData({ dieRoll: 5, bardicDieSize: 'd6', tempHp: 3 }),
      });
      await handlers.handleMantleOfInspirationConfirm(['Ally1']);
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ mantleOfInspirationTarget: null });
    });
  });

  describe('handleCelestialResilienceConfirm', () => {
    it.each([null, undefined])('returns early without side effects when selectedTargets is %s', async (selectedTargets) => {
      const handlers = getHandlers();
      await handlers.handleCelestialResilienceConfirm(selectedTargets);
      expect(confirmCelestialResilience).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early without side effects when celestialResilienceModal is not in modalState', async () => {
      const handlers = getHandlers();
      await handlers.handleCelestialResilienceConfirm(['target']);
      expect(confirmCelestialResilience).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmCelestialResilience with all parameters and clears the modal', async () => {
      confirmCelestialResilience.mockResolvedValue({ payload: '<p>Resilient!</p>' });
      const modalState = {
        celestialResilienceModal: {
          action: { name: 'Celestial Resilience' },
          playerStats: makePlayerStats(),
          campaignName: 'test-campaign',
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleCelestialResilienceConfirm(['Ally1']);
      expect(confirmCelestialResilience).toHaveBeenCalledWith(
        modalState.celestialResilienceModal.action,
        modalState.celestialResilienceModal.playerStats,
        modalState.celestialResilienceModal.campaignName,
        ['Ally1']
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ celestialResilienceModal: null });
    });

    it('shows popup when confirmCelestialResilience returns a payload', async () => {
      confirmCelestialResilience.mockResolvedValue({ payload: '<p>Resilience applied</p>' });
      const handlers = getHandlers({
        celestialResilienceModal: makeBaseModalData(),
      });
      await handlers.handleCelestialResilienceConfirm(['Ally1']);
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Resilience applied</p>');
      expect(mockSetModalState).toHaveBeenCalledWith({ celestialResilienceModal: null });
    });

    it('skips popup when confirmCelestialResilience returns no payload', async () => {
      confirmCelestialResilience.mockResolvedValue({});
      const handlers = getHandlers({
        celestialResilienceModal: makeBaseModalData(),
      });
      await handlers.handleCelestialResilienceConfirm(['Ally1']);
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ celestialResilienceModal: null });
    });
  });

  describe('handleCelestialResilienceSkip', () => {
    it('returns early without side effects when celestialResilienceModal is not in modalState', async () => {
      const handlers = getHandlers();
      await handlers.handleCelestialResilienceSkip();
      expect(skipCelestialResilience).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to skipCelestialResilience with all parameters and clears the modal', async () => {
      skipCelestialResilience.mockResolvedValue({ payload: '<p>Skipped!</p>' });
      const modalState = {
        celestialResilienceModal: {
          action: { name: 'Celestial Resilience' },
          playerStats: makePlayerStats(),
          campaignName: 'test-campaign',
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleCelestialResilienceSkip();
      expect(skipCelestialResilience).toHaveBeenCalledWith(
        modalState.celestialResilienceModal.action,
        modalState.celestialResilienceModal.playerStats,
        modalState.celestialResilienceModal.campaignName
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ celestialResilienceModal: null });
    });

    it('shows popup when skipCelestialResilience returns a payload', async () => {
      skipCelestialResilience.mockResolvedValue({ payload: '<p>Resilience skipped</p>' });
      const handlers = getHandlers({
        celestialResilienceModal: makeBaseModalData(),
      });
      await handlers.handleCelestialResilienceSkip();
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Resilience skipped</p>');
      expect(mockSetModalState).toHaveBeenCalledWith({ celestialResilienceModal: null });
    });

    it('skips popup when skipCelestialResilience returns no payload', async () => {
      skipCelestialResilience.mockResolvedValue({});
      const handlers = getHandlers({
        celestialResilienceModal: makeBaseModalData(),
      });
      await handlers.handleCelestialResilienceSkip();
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ celestialResilienceModal: null });
    });
  });

  describe('handleInspiringSmiteConfirm', () => {
    it.each([null, undefined])('returns early without side effects when distribution is %s', async (distribution) => {
      const handlers = getHandlers();
      await handlers.handleInspiringSmiteConfirm(distribution);
      expect(setTempHp).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early without side effects when inspiringSmiteModal is not in modalState', async () => {
      const handlers = getHandlers();
      await handlers.handleInspiringSmiteConfirm({ target: 10 });
      expect(setTempHp).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early without side effects when distribution has no targets', async () => {
      const modalState = {
        inspiringSmiteModal: {
          action: { name: 'Inspiring Smite' },
          playerStats: makePlayerStats(),
          campaignName: 'test-campaign',
          channelDivinityCharges: 1,
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleInspiringSmiteConfirm({});
      expect(setTempHp).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('applies temp HP to each target, decrements charges, logs, shows popup, and clears modal', async () => {
      addEntry.mockResolvedValue({});
      const modalState = {
        inspiringSmiteModal: {
          action: { name: 'Inspiring Smite' },
          playerStats: makePlayerStats(),
          campaignName: 'test-campaign',
          channelDivinityCharges: 2,
        },
      };
      const handlers = getHandlers(modalState);
      const distribution = { Ally1: 5, Ally2: 10 };
      await handlers.handleInspiringSmiteConfirm(distribution);

      expect(setTempHp).toHaveBeenNthCalledWith(1, 'Ally1', 5, 'test-campaign');
      expect(setTempHp).toHaveBeenNthCalledWith(2, 'Ally2', 10, 'test-campaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', 'channelDivinityCharges', 1, 'test-campaign');
      expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Inspiring Smite',
        description: 'TestChar used Inspiring Smite (15 temp HP). Distribution: Ally1=5, Ally2=10',
      });
      expect(mockSetPopupHtml).toHaveBeenCalledWith(
        '<b>Inspiring Smite</b><br/>Granted 15 temporary hit points: Ally1 (5 HP), Ally2 (10 HP).'
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ inspiringSmiteModal: null });
    });

    it('handles single target distribution correctly', async () => {
      addEntry.mockResolvedValue({});
      const modalState = {
        inspiringSmiteModal: {
          action: { name: 'Inspiring Smite' },
          playerStats: makePlayerStats(),
          campaignName: 'my-campaign',
          channelDivinityCharges: 3,
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleInspiringSmiteConfirm({ Self: 8 });

      expect(setTempHp).toHaveBeenCalledWith('Self', 8, 'my-campaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', 'channelDivinityCharges', 2, 'my-campaign');
      expect(mockSetPopupHtml).toHaveBeenCalledWith(
        '<b>Inspiring Smite</b><br/>Granted 8 temporary hit points: Self (8 HP).'
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ inspiringSmiteModal: null });
    });
  });

  describe('handleVitalityOfTheTreeConfirm', () => {
    it.each([null, undefined])('returns early without side effects when selectedTargets is %s', async (selectedTargets) => {
      const handlers = getHandlers();
      await handlers.handleVitalityOfTheTreeConfirm(selectedTargets);
      expect(confirmVitalityOfTheTree).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early without side effects when vitalityOfTheTreeTarget is not in modalState', async () => {
      const handlers = getHandlers();
      await handlers.handleVitalityOfTheTreeConfirm(['target']);
      expect(confirmVitalityOfTheTree).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmVitalityOfTheTree with all parameters and clears the modal', async () => {
      confirmVitalityOfTheTree.mockResolvedValue({ payload: '<p>Tree heal!</p>' });
      const modalState = {
        vitalityOfTheTreeTarget: {
          action: { name: 'Vitality of the Tree' },
          playerStats: makePlayerStats(),
          campaignName: 'test-campaign',
          tempHp: 10,
          maxTargets: 3,
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleVitalityOfTheTreeConfirm(['Ally1', 'Ally2']);
      expect(confirmVitalityOfTheTree).toHaveBeenCalledWith(
        modalState.vitalityOfTheTreeTarget.action,
        modalState.vitalityOfTheTreeTarget.playerStats,
        modalState.vitalityOfTheTreeTarget.campaignName,
        ['Ally1', 'Ally2'],
        10,
        3
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ vitalityOfTheTreeTarget: null });
    });

    it('shows popup when confirmVitalityOfTheTree returns a payload', async () => {
      confirmVitalityOfTheTree.mockResolvedValue({ payload: '<p>Tree vitality applied</p>' });
      const handlers = getHandlers({
        vitalityOfTheTreeTarget: makeBaseModalData({ tempHp: 10, maxTargets: 3 }),
      });
      await handlers.handleVitalityOfTheTreeConfirm(['Ally1']);
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Tree vitality applied</p>');
      expect(mockSetModalState).toHaveBeenCalledWith({ vitalityOfTheTreeTarget: null });
    });

    it('skips popup when confirmVitalityOfTheTree returns no payload', async () => {
      confirmVitalityOfTheTree.mockResolvedValue({});
      const handlers = getHandlers({
        vitalityOfTheTreeTarget: makeBaseModalData({ tempHp: 10, maxTargets: 3 }),
      });
      await handlers.handleVitalityOfTheTreeConfirm(['Ally1']);
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ vitalityOfTheTreeTarget: null });
    });
  });

  describe('handleTricksterBlessingConfirm', () => {
    it('returns early without side effects when tricksterBlessingModal is not in modalState', async () => {
      const handlers = getHandlers();
      await handlers.handleTricksterBlessingConfirm('target');
      expect(toggleBuff).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('toggles buff with targetName and logs when activated', async () => {
      toggleBuff.mockReturnValue({ wasActive: false });
      addEntry.mockResolvedValue({});
      const modalState = {
        tricksterBlessingModal: {
          action: { name: 'Blessing of the Trickster', automation: { type: 'buff', duration: '1 hour' } },
          playerStats: makePlayerStats(),
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleTricksterBlessingConfirm('Ally1');

      expect(toggleBuff).toHaveBeenCalledWith(
        'Ally1',
        'Blessing of the Trickster',
        { type: 'buff', duration: '1 hour' },
        undefined,
        'Ally1'
      );
      expect(addEntry).toHaveBeenCalledWith(undefined, {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Blessing of the Trickster',
        description: 'Blessing granted to Ally1 with advantage on Stealth checks.',
      });
      expect(mockSetPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Blessing of the Trickster',
        automationType: 'buff',
        description: 'Blessing of the Trickster activated on Ally1 (1 hour)',
        automation: { type: 'buff', duration: '1 hour' },
      });
      expect(mockSetModalState).toHaveBeenCalledWith({ tricksterBlessingModal: null });
    });

    it('uses playerStats.name when targetName is null', async () => {
      toggleBuff.mockReturnValue({ wasActive: false });
      addEntry.mockResolvedValue({});
      const modalState = {
        tricksterBlessingModal: {
          action: { name: 'Blessing of the Trickster', automation: { type: 'buff', duration: '1 hour' } },
          playerStats: makePlayerStats(),
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleTricksterBlessingConfirm(null);

      expect(toggleBuff).toHaveBeenCalledWith(
        'TestChar',
        'Blessing of the Trickster',
        { type: 'buff', duration: '1 hour' },
        undefined,
        'TestChar'
      );
      expect(mockSetPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Blessing of the Trickster',
        automationType: 'buff',
        description: 'Blessing of the Trickster activated on yourself (1 hour)',
        automation: { type: 'buff', duration: '1 hour' },
      });
      expect(mockSetModalState).toHaveBeenCalledWith({ tricksterBlessingModal: null });
    });

    it('shows toggled OFF description when wasActive is true and skips logging', async () => {
      toggleBuff.mockReturnValue({ wasActive: true });
      addEntry.mockResolvedValue({});
      const modalState = {
        tricksterBlessingModal: {
          action: { name: 'Blessing of the Trickster', automation: { type: 'buff', duration: '1 hour' } },
          playerStats: makePlayerStats(),
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleTricksterBlessingConfirm('Ally1');

      expect(mockSetPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Blessing of the Trickster',
        automationType: 'buff',
        description: 'Blessing of the Trickster toggled OFF',
        automation: { type: 'buff', duration: '1 hour' },
      });
      expect(addEntry).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ tricksterBlessingModal: null });
    });

    it('defaults feature name to "Blessing of the Trickster" when action.name is missing', async () => {
      toggleBuff.mockReturnValue({ wasActive: false });
      addEntry.mockResolvedValue({});
      const modalState = {
        tricksterBlessingModal: {
          action: { automation: { type: 'buff', duration: '1 hour' } },
          playerStats: makePlayerStats(),
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleTricksterBlessingConfirm('Ally1');

      expect(toggleBuff).toHaveBeenLastCalledWith(
        'Ally1',
        'Blessing of the Trickster',
        { type: 'buff', duration: '1 hour' },
        undefined,
        'Ally1'
      );
    });

    it('uses fallback duration "1 hour" when automation.duration is missing', async () => {
      toggleBuff.mockReturnValue({ wasActive: false });
      addEntry.mockResolvedValue({});
      const modalState = {
        tricksterBlessingModal: {
          action: { name: 'Blessing of the Trickster', automation: { type: 'buff' } },
          playerStats: makePlayerStats(),
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleTricksterBlessingConfirm('Ally1');

      expect(mockSetPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Blessing of the Trickster',
        automationType: 'buff',
        description: 'Blessing of the Trickster activated on Ally1 (1 hour)',
        automation: { type: 'buff' },
      });
      expect(mockSetModalState).toHaveBeenCalledWith({ tricksterBlessingModal: null });
    });
  });
});
