// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();
const setRuntimeBatchMock = vi.fn();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  useRuntimeValue: vi.fn(() => null),
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
  SHORT_REST_RESOURCES: ['spell_slots_level_1', 'spell_slots_level_2'],
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

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: ({ title, description, note, confirmLabel }) => (
    <div className="creature-selection-mock">
      <span>{title}</span>
      <span>{description}</span>
      <span>{note}</span>
      <span>{confirmLabel}</span>
      <button data-testid="creature-confirm">Confirm</button>
      <button data-testid="creature-skip">Skip</button>
    </div>
  ),
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
      { name: 'Wisdom', bonus: 2 },
    ],
    class: { name: 'Cleric', major: { name: 'Cleric' } },
    automation: { passives: [], actions: [] },
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spells: [{ name: 'Healing Word', prepared: 'Prepared' }],
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

describe('ShortRestModal - Natural Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValueMock.mockImplementation(() => null);
  });

  describe('rendering', () => {
    it('renders Natural Recovery section for Druid with Circle of the Land subclass', () => {
      renderModal({
        class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        spellAbilities: { spell_slots_level_1: 4, spell_slots_level_2: 3, spells: [] },
      });
      expect(screen.getByText('Natural Recovery')).toBeInTheDocument();
    });

    it('shows correct max budget based on druid level', () => {
      // Level 5 druid: Math.floor(5/2) = 2
      renderModal({
        level: 5,
        class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        spellAbilities: { spell_slots_level_1: 4, spell_slots_level_2: 3, spells: [] },
      });
      expect(screen.getByText(/Budget: 2 of 2 levels remaining/)).toBeInTheDocument();
    });

    it('shows only slot levels with max > 0', () => {
      renderModal({
        level: 10,
        class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 0,
          spell_slots_level_3: 3,
          spells: [],
        },
      });
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.queryByText('2')).not.toBeInTheDocument();
    });
  });

  describe('slot selection', () => {
    it('increments selection count with + button', () => {
      setupGetRuntimeValue({ spell_slots_level_1: 2, spell_slots_level_2: 1 });
      renderModal({
        level: 10,
        class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spells: [],
        },
      });
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      expect(plusButtons[0]).not.toBeDisabled();
      fireEvent.click(plusButtons[0]);
      expect(screen.getByText(/Budget: 4 of 5 levels remaining/)).toBeInTheDocument();
    });

    it('disables minus button when selection count is 0', () => {
      setupGetRuntimeValue({ spell_slots_level_1: 2 });
      renderModal({
        level: 10,
        class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        spellAbilities: {
          spell_slots_level_1: 4,
          spells: [],
        },
      });
      const minusButtons = screen.getAllByRole('button', { name: '-' });
      expect(minusButtons[0]).toBeDisabled();
    });

    it('disables + button when all available slots are selected', () => {
      setupGetRuntimeValue({ spell_slots_level_1: 2 });
      renderModal({
        level: 10,
        class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        spellAbilities: {
          spell_slots_level_1: 4,
          spells: [],
        },
      });
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      // Available = 4 - 2 = 2, click + twice to exhaust
      fireEvent.click(plusButtons[0]);
      fireEvent.click(plusButtons[0]);
      expect(plusButtons[0]).toBeDisabled();
    });

    it('disables + button when budget is insufficient for slot level', () => {
      setupGetRuntimeValue({ spell_slots_level_3: 1 });
      renderModal({
        level: 5,
        class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 3,
          spells: [],
        },
      });
      // Level 3 costs 3 budget, max budget is 2 (Math.floor(5/2))
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      // Level 3 plus button is the third one (indices 0, 1, 2)
      expect(plusButtons[2]).toBeDisabled();
    });

    it('updates budget display when a slot is selected', () => {
      setupGetRuntimeValue({ spell_slots_level_1: 2, spell_slots_level_2: 1 });
      renderModal({
        level: 10,
        class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spells: [],
        },
      });
      expect(screen.getByText(/Budget: 5 of 5 levels remaining/)).toBeInTheDocument();
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      fireEvent.click(plusButtons[0]);
      expect(screen.getByText(/Budget: 4 of 5 levels remaining/)).toBeInTheDocument();
    });

    it('uses correct budget calculation: level * count', () => {
      setupGetRuntimeValue({ spell_slots_level_1: 2, spell_slots_level_2: 1 });
      renderModal({
        level: 10,
        class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spells: [],
        },
      });
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      // Select 2x level 2 slots = 4 budget used (level 2 x count 2)
      fireEvent.click(plusButtons[1]);
      fireEvent.click(plusButtons[1]);
      expect(screen.getByText(/Budget: 1 of 5 levels remaining/)).toBeInTheDocument();
    });

    it('clears selection when count goes back to 0', () => {
      setupGetRuntimeValue({ spell_slots_level_1: 2, spell_slots_level_2: 1 });
      renderModal({
        level: 10,
        class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spells: [],
        },
      });
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      const minusButtons = screen.getAllByRole('button', { name: '-' });
      fireEvent.click(plusButtons[0]);
      expect(screen.getByText(/Budget: 4 of 5 levels remaining/)).toBeInTheDocument();
      fireEvent.click(minusButtons[0]);
      expect(screen.getByText(/Budget: 5 of 5 levels remaining/)).toBeInTheDocument();
    });
  });

  describe('CLA-232: apply + consumption', () => {
    const landDruid = {
      level: 20,
      class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
      automation: { passives: [{ type: 'natural_recovery' }] },
      spellAbilities: {
        spell_slots_level_1: 4,
        spell_slots_level_2: 3,
        spell_slots_level_3: 3,
        spells: [],
      },
    };

    function tick(level, times) {
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      const index = [1, 2, 3].indexOf(level);
      for (let i = 0; i < times; i++) fireEvent.click(plusButtons[index]);
    }

    it('writes lv1+lv2 recoveries AND consumes naturalRecoverySlots in ONE merged batch', async () => {
      setupGetRuntimeValue({ spell_slots_level_1: 0, spell_slots_level_2: 1, spell_slots_level_3: 2, naturalRecoverySlots: 10 });
      renderModal(landDruid);
      tick(1, 4);
      tick(2, 2);
      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});
      const batchCall = setRuntimeBatchMock.mock.calls.find(
        (call) => call[1] && typeof call[1] === 'object'
          && 'spell_slots_level_1' in call[1] && 'spell_slots_level_2' in call[1]
      );
      expect(batchCall).toBeDefined();
      expect(batchCall[1].spell_slots_level_1).toBe(4);
      expect(batchCall[1].spell_slots_level_2).toBe(3);
      expect(batchCall[1].naturalRecoverySlots).toBe(0);
      // Defect A: the per-level setRuntimeValue loop must be gone.
      const slotLoop = setRuntimeValueMock.mock.calls.filter(
        (call) => String(call[1]).startsWith('spell_slots_level_')
      );
      expect(slotLoop).toHaveLength(0);
    });

    it('logs the recovery detail on a successful apply', async () => {
      setupGetRuntimeValue({ spell_slots_level_1: 0, spell_slots_level_2: 1, spell_slots_level_3: 2, naturalRecoverySlots: 10 });
      const { addEntry } = await import('../../services/ui/logService.js');
      renderModal(landDruid);
      tick(1, 4);
      tick(2, 2);
      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});
      const log = addEntry.mock.calls.map(c => c[1]).find(e => e && e.type === 'short_rest');
      expect(log.message).toContain('Natural Recovery: 4x level 1, 2x level 2');
    });

    it('shows the consumed state and refuses a stale apply with zero runtime change', async () => {
      setupGetRuntimeValue({ spell_slots_level_1: 0, spell_slots_level_2: 1, spell_slots_level_3: 2, naturalRecoverySlots: 10 });
      renderModal(landDruid);
      tick(1, 2);
      // Feature consumed out-of-band between tick and Complete.
      setupGetRuntimeValue({ spell_slots_level_1: 0, spell_slots_level_2: 1, spell_slots_level_3: 2, naturalRecoverySlots: 0 });
      const { addEntry } = await import('../../services/ui/logService.js');
      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});
      const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e && e.automationType === 'natural_recovery_refused');
      expect(refusal).toBeDefined();
      const slotBatch = setRuntimeBatchMock.mock.calls.filter(
        (call) => call[1] && typeof call[1] === 'object' && 'spell_slots_level_1' in call[1]
      );
      expect(slotBatch).toHaveLength(0);
      const log = addEntry.mock.calls.map(c => c[1]).find(e => e && e.type === 'short_rest');
      expect(log.message).not.toContain('Natural Recovery:');
    });

    it('renders unavailable section (no live + buttons) when naturalRecoverySlots is 0', () => {
      setupGetRuntimeValue({ spell_slots_level_1: 2, spell_slots_level_2: 2, naturalRecoverySlots: 0 });
      renderModal(landDruid);
      expect(screen.getByText('Natural Recovery')).toBeInTheDocument();
      expect(screen.getByText(/Already used since the last long rest/)).toBeInTheDocument();
      expect(screen.queryByText(/Budget: \d+ of 10 levels remaining/)).not.toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: '+' })).toHaveLength(0);
    });

    it('re-arms when naturalRecoverySlots is null (long rest reset)', () => {
      setupGetRuntimeValue({ spell_slots_level_1: 2, spell_slots_level_2: 2, naturalRecoverySlots: null });
      renderModal(landDruid);
      expect(screen.getByText(/Budget: 10 of 10 levels remaining/)).toBeInTheDocument();
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      expect(plusButtons[1]).not.toBeDisabled();
    });
  });
});
