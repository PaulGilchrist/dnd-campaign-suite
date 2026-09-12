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

const { confirmMassHeal } = await import('../../services/automation/handlers/healing/massHealHandler.js');
const { confirmClockworkCavalcadeHeal, confirmClockworkCavalcadeDispel, confirmClockworkCavalcadeRepair } = await import('../../services/automation/handlers/class-sorcerer/clockworkCavalcadeHandler.js');
const { confirmMassCureWounds } = await import('../../services/automation/handlers/healing/massCureWoundsHandler.js');
const { confirmPrayerOfHealing } = await import('../../services/automation/handlers/healing/prayerOfHealingHandler.js');
const { confirmPowerWordFortify } = await import('../../services/automation/handlers/buffs/powerWordFortifyHandler.js');
const { confirmMassHealingWord } = await import('../../services/automation/handlers/healing/massHealingWordHandler.js');

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

describe('useCharActionsModalHandlers - healing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPopupHtml.mockClear();
    mockSetModalState.mockClear();
  });

  describe('handleMassHealConfirm', () => {
    it.each([null, undefined])('returns early when distribution is %s', async (distribution) => {
      const handlers = getHandlers();
      await handlers.handleMassHealConfirm(distribution);
      expect(confirmMassHeal).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early when massHealModal is absent from modalState', async () => {
      const handlers = getHandlers();
      await handlers.handleMassHealConfirm({ Ally1: 20 });
      expect(confirmMassHeal).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmMassHeal and clears the modal', async () => {
      confirmMassHeal.mockResolvedValue({ payload: '<p>Mass heal!</p>' });
      const modalState = {
        massHealModal: makeBaseModalData({
          totalPool: 50,
          bonusHeal: 10,
          bonusDetails: 'bonus',
        }),
      };
      const handlers = getHandlers(modalState);
      await handlers.handleMassHealConfirm({ Ally1: 20, Ally2: 30 });

      expect(confirmMassHeal).toHaveBeenCalledWith(
        modalState.massHealModal.action,
        modalState.massHealModal.playerStats,
        modalState.massHealModal.campaignName,
        { Ally1: 20, Ally2: 30 },
        50,
        10,
        'bonus'
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ massHealModal: null });
    });

    it('shows popup when confirmMassHeal returns a payload', async () => {
      confirmMassHeal.mockResolvedValue({ payload: '<p>Healed 50 HP</p>' });
      const handlers = getHandlers({
        massHealModal: makeBaseModalData({ totalPool: 50, bonusHeal: 0, bonusDetails: '' }),
      });
      await handlers.handleMassHealConfirm({ Ally1: 50 });
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Healed 50 HP</p>');
    });

    it('skips popup when confirmMassHeal returns no payload', async () => {
      confirmMassHeal.mockResolvedValue({});
      const handlers = getHandlers({
        massHealModal: makeBaseModalData({ totalPool: 50, bonusHeal: 0, bonusDetails: '' }),
      });
      await handlers.handleMassHealConfirm({ Ally1: 50 });
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ massHealModal: null });
    });
  });

  describe('handleClockworkCavalcadeHealConfirm', () => {
    it.each([null, undefined])('returns early when distribution is %s', async (distribution) => {
      const handlers = getHandlers();
      await handlers.handleClockworkCavalcadeHealConfirm(distribution);
      expect(confirmClockworkCavalcadeHeal).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early when clockworkCavalcadeHealModal is absent from mergedModalState', async () => {
      const handlers = getHandlers();
      await handlers.handleClockworkCavalcadeHealConfirm({ Ally1: 15 });
      expect(confirmClockworkCavalcadeHeal).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmClockworkCavalcadeHeal and clears the modal', async () => {
      confirmClockworkCavalcadeHeal.mockResolvedValue({ payload: '<p>Healed!</p>' });
      const mergedModalState = {
        clockworkCavalcadeHealModal: makeBaseModalData({ maxHeal: 30 }),
      };
      const handlers = getHandlers({}, mergedModalState);
      await handlers.handleClockworkCavalcadeHealConfirm({ Ally1: 15, Ally2: 15 });

      expect(confirmClockworkCavalcadeHeal).toHaveBeenCalledWith(
        mergedModalState.clockworkCavalcadeHealModal.action,
        mergedModalState.clockworkCavalcadeHealModal.playerStats,
        mergedModalState.clockworkCavalcadeHealModal.campaignName,
        { Ally1: 15, Ally2: 15 },
        30
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ clockworkCavalcadeHealModal: null });
    });

    it('shows popup when confirmClockworkCavalcadeHeal returns a payload', async () => {
      confirmClockworkCavalcadeHeal.mockResolvedValue({ payload: '<p>Repaired ally</p>' });
      const handlers = getHandlers({}, {
        clockworkCavalcadeHealModal: makeBaseModalData({ maxHeal: 30 }),
      });
      await handlers.handleClockworkCavalcadeHealConfirm({ Ally1: 30 });
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Repaired ally</p>');
    });
  });

  describe('handleClockworkCavalcadeDispelConfirm', () => {
    it.each([null, undefined])('returns early when targetNames is %s', async (targetNames) => {
      const handlers = getHandlers();
      await handlers.handleClockworkCavalcadeDispelConfirm(targetNames);
      expect(confirmClockworkCavalcadeDispel).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early when clockworkCavalcadeDispelModal is absent from mergedModalState', async () => {
      const handlers = getHandlers();
      await handlers.handleClockworkCavalcadeDispelConfirm(['Enemy1']);
      expect(confirmClockworkCavalcadeDispel).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmClockworkCavalcadeDispel and clears the modal', async () => {
      confirmClockworkCavalcadeDispel.mockResolvedValue({ payload: '<p>Dispel!</p>' });
      const mergedModalState = {
        clockworkCavalcadeDispelModal: makeBaseModalData(),
      };
      const handlers = getHandlers({}, mergedModalState);
      await handlers.handleClockworkCavalcadeDispelConfirm(['Enemy1']);

      expect(confirmClockworkCavalcadeDispel).toHaveBeenCalledWith(
        mergedModalState.clockworkCavalcadeDispelModal.action,
        mergedModalState.clockworkCavalcadeDispelModal.playerStats,
        mergedModalState.clockworkCavalcadeDispelModal.campaignName,
        ['Enemy1']
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ clockworkCavalcadeDispelModal: null });
    });

    it('shows popup when confirmClockworkCavalcadeDispel returns a payload', async () => {
      confirmClockworkCavalcadeDispel.mockResolvedValue({ payload: '<p>Dispel success</p>' });
      const handlers = getHandlers({}, {
        clockworkCavalcadeDispelModal: makeBaseModalData(),
      });
      await handlers.handleClockworkCavalcadeDispelConfirm(['Enemy1']);
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Dispel success</p>');
    });
  });

  describe('handleClockworkCavalcadeRepairConfirm', () => {
    it('returns early when clockworkCavalcadeRepairModal is absent from mergedModalState', async () => {
      const handlers = getHandlers();
      await handlers.handleClockworkCavalcadeRepairConfirm();
      expect(confirmClockworkCavalcadeRepair).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmClockworkCavalcadeRepair and clears the modal', async () => {
      confirmClockworkCavalcadeRepair.mockResolvedValue({ payload: '<p>Repaired!</p>' });
      const mergedModalState = {
        clockworkCavalcadeRepairModal: makeBaseModalData(),
      };
      const handlers = getHandlers({}, mergedModalState);
      await handlers.handleClockworkCavalcadeRepairConfirm();

      expect(confirmClockworkCavalcadeRepair).toHaveBeenCalledWith(
        mergedModalState.clockworkCavalcadeRepairModal.action,
        mergedModalState.clockworkCavalcadeRepairModal.playerStats,
        mergedModalState.clockworkCavalcadeRepairModal.campaignName
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ clockworkCavalcadeRepairModal: null });
    });

    it('shows popup when confirmClockworkCavalcadeRepair returns a payload', async () => {
      confirmClockworkCavalcadeRepair.mockResolvedValue({ payload: '<p>Item repaired</p>' });
      const handlers = getHandlers({}, {
        clockworkCavalcadeRepairModal: makeBaseModalData(),
      });
      await handlers.handleClockworkCavalcadeRepairConfirm();
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Item repaired</p>');
    });
  });

  describe('handleMassCureWoundsConfirm', () => {
    it.each([null, undefined])('returns early when targetNames is %s', async (targetNames) => {
      const handlers = getHandlers();
      await handlers.handleMassCureWoundsConfirm(targetNames);
      expect(confirmMassCureWounds).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early when massCureWoundsModal is absent from mergedModalState', async () => {
      const handlers = getHandlers();
      await handlers.handleMassCureWoundsConfirm(['Ally1']);
      expect(confirmMassCureWounds).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmMassCureWounds with all parameters and clears the modal', async () => {
      confirmMassCureWounds.mockResolvedValue({ payload: '<p>Healed!</p>' });
      const mergedModalState = {
        massCureWoundsModal: makeBaseModalData({
          healExpression: '3d8',
          maximize: false,
          bonusHeal: 5,
          bonusDetails: 'bonus',
          slotLevel: 5,
        }),
      };
      const handlers = getHandlers({}, mergedModalState);
      await handlers.handleMassCureWoundsConfirm(['Ally1', 'Ally2']);

      expect(confirmMassCureWounds).toHaveBeenCalledWith({
          action: mergedModalState.massCureWoundsModal.action,
          playerStats: mergedModalState.massCureWoundsModal.playerStats,
          campaignName: mergedModalState.massCureWoundsModal.campaignName,
          selectedTargetNames: ['Ally1', 'Ally2'],
          healExpression: '3d8',
          maximize: false,
          bonusHeal: 5,
          bonusDetails: 'bonus',
          slotLevel: 5,
      });
      expect(mockSetModalState).toHaveBeenCalledWith({ massCureWoundsModal: null });
    });

    it('shows popup when confirmMassCureWounds returns a payload', async () => {
      confirmMassCureWounds.mockResolvedValue({ payload: '<p>Mass cure success</p>' });
      const handlers = getHandlers({}, {
        massCureWoundsModal: makeBaseModalData({
          healExpression: '3d8', maximize: false, bonusHeal: 0, bonusDetails: '', slotLevel: 3,
        }),
      });
      await handlers.handleMassCureWoundsConfirm(['Ally1']);
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Mass cure success</p>');
    });
  });

  describe('handlePrayerOfHealingConfirm', () => {
    it.each([null, undefined])('returns early when targetNames is %s', async (targetNames) => {
      const handlers = getHandlers();
      await handlers.handlePrayerOfHealingConfirm(targetNames);
      expect(confirmPrayerOfHealing).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early when prayerOfHealingModal is absent from mergedModalState', async () => {
      const handlers = getHandlers();
      await handlers.handlePrayerOfHealingConfirm(['Ally1']);
      expect(confirmPrayerOfHealing).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmPrayerOfHealing with all parameters and clears the modal', async () => {
      confirmPrayerOfHealing.mockResolvedValue({ payload: '<p>Prayed!</p>' });
      const mergedModalState = {
        prayerOfHealingModal: makeBaseModalData({
          healExpression: '2d4',
          maximize: false,
          bonusHeal: 3,
          bonusDetails: 'bonus',
          slotLevel: 2,
          currentRound: 5,
        }),
      };
      const handlers = getHandlers({}, mergedModalState);
      await handlers.handlePrayerOfHealingConfirm(['Ally1']);

      expect(confirmPrayerOfHealing).toHaveBeenCalledWith({
          action: mergedModalState.prayerOfHealingModal.action,
          playerStats: mergedModalState.prayerOfHealingModal.playerStats,
          campaignName: mergedModalState.prayerOfHealingModal.campaignName,
          selectedTargetNames: ['Ally1'],
          healExpression: '2d4',
          maximize: false,
          bonusHeal: 3,
          bonusDetails: 'bonus',
          slotLevel: 2,
          currentRound: 5,
      });
      expect(mockSetModalState).toHaveBeenCalledWith({ prayerOfHealingModal: null });
    });

    it('shows popup when confirmPrayerOfHealing returns a payload', async () => {
      confirmPrayerOfHealing.mockResolvedValue({ payload: '<p>Prayer answered</p>' });
      const handlers = getHandlers({}, {
        prayerOfHealingModal: makeBaseModalData({
          healExpression: '2d4', maximize: false, bonusHeal: 0, bonusDetails: '', slotLevel: 1, currentRound: 1,
        }),
      });
      await handlers.handlePrayerOfHealingConfirm(['Ally1']);
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Prayer answered</p>');
    });
  });

  describe('handlePowerWordFortifyConfirm', () => {
    it.each([null, undefined])('returns early when distribution is %s', async (distribution) => {
      const handlers = getHandlers();
      await handlers.handlePowerWordFortifyConfirm(distribution);
      expect(confirmPowerWordFortify).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early when powerWordFortifyModal is absent from mergedModalState', async () => {
      const handlers = getHandlers();
      await handlers.handlePowerWordFortifyConfirm({ Ally1: 10 });
      expect(confirmPowerWordFortify).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmPowerWordFortify and clears the modal', async () => {
      confirmPowerWordFortify.mockResolvedValue({ payload: '<p>Fortified!</p>' });
      const mergedModalState = {
        powerWordFortifyModal: makeBaseModalData({
          totalTempHp: 20,
          tempHpExpression: '1d10',
        }),
      };
      const handlers = getHandlers({}, mergedModalState);
      await handlers.handlePowerWordFortifyConfirm({ Ally1: 10, Ally2: 10 });

      expect(confirmPowerWordFortify).toHaveBeenCalledWith(
        mergedModalState.powerWordFortifyModal.action,
        mergedModalState.powerWordFortifyModal.playerStats,
        mergedModalState.powerWordFortifyModal.campaignName,
        { Ally1: 10, Ally2: 10 },
        20,
        '1d10'
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ powerWordFortifyModal: null });
    });

    it('shows popup when confirmPowerWordFortify returns a payload', async () => {
      confirmPowerWordFortify.mockResolvedValue({ payload: '<p>Temp HP granted</p>' });
      const handlers = getHandlers({}, {
        powerWordFortifyModal: makeBaseModalData({ totalTempHp: 20, tempHpExpression: '1d10' }),
      });
      await handlers.handlePowerWordFortifyConfirm({ Ally1: 20 });
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Temp HP granted</p>');
    });
  });

  describe('handleMassHealingWordConfirm', () => {
    it.each([null, undefined])('returns early when targetNames is %s', async (targetNames) => {
      const handlers = getHandlers();
      await handlers.handleMassHealingWordConfirm(targetNames);
      expect(confirmMassHealingWord).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early when massHealingWordModal is absent from mergedModalState', async () => {
      const handlers = getHandlers();
      await handlers.handleMassHealingWordConfirm(['Ally1']);
      expect(confirmMassHealingWord).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('delegates to confirmMassHealingWord with all parameters and clears the modal', async () => {
      confirmMassHealingWord.mockResolvedValue({ payload: '<p>Healed!</p>' });
      const mergedModalState = {
        massHealingWordModal: makeBaseModalData({
          healExpression: '2d4',
          maximize: false,
          bonusHeal: 3,
          bonusDetails: 'bonus',
          slotLevel: 3,
        }),
      };
      const handlers = getHandlers({}, mergedModalState);
      await handlers.handleMassHealingWordConfirm(['Ally1', 'Ally2', 'Ally3']);

      expect(confirmMassHealingWord).toHaveBeenCalledWith({
          action: mergedModalState.massHealingWordModal.action,
          playerStats: mergedModalState.massHealingWordModal.playerStats,
          campaignName: mergedModalState.massHealingWordModal.campaignName,
          selectedTargetNames: ['Ally1', 'Ally2', 'Ally3'],
          healExpression: '2d4',
          maximize: false,
          bonusHeal: 3,
          bonusDetails: 'bonus',
          slotLevel: 3,
      });
      expect(mockSetModalState).toHaveBeenCalledWith({ massHealingWordModal: null });
    });

    it('shows popup when confirmMassHealingWord returns a payload', async () => {
      confirmMassHealingWord.mockResolvedValue({ payload: '<p>Mass healing word</p>' });
      const handlers = getHandlers({}, {
        massHealingWordModal: makeBaseModalData({
          healExpression: '2d4', maximize: false, bonusHeal: 0, bonusDetails: '', slotLevel: 3,
        }),
      });
      await handlers.handleMassHealingWordConfirm(['Ally1', 'Ally2', 'Ally3']);
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Mass healing word</p>');
    });
  });
});
