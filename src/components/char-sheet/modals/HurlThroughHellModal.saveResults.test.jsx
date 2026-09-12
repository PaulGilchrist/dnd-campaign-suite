// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HurlThroughHellModal from './HurlThroughHellModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id-123' })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 22 })),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 5),
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin1', type: 'npc' },
      { name: 'Orc Warrior', type: 'npc', monsterType: 'fiend' },
      { name: 'Elf Mage', type: 'player' },
    ],
  })),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 22, rolls: [15, 7] })),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as savePrompt from '../../../services/automation/common/savePrompt.js';
import * as logService from '../../../services/ui/logService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as applyDamage from '../../../services/rules/combat/applyDamage.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as expirations from '../../../services/rules/effects/expirations.js';

// ── Test fixtures ──

const mockPlayerStats = { name: 'Throg', level: 15 };
const mockCampaignName = 'test-campaign';
const mockOnClose = vi.fn();

function makeProps(overrides) {
  return {
    action: { name: 'Hurl Through Hell' },
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    targetName: 'Goblin1',
    saveType: 'WIS',
    saveDc: 16,
    damageType: 'Psychic',
    damageExpression: '4d10',
    damageTotal: 22,
    currentUses: 0,
    maxUses: 3,
    pactMagicRecharge: false,
    pactSlotLevel: 0,
    pactSlotsAvailable: 0,
    onClose: mockOnClose,
    ...(overrides || {}),
  };
}

// ── Helpers ──

function dispatchSaveResult(detail) {
  return act(async () => {
    await new Promise(r => setTimeout(r, 15));
    window.dispatchEvent(new CustomEvent('save-result', { detail }));
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
  });
}

function renderModal(propsOverride) {
  return render(<HurlThroughHellModal {...makeProps(propsOverride)} />);
}

function triggerConfirm() {
  fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));
}

// ── Tests ──

