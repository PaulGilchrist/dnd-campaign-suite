import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();
const setRuntimeBatchMock = vi.fn();
const setTempHpMock = vi.fn();
let _useRuntimeValueResult = null;

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  useRuntimeValue: () => _useRuntimeValueResult,
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
  SHORT_REST_RESOURCES: [],
  getShortRestResourceLabels: vi.fn(() => []),
  clearHuntersMarkConcentration: vi.fn(),
  applyShortRest: vi.fn(async () => ({})),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({})),
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

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn((...args) => setTempHpMock(...args)),
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: ({ title, description, note, confirmLabel, onConfirm, onSkip, targets, maxTargets }) => (
    <div data-testid="creature-selection-modal">
      <span data-testid="modal-title">{title}</span>
      <span data-testid="modal-description">{description}</span>
      <span data-testid="modal-note">{note}</span>
      {targets.map((target) => (
        <button
          key={target.name}
          data-testid={`target-${target.name}`}
          onClick={() => {}}
        >
          {target.name}
        </button>
      ))}
      <span data-testid="max-targets">{maxTargets}</span>
      {confirmLabel && (
        <button data-testid="confirm-button" onClick={() => onConfirm(['Ally1'])}>
          {confirmLabel}
        </button>
      )}
      {onSkip && (
        <button data-testid="skip-button" onClick={onSkip}>
          Skip
        </button>
      )}
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
    ],
    class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
    automation: { passives: [] },
    specialActions: [{ name: 'Celestial Resilience' }],
    spellAbilities: { spells: [] },
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

