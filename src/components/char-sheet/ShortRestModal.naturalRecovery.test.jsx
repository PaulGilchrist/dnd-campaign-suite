// @maintained-by-ai
// Natural Recovery lane: Druid/Ranger 2024 hit-dice-per-short-rest slot recovery UI
// wiring — gating flags, budget/disable states, CLA-232 merged-batch apply, once-per-
// long-rest consumption, stale-apply refusal, and consumed/re-armed display.
// Rest math itself lives in restRules-* services and is asserted there, not re-derived.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();
const setRuntimeBatchMock = vi.fn();

// Exactly the symbols ShortRestModal (and its unmocked tempHpService dependency) import.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getRuntimeValue: vi.fn((...args) => getRuntimeValueMock(...args)),
  setRuntimeValue: vi.fn((...args) => setRuntimeValueMock(...args)),
  setRuntimeBatch: vi.fn((...args) => setRuntimeBatchMock(...args)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: vi.fn((count, _die) => ({ total: count * 4, rolls: Array(count).fill(4) })),
}));

// REAL static-data producer for labels (restRules-constants.js passthrough — labels are
// strings, restRules-constants.js:41). This lane never asserts rest math.
vi.mock('../../services/rules/effects/restRules.js', async () => {
  const constants = await import('../../services/rules/effects/restRules-constants.js');
  return {
    getHitDieSize: vi.fn(() => 8),
    computeHitDieRecovery: vi.fn((roll, conBonus) => Math.max(1, roll + conBonus)),
    getShortRestResourceLabels: vi.fn((playerStats) => constants.getShortRestResourceLabels(playerStats)),
    applyShortRest: vi.fn(async () => ({})), // no celestialResilienceAllies -> picker never opens
  };
});

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({})),
}));

// Guards for lanes owned by other test files (sorcery restore, song of rest, memorize swap).
vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(() => 0),
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
  default: () => null,
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

// Land druid fixture with the natural_recovery passive (Circle of the Land lv6).
function druid(overrides = {}) {
  return {
    class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
    automation: { passives: [{ type: 'natural_recovery' }] },
    spellAbilities: { spell_slots_level_1: 4, spell_slots_level_2: 3, spells: [] },
    ...overrides,
  };
}

// Select N slots of `level` via the row's + button.
function tick(level, times) {
  const plusButtons = screen.getAllByRole('button', { name: '+' });
  const index = [1, 2, 3].indexOf(level);
  for (let i = 0; i < times; i++) fireEvent.click(plusButtons[index]);
}

