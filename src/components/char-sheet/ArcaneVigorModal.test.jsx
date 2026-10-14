// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ArcaneVigorModal from './ArcaneVigorModal.jsx';

// Service-boundary mocks: the modal is tested as a unit, so runtime store,
// dice RNG, healing application, and campaign logging are stubbed here.
// Names are mock*-prefixed so vi.mock hoisting can reference them directly.
const mockGetRuntimeValue = vi.fn(() => null);
const mockSetRuntimeValue = vi.fn();
const mockRollDice = vi.fn(() => ({ total: 4, rolls: [4] }));
const mockGetCombatContext = vi.fn(() => Promise.resolve(null));
const mockApplyHealingToTarget = vi.fn(() => null);
const mockAddEntry = vi.fn(() => Promise.resolve({}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (...args) => mockGetRuntimeValue(...args),
  setRuntimeValue: (...args) => mockSetRuntimeValue(...args),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: (...args) => mockRollDice(...args),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: (...args) => mockGetCombatContext(...args),
}));

vi.mock('../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: (...args) => mockApplyHealingToTarget(...args),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: (...args) => mockAddEntry(...args),
}));

const CAMPAIGN = 'test-campaign';
const PLAYER = 'Elyra';

function createProps(overrides = {}) {
  return {
    hitDieSize: 8,
    spellcastingAbility: 'INT',
    spellcastingAbilityModifier: 3,
    diceCount: 2,
    slotLevel: 2,
    playerName: PLAYER,
    campaignName: CAMPAIGN,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  return render(<ArcaneVigorModal {...createProps(overrides)} />);
}

// Per-test fixture: seed the hit dice pool the modal reads from the store.
function withStoredHitDice(count) {
  mockGetRuntimeValue.mockImplementation((_name, key) =>
    (key === 'shortRestHitDice' ? count : null));
}

const rollButton = () => screen.getByRole('button', { name: /Roll One/ });
const applyButton = () => screen.getByRole('button', { name: /Apply Healing/ });
const cancelButton = () => screen.getByRole('button', { name: /Cancel/ });

describe('ArcaneVigorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps call history cleared but re-assert neutral
    // implementations so tests never leak state into each other.
    mockGetRuntimeValue.mockImplementation(() => null);
    mockGetCombatContext.mockResolvedValue(null);
    mockApplyHealingToTarget.mockReturnValue(null);
  });

  it('renders the title, description with the ability modifier, and disabled actions before rolling', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: /Arcane Vigor/ })).toBeInTheDocument();
    expect(screen.getByText(/roll total \+ 3 \(INT modifier\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Roll One \(d8\)/ })).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();
    expect(cancelButton()).toBeEnabled();
    expect(screen.queryByText(/Roll Total:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/HP healed/)).not.toBeInTheDocument();
  });

  it('reads the hit dice pool from the runtime store in preference to diceCount', () => {
    withStoredHitDice(5);
    renderModal({ diceCount: 6 });
    expect(screen.getByText(/5 of 5 remaining/)).toBeInTheDocument();
    expect(screen.getByText(/up to 6 dice/)).toBeInTheDocument();
  });

  it('falls back to diceCount when the store has no recorded pool', () => {
    renderModal({ diceCount: 4 });
    expect(screen.getByText(/4 of 4 remaining/)).toBeInTheDocument();
    expect(screen.getByText(/up to 4 dice/)).toBeInTheDocument();
  });

  it('rolls one configured die per click, shows the projection, and decrements the pool', () => {
    withStoredHitDice(3);
    renderModal();
    fireEvent.click(rollButton());
    expect(mockRollDice).toHaveBeenCalledWith(1, 8);
    expect(screen.getByText('d8 = 4')).toBeInTheDocument();
    expect(screen.getByText(/Roll Total: 4 \+ 3 = 7 HP/)).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 remaining/)).toBeInTheDocument();
  });

  it('accumulates dice across rolls and applies a negative modifier to the projection', () => {
    withStoredHitDice(3);
    renderModal({ spellcastingAbilityModifier: -1 });
    fireEvent.click(rollButton());
    fireEvent.click(rollButton());
    expect(screen.getByText(/Roll Total: 8 \+ -1 = 7 HP/)).toBeInTheDocument();
  });

  it('stops rolling once the last available hit die is used', () => {
    withStoredHitDice(1);
    renderModal();
    expect(rollButton()).toBeEnabled();
    fireEvent.click(rollButton());
    expect(screen.getByText(/0 of 1 remaining/)).toBeInTheDocument();
    expect(rollButton()).toBeDisabled();
    fireEvent.click(rollButton()); // click on disabled button is ignored
    expect(mockRollDice).toHaveBeenCalledTimes(1);
  });

  it('applies the projected healing, reports the clamped actual heal, consumes dice, locks actions, and completes once', async () => {
    const combatSummary = { creatures: [{ name: PLAYER, hp: 10, maxHp: 17 }] };
    mockGetCombatContext.mockResolvedValue(combatSummary);
    // Projected is 11 (8+3) but only 5 fit under the max — UI must show 5.
    mockApplyHealingToTarget.mockReturnValue({ actualHeal: 5, newHp: 15, oldHp: 10 });
    const onComplete = vi.fn();
    withStoredHitDice(5);
    renderModal({ onComplete });
    fireEvent.click(rollButton());
    fireEvent.click(rollButton());
    fireEvent.click(applyButton());
    await waitFor(() => expect(mockApplyHealingToTarget).toHaveBeenCalled());
    expect(mockApplyHealingToTarget).toHaveBeenCalledWith(combatSummary, PLAYER, 11, CAMPAIGN);
    expect(screen.getByText(/5 HP healed \(2 hit dice consumed, 3 remaining\)/)).toBeInTheDocument();
    expect(mockSetRuntimeValue).toHaveBeenCalledWith(PLAYER, 'shortRestHitDice', 3, CAMPAIGN);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(rollButton()).toBeDisabled();
    expect(applyButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();
    // Re-clicking after applying must not double-apply.
    fireEvent.click(applyButton());
    expect(mockApplyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(mockSetRuntimeValue).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reports 0 healed when no combat context is available but still consumes dice and logs', async () => {
    const onComplete = vi.fn();
    withStoredHitDice(5);
    renderModal({ onComplete });
    fireEvent.click(rollButton());
    fireEvent.click(applyButton());
    await waitFor(() => expect(screen.getByText(/0 HP healed/)).toBeInTheDocument());
    expect(mockApplyHealingToTarget).not.toHaveBeenCalled();
    expect(mockSetRuntimeValue).toHaveBeenCalledWith(PLAYER, 'shortRestHitDice', 4, CAMPAIGN);
    expect(onComplete).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockAddEntry).toHaveBeenCalledTimes(2));
    expect(mockAddEntry.mock.calls.map(([campaign]) => campaign)).toEqual([CAMPAIGN, CAMPAIGN]);
    expect(mockAddEntry.mock.calls[1][1]).toMatchObject({ type: 'hp_change', delta: 0 });
  });

  it('cancel closes without applying healing, logging, or touching the pool', () => {
    const onClose = vi.fn();
    const onComplete = vi.fn();
    withStoredHitDice(5);
    renderModal({ onClose, onComplete });
    fireEvent.click(rollButton()); // rolled dice are discarded on cancel
    fireEvent.click(cancelButton());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(mockSetRuntimeValue).not.toHaveBeenCalled();
  });

  it('logs spell and hp_change entries describing caster, slot, dice, and resulting HP', async () => {
    mockGetCombatContext.mockResolvedValue({ creatures: [{ name: 'TestChar', hp: 10, maxHp: 17 }] });
    mockApplyHealingToTarget.mockReturnValue({ actualHeal: 7, newHp: 17, oldHp: 10 });
    renderModal({
      hitDieSize: 10,
      spellcastingAbilityModifier: 3,
      slotLevel: 4,
      playerName: 'TestChar',
    });
    fireEvent.click(rollButton());
    fireEvent.click(applyButton());
    await waitFor(() => expect(mockAddEntry).toHaveBeenCalledTimes(2));
    const [spellEntry, hpEntry] = mockAddEntry.mock.calls.map(([campaign, entry]) => {
      expect(campaign).toBe(CAMPAIGN);
      expect(typeof entry.timestamp).toBe('number');
      return entry;
    });
    expect(spellEntry).toMatchObject({
      type: 'spell',
      characterName: 'TestChar',
      targetName: 'TestChar',
      spellName: 'Arcane Vigor',
      spellLevel: 4,
      castingTime: 'Bonus Action',
      diceRolled: 1,
      hitDieSize: 10,
      rollTotal: 4,
      abilityModifier: 3,
      healing: 7,
      hitDiceRemaining: 1,
    });
    expect(hpEntry).toMatchObject({
      type: 'hp_change',
      targetName: 'TestChar',
      delta: 7,
      currentHp: 17,
      maxHp: 17,
      isHealing: true,
      sourceName: 'TestChar',
      note: 'Arcane Vigor',
      formula: '1d10 + 3',
    });
  });

  // SP-007: a big pool must NOT override the slot-level dice cap —
  // lv2 (diceCount 2) blocks the 3rd roll and only logs 2 dice rolled.
  it('caps rolls at diceCount even with a large pool', async () => {
    withStoredHitDice(20);
    renderModal({ hitDieSize: 6, diceCount: 2, slotLevel: 2 });
    fireEvent.click(rollButton());
    fireEvent.click(rollButton());
    expect(rollButton()).toBeDisabled();
    fireEvent.click(rollButton()); // blocked by the cap
    expect(mockRollDice).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Roll Total: 8 \+ 3 = 11 HP/)).toBeInTheDocument();
    fireEvent.click(applyButton());
    await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    expect(mockAddEntry.mock.calls[0][1]).toMatchObject({
      diceRolled: 2,
      hitDiceRemaining: 18,
    });
  });
});
