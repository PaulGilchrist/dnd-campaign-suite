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

const {
  executeSweepingAttack,
  executeBaitAndSwitchChoice,
  executeCommanderStrikeChoice,
  executeRallyChoice,
} = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');

const { addEntry } = await import('../../services/ui/logService.js');

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

function makeModalData(overrides = {}) {
  return {
    playerStats: makePlayerStats(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}

describe('useCharActionsModalHandlers - combat superiority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPopupHtml.mockClear();
    mockSetModalState.mockClear();
  });

  describe('handleSweepingAttackConfirm', () => {
    it.each([null, undefined])('returns early without side effects when targetName is %s', async (targetName) => {
      const handlers = getHandlers();
      await handlers.handleSweepingAttackConfirm(targetName, {});
      expect(executeSweepingAttack).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early without side effects when targetName is an empty string', async () => {
      const handlers = getHandlers();
      await handlers.handleSweepingAttackConfirm('', {});
      expect(executeSweepingAttack).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it.each([null, undefined])('returns early without side effects when modalData is %s', async (modalData) => {
      const handlers = getHandlers();
      await handlers.handleSweepingAttackConfirm('target', modalData);
      expect(executeSweepingAttack).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('calls executeSweepingAttack with correct args and clears modal', async () => {
      executeSweepingAttack.mockResolvedValue({ payload: '<p>Hit!</p>' });
      const handlers = getHandlers();
      const modalData = makeModalData();
      await handlers.handleSweepingAttackConfirm('Goblin', modalData);
      expect(executeSweepingAttack).toHaveBeenCalledWith(
        { automation: { secondaryTargetName: 'Goblin' } },
        modalData.playerStats,
        modalData.campaignName,
        'Goblin'
      );
      expect(mockSetPopupHtml).toHaveBeenCalledWith('<p>Hit!</p>');
      expect(mockSetModalState).toHaveBeenCalledWith({ sweepingAttackTargetModal: null });
    });

    it('does not call setPopupHtml when result has no payload but still clears modal', async () => {
      executeSweepingAttack.mockResolvedValue({});
      const handlers = getHandlers();
      const modalData = makeModalData();
      await handlers.handleSweepingAttackConfirm('Goblin', modalData);
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ sweepingAttackTargetModal: null });
    });
  });

  describe('handleBaitAndSwitchChoiceConfirm', () => {
    it.each([null, undefined, ''])('returns early without side effects when targetName is %s', async (targetName) => {
      const handlers = getHandlers();
      await handlers.handleBaitAndSwitchChoiceConfirm(targetName, {});
      expect(executeBaitAndSwitchChoice).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it.each([null, undefined])('returns early without side effects when modalData is %s', async (modalData) => {
      const handlers = getHandlers();
      await handlers.handleBaitAndSwitchChoiceConfirm('Orc', modalData);
      expect(executeBaitAndSwitchChoice).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('calls executeBaitAndSwitchChoice with correct args and clears modal', async () => {
      executeBaitAndSwitchChoice.mockResolvedValue({ payload: '<p>Success</p>' });
      const handlers = getHandlers();
      const modalData = makeModalData({ dieValue: 15, maneuverName: 'Trip' });
      await handlers.handleBaitAndSwitchChoiceConfirm('Orc', modalData);
      expect(executeBaitAndSwitchChoice).toHaveBeenCalledWith(
        { dieValue: 15, maneuverName: 'Trip' },
        modalData.playerStats,
        modalData.campaignName,
        'Orc'
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ baitAndSwitchChoiceModal: null });
    });

    it('does not call setPopupHtml when result has no payload but still clears modal', async () => {
      executeBaitAndSwitchChoice.mockResolvedValue({});
      const handlers = getHandlers();
      const modalData = makeModalData({ dieValue: 15, maneuverName: 'Trip' });
      await handlers.handleBaitAndSwitchChoiceConfirm('Orc', modalData);
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ baitAndSwitchChoiceModal: null });
    });
  });

  describe('handleCommanderStrikeChoiceConfirm', () => {
    it.each([null, undefined, ''])('returns early without side effects when targetName is %s', async (targetName) => {
      const handlers = getHandlers();
      await handlers.handleCommanderStrikeChoiceConfirm(targetName, {});
      expect(executeCommanderStrikeChoice).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it.each([null, undefined])('returns early without side effects when modalData is %s', async (modalData) => {
      const handlers = getHandlers();
      await handlers.handleCommanderStrikeChoiceConfirm('Ally1', modalData);
      expect(executeCommanderStrikeChoice).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('calls executeCommanderStrikeChoice with correct args and clears modal', async () => {
      executeCommanderStrikeChoice.mockResolvedValue({ payload: '<p>Struck</p>' });
      const handlers = getHandlers();
      const modalData = makeModalData({ dieValue: 12, maneuverName: 'Commander Strike' });
      await handlers.handleCommanderStrikeChoiceConfirm('Ally1', modalData);
      expect(executeCommanderStrikeChoice).toHaveBeenCalledWith(
        { dieValue: 12, maneuverName: 'Commander Strike' },
        modalData.playerStats,
        modalData.campaignName,
        'Ally1'
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ commanderStrikeChoiceModal: null });
    });

    it('does not call setPopupHtml when result has no payload but still clears modal', async () => {
      executeCommanderStrikeChoice.mockResolvedValue({});
      const handlers = getHandlers();
      const modalData = makeModalData({ dieValue: 12, maneuverName: 'Commander Strike' });
      await handlers.handleCommanderStrikeChoiceConfirm('Ally1', modalData);
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ commanderStrikeChoiceModal: null });
    });
  });

  describe('handleRallyChoiceConfirm', () => {
    it.each([null, undefined, ''])('returns early without side effects when targetName is %s', async (targetName) => {
      const handlers = getHandlers();
      await handlers.handleRallyChoiceConfirm(targetName, {});
      expect(executeRallyChoice).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it.each([null, undefined])('returns early without side effects when modalData is %s', async (modalData) => {
      const handlers = getHandlers();
      await handlers.handleRallyChoiceConfirm('Ally2', modalData);
      expect(executeRallyChoice).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('calls executeRallyChoice with all parameters and clears modal', async () => {
      executeRallyChoice.mockResolvedValue({ payload: '<p>Rally!</p>' });
      const handlers = getHandlers();
      const modalData = makeModalData({
        dieValue: 10,
        maneuverName: 'Rally the Brave',
        totalHp: 20,
        extraHp: 5,
        description: 'Rally description',
      });
      await handlers.handleRallyChoiceConfirm('Ally2', modalData);
      expect(executeRallyChoice).toHaveBeenCalledWith({
        action: { dieValue: 10, maneuverName: 'Rally the Brave' },
        playerStats: modalData.playerStats,
        campaignName: modalData.campaignName,
        chosenName: 'Ally2',
        totalHp: 20,
        extraHp: 5,
        description: 'Rally description',
      });
      expect(mockSetModalState).toHaveBeenCalledWith({ rallyChoiceModal: null });
    });

    it('does not call setPopupHtml when result has no payload but still clears modal', async () => {
      executeRallyChoice.mockResolvedValue({});
      const handlers = getHandlers();
      const modalData = makeModalData({
        dieValue: 10,
        maneuverName: 'Rally the Brave',
        totalHp: 20,
        extraHp: 5,
        description: 'Rally description',
      });
      await handlers.handleRallyChoiceConfirm('Ally2', modalData);
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ rallyChoiceModal: null });
    });

    it('flushes executeRallyChoice logEntries to the campaign log (MN-016)', async () => {
      const grantEntry = {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Rally',
        description: 'Rally: HexWarlock gains 16 temporary hit points.',
        d10Roll: 7,
      };
      executeRallyChoice.mockResolvedValue({ payload: { description: 'Rally!' }, logEntries: [grantEntry] });
      const handlers = getHandlers();
      const modalData = makeModalData({
        dieValue: 7,
        maneuverName: 'Rally',
        totalHp: 16,
        extraHp: 9,
        description: 'Rally description',
      });
      await handlers.handleRallyChoiceConfirm('HexWarlock', modalData);
      expect(addEntry).toHaveBeenCalledWith('test-campaign', grantEntry);
      expect(mockSetModalState).toHaveBeenCalledWith({ rallyChoiceModal: null });
    });

    it('does not call addEntry when result has no logEntries', async () => {
      executeRallyChoice.mockResolvedValue({ payload: { description: 'Rally!' } });
      const handlers = getHandlers();
      const modalData = makeModalData({ dieValue: 7, maneuverName: 'Rally', totalHp: 16, extraHp: 9 });
      await handlers.handleRallyChoiceConfirm('HexWarlock', modalData);
      expect(addEntry).not.toHaveBeenCalled();
    });
  });
});
