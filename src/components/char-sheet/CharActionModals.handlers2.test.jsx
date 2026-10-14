// @maintained-by-ai
// Side-effect behavioral tests for CharActionModals internal handlers.
//
// Scope — observable side effects of two async handlers defined inside
// CharActionModals.jsx (not exported separately):
//   - handleInvokeDuplicityConfirm: stores advantage targets, logs ability
//     use, dispatches buffs-updated, closes modal
//   - handleHealingIllusionConfirm: filters the buff out of activeBuffs,
//     clears invokeDuplicityAdvantageTargets, sets target HP (heal = caster
//     level, capped at max), logs healing via SSE, closes modal
//
// Rendering / display tests for these handlers are in
// CharActionModals.internal-handlers.test.jsx and
// CharActionModals.helper-modals.test.jsx. Handler callback wiring for all
// other modals lives in CharActionModals.handlers.test.jsx,
// CharActionModals.target-selection-handlers.test.jsx,
// CharActionModals.secondary-targets.test.jsx, and
// CharActionModals.secondary-target-skips.test.jsx.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

const { setRuntimeValue, getStore } = await import('../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../services/ui/logService.js');
const { logHealingToSSE } = await import('../../services/automation/common/healingRoll.js');

// ── Mocks ──
// Only the services whose behavior these flows exercise (or that run at
// mount) plus the two modal surfaces these tests click are mocked. All
// other modals in the import chain load for real but never mount because
// their modalState keys are absent.

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  const store = new Map();
  return {
    getStore: vi.fn(() => store),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((character, key, campaign) => {
      const k = `${character}:${key}:${campaign}`;
      return store.get(k) ?? null;
    }),
    setRuntimeValue: vi.fn(async (character, key, value, campaign) => {
      const k = `${character}:${key}:${campaign}`;
      store.set(k, value);
      return value;
    }),
  };
});
vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestModal({ title, targets, onTargetSelected, onSkip, confirmLabel, description, showHp }) {
    return (
      <div data-testid="secondary-target-modal">
        <div data-testid="secondary-title">{title}</div>
        {description && <div data-testid="secondary-desc">{description}</div>}
        {showHp && <div data-testid="secondary-show-hp">true</div>}
        {targets.map((target, i) => (
          <label key={i} data-testid={`secondary-target-${target.name}`} onClick={() => onTargetSelected(target.name)}>
            {target.name}
          </label>
        ))}
        <button data-testid="secondary-confirm" onClick={() => onTargetSelected(targets[0]?.name)}>{confirmLabel}</button>
        <button data-testid="secondary-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestModal({ title, targets, onConfirm, onSkip, confirmLabel, note }) {
    return (
      <div data-testid="creature-selection-modal">
        <div data-testid="creature-title">{title}</div>
        {note && <div data-testid="creature-note">{note}</div>}
        {targets.map((target, i) => (
          <label key={i} data-testid={`creature-target-${target.name}`} onClick={() => onConfirm([target.name])}>
            {target.name}
          </label>
        ))}
        <button data-testid="creature-confirm" onClick={() => onConfirm(targets.map(t => t.name))}>{confirmLabel}</button>
        <button data-testid="creature-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

// ── Helpers ──

// Seed the mocked runtime store directly so seeding does not pollute the
// setRuntimeValue call log these tests assert against.
function seed(character, key, value, campaign = 'test-campaign') {
  getStore().set(`${character}:${key}:${campaign}`, value);
}

function renderWithModalState(modalState, { playerStats = { name: 'Test Character' }, characters = [] } = {}) {
  const setModalState = vi.fn();
  render(<CharActionModals
    {...createBaseProps({})}
    playerStats={playerStats}
    campaignName="test-campaign"
    characters={characters}
    modalState={modalState}
    setModalState={setModalState}
  />);
  return setModalState;
}

// ── Tests ──

describe('CharActionModals — Invoke Duplicity and Healing Illusion handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStore().clear();
  });

  describe('handleInvokeDuplicityConfirm', () => {
    it('stores selected allies as advantage targets, logs the ability use, dispatches buffs-updated, and closes the modal', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const setModalState = renderWithModalState(
        { invokeDuplicityModal: { action: {}, playerStats: { name: 'Test Character' } } },
        { playerStats: { name: 'Test Character' }, characters: [{ name: 'Ally1', type: 'humanoid', size: 'M', currentHp: 30, maxHp: 50 }] },
      );

      // CreatureSelectionModal mock confirms with all rendered target names
      fireEvent.click(screen.getByTestId('creature-confirm'));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'invokeDuplicityAdvantageTargets',
          ['Ally1'],
          'test-campaign',
        );
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          type: 'ability_use',
          characterName: 'Test Character',
          abilityName: 'Improved Duplicity',
          description: expect.stringContaining('Ally1'),
        }));
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'buffs-updated' }));
        expect(setModalState).toHaveBeenCalledWith({ invokeDuplicityModal: null });
      });
    });

    it('closes the modal without granting advantage or logging when skipped', async () => {
      const setModalState = renderWithModalState(
        { invokeDuplicityModal: { action: {}, playerStats: { name: 'Test Character' } } },
        { playerStats: { name: 'Test Character' } },
      );

      fireEvent.click(screen.getByTestId('creature-skip'));

      await waitFor(() => {
        expect(setModalState).toHaveBeenCalledWith({ invokeDuplicityModal: null });
      });
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Character',
        'invokeDuplicityAdvantageTargets',
        expect.anything(),
        'test-campaign',
      );
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('handleHealingIllusionConfirm', () => {
    it('removes only the Healing Illusion buff, heals the ally by caster level, logs the heal, and closes the modal', async () => {
      seed('Caster', 'activeBuffs', [{ name: 'Bless' }, { name: 'Healing Illusion' }]);
      const setModalState = renderWithModalState(
        { healingIllusionModal: { action: { name: 'Healing Illusion' }, playerStats: { name: 'Caster', level: 5 } } },
        { playerStats: { name: 'Caster', level: 5 }, characters: [{ name: 'Target1', maxHp: 100 }] },
      );

      fireEvent.click(screen.getByTestId('secondary-target-Target1'));

      await waitFor(() => {
        // Buff filter must keep unrelated buffs and drop only this one
        expect(setRuntimeValue).toHaveBeenCalledWith('Caster', 'activeBuffs', [{ name: 'Bless' }], 'test-campaign');
        // Healing Illusion ends the duplicity advantage as well
        expect(setRuntimeValue).toHaveBeenCalledWith('Caster', 'invokeDuplicityAdvantageTargets', [], 'test-campaign');
        // Target at 0 HP, no stored hitPoints: heals level (5), capped by character maxHp (100)
        expect(setRuntimeValue).toHaveBeenCalledWith('Target1', 'currentHitPoints', 5, 'test-campaign');
        expect(logHealingToSSE).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          targetName: 'Target1',
          sourceName: 'Healing Illusion',
          healingName: 'Healing Illusion',
          actualHeal: 5,
          newHp: 5,
          maxHp: 100,
        }));
        expect(setModalState).toHaveBeenCalledWith({ healingIllusionModal: null });
      });
    });

    it('caps self-healing at playerStats.hitPoints when the caster is the only target', async () => {
      seed('Caster', 'activeBuffs', [{ name: 'Healing Illusion' }]);
      seed('Caster', 'currentHitPoints', 48);
      const setModalState = renderWithModalState(
        { healingIllusionModal: { action: { name: 'Healing Illusion' }, playerStats: { name: 'Caster', level: 3, hitPoints: 50 } } },
        { playerStats: { name: 'Caster', level: 3, hitPoints: 50 }, characters: [{ name: 'Caster', maxHp: 100 }] },
      );

      fireEvent.click(screen.getByTestId('secondary-target-Caster'));

      await waitFor(() => {
        // 48 + 3 would exceed 50, and self max HP must come from
        // playerStats.hitPoints (50), not the characters entry (100)
        expect(setRuntimeValue).toHaveBeenCalledWith('Caster', 'currentHitPoints', 50, 'test-campaign');
        expect(logHealingToSSE).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          targetName: 'Caster',
          actualHeal: 2,
          newHp: 50,
          maxHp: 50,
        }));
        expect(setModalState).toHaveBeenCalledWith({ healingIllusionModal: null });
      });
    });

    it('closes the modal without healing or removing buffs on skip', async () => {
      seed('Caster', 'activeBuffs', [{ name: 'Healing Illusion' }]);
      const setModalState = renderWithModalState(
        { healingIllusionModal: { action: { name: 'Healing Illusion' }, playerStats: { name: 'Caster', level: 5 } } },
        { playerStats: { name: 'Caster', level: 5 } },
      );

      fireEvent.click(screen.getByTestId('secondary-skip'));

      await waitFor(() => {
        expect(setModalState).toHaveBeenCalledWith({ healingIllusionModal: null });
      });
      // Skipping must leave the buff in place (empty array = removal signal)
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Caster', 'activeBuffs', [], 'test-campaign');
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Caster', 'invokeDuplicityAdvantageTargets', [], 'test-campaign');
      expect(logHealingToSSE).not.toHaveBeenCalled();
    });
  });
});
