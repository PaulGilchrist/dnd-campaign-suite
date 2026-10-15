// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCombatSuperiorityModal } from './useCombatSuperiorityModal.js';

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  executeManeuver: vi.fn(),
  onCombatSuperioritySelected: vi.fn(),
}));

import { addEntry } from '../../services/ui/logService.js';
import { executeManeuver, onCombatSuperioritySelected } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const mockPlayerStats = { name: 'Thorin', level: 5 };
const mockCampaignName = 'test-campaign';
const singleUseModal = { action: { name: 'Test Maneuver' } };
const selectionModal = { action: { name: 'Select Maneuvers' } };

const mockRollAttack = vi.fn();
const mockRollDamage = vi.fn();
const mockOnPopupHtml = vi.fn();

// Opens the modal and confirms — the exact seam every test drives.
async function openAndConfirm(modalPayload, selected = [], singleUseManeuverName) {
  const { result } = renderHook(() =>
    useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
  );
  act(() => {
    result.current.setCombatSuperiorityModal(modalPayload);
  });
  await act(async () => {
    await result.current.handleCombatSuperiorityConfirm(selected, singleUseManeuverName);
  });
  return result;
}

// Captures window CustomEvents dispatched during a confirm; restored in afterEach.
function captureModalEvents() {
  const events = [];
  vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
    events.push(event);
    return true;
  });
  return events;
}

function attackRollResult({ attack, targetName, dieValue, baseDamageFormula }) {
  return {
    type: 'attack_roll',
    payload: { attack, targetName },
    context: { superiorityDieValue: dieValue, baseDamageFormula },
  };
}

