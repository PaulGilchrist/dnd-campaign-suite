// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();
const setRuntimeBatchMock = vi.fn();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  useRuntimeValue: () => null,
  listeners: new Map(),
  getRuntimeValue: vi.fn((...args) => getRuntimeValueMock(...args)),
  setRuntimeValue: vi.fn((...args) => setRuntimeValueMock(...args)),
  setRuntimeBatch: vi.fn((...args) => setRuntimeBatchMock(...args)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: vi.fn((count, _die) => ({ total: count * 4, rolls: Array(count).fill(4) })),
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  getHitDieSize: vi.fn(() => 8),
  computeHitDieRecovery: vi.fn((roll, conBonus) => roll + conBonus),
  SHORT_REST_RESOURCES: ['channelDivinityCharges', 'wildShapeUses'],
  getShortRestResourceLabels: vi.fn(() => ['Spell Slots (1st+)', 'Hit Dice']),
  clearHuntersMarkConcentration: vi.fn(),
  applyShortRest: vi.fn(async () => ({})),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ songOfRestDie: 6 })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(() => 2),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(() => null),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpellData: vi.fn(() => Promise.resolve([])),
}));

const addEntryMock = vi.hoisted(() => vi.fn(() => Promise.resolve({})));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: addEntryMock,
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: () => <div>mock-creature-selection</div>,
}));

const mockCampaignName = 'test-campaign';

function createPlayerStats(overrides = {}) {
  return {
    name: 'Thorin',
    level: 5,
    hitPoints: 45,
    proficiency: 3,
    abilities: [
      { name: 'Constitution', bonus: 2 },
      { name: 'Charisma', bonus: 3 },
    ],
    class: { name: 'Cleric', major: { name: 'Cleric' } },
    automation: { passives: [], actions: [] },
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spells: [],
    },
    inventory: { equipped: [] },
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  const playerStats = createPlayerStats(overrides);
  const onClose = vi.fn();
  const onComplete = vi.fn();
  const rendered = render(
    <ShortRestModal
      playerStats={playerStats}
      campaignName={mockCampaignName}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
  return { ...rendered, onClose, onComplete, playerStats };
}

function setupGetRuntimeValue(returns) {
  getRuntimeValueMock.mockImplementation((_name, key) => {
    if (key in returns) return returns[key];
    return null;
  });
}

function firstLogMessage() {
  expect(addEntryMock.mock.calls.length).toBeGreaterThan(0);
  const logCall = addEntryMock.mock.calls[0][1];
  return logCall.message;
}

function expectLogContains(text) {
  const message = firstLogMessage();
  expect(message).toContain(text);
}

describe('ShortRestModal - Completion Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValueMock.mockImplementation(() => null);
  });

  describe('HP tracking', () => {
    it('updates currentHitPoints on completion after rolling hit dice', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/i }));
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      const hpCalls = setRuntimeValueMock.mock.calls.filter(
        (call) => call[1] === 'currentHitPoints'
      );
      expect(hpCalls.length).toBe(1);
      expect(hpCalls[0][2]).toBeLessThanOrEqual(45);
    });
  });

  describe('log entries', () => {
    it('calls addEntry with short_rest type on completion', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/i }));
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      expect(addEntryMock).toHaveBeenCalled();
      expect(addEntryMock.mock.calls[0][1].type).toBe('short_rest');
    });

    it('includes hit dice details in log when dice were rolled', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/i }));
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      expectLogContains('Hit Dice:');
      expectLogContains('HP recovered');
    });
  });

  describe('resource restoration logging', () => {
    it('logs Second Wind for Fighter when not at max', async () => {
      setupGetRuntimeValue({ secondWindUses: 0 });
      renderModal({
        class: {
          name: 'Fighter',
          major: { name: 'Fighter' },
          class_levels: [{ level: 5, second_wind: 1 }],
        },
      });
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      expectLogContains('Second Wind');
    });

    it('logs Rage (2024) for Barbarian 2024 when not at max', async () => {
      setupGetRuntimeValue({ ragePoints: 0 });
      renderModal({
        rules: '2024',
        class: {
          name: 'Barbarian',
          major: { name: 'Barbarian' },
          class_levels: [{ level: 5, rages: 2 }],
        },
      });
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      expectLogContains('Rage (2024)');
    });

    it('logs Warding Flare when Improved Warding Flare feature exists', async () => {
      renderModal({
        specialActions: [{ name: 'Improved Warding Flare' }],
      });
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      expectLogContains('Warding Flare');
    });

    // CLA-145: pin inverted — the old version asserted the false "Resources
    // restored: Bardic Inspiration" label with no runtime write. The label
    // must now ride the actual restore (applyShortRest's write seam).
    it('logs Font of Inspiration only when a below-max pool was restored', async () => {
      setupGetRuntimeValue({ bardicInspirationUses: 0 });
      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({ fontOfInspirationRestored: true });
      renderModal({
        class: { name: 'Bard', major: { name: 'Bard' } },
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      });
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      expectLogContains('Bardic Inspiration (Font of Inspiration)');
    });

    it('does not log Font of Inspiration restored when nothing was written', async () => {
      setupGetRuntimeValue({ bardicInspirationUses: 3 });
      renderModal({
        class: { name: 'Bard', major: { name: 'Bard' } },
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      });
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      const message = firstLogMessage();
      expect(message).not.toContain('Bardic Inspiration');
      expect(message).toContain('takes a short rest');
    });

    it('logs Pact Magic for Warlock', async () => {
      renderModal({
        class: { name: 'Warlock', major: { name: 'Archfey' } },
      });
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      expectLogContains('Pact Magic');
    });

    it('logs Bolstering Treats when feature exists', async () => {
      renderModal({
        automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
      });
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      expectLogContains('Bolstering Treats');
    });

    it('logs Tireless for Ranger level 10+ with exhaustion', async () => {
      setupGetRuntimeValue({ exhaustionLevel: 1 });
      renderModal({
        class: { name: 'Ranger', major: { name: 'Ranger' } },
        level: 10,
      });
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
      await act(() => Promise.resolve());

      expectLogContains('Tireless');
    });
  });
});
