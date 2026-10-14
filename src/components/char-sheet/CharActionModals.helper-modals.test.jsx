// @maintained-by-ai
// CharActionModals host-prop tests for helper modals: what the host passes
// INTO the shared selection modals (title, description, note, showHp, merged
// target lists) plus skip lanes not covered by sibling files.
//
// Deliberately NOT covered here (stronger versions live elsewhere):
// - Healing Illusion confirm + skip (heals, buff removal, logging):
//   CharActionModals.handlers2.test.jsx
// - Invoke Duplicity confirm + skip (advantage targets, logging):
//   CharActionModals.handlers2.test.jsx
// - Flurry of Blows confirm + skip: CharActionModals.target-selection-handlers.test.jsx
// - Starry Chalice confirm (heal + popup): CharActionModals.handler-callbacks.test.jsx
// - Reckless Attack explicit-mode callback routing:
//   CharActionModals.choice-handlers.test.jsx (its mock defaults mode
//   itself, so the host's mode default must be asserted in this file)
// - Real-modal rendering titles/instructions for Epitome, Destructive Stride
//   (+ target), Starry Chalice, Healing Illusion:
//   CharActionModals.internal-handlers.test.jsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';
import { applyStarryChaliceHeal } from '../../services/rules/spells/postCastHealService.js';

// Mocks only the modals this file mounts, plus services touched at mount.

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestModal({ title, description, showHp, targets, onSkip }) {
    return (
      <div data-testid="secondary-target-modal">
        <div data-testid="secondary-title">{title}</div>
        {description && <div data-testid="secondary-desc">{description}</div>}
        {showHp && <div data-testid="secondary-show-hp">true</div>}
        {targets.map((target, i) => (
          <div key={i} data-testid={`secondary-target-${target.name}`}>{target.name}</div>
        ))}
        <button data-testid="secondary-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestModal({ title, note, targets }) {
    return (
      <div data-testid="creature-selection-modal">
        <div data-testid="creature-title">{title}</div>
        {note && <div data-testid="creature-note">{note}</div>}
        {targets.map((target, i) => (
          <div key={i} data-testid={`creature-target-${target.name}`}>{target.name}</div>
        ))}
      </div>
    );
  },
}));
// Renders the received mode WITHOUT defaulting it, so the host's
// mode={rm.mode || 'full'} default is observable. Full-mode emit contract:
// onConfirm(attack, choice).
vi.mock('./modals/shared/RecklessAttackModal.jsx', () => ({
  default: function TestModal({ attack, mode, onConfirm, onCancel }) {
    return (
      <div data-testid="reckless-attack-modal">
        <div data-testid="reckless-mode">{String(mode)}</div>
        <button data-testid="reckless-confirm" onClick={() => onConfirm(attack, { useBrutalStrike: true, effectChoices: ['Forceful Blow'] })}>Confirm</button>
        <button data-testid="reckless-cancel" onClick={() => onCancel(attack)}>Cancel</button>
      </div>
    );
  },
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));
// Combat-context creatures merge into the host-built target lists; 'Orc' is
// the merge-only witness and 'Goblin' collides with the characters prop to
// prove name deduplication.
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue({
    creatures: [
      { name: 'Goblin', type: 'humanoid', currentHp: 10, maxHp: 30 },
      { name: 'Orc', type: 'humanoid', currentHp: 20, maxHp: 40 },
    ],
  }),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));
vi.mock('../../services/rules/spells/postCastHealService.js', () => ({
  applyStarryChaliceHeal: vi.fn().mockResolvedValue(null),
}));

// ── Tests ──

describe('CharActionModals — helper modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Healing Illusion modal', () => {
    it('passes title, description, showHp, and merged deduplicated targets to SecondaryTargetModal', async () => {
      const playerStats = { name: 'Caster', level: 5 };
      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        characters={[
          { name: 'Ally1', type: 'humanoid', size: 'M', currentHp: 30, maxHp: 50 },
          { name: 'Goblin', type: 'humanoid', size: 'S', currentHp: 7, maxHp: 7 },
        ]}
        modalState={{ healingIllusionModal: { action: {}, playerStats } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('secondary-title').textContent).toBe('Healing Illusion');
      expect(screen.getByTestId('secondary-desc').textContent).toContain('Choose a creature within 5 feet');
      expect(screen.getByTestId('secondary-show-hp')).toBeInTheDocument();
      // Targets merge characters with combat-context creatures...
      await waitFor(() => expect(screen.getByTestId('secondary-target-Orc')).toBeInTheDocument());
      expect(screen.getByTestId('secondary-target-Ally1')).toBeInTheDocument();
      // ...and deduplicate by name (Goblin is in both lists).
      expect(screen.getAllByTestId('secondary-target-Goblin')).toHaveLength(1);
    });
  });

  describe('Invoke Duplicity modal', () => {
    it('passes title, note, and merged deduplicated targets to CreatureSelectionModal', async () => {
      const playerStats = { name: 'Caster' };
      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        characters={[
          { name: 'Ally1', type: 'humanoid', size: 'M', currentHp: 30, maxHp: 50 },
          { name: 'Goblin', type: 'humanoid', size: 'S', currentHp: 7, maxHp: 7 },
        ]}
        modalState={{ invokeDuplicityModal: { action: {}, playerStats } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('creature-title').textContent).toBe('Improved Duplicity — Choose Allies');
      expect(screen.getByTestId('creature-note').textContent).toContain('Select all allies');
      // Targets merge characters with combat-context creatures...
      await waitFor(() => expect(screen.getByTestId('creature-target-Orc')).toBeInTheDocument());
      expect(screen.getByTestId('creature-target-Ally1')).toBeInTheDocument();
      // ...and deduplicate by name (Goblin is in both lists).
      expect(screen.getAllByTestId('creature-target-Goblin')).toHaveLength(1);
    });
  });

  describe('Starry Chalice Heal modal', () => {
    it('skip closes the modal without applying the heal', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({})}
        modalState={{ starryChaliceHealModal: { targetNames: ['Ally1'], amount: 10 } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('secondary-skip'));
      expect(setModalState).toHaveBeenCalledWith({ starryChaliceHealModal: null });
      expect(applyStarryChaliceHeal).not.toHaveBeenCalled();
    });
  });

  describe('Reckless Attack modal', () => {
    it('defaults to mode=full and routes confirm to handleRecklessAttackConfirm', () => {
      const attack = { name: 'Longsword' };
      const handleRecklessAttackConfirm = vi.fn();
      const handleBrutalStrikeConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({
          handleRecklessAttackConfirm,
          handleRecklessAttackCancel: vi.fn(),
          handleBrutalStrikeConfirm,
          handleBrutalStrikeCancel: vi.fn(),
        })}
        modalState={{ recklessAttackModal: { attack } }}
        setModalState={vi.fn()}
      />);
      // mode is unset in modalState — the host must supply the 'full' default.
      expect(screen.getByTestId('reckless-mode').textContent).toBe('full');
      fireEvent.click(screen.getByTestId('reckless-confirm'));
      expect(handleRecklessAttackConfirm).toHaveBeenCalledWith(attack, expect.objectContaining({ useBrutalStrike: true }));
      expect(handleBrutalStrikeConfirm).not.toHaveBeenCalled();
    });
  });
});
