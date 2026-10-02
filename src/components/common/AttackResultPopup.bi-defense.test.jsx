// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AttackResultPopup from './AttackResultPopup.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../services/ui/logService.js';

// ── Mock dependencies ──

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Helpers ──

function renderPopup(props = {}) {
  const defaultProps = {
    popupHtml: { name: 'Test Attack', type: 'd20', rolls: [15], bonus: 3, hit: true },
    onClose: vi.fn(),
    campaignName: 'test-campaign',
    attackerName: 'PlayerOne',
    setPopupHtml: vi.fn(),
    ...props,
  };
  return render(<AttackResultPopup {...defaultProps} />);
}

// ── Tests ──

describe('AttackResultPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Bardic Inspiration Defense ──

  describe('bardic inspiration defense', () => {
    it('renders BI Defense button when bardicInspirationDefense is true', () => {
      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
        },
        onClose: vi.fn(),
      });

      expect(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i })).toBeInTheDocument();
    });

    it('invokes onBeforeBiDefense and onAfterBiDefense callbacks with correct arguments', async () => {
      const onBeforeBiDefense = vi.fn().mockResolvedValue(undefined);
      const onAfterBiDefense = vi.fn().mockResolvedValue(undefined);

      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'bardicInspirationUses') return { current: 1 };
        return null;
      });

      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
          targetAc: 25,
        },
        onBeforeBiDefense,
        onAfterBiDefense,
        campaignName: 'test-campaign',
        onClose: vi.fn(),
      });

      fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

      await waitFor(() => {
        expect(onBeforeBiDefense).toHaveBeenCalledTimes(1);
        expect(onAfterBiDefense).toHaveBeenCalledTimes(1);
      });

      const [beforeArgs] = onBeforeBiDefense.mock.calls[0];
      expect(beforeArgs).toMatchObject({ targetName: 'Bard', willMiss: true });

      const [afterArgs] = onAfterBiDefense.mock.calls[0];
      expect(afterArgs).toMatchObject({ targetName: 'Bard', willMiss: true });
    });

    it('skips onBeforeBiDefense and onAfterBiDefense when not provided', async () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'bardicInspirationUses') return { current: 1 };
        return null;
      });

      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
        },
        campaignName: 'test-campaign',
        onClose: vi.fn(),
      });

      fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationDie', null, 'test-campaign');
      });
    });

    it('does NOT decrement the numeric pool on self-granted defense (grant already paid the pool)', async () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'bardicInspirationUses') return 3;
        if (prop === 'bardicInspirationGrantedBy') return 'Bard';
        return null;
      });

      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
        },
        campaignName: 'test-campaign',
        onClose: vi.fn(),
      });

      fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationDie', null, 'test-campaign');
      });
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Bard', 'bardicInspirationUses', expect.any(Number), 'test-campaign');
    });

    it('decrements bardicInspirationUses for number, object, and string formats when > 0', async () => {
      // Number format
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'bardicInspirationUses') return 3;
        return null;
      });

      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
        },
        campaignName: 'test-campaign',
        onClose: vi.fn(),
      });

      fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationUses', 2, 'test-campaign');
      });

      vi.clearAllMocks();

      // Object format
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'bardicInspirationUses') return { current: 2 };
        return null;
      });

      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
        },
        campaignName: 'test-campaign',
        onClose: vi.fn(),
      });

      fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationUses', 1, 'test-campaign');
      });

      vi.clearAllMocks();

      // String format
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'bardicInspirationUses') return '5';
        return null;
      });

      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
        },
        campaignName: 'test-campaign',
        onClose: vi.fn(),
      });

      fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationUses', 4, 'test-campaign');
      });
    });

    it('does NOT decrement bardicInspirationUses when current is 0 or null', async () => {
      const cases = [
        { desc: 'number 0', value: 0 },
        { desc: 'object { current: 0 }', value: { current: 0 } },
        { desc: 'null', value: null },
        { desc: 'string "0"', value: '0' },
        { desc: 'negative', value: -1 },
      ];

      for (const { value } of cases) {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_key, prop) => {
          if (prop === 'bardicInspirationUses') return value;
          return null;
        });

        renderPopup({
          popupHtml: {
            name: 'Test Attack',
            type: 'd20',
            rolls: [18],
            bonus: 3,
            hit: true,
            bardicInspirationDefense: true,
            bardicInspirationDefenseTargetName: 'Bard',
          },
          campaignName: 'test-campaign',
          onClose: vi.fn(),
        });

        fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

        await waitFor(() => {
          const calls = setRuntimeValue.mock.calls.filter((c) => c[1] === 'bardicInspirationUses');
          expect(calls).toHaveLength(0);
        });
      }
    });

    it('sets popupHtml to hit:false/isAutoMiss:true when willMiss is true', async () => {
      const setPopupHtml = vi.fn();

      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'bardicInspirationUses') return { current: 1 };
        return null;
      });

      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
          targetAc: 25,
        },
        setPopupHtml,
        campaignName: 'test-campaign',
        onClose: vi.fn(),
      });

      fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

      await waitFor(() => {
        expect(setPopupHtml).toHaveBeenCalledTimes(1);
      });

      const updatedHtml = setPopupHtml.mock.calls[0][0];
      expect(updatedHtml.hit).toBe(false);
      expect(updatedHtml.isAutoMiss).toBe(true);
      expect(updatedHtml.name).toBe('Test Attack');
    });

    it('does NOT call setPopupHtml when willMiss is false', async () => {
      const setPopupHtml = vi.fn();

      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'bardicInspirationUses') return { current: 1 };
        return null;
      });

      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
          targetAc: 0,
        },
        setPopupHtml,
        campaignName: 'test-campaign',
        onClose: vi.fn(),
      });

      fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

      await waitFor(() => {
        expect(setPopupHtml).not.toHaveBeenCalled();
      });
    });

    it('logs an ability_use entry with attacker-aware description', async () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'bardicInspirationUses') return { current: 1 };
        return null;
      });

      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
          targetAc: 25,
        },
        campaignName: 'test-campaign',
        attackerName: 'Goblin',
        onClose: vi.fn(),
      });

      fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

      await waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalledTimes(1);
      });

      const [, logArgs] = logService.addEntry.mock.calls[0];
      expect(logArgs.type).toBe('ability_use');
      expect(logArgs.characterName).toBe('Bard');
      expect(logArgs.abilityName).toBe('Combat Inspiration - Defense');
      expect(logArgs.biDieRoll).toBeDefined();
      expect(typeof logArgs.biDieRoll).toBe('number');
      expect(logArgs.timestamp).toBeDefined();
    });

    it('resets bardicInspirationDie, bardicInspirationCombatOptions, bardicInspirationGrantedBy after defense', async () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'bardicInspirationUses') return { current: 1 };
        return null;
      });

      renderPopup({
        popupHtml: {
          name: 'Test Attack',
          type: 'd20',
          rolls: [18],
          bonus: 3,
          hit: true,
          bardicInspirationDefense: true,
          bardicInspirationDefenseTargetName: 'Bard',
          targetAc: 25,
        },
        campaignName: 'test-campaign',
        onClose: vi.fn(),
      });

      fireEvent.click(screen.getByRole('button', { name: /Bardic Inspiration - Defense/i }));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationDie', null, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationCombatOptions', null, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationGrantedBy', null, 'test-campaign');
      });
    });
  });
});
