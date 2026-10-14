// @improved-by-ai
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

  describe('initial render', () => {
    it('displays the title and describes healing as roll total plus the ability modifier', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: /Arcane Vigor/ })).toBeInTheDocument();
      expect(screen.getByText(/roll total \+ 3 \(INT modifier\)/)).toBeInTheDocument();
    });

    it('shows the raw negative modifier in the description', () => {
      renderModal({ spellcastingAbilityModifier: -2 });
      expect(screen.getByText(/roll total \+ -2 \(INT modifier\)/)).toBeInTheDocument();
    });

    it('offers Roll One, Apply Healing, and Cancel actions', () => {
      renderModal();
      expect(rollButton()).toBeInTheDocument();
      expect(applyButton()).toBeInTheDocument();
      expect(cancelButton()).toBeInTheDocument();
    });

    it('reads the hit dice pool from the runtime store', () => {
      withStoredHitDice(5);
      renderModal({ diceCount: 6 });
      expect(screen.getByText(/5 of 5 remaining/)).toBeInTheDocument();
    });

    it('falls back to diceCount when the store has no recorded pool', () => {
      renderModal({ diceCount: 4 });
      expect(screen.getByText(/4 of 4 remaining/)).toBeInTheDocument();
      expect(screen.getByText(/up to 4 dice/)).toBeInTheDocument();
    });

    it('disables rolling when no hit dice remain', () => {
      withStoredHitDice(0);
      renderModal();
      expect(screen.getByText(/0 of 0 remaining/)).toBeInTheDocument();
      expect(rollButton()).toBeDisabled();
    });

    it('disables Apply Healing and hides results before any dice are rolled', () => {
      renderModal();
      expect(applyButton()).toBeDisabled();
      expect(screen.queryByText(/Roll Total:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/HP healed/)).not.toBeInTheDocument();
    });
  });

  describe('rolling dice', () => {
    it('rolls one configured die per click and shows the projected healing', () => {
      renderModal({ hitDieSize: 8, spellcastingAbilityModifier: 3 });
      fireEvent.click(rollButton());
      expect(mockRollDice).toHaveBeenCalledTimes(1);
      expect(mockRollDice).toHaveBeenCalledWith(1, 8);
      expect(screen.getByText('d8 = 4')).toBeInTheDocument();
      expect(screen.getByText(/Roll Total: 4 \+ 3 = 7 HP/)).toBeInTheDocument();
    });

    it('accumulates projected healing across multiple rolls', () => {
      renderModal({ spellcastingAbilityModifier: 3 });
      fireEvent.click(rollButton());
      fireEvent.click(rollButton());
      expect(screen.getByText(/Roll Total: 8 \+ 3 = 11 HP/)).toBeInTheDocument();
    });

    it('adds a negative modifier to the projected healing', () => {
      renderModal({ spellcastingAbilityModifier: -1 });
      fireEvent.click(rollButton());
      expect(screen.getByText(/Roll Total: 4 \+ -1 = 3 HP/)).toBeInTheDocument();
    });

    it('projects zero healing when a negative modifier cancels the roll', () => {
      renderModal({ spellcastingAbilityModifier: -4 });
      fireEvent.click(rollButton());
      expect(screen.getByText(/Roll Total: 4 \+ -4 = 0 HP/)).toBeInTheDocument();
    });

    it('decrements displayed remaining hit dice after each roll', () => {
      withStoredHitDice(3);
      renderModal();
      expect(screen.getByText(/3 of 3 remaining/)).toBeInTheDocument();
      fireEvent.click(rollButton());
      expect(screen.getByText(/2 of 3 remaining/)).toBeInTheDocument();
    });

    it('disables rolling once the last available hit die is used', () => {
      withStoredHitDice(1);
      renderModal();
      fireEvent.click(rollButton());
      expect(rollButton()).toBeDisabled();
    });

    it('labels the roll button with the configured die size', () => {
      renderModal({ hitDieSize: 10 });
      expect(screen.getByRole('button', { name: /Roll One \(d10\)/ })).toBeInTheDocument();
    });
  });

  describe('applying healing', () => {
    it('applies the full projected healing (dice + modifier) to the player', async () => {
      const combatSummary = { creatures: [{ name: PLAYER, hp: 10, maxHp: 20 }] };
      mockGetCombatContext.mockResolvedValue(combatSummary);
      mockApplyHealingToTarget.mockReturnValue({ actualHeal: 11, newHp: 20, oldHp: 10 });
      renderModal({ spellcastingAbilityModifier: 3 });
      fireEvent.click(rollButton());
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(mockApplyHealingToTarget).toHaveBeenCalled());
      expect(mockApplyHealingToTarget).toHaveBeenCalledWith(combatSummary, PLAYER, 11, CAMPAIGN);
    });

    it('calls onComplete after applying healing', async () => {
      const onComplete = vi.fn();
      renderModal({ onComplete });
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(onComplete).toHaveBeenCalled());
    });

    it('shows the actual HP healed rather than the projected total', async () => {
      mockGetCombatContext.mockResolvedValue({ creatures: [{ name: PLAYER, hp: 10, maxHp: 17 }] });
      // Projected is 7 (4+3) but only 5 fit under the max — UI must show 5.
      mockApplyHealingToTarget.mockReturnValue({ actualHeal: 5, newHp: 15, oldHp: 10 });
      renderModal({ spellcastingAbilityModifier: 3 });
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(screen.getByText(/5 HP healed/)).toBeInTheDocument());
      expect(screen.queryByText(/7 HP healed/)).not.toBeInTheDocument();
    });

    it('reports 0 HP healed when no combat context is available', async () => {
      mockGetCombatContext.mockResolvedValue(null);
      renderModal();
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(screen.getByText(/0 HP healed/)).toBeInTheDocument());
      expect(mockApplyHealingToTarget).not.toHaveBeenCalled();
    });

    it('reports 0 HP healed but still consumes dice when the healing does not resolve', async () => {
      mockGetCombatContext.mockResolvedValue({ creatures: [{ name: 'OtherPlayer', hp: 10, maxHp: 20 }] });
      mockApplyHealingToTarget.mockReturnValue(null);
      const onComplete = vi.fn();
      withStoredHitDice(5);
      renderModal({ onComplete });
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(screen.getByText(/0 HP healed/)).toBeInTheDocument());
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(PLAYER, 'shortRestHitDice', 4, CAMPAIGN);
      expect(onComplete).toHaveBeenCalled();
    });

    it('locks all actions once healing is applied', async () => {
      renderModal();
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(screen.getByText(/HP healed/)).toBeInTheDocument());
      expect(rollButton()).toBeDisabled();
      expect(applyButton()).toBeDisabled();
      expect(cancelButton()).toBeDisabled();
    });

    it('reports the consumed dice count in the applied message', async () => {
      withStoredHitDice(5);
      renderModal();
      fireEvent.click(rollButton());
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(screen.getByText(/2 hit dice consumed, 3 remaining/)).toBeInTheDocument());
    });

    it('does nothing when Apply Healing is clicked before rolling', () => {
      const onComplete = vi.fn();
      renderModal({ onComplete });
      expect(applyButton()).toBeDisabled();
      fireEvent.click(applyButton());
      expect(mockApplyHealingToTarget).not.toHaveBeenCalled();
      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
      expect(mockAddEntry).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('applies healing only once even if the button is clicked repeatedly', async () => {
      const onComplete = vi.fn();
      renderModal({ onComplete });
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(screen.getByText(/HP healed/)).toBeInTheDocument());
      fireEvent.click(applyButton());
      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
      expect(mockSetRuntimeValue).toHaveBeenCalledTimes(1);
    });
  });

  describe('hit dice consumption', () => {
    it('writes the decremented pool back to the runtime store', async () => {
      withStoredHitDice(5);
      renderModal();
      fireEvent.click(rollButton());
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => {
        expect(mockSetRuntimeValue).toHaveBeenCalledWith(PLAYER, 'shortRestHitDice', 3, CAMPAIGN);
      });
    });

    it('uses diceCount as the pool size when no stored value exists', async () => {
      renderModal({ diceCount: 3 });
      fireEvent.click(rollButton());
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => {
        expect(mockSetRuntimeValue).toHaveBeenCalledWith(PLAYER, 'shortRestHitDice', 1, CAMPAIGN);
      });
    });

    it('never writes a negative pool back to the store', async () => {
      withStoredHitDice(1);
      renderModal({ diceCount: 5 });
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => {
        expect(mockSetRuntimeValue).toHaveBeenCalledWith(PLAYER, 'shortRestHitDice', 0, CAMPAIGN);
      });
    });
  });

  describe('cancellation', () => {
    it('closes without completing, logging, or touching the pool', () => {
      const onClose = vi.fn();
      const onComplete = vi.fn();
      renderModal({ onClose, onComplete });
      fireEvent.click(cancelButton());
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();
      expect(mockAddEntry).not.toHaveBeenCalled();
      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
    });

    it('discards rolled dice when cancelled after rolling', () => {
      withStoredHitDice(5);
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(rollButton());
      fireEvent.click(cancelButton());
      expect(onClose).toHaveBeenCalled();
      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
      expect(mockAddEntry).not.toHaveBeenCalled();
    });

    it('ignores clicks on the overlay backdrop and modal content', () => {
      const onClose = vi.fn();
      const { container } = renderModal({ onClose });
      fireEvent.click(container.firstChild); // overlay backdrop
      fireEvent.click(screen.getByRole('heading', { name: /Arcane Vigor/ }));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: /Arcane Vigor/ })).toBeInTheDocument();
    });
  });

  describe('logging', () => {
    it('logs a spell entry describing the caster, slot, and roll', async () => {
      renderModal({
        hitDieSize: 10,
        spellcastingAbilityModifier: 3,
        slotLevel: 4,
        playerName: 'TestChar',
      });
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
      expect(mockAddEntry.mock.calls[0][0]).toBe(CAMPAIGN);
      expect(mockAddEntry.mock.calls[0][1]).toMatchObject({
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
        healing: 0,
        hitDiceRemaining: 1,
      });
      expect(typeof mockAddEntry.mock.calls[0][1].timestamp).toBe('number');
    });

    // SP-007: a big pool must NOT override the slot-level dice cap —
    // lv2 (diceCount 2) blocks the 3rd roll and only logs 2 dice rolled.
    it('caps rolls at diceCount (lv2 = 2) even with a large pool', async () => {
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

    it('allows three rolls at lv3 upcast (diceCount 3)', async () => {
      withStoredHitDice(20);
      renderModal({ hitDieSize: 6, diceCount: 3, slotLevel: 3 });
      fireEvent.click(rollButton());
      fireEvent.click(rollButton());
      expect(rollButton()).toBeEnabled();
      fireEvent.click(rollButton());
      expect(rollButton()).toBeDisabled();
      fireEvent.click(applyButton());
      await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
      expect(mockAddEntry.mock.calls[0][1]).toMatchObject({
        diceRolled: 3,
        spellLevel: 3,
        hitDiceRemaining: 17,
      });
    });

    it('logs an hp_change entry with formula and healing flag', async () => {
      renderModal({ hitDieSize: 8, spellcastingAbilityModifier: 3, playerName: 'Caster' });
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(mockAddEntry).toHaveBeenCalledTimes(2));
      expect(mockAddEntry.mock.calls[1][0]).toBe(CAMPAIGN);
      expect(mockAddEntry.mock.calls[1][1]).toMatchObject({
        type: 'hp_change',
        targetName: 'Caster',
        delta: 0,
        isHealing: true,
        sourceName: 'Caster',
        note: 'Arcane Vigor',
        formula: '1d8 + 3',
      });
      expect(typeof mockAddEntry.mock.calls[1][1].timestamp).toBe('number');
    });

    it('records the resulting HP values in the hp_change log when combat context resolves', async () => {
      mockGetCombatContext.mockResolvedValue({ creatures: [{ name: PLAYER, hp: 10, maxHp: 20 }] });
      mockApplyHealingToTarget.mockReturnValue({ actualHeal: 7, newHp: 17, oldHp: 10 });
      renderModal({ spellcastingAbilityModifier: 3 });
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(mockAddEntry).toHaveBeenCalledTimes(2));
      expect(mockAddEntry.mock.calls[1][1]).toMatchObject({
        type: 'hp_change',
        delta: 7,
        currentHp: 17,
        maxHp: 20,
      });
    });

    it('writes both log entries to the selected campaign', async () => {
      renderModal({ campaignName: 'my-campaign' });
      fireEvent.click(rollButton());
      fireEvent.click(applyButton());
      await waitFor(() => expect(mockAddEntry).toHaveBeenCalledTimes(2));
      expect(mockAddEntry.mock.calls.map(([campaign]) => campaign)).toEqual(['my-campaign', 'my-campaign']);
    });
  });
});
