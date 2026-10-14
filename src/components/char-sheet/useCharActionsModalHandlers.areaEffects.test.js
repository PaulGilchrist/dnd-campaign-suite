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

const { activateNaturesSanctuary, moveNaturesSanctuary } = await import('../../services/automation/handlers/class-ranger/naturesSanctuaryHandler.js');
const { activateCoronaOfLight } = await import('../../services/automation/handlers/class-cleric-paladin/coronaOfLightHandler.js');
const { confirmRadianceOfDawn } = await import('../../services/automation/handlers/class-cleric-paladin/radianceOfDawnHandler.js');

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

describe('useCharActionsModalHandlers - area effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPopupHtml.mockClear();
    mockSetModalState.mockClear();
  });

  describe('handleNaturesSanctuaryConfirm', () => {
    it.each([null, undefined])('returns early when targetNames is %s', async (targetNames) => {
      const handlers = getHandlers();
      await handlers.handleNaturesSanctuaryConfirm(targetNames, null);
      expect(activateNaturesSanctuary).not.toHaveBeenCalled();
      expect(moveNaturesSanctuary).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early when naturesSanctuaryCreaturesModal is not in modalState', async () => {
      const handlers = getHandlers();
      await handlers.handleNaturesSanctuaryConfirm(['target'], null);
      expect(activateNaturesSanctuary).not.toHaveBeenCalled();
      expect(moveNaturesSanctuary).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('calls moveNaturesSanctuary when isMove is true', async () => {
      moveNaturesSanctuary.mockResolvedValue({ payload: '<p>Moved!</p>' });
      const modalState = {
        naturesSanctuaryCreaturesModal: {
          ...makeBaseModalData({ action: { name: "Nature's Sanctuary" }, isMove: true }),
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleNaturesSanctuaryConfirm(['Ally1'], 'Forest Map');
      expect(moveNaturesSanctuary).toHaveBeenCalledWith(
        modalState.naturesSanctuaryCreaturesModal.action,
        modalState.naturesSanctuaryCreaturesModal.playerStats,
        modalState.naturesSanctuaryCreaturesModal.campaignName,
        ['Ally1']
      );
      expect(activateNaturesSanctuary).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ naturesSanctuaryCreaturesModal: null });
    });

    it('calls activateNaturesSanctuary when isMove is false', async () => {
      activateNaturesSanctuary.mockResolvedValue({ payload: '<p>Activated!</p>' });
      const modalState = {
        naturesSanctuaryCreaturesModal: {
          ...makeBaseModalData({ action: { name: "Nature's Sanctuary" }, isMove: false }),
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleNaturesSanctuaryConfirm(['Ally1'], 'Forest Map');
      expect(activateNaturesSanctuary).toHaveBeenCalledWith(
        modalState.naturesSanctuaryCreaturesModal.action,
        modalState.naturesSanctuaryCreaturesModal.playerStats,
        modalState.naturesSanctuaryCreaturesModal.campaignName,
        'Forest Map',
        ['Ally1']
      );
      expect(moveNaturesSanctuary).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ naturesSanctuaryCreaturesModal: null });
    });

    it('calls activateNaturesSanctuary when isMove is undefined', async () => {
      activateNaturesSanctuary.mockResolvedValue({ payload: '<p>Activated!</p>' });
      const modalState = {
        naturesSanctuaryCreaturesModal: makeBaseModalData({ action: { name: "Nature's Sanctuary" } }),
      };
      const handlers = getHandlers(modalState);
      await handlers.handleNaturesSanctuaryConfirm(['Ally1'], 'Forest Map');
      expect(activateNaturesSanctuary).toHaveBeenCalled();
      expect(moveNaturesSanctuary).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ naturesSanctuaryCreaturesModal: null });
    });

    it('does not call setPopupHtml when result has no payload (isMove=true)', async () => {
      moveNaturesSanctuary.mockResolvedValue({});
      const modalState = {
        naturesSanctuaryCreaturesModal: {
          ...makeBaseModalData({ action: { name: "Nature's Sanctuary" }, isMove: true }),
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleNaturesSanctuaryConfirm(['Ally1'], 'Forest Map');
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ naturesSanctuaryCreaturesModal: null });
    });

    it('does not call setPopupHtml when result has no payload (isMove=false)', async () => {
      activateNaturesSanctuary.mockResolvedValue({});
      const modalState = {
        naturesSanctuaryCreaturesModal: {
          ...makeBaseModalData({ action: { name: "Nature's Sanctuary" }, isMove: false }),
        },
      };
      const handlers = getHandlers(modalState);
      await handlers.handleNaturesSanctuaryConfirm(['Ally1'], 'Forest Map');
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ naturesSanctuaryCreaturesModal: null });
    });
  });

  describe('handleCoronaEnemySelectionConfirm', () => {
    it.each([null, undefined])('returns early when selectedEnemies is %s', async (selectedEnemies) => {
      const handlers = getHandlers();
      await handlers.handleCoronaEnemySelectionConfirm(selectedEnemies);
      expect(activateCoronaOfLight).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early when coronaEnemySelectionModal is not in modalState', async () => {
      const handlers = getHandlers();
      await handlers.handleCoronaEnemySelectionConfirm(['enemy']);
      expect(activateCoronaOfLight).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('calls activateCoronaOfLight when modal is present', async () => {
      activateCoronaOfLight.mockResolvedValue({ payload: '<p>Corona!</p>' });
      const modalState = {
        coronaEnemySelectionModal: makeBaseModalData({ action: { name: 'Corona of Light' } }),
      };
      const handlers = getHandlers(modalState);
      await handlers.handleCoronaEnemySelectionConfirm(['Enemy1', 'Enemy2']);
      expect(activateCoronaOfLight).toHaveBeenCalledWith(
        modalState.coronaEnemySelectionModal.action,
        modalState.coronaEnemySelectionModal.playerStats,
        modalState.coronaEnemySelectionModal.campaignName,
        ['Enemy1', 'Enemy2']
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ coronaEnemySelectionModal: null });
    });

    it('does not call setPopupHtml when result has no payload', async () => {
      activateCoronaOfLight.mockResolvedValue({});
      const modalState = {
        coronaEnemySelectionModal: makeBaseModalData({ action: { name: 'Corona of Light' } }),
      };
      const handlers = getHandlers(modalState);
      await handlers.handleCoronaEnemySelectionConfirm(['Enemy1', 'Enemy2']);
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ coronaEnemySelectionModal: null });
    });
  });

  describe('handleRadianceOfDawnConfirm', () => {
    it.each([null, undefined])('returns early when selectedTargets is %s', async (selectedTargets) => {
      const handlers = getHandlers();
      await handlers.handleRadianceOfDawnConfirm(selectedTargets);
      expect(confirmRadianceOfDawn).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('returns early when radianceOfDawnModal is not in modalState', async () => {
      const handlers = getHandlers();
      await handlers.handleRadianceOfDawnConfirm(['target']);
      expect(confirmRadianceOfDawn).not.toHaveBeenCalled();
      expect(mockSetModalState).not.toHaveBeenCalled();
    });

    it('calls confirmRadianceOfDawn when modal is present', async () => {
      confirmRadianceOfDawn.mockResolvedValue({ payload: '<p>Radiance!</p>' });
      const modalState = {
        radianceOfDawnModal: makeBaseModalData({ action: { name: 'Radiance of Dawn' } }),
      };
      const handlers = getHandlers(modalState);
      await handlers.handleRadianceOfDawnConfirm(['Ally1', 'Enemy1']);
      expect(confirmRadianceOfDawn).toHaveBeenCalledWith(
        modalState.radianceOfDawnModal.action,
        modalState.radianceOfDawnModal.playerStats,
        modalState.radianceOfDawnModal.campaignName,
        ['Ally1', 'Enemy1']
      );
      expect(mockSetModalState).toHaveBeenCalledWith({ radianceOfDawnModal: null });
    });

    it('does not call setPopupHtml when result has no payload', async () => {
      confirmRadianceOfDawn.mockResolvedValue({});
      const modalState = {
        radianceOfDawnModal: makeBaseModalData({ action: { name: 'Radiance of Dawn' } }),
      };
      const handlers = getHandlers(modalState);
      await handlers.handleRadianceOfDawnConfirm(['Ally1', 'Enemy1']);
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(mockSetModalState).toHaveBeenCalledWith({ radianceOfDawnModal: null });
    });
  });
});
