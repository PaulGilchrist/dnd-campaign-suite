// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackHealModal from './SaveAttackHealModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, formula: '1d20' })),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: {
    guid: vi.fn(() => 'test-guid-123'),
  },
}));

vi.mock('../../../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(() => ({ newHp: 30, maxHp: 40, actualHeal: 10 })),
  logHealingToSSE: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as logService from '../../../../services/ui/logService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import utils from '../../../../services/ui/utils.js';

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Helpers ──

function findRollLogEntry(calls) {
  return calls.find((call) => call[1].type === 'roll');
}

function findLastRollLogEntry(calls) {
  let last = null;
  for (const call of calls) {
    if (call[1].type === 'roll') {
      last = call;
    }
  }
  return last;
}

function findHealingLogEntry(calls) {
  return calls.find(
    (call) => call[1].type === 'roll' && call[1].rollType === 'healing'
  );
}

async function triggerFeatureApply(targetName) {
  fireEvent.click(getCheckboxByName(targetName));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
  });
}

async function triggerHeal() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
  });
  await act(async () => {
    fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
  });
  await waitFor(() => {
    expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
  });
}

// ── Tests ──

describe('SaveAttackHealModal — log details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({
      total: 10,
      rolls: [10],
      modifier: 0,
      formula: '1d20',
    });
    utils.guid.mockReturnValue('test-guid-123');
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Roll formula and bonus for NPC saves ──

  describe('NPC save roll log', () => {
    it('includes save bonus in roll formula when non-zero', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 15,
        rolls: [15],
        modifier: 0,
        formula: '1d20',
      });
      render(
        <SaveAttackHealModal
          {...makeProps({
            combatSummary: {
              creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 3 } }],
            },
          })}
        />
      );
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].formula).toBe('1d20+3');
    });

    it('omits plus sign from roll formula when save bonus is zero', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 15,
        rolls: [15],
        modifier: 0,
        formula: '1d20',
      });
      render(<SaveAttackHealModal {...makeProps()} />);
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].formula).toBe('1d20');
    });

    it('records the correct save bonus value in the log entry', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 15,
        rolls: [15],
        modifier: 0,
        formula: '1d20',
      });
      render(
        <SaveAttackHealModal
          {...makeProps({
            combatSummary: {
              creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 5 } }],
            },
          })}
        />
      );
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].bonus).toBe(5);
    });

    it('defaults bonus to 0 when saveBonuses property is missing', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 15,
        rolls: [15],
        modifier: 0,
        formula: '1d20',
      });
      render(
        <SaveAttackHealModal
          {...makeProps({
            combatSummary: { creatures: [{ name: 'Goblin A', type: 'npc' }] },
          })}
        />
      );
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].bonus).toBe(0);
    });

    it('looks up saveBonuses with lowercase save type key', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 15,
        rolls: [15],
        modifier: 0,
        formula: '1d20',
      });
      render(
        <SaveAttackHealModal
          {...makeProps({
            saveType: 'CON',
            combatSummary: {
              creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 4 } }],
            },
          })}
        />
      );
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].bonus).toBe(4);
    });

    it('records saveResult as failure when total is below DC', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 7,
        rolls: [7],
        modifier: 0,
        formula: '1d20',
      });
      render(<SaveAttackHealModal {...makeProps()} />);
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].saveResult).toBe('failure');
    });

    it('records saveResult as success when total meets DC', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 10,
        rolls: [10],
        modifier: 0,
        formula: '1d20',
      });
      render(<SaveAttackHealModal {...makeProps()} />);
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].saveResult).toBe('success');
    });

    it('records saveType in the log entry', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 15,
        rolls: [15],
        modifier: 0,
        formula: '1d20',
      });
      render(
        <SaveAttackHealModal
          {...makeProps({
            saveType: 'DEX',
          })}
        />
      );
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].saveType).toBe('DEX');
    });

    it('records total and rolls array from the dice roll', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 18,
        rolls: [18],
        modifier: 0,
        formula: '1d20',
      });
      render(<SaveAttackHealModal {...makeProps()} />);
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].total).toBe(18);
      expect(rollCall[1].rolls).toEqual([18]);
    });

    it('records attacker name and feature name in log entry', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 15,
        rolls: [15],
        modifier: 0,
        formula: '1d20',
      });
      render(<SaveAttackHealModal {...makeProps()} />);
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].characterName).toBe('Cleric1');
      expect(rollCall[1].name).toBe('Divine Smite');
    });

    it('records targetName in log entry', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 15,
        rolls: [15],
        modifier: 0,
        formula: '1d20',
      });
      render(<SaveAttackHealModal {...makeProps()} />);
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].targetName).toBe('Goblin A');
    });

    it('includes a numeric timestamp in the log entry', async () => {
      diceRoller.rollExpression.mockReturnValue({
        total: 15,
        rolls: [15],
        modifier: 0,
        formula: '1d20',
      });
      render(<SaveAttackHealModal {...makeProps()} />);
      await triggerFeatureApply('Goblin A');

      const rollCall = findRollLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(typeof rollCall[1].timestamp).toBe('number');
    });
  });

  // ── Player save result event handling ──

  describe('Player save result event', () => {
    function setupPlayerSaveFlow() {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Player One'));
      act(() => {
        fireEvent.click(
          screen.getByRole('button', { name: /Divine Smite \(1 target\)/ })
        );
      });
    }

    function dispatchSaveResult(detailOverrides) {
      const detail = {
        promptId: 'test-guid-123',
        success: false,
        total: 5,
        roll: 3,
        saveBonus: 2,
        ...detailOverrides,
      };
      const saveEvent = new CustomEvent('save-result', { detail });
      window.dispatchEvent(saveEvent);
    }

    it('logs save bonus from save-result event detail', async () => {
      setupPlayerSaveFlow();
      dispatchSaveResult({ saveBonus: 2 });

      await waitFor(() => {
        const rollCall = findLastRollLogEntry(logService.addEntry.mock.calls);
        expect(rollCall).toBeDefined();
        expect(rollCall[1].bonus).toBe(2);
      });
    });

    it('logs formula with save bonus from event detail when non-zero', async () => {
      setupPlayerSaveFlow();
      dispatchSaveResult({ saveBonus: 2 });

      await waitFor(() => {
        const rollCall = findLastRollLogEntry(logService.addEntry.mock.calls);
        expect(rollCall).toBeDefined();
        expect(rollCall[1].formula).toBe('1d20+2');
      });
    });

    it('logs formula without plus when save bonus from event is zero', async () => {
      setupPlayerSaveFlow();
      dispatchSaveResult({ saveBonus: 0 });

      await waitFor(() => {
        const rollCall = findLastRollLogEntry(logService.addEntry.mock.calls);
        expect(rollCall).toBeDefined();
        expect(rollCall[1].formula).toBe('1d20');
      });
    });

    it('uses total from event detail in log entry', async () => {
      setupPlayerSaveFlow();
      dispatchSaveResult({ total: 8 });

      await waitFor(() => {
        const rollCall = findLastRollLogEntry(logService.addEntry.mock.calls);
        expect(rollCall).toBeDefined();
        expect(rollCall[1].total).toBe(8);
      });
    });

    it('uses roll value from event detail in rolls array', async () => {
      setupPlayerSaveFlow();
      dispatchSaveResult({ roll: 6 });

      await waitFor(() => {
        const rollCall = findLastRollLogEntry(logService.addEntry.mock.calls);
        expect(rollCall).toBeDefined();
        expect(rollCall[1].rolls).toEqual([6]);
      });
    });

    it('defaults total to 0 when event detail total is undefined', async () => {
      setupPlayerSaveFlow();
      dispatchSaveResult({ total: undefined });

      await waitFor(() => {
        const rollCall = findLastRollLogEntry(logService.addEntry.mock.calls);
        expect(rollCall).toBeDefined();
        expect(rollCall[1].total).toBe(0);
      });
    });

    it('defaults roll to 0 when event detail roll is undefined', async () => {
      setupPlayerSaveFlow();
      dispatchSaveResult({ roll: undefined });

      await waitFor(() => {
        const rollCall = findLastRollLogEntry(logService.addEntry.mock.calls);
        expect(rollCall).toBeDefined();
        expect(rollCall[1].rolls).toEqual([0]);
      });
    });

    it('defaults save bonus to 0 when event detail saveBonus is undefined', async () => {
      setupPlayerSaveFlow();
      dispatchSaveResult({ saveBonus: undefined });

      await waitFor(() => {
        const rollCall = findLastRollLogEntry(logService.addEntry.mock.calls);
        expect(rollCall).toBeDefined();
        expect(rollCall[1].bonus).toBe(0);
      });
    });

    it('records saveResult from event detail success flag', async () => {
      setupPlayerSaveFlow();
      dispatchSaveResult({ success: true });

      await waitFor(() => {
        const rollCall = findLastRollLogEntry(logService.addEntry.mock.calls);
        expect(rollCall).toBeDefined();
        expect(rollCall[1].saveResult).toBe('success');
      });
    });
  });

  // ── UI display of modal props ──

  describe('modal body display', () => {
    it('displays the save type in body text', () => {
      render(<SaveAttackHealModal {...makeProps({ saveType: 'DEX' })} />);
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('DEX');
      expect(body.textContent).toContain('saving throw');
    });

    it('displays the save DC in body text', () => {
      render(<SaveAttackHealModal {...makeProps({ saveDc: 15 })} />);
      expect(screen.getByText(/DC 15/)).toBeInTheDocument();
    });

    it('displays the range in body text', () => {
      render(<SaveAttackHealModal {...makeProps({ rangeFeet: 60 })} />);
      expect(screen.getByText(/within 60 feet/)).toBeInTheDocument();
    });

    it('displays the damage expression in warning text', () => {
      render(<SaveAttackHealModal {...makeProps({ damageExpression: '6d6' })} />);
      expect(screen.getByText(/6d6.*Radiant.*damage/)).toBeInTheDocument();
    });

    it('displays the damage type in warning text', () => {
      render(<SaveAttackHealModal {...makeProps({ damageType: 'Fire' })} />);
      expect(screen.getByText(/Fire.*damage/)).toBeInTheDocument();
    });
  });

  // ── Healing roll log ──

  describe('healing roll log entry', () => {
    function setupHealFlow(targetName) {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName(targetName));
      act(() => {
        fireEvent.click(
          screen.getByRole('button', { name: /Divine Smite \(1 target\)/ })
        );
      });
      return triggerHeal();
    }

    it('logs a healing roll entry with rolls array', async () => {
      await setupHealFlow('Goblin A');

      const rollCall = findHealingLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(Array.isArray(rollCall[1].rolls)).toBe(true);
    });

    it('logs the total healing amount', async () => {
      await setupHealFlow('Goblin A');

      const rollCall = findHealingLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].total).toBe(10);
    });

    it('logs the healer character name', async () => {
      await setupHealFlow('Goblin A');

      const rollCall = findHealingLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].characterName).toBe('Cleric1');
    });

    it('logs the feature name', async () => {
      await setupHealFlow('Goblin A');

      const rollCall = findHealingLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].name).toBe('Divine Smite');
    });

    it('logs the target name', async () => {
      await setupHealFlow('Goblin A');

      const rollCall = findHealingLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].targetName).toBe('Goblin A');
    });

    it('logs the heal expression as formula', async () => {
      await setupHealFlow('Goblin A');

      const rollCall = findHealingLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].formula).toBe('2d8');
    });

    it('logs rollType as healing', async () => {
      await setupHealFlow('Goblin A');

      const rollCall = findHealingLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].rollType).toBe('healing');
    });

    it('logs bonus as 0 for healing', async () => {
      await setupHealFlow('Goblin A');

      const rollCall = findHealingLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(rollCall[1].bonus).toBe(0);
    });

    it('includes a numeric timestamp in the healing log entry', async () => {
      await setupHealFlow('Goblin A');

      const rollCall = findHealingLogEntry(logService.addEntry.mock.calls);
      expect(rollCall).toBeDefined();
      expect(typeof rollCall[1].timestamp).toBe('number');
    });
  });
});
