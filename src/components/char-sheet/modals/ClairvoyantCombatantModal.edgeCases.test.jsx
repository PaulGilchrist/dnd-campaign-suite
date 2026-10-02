// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  clearRuntimeState: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const baseAction = { name: 'Clairvoyant Combatant' };
const basePlayerStats = { name: 'Paladin1', level: 5 };

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  targetName: 'Goblin1',
  saveType: 'Wisdom',
  saveDc: 13,
  currentUses: 0,
  maxUses: 3,
  pactSlotLevel: 0,
  pactSlotsAvailable: false,
  pactMagicRecharge: false,
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(props) {
  return render(<ClairvoyantCombatantModal {...props} />);
}

// ── beforeEach ──

describe('ClairvoyantCombatantModal - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useRuntimeState.clearRuntimeState('campaign');
    useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') return [];
      if (key === 'Paladin1' && prop === 'activeBuffs') return [];
      return null;
    });
    useRuntimeState.setRuntimeValue.mockImplementation(() => Promise.resolve());
  });

  // ── targetEffects with existing effects ──

  describe('targetEffects with existing effects', () => {
    it('preserves existing targetEffects when adding new clairvoyant_combatant', async () => {
      const existingEffect = {
        target: 'OtherCreature',
        source: 'OtherSource',
        effect: 'other_effect',
      };
      useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return [existingEffect];
        return null;
      });
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        const calls = useRuntimeState.setRuntimeValue.mock.calls;
        const teCall = calls.find(
          c => c[0] === 'campaign' && c[1] === 'targetEffects'
        );
        expect(teCall).toBeDefined();
        expect(teCall[2]).toContainEqual(existingEffect);
        expect(teCall[2]).toContainEqual(expect.objectContaining({
          target: 'Goblin1',
          source: 'Clairvoyant Combatant',
          effect: 'clairvoyant_combatant',
        }));
      });
    });

    it('filters only matching clairvoyant_combatant effects on success save', async () => {
      const matchingEffect = {
        target: 'Goblin1',
        source: 'Clairvoyant Combatant',
        effect: 'clairvoyant_combatant',
      };
      const otherEffect = {
        target: 'Goblin1',
        source: 'OtherSource',
        effect: 'other_effect',
      };
      const differentTargetEffect = {
        target: 'OtherCreature',
        source: 'Clairvoyant Combatant',
        effect: 'clairvoyant_combatant',
      };
      useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return [matchingEffect, otherEffect, differentTargetEffect];
        return null;
      });
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      // Simulate save success event
      const successEvent = new CustomEvent('save-result', {
        detail: {
          promptId: 'test-prompt-id',
          roll: 10,
          total: 15,
          success: true,
        },
      });
      window.dispatchEvent(successEvent);

      await waitFor(() => {
        const calls = useRuntimeState.setRuntimeValue.mock.calls;
        const teCalls = calls.filter(
          c => c[0] === 'campaign' && c[1] === 'targetEffects'
        );
        // Get the last call (from handleSaveResult filtering)
        const lastTeCall = teCalls[teCalls.length - 1];
        expect(lastTeCall[2]).toContainEqual(otherEffect);
        expect(lastTeCall[2]).toContainEqual(differentTargetEffect);
        expect(lastTeCall[2]).not.toContainEqual(matchingEffect);
      });
    });
  });

  // ── activeBuffs edge cases ──

  describe('activeBuffs edge cases', () => {
    it('preserves existing activeBuffs when adding new clairvoyant_combatant', async () => {
      const existingBuff = {
        name: 'Blessing',
        effect: 'blessing',
      };
      useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return [];
        if (key === 'Paladin1' && prop === 'activeBuffs') return [existingBuff];
        return null;
      });
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        // CLA-053: buffs ride the merged setRuntimeObject payload (§39)
        const objCall = useRuntimeState.setRuntimeObject.mock.calls.find(
          c => c[0] === 'Paladin1'
        );
        expect(objCall).toBeDefined();
        expect(objCall[1].activeBuffs).toContainEqual(existingBuff);
        expect(objCall[1].activeBuffs).toContainEqual(expect.objectContaining({
          effect: 'clairvoyant_combatant',
        }));
      });
    });

    it('removes only matching clairvoyant_combatant buffs on success save', async () => {
      const matchingBuff = {
        name: 'Clairvoyant Combatant',
        effect: 'clairvoyant_combatant',
        target: 'Goblin1',
      };
      const otherBuff = {
        name: 'Blessing',
        effect: 'blessing',
        target: 'Goblin1',
      };
      // Use a mutable store so getRuntimeValue reflects merged writes (§39)
      const store = { activeBuffs: [matchingBuff, otherBuff] };
      useRuntimeState.getRuntimeValue.mockImplementation((key, prop, _campaign) => {
        if (key === 'campaign' && prop === 'targetEffects') return [];
        if (key === 'Paladin1' && prop === 'activeBuffs') return store.activeBuffs;
        return null;
      });
      useRuntimeState.setRuntimeObject.mockImplementation((player, obj) => {
        if (player === 'Paladin1' && Array.isArray(obj.activeBuffs)) {
          store.activeBuffs = obj.activeBuffs;
        }
      });
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      // Simulate save success event
      const successEvent = new CustomEvent('save-result', {
        detail: {
          promptId: 'test-prompt-id',
          roll: 10,
          total: 15,
          success: true,
        },
      });
      window.dispatchEvent(successEvent);

      await waitFor(() => {
        // CLA-053: success filtering writes through the merged setRuntimeObject
        const calls = useRuntimeState.setRuntimeObject.mock.calls.filter(
          c => c[0] === 'Paladin1' && Array.isArray(c[1]?.activeBuffs)
        );
        const lastBuffs = calls[calls.length - 1][1].activeBuffs;
        expect(lastBuffs).toContainEqual(otherBuff);
        expect(lastBuffs).not.toContainEqual(matchingBuff);
      });
    });
  });
});
