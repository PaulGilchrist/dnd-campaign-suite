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
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';

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

describe('ClairvoyantCombatantModal - confirm flow', () => {
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

  // ── Confirm with uses available ──

  describe('confirm with uses available', () => {
    it('increments clairvoyantCombatantUses when hasUse is true', async () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        // CLA-053: player-store keys ride ONE merged setRuntimeObject (§39)
        expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
          'Paladin1',
          expect.objectContaining({ clairvoyantCombatantUses: 2 }),
          'test-campaign',
        );
      });
    });

    it('adds clairvoyant_combatant targetEffect to campaign', async () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        const calls = useRuntimeState.setRuntimeValue.mock.calls;
        const teCall = calls.find(
          c => c[0] === 'campaign' && c[1] === 'targetEffects'
        );
        expect(teCall).toBeDefined();
        expect(teCall[2]).toContainEqual(expect.objectContaining({
          target: 'Goblin1',
          source: 'Clairvoyant Combatant',
          effect: 'clairvoyant_combatant',
          attackerAdvantage: true,
          defenderDisadvantage: true,
        }));
      });
    });

    it('sets clairvoyantCombatantTarget on player stats', async () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
          'Paladin1',
          expect.objectContaining({ clairvoyantCombatantTarget: 'Goblin1' }),
          'test-campaign',
        );
      });
    });

    it('adds clairvoyant_combatant to activeBuffs', async () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        const objCall = useRuntimeState.setRuntimeObject.mock.calls.find(
          c => c[0] === 'Paladin1'
        );
        expect(objCall).toBeDefined();
        expect(objCall[1].activeBuffs).toContainEqual(expect.objectContaining({
          name: 'Clairvoyant Combatant',
          effect: 'clairvoyant_combatant',
          target: 'Goblin1',
        }));
      });
    });

    it('creates save listener with correct parameters', async () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
          targetName: 'Goblin1',
          saveType: 'Wisdom',
          saveDc: 13,
        });
      });
    });

    it('adds ability_use log entry with save prompt info', async () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        const abilityCalls = addEntry.mock.calls.filter(
          c => c[1] && c[1].type === 'ability_use'
        );
        expect(abilityCalls.length).toBeGreaterThan(0);
        const match = abilityCalls.find(
          c => c[1].characterName === 'Paladin1'
            && c[1].abilityName === 'Clairvoyant Combatant'
            && c[1].targetName === 'Goblin1'
            && c[1].description.includes('Awakened Mind')
            && c[1].description.includes('Wisdom save')
            && c[1].description.includes('DC 13')
        );
        expect(match).toBeDefined();
      });
    });

    it('attaches save-result event listener on confirm', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
      });
      addEventListenerSpy.mockRestore();
    });
  });

  // ── Confirm with Pact Magic expenditure ──

  describe('confirm with Pact Magic expenditure', () => {
    it('expends Pact Magic slot when no uses but pactMagicRecharge and pactSlotsAvailable', async () => {
      const props = makeProps({
        currentUses: 3,
        maxUses: 3,
        pactMagicRecharge: true,
        pactSlotLevel: 2,
        pactSlotsAvailable: true,
      });
      useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return [];
        if (key === 'Paladin1' && prop === 'activeBuffs') return [];
        if (key === 'Paladin1' && prop === 'spell_slots_level_2') return 3;
        return null;
      });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
          'Paladin1',
          expect.objectContaining({ spell_slots_level_2: 2 }),
          'test-campaign',
        );
      });
    });

    it('logs both Pact Magic and ability_use entries when expending Pact Magic slot', async () => {
      const props = makeProps({
        currentUses: 3,
        maxUses: 3,
        pactMagicRecharge: true,
        pactSlotLevel: 2,
        pactSlotsAvailable: true,
      });
      useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return [];
        if (key === 'Paladin1' && prop === 'activeBuffs') return [];
        if (key === 'Paladin1' && prop === 'spell_slots_level_2') return 3;
        return null;
      });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await waitFor(() => {
        const abilityCalls = addEntry.mock.calls.filter(
          c => c[1] && c[1].type === 'ability_use'
        );
        expect(abilityCalls.length).toBeGreaterThan(1);
        const pactLog = abilityCalls.find(
          c => c[1].description.includes('Pact Magic')
        );
        const saveLog = abilityCalls.find(
          c => c[1].description.includes('Awakened Mind')
        );
        expect(pactLog).toBeDefined();
        expect(saveLog).toBeDefined();
      });
    });
  });
});