describe('useCombatSuperiorityModal - handleCombatSuperiorityConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue({});
    executeManeuver.mockResolvedValue({});
    onCombatSuperioritySelected.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should do nothing when the modal is not open', async () => {
    const { result } = renderHook(() => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName));

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Test Maneuver']);
    });

    expect(result.current.combatSuperiorityModal).toBeNull();
    expect(onCombatSuperioritySelected).not.toHaveBeenCalled();
    expect(executeManeuver).not.toHaveBeenCalled();
  });

  describe('multi-maneuver selection path', () => {
    it('should close the modal and dispatch the selection to onCombatSuperioritySelected', async () => {
      const result = await openAndConfirm(selectionModal, ['Rally', 'Disarming Attack']);

      expect(result.current.combatSuperiorityModal).toBeNull();
      expect(onCombatSuperioritySelected).toHaveBeenCalledWith(
        { name: 'Select Maneuvers' },
        mockPlayerStats,
        mockCampaignName,
        ['Rally', 'Disarming Attack'],
        undefined
      );
      expect(executeManeuver).not.toHaveBeenCalled();
    });

    it('should log result entries and show a formatted popup for an object popup payload', async () => {
      const entry = { type: 'ability_use', characterName: 'Thorin', abilityName: 'Selection', description: 'Selected.' };
      onCombatSuperioritySelected.mockResolvedValue({
        logEntries: [entry],
        type: 'popup',
        payload: { name: 'Maneuver Selection', description: 'Maneuvers selected.' },
      });

      await openAndConfirm(selectionModal, ['Rally']);

      expect(addEntry).toHaveBeenCalledWith(mockCampaignName, entry);
      expect(mockOnPopupHtml).toHaveBeenCalledWith(
        '<b><i class="fa-solid fa-bolt"></i> Maneuver Selection</b><br/>Maneuvers selected.<br/><span class="dice-roll-hint">click to dismiss</span>'
      );
    });

    it('should show a popup from the top-level popup property fallback', async () => {
      onCombatSuperioritySelected.mockResolvedValue({
        popup: { name: 'Pushing Attack', description: 'Target pushed 10 feet.' },
      });

      await openAndConfirm(selectionModal, ['Pushing Attack']);

      expect(mockOnPopupHtml).toHaveBeenCalledWith(
        '<b><i class="fa-solid fa-bolt"></i> Pushing Attack</b><br/>Target pushed 10 feet.<br/><span class="dice-roll-hint">click to dismiss</span>'
      );
    });

    it('should dispatch rally-choice-modal-show for a rallyChoice modal result', async () => {
      const payload = {
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        options: [{ label: 'Myself', value: 'Thorin' }],
      };
      onCombatSuperioritySelected.mockResolvedValue({ type: 'modal', modalName: 'rallyChoice', payload });

      const events = captureModalEvents();
      await openAndConfirm(selectionModal, ['Rally']);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('rally-choice-modal-show');
      expect(events[0].detail).toEqual(payload);
    });

    it('should ignore choice modals outside the multi-selection allowlist', async () => {
      onCombatSuperioritySelected.mockResolvedValue({
        type: 'modal',
        modalName: 'baitAndSwitchChoice',
        payload: { options: [] },
      });

      const events = captureModalEvents();
      await openAndConfirm(selectionModal, ['Bait and Switch']);

      expect(events).toHaveLength(0);
      expect(mockOnPopupHtml).not.toHaveBeenCalled();
      expect(mockRollAttack).not.toHaveBeenCalled();
    });

    it('should route attack_roll results to rollAttack with the superiority die added', async () => {
      onCombatSuperioritySelected.mockResolvedValue(attackRollResult({
        attack: { name: 'Riposte', hitBonus: 6, damageFormula: '1d6 + 3', damageType: 'Slashing' },
        targetName: 'Troll',
        dieValue: 2,
        baseDamageFormula: '1d6 + 3',
      }));

      await openAndConfirm(selectionModal, ['Riposte']);

      expect(mockRollAttack).toHaveBeenCalledWith(
        'Riposte',
        8,
        expect.objectContaining({
          targetName: 'Troll',
          isOpportunityAttack: true,
          autoDamageFormula: '1d6 + 3 + 2 [Superiority]',
          superiorityDieValue: 2,
        })
      );
    });
  });

  describe('single-use maneuver path', () => {
    it('should execute the maneuver with the modal action and close the modal', async () => {
      const result = await openAndConfirm(singleUseModal, [], 'Precision Strike');

      expect(result.current.combatSuperiorityModal).toBeNull();
      expect(executeManeuver).toHaveBeenCalledWith(
        { name: 'Test Maneuver' },
        mockPlayerStats,
        mockCampaignName,
        'Precision Strike'
      );
      expect(onCombatSuperioritySelected).not.toHaveBeenCalled();
    });

    it('should log result entries and show a formatted popup for an object popup payload', async () => {
      const entry = { type: 'ability_use', characterName: 'Thorin', abilityName: 'Rally', description: 'Rally used.' };
      executeManeuver.mockResolvedValue({
        logEntries: [entry],
        type: 'popup',
        payload: { name: 'Disarming Attack', description: 'Target drops an item.' },
      });

      const result = await openAndConfirm(singleUseModal, [], 'Disarming Attack');

      expect(addEntry).toHaveBeenCalledWith(mockCampaignName, entry);
      expect(mockOnPopupHtml).toHaveBeenCalledWith(
        '<b><i class="fa-solid fa-bolt"></i> Disarming Attack</b><br/>Target drops an item.<br/><span class="dice-roll-hint">click to dismiss</span>'
      );
      expect(result.current.combatSuperiorityModal).toBeNull();
    });

    it('should pass a raw string popup payload through unchanged', async () => {
      executeManeuver.mockResolvedValue({ type: 'popup', payload: '<b>Test</b><br/>Description.' });

      await openAndConfirm(singleUseModal, [], 'Test');

      expect(mockOnPopupHtml).toHaveBeenCalledWith('<b>Test</b><br/>Description.');
    });

    it('should still close the modal when addEntry rejects', async () => {
      addEntry.mockRejectedValue(new Error('Log write failed'));
      executeManeuver.mockResolvedValue({
        logEntries: [{ type: 'ability_use', characterName: 'Thorin', abilityName: 'Rally', description: 'Rally used.' }],
      });

      const result = await openAndConfirm(singleUseModal, [], 'Rally');

      expect(result.current.combatSuperiorityModal).toBeNull();
    });

    it.each([
      ['baitAndSwitchChoice', 'bait-and-switch-modal-show'],
      ['commanderStrikeChoice', 'commander-strike-modal-show'],
      ['rallyChoice', 'rally-choice-modal-show'],
    ])('should dispatch %s → %s when executeManeuver returns that choice modal', async (modalName, eventName) => {
      const payload = {
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        options: [{ label: 'Myself', value: 'Thorin' }],
      };
      executeManeuver.mockResolvedValue({ type: 'modal', modalName, payload });

      const events = captureModalEvents();
      await openAndConfirm(singleUseModal, [], 'Maneuver');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(eventName);
      expect(events[0].detail).toEqual(payload);
    });

    it('should boost hit bonus and damage formula when the superiority die value is non-zero', async () => {
      executeManeuver.mockResolvedValue(attackRollResult({
        attack: { name: 'Riposte', hitBonus: 7, damageFormula: '1d6 + 3', damageType: 'Slashing' },
        targetName: 'Ogre',
        dieValue: 3,
        baseDamageFormula: '1d6 + 3',
      }));

      await openAndConfirm(singleUseModal, [], 'Riposte');

      expect(mockRollAttack).toHaveBeenCalledWith(
        'Riposte',
        10,
        expect.objectContaining({
          targetName: 'Ogre',
          isOpportunityAttack: true,
          autoDamageFormula: '1d6 + 3 + 3 [Superiority]',
          autoDamageName: 'Riposte (Riposte)',
          damageType: 'Slashing',
          superiorityDieValue: 3,
        })
      );
    });

    it('should keep the base damage formula without superiority suffix when the die value is zero', async () => {
      executeManeuver.mockResolvedValue(attackRollResult({
        attack: { name: 'Counter', hitBonus: 5, damageFormula: '1d4 + 2' },
        targetName: 'Bandit',
        dieValue: 0,
        baseDamageFormula: '1d4 + 2',
      }));

      await openAndConfirm(singleUseModal, [], 'Counter');

      expect(mockRollAttack).toHaveBeenCalledWith(
        'Counter',
        5,
        expect.objectContaining({
          autoDamageFormula: '1d4 + 2',
          superiorityDieValue: 0,
        })
      );
    });
  });
});
