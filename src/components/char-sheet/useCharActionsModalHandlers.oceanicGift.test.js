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

const { confirmOceanicGift } = await import('../../services/automation/handlers/class-druid/oceanicGiftHandler.js');

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
    action: { name: 'Oceanic Gift' },
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    spellSaveDc: 13,
    wisMod: 3,
    doubleEmanation: false,
    ...overrides,
  };
}

describe('useCharActionsModalHandlers - oceanicGift', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPopupHtml.mockClear();
    mockSetModalState.mockClear();
  });

  describe('handleOceanicGiftConfirm', () => {
    it.each([null, undefined])('returns early without side effects when oceanicGiftTargetModal is %s', async (modalValue) => {
      const handlers = getHandlers({ oceanicGiftTargetModal: modalValue });
      await handlers.handleOceanicGiftConfirm('Ally1');
      expect(confirmOceanicGift).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it.each([null, undefined, ''])('returns early when selectedAllyName is %s but still clears modal state', async (targetName) => {
      const handlers = getHandlers({
        oceanicGiftTargetModal: makeBaseModalData(),
      });
      await handlers.handleOceanicGiftConfirm(targetName);
      expect(confirmOceanicGift).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ oceanicGiftTargetModal: null });
    });

    it('delegates to confirmOceanicGift with all parameters and clears the modal', async () => {
      confirmOceanicGift.mockResolvedValue({ type: 'popup', payload: '<p>Gift!</p>' });
      const modalState = {
        oceanicGiftTargetModal: {
          action: { name: 'Oceanic Gift' },
          playerStats: makePlayerStats(),
          campaignName: 'test-campaign',
          spellSaveDc: 13,
          wisMod: 3,
          doubleEmanation: false,
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleOceanicGiftConfirm('Ally1');
      expect(confirmOceanicGift).toHaveBeenCalledWith({
        action: modalState.oceanicGiftTargetModal.action,
        playerStats: modalState.oceanicGiftTargetModal.playerStats,
        campaignName: modalState.oceanicGiftTargetModal.campaignName,
        selectedAllyName: 'Ally1',
        spellSaveDc: 13,
        wisMod: 3,
        doubleEmanation: false,
      });
      expect(mockSetModalState).toHaveBeenCalledWith({ oceanicGiftTargetModal: null });
    });

    it('shows popup when confirmOceanicGift returns a payload', async () => {
      confirmOceanicGift.mockResolvedValue({ type: 'popup', payload: '<p>Gift!</p>' });
      const handlers = getHandlers({
        oceanicGiftTargetModal: makeBaseModalData(),
      });
      await handlers.handleOceanicGiftConfirm('Ally1');
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Gift!</p>');
      expect(mockSetModalState).toHaveBeenCalledWith({ oceanicGiftTargetModal: null });
    });

    it('skips popup when confirmOceanicGift returns no payload but still clears modal', async () => {
      confirmOceanicGift.mockResolvedValue({});
      const handlers = getHandlers({
        oceanicGiftTargetModal: makeBaseModalData(),
      });
      await handlers.handleOceanicGiftConfirm('Ally1');
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ oceanicGiftTargetModal: null });
    });

    it('dispatches doubleEmanation:true when the chooser toggle override is true (CLA-240)', async () => {
      confirmOceanicGift.mockResolvedValue({ type: 'popup', payload: '<p>Gift!</p>' });
      const modalState = {
        oceanicGiftTargetModal: makeBaseModalData({ doubleEmanation: false }),
      };
      const handlers = getHandlers(modalState);
      await handlers.handleOceanicGiftConfirm('Ally1', true);
      expect(confirmOceanicGift).toHaveBeenCalledWith({
        action: modalState.oceanicGiftTargetModal.action,
        playerStats: modalState.oceanicGiftTargetModal.playerStats,
        campaignName: modalState.oceanicGiftTargetModal.campaignName,
        selectedAllyName: 'Ally1',
        spellSaveDc: 13,
        wisMod: 3,
        doubleEmanation: true,
      });
    });

    it('keeps doubleEmanation:false when the toggle override is false or omitted', async () => {
      confirmOceanicGift.mockResolvedValue({ type: 'popup', payload: '<p>Gift!</p>' });
      const handlers = getHandlers({ oceanicGiftTargetModal: makeBaseModalData() });
      await handlers.handleOceanicGiftConfirm('Ally1', false);
      expect(confirmOceanicGift).toHaveBeenLastCalledWith(expect.objectContaining({ selectedAllyName: 'Ally1', spellSaveDc: 13, wisMod: 3, doubleEmanation: false }));
      await handlers.handleOceanicGiftConfirm('Ally1');
      expect(confirmOceanicGift).toHaveBeenLastCalledWith(expect.objectContaining({ selectedAllyName: 'Ally1', spellSaveDc: 13, wisMod: 3, doubleEmanation: false }));
    });

    it('skips popup when confirmOceanicGift returns non-popup type but still clears modal', async () => {
      confirmOceanicGift.mockResolvedValue({ type: 'info', payload: 'Some info' });
      const handlers = getHandlers({
        oceanicGiftTargetModal: makeBaseModalData(),
      });
      await handlers.handleOceanicGiftConfirm('Ally1');
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ oceanicGiftTargetModal: null });
    });
  });
});
