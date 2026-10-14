import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin1', type: 'npc' },
      { name: 'Orc Warrior', type: 'fiend' },
      { name: 'Elf Mage', type: 'player' },
    ],
  })),
  getCurrentCombatRound: vi.fn(() => 5),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 22, rolls: [15, 7] })),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as applyDamage from '../../../services/rules/combat/applyDamage.js';

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

// ── Tests for error handling and fallback branches ──

describe('HurlThroughHellModal - error handling and fallback branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentTurn') return 'Turn5';
      if (key === 'activeConditions') return [];
      if (key === 'targetEffects') return [];
      if (key === 'spell_slots_level_2') return '3';
      return null;
    });
    diceRoller.rollExpression.mockImplementation(() => ({ total: 22, rolls: [15, 7] }));
    combatData.getCombatSummary.mockImplementation(() => ({
      creatures: [
        { name: 'Goblin1', type: 'npc' },
        { name: 'Orc Warrior', type: 'fiend' },
        { name: 'Elf Mage', type: 'player' },
      ],
    }));
    applyDamage.applyDamageToTarget.mockImplementation(() => ({ finalDamage: 22 }));
    runtimeState.setRuntimeValue.mockImplementation(() => Promise.resolve());
  });

  describe('round-keyed turn latch', () => {
    it('stamps the current combat round number (CLA-175)', async () => {
      runtimeState.getRuntimeValue.mockImplementation(() => null);

      render(<HurlThroughHellModal {...makeProps()} />);

      fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));

      await waitFor(() => {
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Throg',
          'hurlThroughHellTurnUsed',
          5,
          'test-campaign'
        );
      });
    });
  });
});