describe('HurlThroughHellModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentTurn') return 'Turn5';
      if (key === 'activeConditions') return [];
      if (key === 'targetEffects') return [];
      if (key === 'spell_slots_level_2') return '3';
      return null;
    });
    diceRoller.rollExpression.mockImplementation((expr) => {
      if (expr === '4d10-custom') return { total: 18, rolls: [10, 8] };
      return { total: 22, rolls: [15, 7] };
    });
    combatData.getCombatSummary.mockImplementation(() => ({
      creatures: [
        { name: 'Goblin1', type: 'npc' },
        { name: 'Orc Warrior', type: 'npc', monsterType: 'fiend' },
        { name: 'Elf Mage', type: 'player' },
      ],
    }));
    applyDamage.applyDamageToTarget.mockImplementation(() => ({ finalDamage: 22 }));
    logService.addEntry.mockImplementation(() => Promise.resolve());
    runtimeState.setRuntimeValue.mockImplementation(() => Promise.resolve());
    savePrompt.createSaveListener.mockImplementation(() => ({ promptId: 'test-prompt-id-123' }));
  });

  // ── Failed save - non-fiend target ──

  describe('failed save - non-fiend target', () => {
    it('applies incapacitated condition, target effect, damage, logging, and popup', async () => {
      const handler = vi.fn();
      window.addEventListener('damage-popup', handler);

      renderModal();
      triggerConfirm();

      await dispatchSaveResult({
        promptId: 'test-prompt-id-123',
        roll: 8,
        total: 10,
        success: false,
      });

      await waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Goblin1',
          'activeConditions',
          expect.arrayContaining(['incapacitated']),
          'test-campaign'
        );
      });

      await waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'campaign',
          'targetEffects',
          expect.arrayContaining([
            expect.objectContaining({
              target: 'Goblin1',
              source: 'Hurl Through Hell',
              effect: 'incapacitated',
              condition: 'incapacitated',
              duration: 'until_end_of_next_turn',
              saveType: 'WIS',
              saveDc: 16,
              teleport: true,
              returnToSpace: true,
            }),
          ]),
          'test-campaign'
        );
      });

      await waitFor(() => {
        expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin1', 22, ['Psychic'], 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'Throg' });
      });

      await waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'save_result',
            characterName: 'Throg',
            targetName: 'Goblin1',
            saveDc: 16,
            saveType: 'WIS',
            success: false,
            saveRoll: 8,
            saveTotal: 10,
          })
        );
      });

      await waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'roll',
            characterName: 'Throg',
            rollType: 'damage',
            name: 'Hurl Through Hell Damage',
            targetName: 'Goblin1',
            damageType: 'Psychic',
            formula: '4d10',
            total: 22,
          })
        );
      });

      await waitFor(() => {
        expect(expirations.addExpiration).toHaveBeenCalledWith(
          'Throg',
          'Goblin1',
          [{ type: 'hurl_through_hell_return', target: 'Goblin1', source: 'Hurl Through Hell' }],
          'test-campaign',
          2
        );
      });

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
        const detail = handler.mock.calls[0][0].detail;
        expect(detail.targetName).toBe('Goblin1');
        expect(detail.sourceName).toBe('Throg');
        expect(detail.spellName).toBe('Hurl Through Hell');
        expect(detail.damageType).toBe('Psychic');
        expect(detail.rolls).toEqual([15, 7]);
        expect(detail.formula).toBe('4d10');
        expect(detail.popupText).toContain('failed WIS save');
      });

      window.removeEventListener('damage-popup', handler);

      await waitFor(() => {
        expect(screen.getByText(/failed.*WIS save/)).toBeInTheDocument();
      });
    });
  });

  // ── Failed save - fiend target ──

  describe('failed save - fiend target', () => {
    function setupFiendTarget() {
      runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'currentTurn') return 'Turn5';
        if (key === 'activeConditions') return [];
        return null;
      });
      combatData.getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Orc Warrior', type: 'npc', monsterType: 'fiend' },
          { name: 'Elf Mage', type: 'player' },
        ],
      });
    }

    it('applies incapacitated and target effect but not damage for fiend', async () => {
      const handler = vi.fn();
      window.addEventListener('damage-popup', handler);

      setupFiendTarget();
      renderModal({ targetName: 'Orc Warrior' });
      triggerConfirm();

      await dispatchSaveResult({
        promptId: 'test-prompt-id-123',
        roll: 8,
        total: 10,
        success: false,
      });

      await waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Orc Warrior',
          'activeConditions',
          expect.arrayContaining(['incapacitated']),
          'test-campaign'
        );
      });

      await waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'campaign',
          'targetEffects',
          expect.arrayContaining([
            expect.objectContaining({
              target: 'Orc Warrior',
              effect: 'incapacitated',
              teleport: true,
              returnToSpace: true,
            }),
          ]),
          'test-campaign'
        );
      });

      await waitFor(() => {
        expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'save_result',
            targetName: 'Orc Warrior',
            success: false,
            description: expect.stringContaining('Fiend'),
          })
        );
      });

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
        const detail = handler.mock.calls[0][0].detail;
        expect(detail.popupText).toContain('Fiend');
        expect(detail.popupText).toContain('no Psychic damage');
      });

      window.removeEventListener('damage-popup', handler);

      await waitFor(() => {
        expect(screen.getByText(/failed.*WIS save/)).toBeInTheDocument();
      });
    });
  });

  // ── Successful save ──

  describe('successful save', () => {
    it('applies no conditions, effects, or damage; logs success and shows popup', async () => {
      const handler = vi.fn();
      window.addEventListener('damage-popup', handler);

      renderModal();
      triggerConfirm();

      await dispatchSaveResult({
        promptId: 'test-prompt-id-123',
        roll: 15,
        total: 17,
        success: true,
      });

      await waitFor(() => {
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
          'Goblin1',
          'activeConditions',
          expect.any(Array),
          'test-campaign'
        );
      });

      await waitFor(() => {
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
          'campaign',
          'targetEffects',
          expect.any(Array),
          'test-campaign'
        );
      });

      await waitFor(() => {
        expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(expirations.addExpiration).not.toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'save_result',
            targetName: 'Goblin1',
            success: true,
            saveRoll: 15,
            saveTotal: 17,
          })
        );
      });

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail.popupText).toContain('succeeded');
      });

      window.removeEventListener('damage-popup', handler);

      await waitFor(() => {
        expect(screen.getByText(/succeeded.*WIS save/)).toBeInTheDocument();
      });
    });
  });
});