describe('ShortRestModal - Natural Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValueMock.mockImplementation(() => null);
  });

  it('gates on Druid + natural_recovery passive: renders section with level/2 budget, hidden without the passive', () => {
    const { unmount } = renderModal({ ...druid(), level: 5 });
    expect(screen.getByRole('heading', { name: 'Natural Recovery' })).toBeInTheDocument();
    // Level 5 druid budget is computed by the modal itself: floor(5/2) = 2.
    expect(screen.getByText(/Budget: 2 of 2 levels remaining/)).toBeInTheDocument();
    unmount();

    renderModal({ ...druid({ automation: { passives: [] } }), level: 5 });
    expect(screen.queryByRole('heading', { name: 'Natural Recovery' })).not.toBeInTheDocument();
  });

  it('lists only slot levels with max > 0', () => {
    renderModal(druid({
      level: 10,
      spellAbilities: { spell_slots_level_1: 4, spell_slots_level_2: 0, spell_slots_level_3: 3, spells: [] },
    }));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(3); // header + level 1 + level 3
    expect(within(rows[1]).getByText('1')).toBeInTheDocument();
    expect(within(rows[2]).getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('tracks budget with + and minus: level-weighted cost, refund, and budget-driven disables', () => {
    setupGetRuntimeValue({ spell_slots_level_1: 2, spell_slots_level_2: 1, spell_slots_level_3: 1 });
    renderModal(druid({
      level: 5,
      spellAbilities: { spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 3, spells: [] },
    }));
    expect(screen.getByText(/Budget: 2 of 2 levels remaining/)).toBeInTheDocument();
    const plusButtons = screen.getAllByRole('button', { name: '+' });
    const minusButtons = screen.getAllByRole('button', { name: '-' });
    expect(plusButtons).toHaveLength(3);
    expect(minusButtons[0]).toBeDisabled(); // no selection yet

    // Level 3 row is unclickable at full budget: cost 3 > 2 (only reason; slots available).
    expect(plusButtons[2]).toBeDisabled();

    fireEvent.click(plusButtons[1]); // one level-2 slot spends 2 budget
    expect(screen.getByText(/Budget: 0 of 2 levels remaining/)).toBeInTheDocument();
    expect(plusButtons[0]).toBeDisabled(); // budget exhausted even though lv1 slots remain
    expect(plusButtons[1]).toBeDisabled();

    fireEvent.click(minusButtons[1]); // deselect refunds the level cost
    expect(screen.getByText(/Budget: 2 of 2 levels remaining/)).toBeInTheDocument();
    expect(plusButtons[1]).not.toBeDisabled();
  });

  it('disables + when the level\'s available slots are exhausted while budget remains', () => {
    setupGetRuntimeValue({ spell_slots_level_1: 2 });
    renderModal(druid({
      level: 10,
      spellAbilities: { spell_slots_level_1: 4, spells: [] },
    }));
    const plusButtons = screen.getAllByRole('button', { name: '+' });
    expect(plusButtons).toHaveLength(1);
    fireEvent.click(plusButtons[0]);
    fireEvent.click(plusButtons[0]); // available = max 4 - current 2
    expect(plusButtons[0]).toBeDisabled();
    expect(screen.getByText(/Budget: 3 of 5 levels remaining/)).toBeInTheDocument();
  });

  describe('CLA-232: apply, consumption, and stale refusal', () => {
    const landDruid = {
      ...druid(),
      level: 20,
      spellAbilities: {
        spell_slots_level_1: 4,
        spell_slots_level_2: 3,
        spell_slots_level_3: 3,
        spells: [],
      },
    };

    it('writes selected recoveries AND consumes the feature in ONE merged batch and logs the detail', async () => {
      setupGetRuntimeValue({ spell_slots_level_1: 0, spell_slots_level_2: 1, spell_slots_level_3: 2, naturalRecoverySlots: 10 });
      const { addEntry } = await import('../../services/ui/logService.js');
      renderModal(landDruid);
      tick(1, 4);
      tick(2, 2);
      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      // Exact merged payload: unselected lv3 must not be written.
      expect(setRuntimeBatchMock).toHaveBeenCalledTimes(1);
      expect(setRuntimeBatchMock).toHaveBeenCalledWith('Thorin', {
        spell_slots_level_1: 4,
        spell_slots_level_2: 3,
        naturalRecoverySlots: 0,
      }, mockCampaignName);
      // Defect A: the per-level setRuntimeValue loop must stay gone.
      const slotLoop = setRuntimeValueMock.mock.calls.filter(
        (call) => String(call[1]).startsWith('spell_slots_level_')
      );
      expect(slotLoop).toHaveLength(0);

      const log = addEntry.mock.calls.map(c => c[1]).find(e => e && e.type === 'short_rest');
      expect(log.message).toContain('Natural Recovery: 4x level 1, 2x level 2');
    });

    it('refuses a stale apply when the feature was spent between render and completion: refusal logged, zero slot writes, no success detail', async () => {
      setupGetRuntimeValue({ spell_slots_level_1: 0, spell_slots_level_2: 1, spell_slots_level_3: 2, naturalRecoverySlots: 10 });
      renderModal(landDruid);
      tick(1, 2);
      // Feature consumed out-of-band between tick and Complete — gate reads FRESH runtime.
      setupGetRuntimeValue({ spell_slots_level_1: 0, spell_slots_level_2: 1, spell_slots_level_3: 2, naturalRecoverySlots: 0 });
      const { addEntry } = await import('../../services/ui/logService.js');
      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
        type: 'automation',
        automationType: 'natural_recovery_refused',
        characterName: 'Thorin',
        description: expect.stringContaining('already used since the last long rest'),
      }));
      expect(setRuntimeBatchMock).not.toHaveBeenCalled();
      const slotWrites = setRuntimeValueMock.mock.calls.filter(
        (call) => String(call[1]).startsWith('spell_slots_level_')
      );
      expect(slotWrites).toHaveLength(0);
      const log = addEntry.mock.calls.map(c => c[1]).find(e => e && e.type === 'short_rest');
      expect(log.message).not.toContain('Natural Recovery:');
    });

    it('shows consumed state with no live controls at naturalRecoverySlots 0 and re-arms on null (long rest reset)', () => {
      setupGetRuntimeValue({ spell_slots_level_1: 2, spell_slots_level_2: 2, naturalRecoverySlots: 0 });
      const { unmount } = renderModal(landDruid);
      expect(screen.getByRole('heading', { name: 'Natural Recovery' })).toBeInTheDocument();
      expect(screen.getByText('Already used since the last long rest')).toBeInTheDocument();
      expect(screen.queryByText(/Budget: \d+ of \d+ levels remaining/)).not.toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: '+' })).toHaveLength(0);
      expect(screen.queryAllByRole('button', { name: '-' })).toHaveLength(0);
      unmount();

      setupGetRuntimeValue({ spell_slots_level_1: 2, spell_slots_level_2: 2, naturalRecoverySlots: null });
      renderModal(landDruid);
      expect(screen.getByText(/Budget: 10 of 10 levels remaining/)).toBeInTheDocument();
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      expect(plusButtons[0]).not.toBeDisabled();
    });
  });
});
