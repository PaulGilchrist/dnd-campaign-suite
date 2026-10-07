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
  useRuntimeValue: vi.fn((characterKey, propertyName) => getRuntimeValueMock(characterKey, propertyName)),
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

describe('ShortRestModal - Memorize Spell Swap', () => {
  // CLA-226: fake runtime store so latch stamping/gating behaves like production
  // (setRuntimeBatch writes synchronously + notifies; modal re-reads on render).
  let runtimeStore;
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeStore = new Map();
    getRuntimeValueMock.mockImplementation((name, key) => (runtimeStore.has(key) ? runtimeStore.get(key) : null));
    setRuntimeBatchMock.mockImplementation((name, props) => {
      Object.entries(props).forEach(([k, v]) => runtimeStore.set(k, v));
    });
  });

  describe('rendering and entry', () => {
    it('shows swap button when memorize spell is available with prepared spells, and enters swap mode on click', () => {
      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [{ type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true }] },
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: 'Prepared', level: 3 },
            { name: 'Mage Armor', prepared: 'Not Prepared', level: 1 },
          ],
        },
      });
      expect(screen.getByText(/Swap Prepared Spell/)).toBeInTheDocument();
      fireEvent.click(screen.getByText(/Swap Prepared Spell/));
      expect(screen.getByText(/Remove prepared spell:/)).toBeInTheDocument();
      expect(screen.getByText(/Add from spellbook:/)).toBeInTheDocument();
    });

    it('does not show memorize spell when no prepared spells', () => {
      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [{ type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true }] },
        spellAbilities: {
          spells: [],
        },
      });
      expect(screen.queryByText(/Swap Prepared Spell/)).not.toBeInTheDocument();
    });
  });

  describe('swap mode', () => {
    it('shows prepared spells in remove dropdown and KNOWN non-prepared spells in add dropdown after spellbook loads', async () => {
      const { loadSpellData } = await import('../../services/ui/dataLoader.js');
      vi.mocked(loadSpellData).mockResolvedValueOnce([
        { name: 'Fireball', level: 3, classes: ['Wizard'] },
        { name: 'Mage Armor', level: 1, classes: ['Wizard'] },
        { name: 'Shield', level: 1, classes: ['Wizard', 'Sorcerer'] },
        { name: 'Cure Wounds', level: 1, classes: ['Cleric', 'Druid', 'Ranger'] },
      ]);

      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [{ type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true }] },
        // CLA-226: disk spellbook (known spells) — Shield is NOT in the book.
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: 'Prepared', level: 3 },
            { name: 'Mage Armor', prepared: 'Not Prepared', level: 1 },
          ],
        },
      });
      fireEvent.click(screen.getByText(/Swap Prepared Spell/));
      await act(() => Promise.resolve());
      const removeSelect = screen.getByText(/Remove prepared spell:/).nextElementSibling;
      const addSelect = screen.getByText(/Add from spellbook:/).nextElementSibling;
      const removeOptions = Array.from(removeSelect.querySelectorAll('option')).map(o => o.textContent);
      const addOptions = Array.from(addSelect.querySelectorAll('option')).map(o => o.textContent);
      expect(removeOptions).toContain('Fireball (level 3)');
      expect(addOptions).toContain('Mage Armor (level 1)');
      // CLA-226: "from the book" = character's known spells only — a Wizard-list
      // spell that is NOT in the spellbook (Shield) must not be offered.
      expect(addOptions).not.toContain('Shield (level 1)');
      // Level 0 spells should be excluded
      expect(addOptions).not.toContain('True Strike (level 0)');
      // CLA-226: spellbook offers Wizard-list spells only — non-Wizard spells excluded
      expect(addOptions).not.toContain('Cure Wounds (level 1)');
    });

    it('does not show already-prepared spells in the add dropdown', async () => {
      const { loadSpellData } = await import('../../services/ui/dataLoader.js');
      vi.mocked(loadSpellData).mockResolvedValueOnce([
        { name: 'Fireball', level: 3, classes: ['Wizard'] },
        { name: 'Mage Armor', level: 1, classes: ['Wizard'] },
      ]);

      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [{ type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true }] },
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: 'Prepared', level: 3 },
            { name: 'Mage Armor', prepared: 'Prepared', level: 1 },
          ],
        },
      });
      fireEvent.click(screen.getByText(/Swap Prepared Spell/));
      await act(() => Promise.resolve());
      const addSelect = screen.getByText(/Add from spellbook:/).nextElementSibling;
      const options = addSelect.querySelectorAll('option');
      expect(options.length).toBe(1);
    });

    it('writes preparedSpells + latch in ONE merged batch when swap is executed, then hides the swap button', async () => {
      const { loadSpellData } = await import('../../services/ui/dataLoader.js');
      vi.mocked(loadSpellData).mockResolvedValue([
        { name: 'Fireball', level: 3, classes: ['Wizard'] },
        { name: 'Mage Armor', level: 1, classes: ['Wizard'] },
      ]);

      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [{ type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true }] },
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: 'Prepared', level: 3 },
            { name: 'Mage Armor', prepared: 'Not Prepared', level: 1 },
          ],
        },
      });
      fireEvent.click(screen.getByText(/Swap Prepared Spell/));
      await act(() => Promise.resolve());
      fireEvent.change(screen.getByText(/Remove prepared spell:/).nextElementSibling, { target: { value: 'Fireball' } });
      fireEvent.change(screen.getByText(/Add from spellbook:/).nextElementSibling, { target: { value: 'Mage Armor' } });
      await act(() => Promise.resolve());
      fireEvent.click(screen.getByText(/Swap Spell/));
      await act(() => Promise.resolve());

      // CLA-226: no direct setRuntimeValue for preparedSpells — merged batch only (§39).
      const preparedCalls = setRuntimeValueMock.mock.calls.filter(
        (call) => call[1] === 'preparedSpells'
      );
      expect(preparedCalls).toHaveLength(0);
      const batchCalls = setRuntimeBatchMock.mock.calls.filter(
        (call) => call[1] && 'preparedSpells' in call[1]
      );
      expect(batchCalls.length).toBe(1);
      expect(batchCalls[0][1].preparedSpells).toEqual(['Mage Armor']);
      expect(batchCalls[0][1].memorizeSpellUsedSinceRest).toBe(true);
      // CLA-226: latch stamped → once-per-rest consumed → swap button gone, used shown.
      expect(screen.queryByText(/Swap Prepared Spell/)).not.toBeInTheDocument();
      expect(screen.getByText(/Already used this rest/)).toBeInTheDocument();
    });

    it('refuses a second swap in the same rest: memorize_spell_refused log, zero runtime change', async () => {
      const { loadSpellData } = await import('../../services/ui/dataLoader.js');
      vi.mocked(loadSpellData).mockResolvedValue([
        { name: 'Fireball', level: 3, classes: ['Wizard'] },
        { name: 'Mage Armor', level: 1, classes: ['Wizard'] },
        { name: 'Sleep', level: 1, classes: ['Wizard'] },
      ]);

      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [{ type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true }] },
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: 'Prepared', level: 3 },
            { name: 'Mage Armor', prepared: 'Not Prepared', level: 1 },
          ],
        },
      });
      fireEvent.click(screen.getByText(/Swap Prepared Spell/));
      await act(() => Promise.resolve());
      fireEvent.change(screen.getByText(/Remove prepared spell:/).nextElementSibling, { target: { value: 'Fireball' } });
      fireEvent.change(screen.getByText(/Add from spellbook:/).nextElementSibling, { target: { value: 'Mage Armor' } });
      await act(() => Promise.resolve());
      // Race guard: latch appears while the swap is armed (stale render) —
      // the click must refuse with zero preparedSpells write.
      runtimeStore.set('memorizeSpellUsedSinceRest', true);
      fireEvent.click(screen.getByText(/Swap Spell/));
      await act(() => Promise.resolve());

      const { addEntry } = await import('../../services/ui/logService.js');
      const refusals = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.automationType === 'memorize_spell_refused'
      );
      expect(refusals.length).toBe(1);
      expect(refusals[0][1].type).toBe('automation');
      const preparedBatches = setRuntimeBatchMock.mock.calls.filter(
        (call) => call[1] && 'preparedSpells' in call[1]
      );
      expect(preparedBatches).toHaveLength(0);
      expect(runtimeStore.get('preparedSpells')).toBeUndefined();
      expect(screen.queryByText(/Remove prepared spell:/)).not.toBeInTheDocument();
      expect(screen.getByText(/Already used this rest/)).toBeInTheDocument();
    });

    it('re-arms the swap button when the latch is cleared (rest finished)', async () => {
      const { loadSpellData } = await import('../../services/ui/dataLoader.js');
      vi.mocked(loadSpellData).mockResolvedValue([
        { name: 'Fireball', level: 3, classes: ['Wizard'] },
        { name: 'Mage Armor', level: 1, classes: ['Wizard'] },
      ]);

      runtimeStore.set('memorizeSpellUsedSinceRest', true);
      const { unmount } = renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [{ type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true }] },
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: 'Prepared', level: 3 },
            { name: 'Mage Armor', prepared: 'Not Prepared', level: 1 },
          ],
        },
      });
      // Latched (rest already used, not yet finished): no swap affordance.
      expect(screen.queryByText(/Swap Prepared Spell/)).not.toBeInTheDocument();
      expect(screen.getByText(/Already used this rest/)).toBeInTheDocument();

      // SHORT_REST/LONG_REST reset lists null the latch when the rest finishes.
      runtimeStore.set('memorizeSpellUsedSinceRest', null);
      unmount();
      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [{ type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true }] },
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: 'Prepared', level: 3 },
            { name: 'Mage Armor', prepared: 'Not Prepared', level: 1 },
          ],
        },
      });
      expect(screen.getByText(/Swap Prepared Spell/)).toBeInTheDocument();
    });

    it('writes a dedicated campaign-log entry (old to new spell names) when the swap executes', async () => {
      const { loadSpellData } = await import('../../services/ui/dataLoader.js');
      vi.mocked(loadSpellData).mockResolvedValueOnce([
        { name: 'Fireball', level: 3, classes: ['Wizard'] },
        { name: 'Mage Armor', level: 1, classes: ['Wizard'] },
      ]);

      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [{ type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true }] },
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: 'Prepared', level: 3 },
            { name: 'Mage Armor', prepared: 'Not Prepared', level: 1 },
          ],
        },
      });
      fireEvent.click(screen.getByText(/Swap Prepared Spell/));
      await act(() => Promise.resolve());
      fireEvent.change(screen.getByText(/Remove prepared spell:/).nextElementSibling, { target: { value: 'Fireball' } });
      fireEvent.change(screen.getByText(/Add from spellbook:/).nextElementSibling, { target: { value: 'Mage Armor' } });
      await act(() => Promise.resolve());
      fireEvent.click(screen.getByText(/Swap Spell/));
      await act(() => Promise.resolve());

      const { addEntry } = await import('../../services/ui/logService.js');
      const swapLogs = vi.mocked(addEntry).mock.calls.filter(
        (call) => call[1]?.abilityName === 'Memorize Spell'
      );
      expect(swapLogs.length).toBe(1);
      expect(swapLogs[0][1].type).toBe('ability_use');
      expect(swapLogs[0][1].description).toContain('Fireball');
      expect(swapLogs[0][1].description).toContain('Mage Armor');
    });

    it('exits swap mode and clears selections when cancel is clicked, without calling setRuntimeValue', async () => {
      const { loadSpellData } = await import('../../services/ui/dataLoader.js');
      vi.mocked(loadSpellData).mockResolvedValueOnce([
        { name: 'Fireball', level: 3, classes: ['Wizard'] },
        { name: 'Mage Armor', level: 1, classes: ['Wizard'] },
      ]);

      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [{ type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true }] },
        spellAbilities: {
          spells: [
            { name: 'Fireball', prepared: 'Prepared', level: 3 },
            { name: 'Mage Armor', prepared: 'Not Prepared', level: 1 },
          ],
        },
      });
      fireEvent.click(screen.getByText(/Swap Prepared Spell/));
      await act(() => Promise.resolve());
      const swapBtn = screen.getByText(/Swap Spell/);
      const swapBtnParent = swapBtn.parentElement;
      const cancelBtn = swapBtnParent.querySelector('button:last-child');
      fireEvent.click(cancelBtn);
      await act(() => Promise.resolve());
      expect(screen.queryByText(/Remove prepared spell:/)).not.toBeInTheDocument();
      expect(screen.getByText(/Swap Prepared Spell/)).toBeInTheDocument();
      const preparedCalls = setRuntimeValueMock.mock.calls.filter(
        (call) => call[1] === 'preparedSpells'
      );
      expect(preparedCalls).toHaveLength(0);
    });
  });
});

describe('ShortRestModal - Natural Recovery on Completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValueMock.mockImplementation(() => null);
  });

  it('allows completing short rest without making Natural Recovery selections', async () => {
    setupGetRuntimeValue({ naturalRecoverySlots: 2 });
    renderModal({
      level: 10,
      class: { name: 'Druid', major: { name: 'Druid' }, subclass: { name: 'Circle of the Land' } },
      automation: { passives: [{ type: 'natural_recovery' }] },
      spellAbilities: {
        spell_slots_level_1: 4,
        spells: [],
      },
    });
    expect(screen.getByText('Natural Recovery')).toBeInTheDocument();
    expect(screen.getByText(/Budget: 5 of 5 levels remaining/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Complete Short Rest'));
    await act(() => Promise.resolve());
    expect(screen.getByText('Short Rest')).toBeInTheDocument();
  });
});
