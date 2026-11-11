// @maintained-by-ai
// Dialog-semantics pin for ShortRestModal (backlog 2026-11-10 HD): the shell that
// historically sat OUTSIDE the shared role="dialog" tier now carries
// role="dialog" + aria-modal="true" + aria-labelledby → visible <h3> heading,
// mirroring the DeleteConfirmModal-class pattern (aria-modal + heading-
// labelled-by). Also pins that the semantics migration left button behavior
// untouched (Cancel → onClose only, zero writes/log rows).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';
import { addEntry } from '../../services/ui/logService.js';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();
const setRuntimeBatchMock = vi.fn();

// Exactly the symbols ShortRestModal (and its unmocked CreatureSelectionModal →
// spellOverlayService / tempHpService deps) import — mirrors ShortRestModal.test.jsx.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (...args) => getRuntimeValueMock(...args),
  setRuntimeValue: (...args) => setRuntimeValueMock(...args),
  setRuntimeBatch: (...args) => setRuntimeBatchMock(...args),
  useRuntimeValue: (...args) => getRuntimeValueMock(...args),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: vi.fn((count, _die) => ({ total: count * 4, rolls: Array(count).fill(4) })),
}));

vi.mock('../../services/rules/effects/restRules.js', async () => {
  const constants = await import('../../services/rules/effects/restRules-constants.js');
  return {
    getHitDieSize: vi.fn(() => 8),
    computeHitDieRecovery: vi.fn((roll, conBonus) => Math.max(1, roll + conBonus)),
    getShortRestResourceLabels: vi.fn((playerStats) => constants.getShortRestResourceLabels(playerStats)),
    applyShortRest: vi.fn(async () => ({})),
  };
});

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ songOfRestDie: 6, maxSorceryPoints: 5 })),
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

function renderModal() {
  const playerStats = {
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
      spells: [{ name: 'Healing Word', prepared: 'Prepared' }],
    },
    inventory: { equipped: [] },
  };
  const onClose = vi.fn();
  const onComplete = vi.fn();
  render(
    <ShortRestModal
      playerStats={playerStats}
      campaignName="test-campaign"
      onClose={onClose}
      onComplete={onComplete}
    />
  );
  return { onClose, onComplete };
}

describe('ShortRestModal dialog semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValueMock.mockImplementation(() => null);
  });

  it('the existing shell is the live [role="dialog"] element', () => {
    renderModal();
    const dialogs = document.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    const shell = dialogs[0];
    expect(shell.classList.contains('short-rest-modal')).toBe(true);
    expect(shell.getAttribute('aria-modal')).toBe('true');
  });

  it('is labelled by its visible "Short Rest" heading', () => {
    renderModal();
    const shell = document.querySelector('[role="dialog"]');
    const labelledBy = shell.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const heading = document.getElementById(labelledBy);
    expect(heading).not.toBeNull();
    expect(heading.tagName).toBe('H3');
    expect(heading.textContent).toContain('Short Rest');
    // Accessible-name lane: a dialog role query by name resolves the modal.
    expect(screen.getByRole('dialog', { name: /Short Rest/ })).toBe(shell);
  });

  it('button behavior is unchanged by the semantics migration', () => {
    const { onClose, onComplete } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    // Cancel = zero write / zero log row contract.
    expect(setRuntimeValueMock).not.toHaveBeenCalled();
    expect(setRuntimeBatchMock).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