describe('ShortRestModal - Celestial Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValueMock.mockImplementation(() => null);
    _useRuntimeValueResult = null;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('renders the modal for a Warlock with Celestial Patron subclass', () => {
      renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [{ name: 'Celestial Resilience' }],
      });
      expect(screen.getByText('Short Rest')).toBeInTheDocument();
    });

    it('does not show Celestial Resilience section before completion', () => {
      renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [{ name: 'Celestial Resilience' }],
      });
      expect(screen.queryByText('Celestial Resilience')).not.toBeInTheDocument();
    });

    it('does not render Celestial Resilience for non-Celestial Warlocks', () => {
      renderModal({
        class: { name: 'Warlock', major: { name: 'Archfey' } },
        specialActions: [],
      });
      expect(screen.getByText('Short Rest')).toBeInTheDocument();
    });

    it('does not render Celestial Resilience when specialActions lacks the feature', () => {
      renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [],
      });
      expect(screen.getByText('Short Rest')).toBeInTheDocument();
    });
  });

  describe('completion flow with Celestial Resilience', () => {
    it('shows CreatureSelectionModal when applyShortRest returns celestialResilienceAllies', async () => {
      renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [{ name: 'Celestial Resilience' }],
      });

      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({
        celestialResilienceAllies: {
          creatureTargets: [{ name: 'Ally1', type: 'player' }, { name: 'Ally2', type: 'player' }],
          allyTempHp: 7,
          selfTempHp: 8,
          maxTargets: 5,
        },
      });

      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      expect(screen.getByTestId('modal-title')).toHaveTextContent('Celestial Resilience');
      expect(screen.getByTestId('modal-description')).toHaveTextContent(/Choose up to 5 allies/);
      expect(screen.getByTestId('modal-note')).toHaveTextContent(/You gain 8 temporary hit points/);
      expect(screen.getByTestId('modal-note')).toHaveTextContent(/Each selected ally gains 7 temporary hit points/);
      expect(screen.getByTestId('max-targets')).toHaveTextContent('5');
    });

    it('sets temp HP on allies after confirming Celestial Resilience', async () => {
      const { onComplete } = renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [{ name: 'Celestial Resilience' }],
      });

      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({
        celestialResilienceAllies: {
          creatureTargets: [{ name: 'Ally1', type: 'player' }],
          allyTempHp: 7,
          selfTempHp: 8,
          maxTargets: 5,
        },
      });

      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      const confirmBtn = screen.getByTestId('confirm-button');
      fireEvent.click(confirmBtn);
      await act(async () => {});

      // Ally temp HP should be set by handleCelestialResilienceConfirm
      expect(setTempHpMock).toHaveBeenCalledWith('Ally1', 7, mockCampaignName);
      expect(onComplete).toHaveBeenCalled();
    });

    it('logs an ability_use entry when confirming Celestial Resilience', async () => {
      renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [{ name: 'Celestial Resilience' }],
      });

      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      const { addEntry } = await import('../../services/ui/logService.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({
        celestialResilienceAllies: {
          creatureTargets: [{ name: 'Ally1', type: 'player' }],
          allyTempHp: 7,
          selfTempHp: 8,
          maxTargets: 5,
        },
      });

      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      const confirmBtn = screen.getByTestId('confirm-button');
      fireEvent.click(confirmBtn);
      await act(async () => {});

      expect(addEntry).toHaveBeenCalled();
      const logCall = addEntry.mock.calls[0][1];
      expect(logCall.type).toBe('ability_use');
      expect(logCall.abilityName).toBe('Celestial Resilience');
      expect(logCall.description).toContain('Ally1');
    });

    it('completes after skipping Celestial Resilience', async () => {
      const { onComplete } = renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [{ name: 'Celestial Resilience' }],
      });

      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({
        celestialResilienceAllies: {
          creatureTargets: [{ name: 'Ally1', type: 'player' }],
          allyTempHp: 7,
          selfTempHp: 8,
          maxTargets: 5,
        },
      });

      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      const skipBtn = screen.getByTestId('skip-button');
      fireEvent.click(skipBtn);
      await act(async () => {});

      expect(onComplete).toHaveBeenCalled();
      expect(setTempHpMock).not.toHaveBeenCalled();
    });

    it('logs an ability_use entry when skipping Celestial Resilience', async () => {
      renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [{ name: 'Celestial Resilience' }],
      });

      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      const { addEntry } = await import('../../services/ui/logService.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({
        celestialResilienceAllies: {
          creatureTargets: [{ name: 'Ally1', type: 'player' }],
          allyTempHp: 7,
          selfTempHp: 8,
          maxTargets: 5,
        },
      });

      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      const skipBtn = screen.getByTestId('skip-button');
      fireEvent.click(skipBtn);
      await act(async () => {});

      expect(addEntry).toHaveBeenCalled();
      const logCall = addEntry.mock.calls[0][1];
      expect(logCall.type).toBe('ability_use');
      expect(logCall.abilityName).toBe('Celestial Resilience');
      expect(logCall.description).toContain('skipped');
    });

    it('completes immediately when applyShortRest returns no celestialResilienceAllies', async () => {
      const { onComplete } = renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [{ name: 'Celestial Resilience' }],
      });

      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({});

      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      expect(onComplete).toHaveBeenCalled();
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
      expect(setTempHpMock).not.toHaveBeenCalled();
    });

    it('does not show CreatureSelectionModal when celestialResilienceAllies is null', async () => {
      const { onComplete } = renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [{ name: 'Celestial Resilience' }],
      });

      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({
        celestialResilienceAllies: null,
      });

      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      expect(onComplete).toHaveBeenCalled();
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    });

  });

  describe('edge cases', () => {
    it('handles confirm when onComplete is undefined', async () => {
      render(
        <ShortRestModal
          playerStats={createPlayerStats()}
          campaignName={mockCampaignName}
          onClose={vi.fn()}
        />
      );

      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({
        celestialResilienceAllies: {
          creatureTargets: [{ name: 'Ally1', type: 'player' }],
          allyTempHp: 7,
          selfTempHp: 8,
          maxTargets: 5,
        },
      });

      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      const confirmBtn = screen.getByTestId('confirm-button');
      // Should not throw even though onComplete is undefined
      await expect(async () => {
        fireEvent.click(confirmBtn);
        await act(async () => {});
      }).not.toThrow();
    });

    it('handles skip when onComplete is undefined', async () => {
      render(
        <ShortRestModal
          playerStats={createPlayerStats()}
          campaignName={mockCampaignName}
          onClose={vi.fn()}
        />
      );

      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({
        celestialResilienceAllies: {
          creatureTargets: [{ name: 'Ally1', type: 'player' }],
          allyTempHp: 7,
          selfTempHp: 8,
          maxTargets: 5,
        },
      });

      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      const skipBtn = screen.getByTestId('skip-button');
      await expect(async () => {
        fireEvent.click(skipBtn);
        await act(async () => {});
      }).not.toThrow();
    });

    it('renders all targets from celestialResilienceAllies in the modal', async () => {
      renderModal({
        class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
        specialActions: [{ name: 'Celestial Resilience' }],
      });

      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      vi.mocked(applyShortRest).mockResolvedValueOnce({
        celestialResilienceAllies: {
          creatureTargets: [
            { name: 'Ally1', type: 'player' },
            { name: 'Ally2', type: 'npc' },
            { name: 'Ally3', type: 'player' },
          ],
          allyTempHp: 5,
          selfTempHp: 6,
          maxTargets: 3,
        },
      });

      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});

      expect(screen.getByTestId('target-Ally1')).toBeInTheDocument();
      expect(screen.getByTestId('target-Ally2')).toBeInTheDocument();
      expect(screen.getByTestId('target-Ally3')).toBeInTheDocument();
    });
  });
});
