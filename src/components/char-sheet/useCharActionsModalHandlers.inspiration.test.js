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

const { applyBardicInspiration } = await import('../../services/automation/handlers/class-bard/bardicInspirationHandler.js');
const { applyInspiringMovement } = await import('../../services/automation/handlers/reactions/reactionBonusHandler.js');

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

describe('useCharActionsModalHandlers - inspiration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPopupHtml.mockClear();
    mockSetModalState.mockClear();
  });

  describe('handleBardicInspirationConfirm', () => {
    it.each([null, undefined])('returns early without side effects when bardicInspirationTargetModal is %s', async (modalValue) => {
      const handlers = getHandlers({ bardicInspirationTargetModal: modalValue });
      await handlers.handleBardicInspirationConfirm('Ally1');
      expect(applyBardicInspiration).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it.each([null, undefined, ''])('returns early when targetName is %s but still clears modal state', async (targetName) => {
      const handlers = getHandlers({
        bardicInspirationTargetModal: makeBaseModalData({ dieSize: 'd8', hasCombatOptions: false }),
      });
      await handlers.handleBardicInspirationConfirm(targetName);
      expect(applyBardicInspiration).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ bardicInspirationTargetModal: null });
    });

    it('delegates to applyBardicInspiration with all parameters and clears the modal', async () => {
      applyBardicInspiration.mockResolvedValue({ type: 'popup', payload: '<p>Inspired!</p>' });
      const modalState = {
        bardicInspirationTargetModal: {
          action: { name: 'Bardic Inspiration' },
          playerStats: makePlayerStats(),
          campaignName: 'test-campaign',
          dieSize: 'd8',
          hasCombatOptions: false,
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleBardicInspirationConfirm('Ally1');
      expect(applyBardicInspiration).toHaveBeenCalledWith({
            action: modalState.bardicInspirationTargetModal.action,
            playerStats: modalState.bardicInspirationTargetModal.playerStats,
            campaignName: modalState.bardicInspirationTargetModal.campaignName,
            targetName: 'Ally1',
            dieSize: 'd8',
            hasCombatOptions: false,
        });
      expect(mockSetModalState).toHaveBeenCalledWith({ bardicInspirationTargetModal: null });
    });

    it('shows popup when applyBardicInspiration returns a payload', async () => {
      applyBardicInspiration.mockResolvedValue({ type: 'popup', payload: '<p>Inspired!</p>' });
      const handlers = getHandlers({
        bardicInspirationTargetModal: makeBaseModalData({ dieSize: 'd8', hasCombatOptions: false }),
      });
      await handlers.handleBardicInspirationConfirm('Ally1');
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Inspired!</p>');
      expect(mockSetModalState).toHaveBeenCalledWith({ bardicInspirationTargetModal: null });
    });

    it('skips popup when applyBardicInspiration returns no payload but still clears modal', async () => {
      applyBardicInspiration.mockResolvedValue({});
      const handlers = getHandlers({
        bardicInspirationTargetModal: makeBaseModalData({ dieSize: 'd8', hasCombatOptions: false }),
      });
      await handlers.handleBardicInspirationConfirm('Ally1');
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ bardicInspirationTargetModal: null });
    });
  });

  describe('handleInspiringMovementConfirm', () => {
    it.each([null, undefined])('returns early without side effects when inspiringMovementAllyModal is %s', async (modalValue) => {
      const handlers = getHandlers({ inspiringMovementAllyModal: modalValue });
      await handlers.handleInspiringMovementConfirm('Ally1');
      expect(applyInspiringMovement).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it.each([null, undefined, ''])('returns early when allyName is %s but still clears modal state', async (allyName) => {
      const handlers = getHandlers({
        inspiringMovementAllyModal: makeBaseModalData({ halfSpeed: true, noOAs: false }),
      });
      await handlers.handleInspiringMovementConfirm(allyName);
      expect(applyInspiringMovement).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ inspiringMovementAllyModal: null });
    });

    it('delegates to applyInspiringMovement with all parameters and clears the modal', async () => {
      applyInspiringMovement.mockResolvedValue({ type: 'popup', payload: '<p>Moving!</p>' });
      const modalState = {
        inspiringMovementAllyModal: {
          action: { name: 'Inspiring Movement' },
          playerStats: makePlayerStats(),
          campaignName: 'test-campaign',
          halfSpeed: true,
          noOAs: false,
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleInspiringMovementConfirm('Ally1');
      expect(applyInspiringMovement).toHaveBeenCalledWith({
            action: modalState.inspiringMovementAllyModal.action,
            playerStats: modalState.inspiringMovementAllyModal.playerStats,
            campaignName: modalState.inspiringMovementAllyModal.campaignName,
            allyName: 'Ally1',
            halfSpeed: true,
            noOAs: false,
        });
      expect(mockSetModalState).toHaveBeenCalledWith({ inspiringMovementAllyModal: null });
    });

    it('shows popup when applyInspiringMovement returns a payload', async () => {
      applyInspiringMovement.mockResolvedValue({ type: 'popup', payload: '<p>Moving!</p>' });
      const handlers = getHandlers({
        inspiringMovementAllyModal: makeBaseModalData({ halfSpeed: true, noOAs: false }),
      });
      await handlers.handleInspiringMovementConfirm('Ally1');
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Moving!</p>');
      expect(mockSetModalState).toHaveBeenCalledWith({ inspiringMovementAllyModal: null });
    });

    it('skips popup when applyInspiringMovement returns no payload but still clears modal', async () => {
      applyInspiringMovement.mockResolvedValue({});
      const handlers = getHandlers({
        inspiringMovementAllyModal: makeBaseModalData({ halfSpeed: true, noOAs: false }),
      });
      await handlers.handleInspiringMovementConfirm('Ally1');
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ inspiringMovementAllyModal: null });
    });
  });
});
