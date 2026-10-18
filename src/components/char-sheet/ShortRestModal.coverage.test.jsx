// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';
import { loadSpellData } from '../../services/ui/dataLoader.js';
import { addEntry } from '../../services/ui/logService.js';

// Lane: Memorize Spell swap (CLA-226) internals only. Render/gating of the
// Memorize Spell section lives in ShortRestModal.test.jsx; completion flow in
// ShortRestModal.completionFlow.test.jsx; Natural Recovery in
// ShortRestModal.naturalRecovery.test.jsx. Nothing here re-derives rest math.

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();
const setRuntimeBatchMock = vi.fn();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn((characterKey, propertyName) => getRuntimeValueMock(characterKey, propertyName)),
  getRuntimeValue: vi.fn((...args) => getRuntimeValueMock(...args)),
  setRuntimeValue: vi.fn((...args) => setRuntimeValueMock(...args)),
  setRuntimeBatch: vi.fn((...args) => setRuntimeBatchMock(...args)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: vi.fn((count, _die) => ({ total: count * 8, rolls: Array(count).fill(8) })),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  getHitDieSize: vi.fn(() => 8),
  computeHitDieRecovery: vi.fn((roll, conBonus) => roll + conBonus),
  SHORT_REST_RESOURCES: ['spell_slots_level_1', 'spell_slots_level_2'],
  getShortRestResourceLabels: vi.fn(() => []),
  applyShortRest: vi.fn(async () => ({})),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({})),
}));

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
  default: () => <div>mock-creature-selection</div>,
}));

const mockCampaignName = 'test-campaign';

// CLA-226: automationRouter routes memorize_spell into automation.specialActions —
// fixtures mirror real router output (base .test.jsx Memorize Spell block).
const MEMORIZE_ACTION = { type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true };

// Spellbook fixture exercising every add-dropdown filter at once:
// Fireball lv3 Wizard (prepared), Mage Armor lv1 Wizard (known, unprepared),
// Shield lv1 Wizard (NOT known), True Strike lv0 Wizard (cantrip),
// Cure Wounds lv1 (non-Wizard list).
const SPELLBOOK = [
  { name: 'Fireball', level: 3, classes: ['Wizard'] },
  { name: 'Mage Armor', level: 1, classes: ['Wizard'] },
  { name: 'Shield', level: 1, classes: ['Wizard'] },
  { name: 'True Strike', level: 0, classes: ['Wizard'] },
  { name: 'Cure Wounds', level: 1, classes: ['Cleric', 'Druid', 'Ranger'] },
];

const KNOWN_SPELLS = [
  { name: 'Fireball', prepared: 'Prepared', level: 3 },
  { name: 'Mage Armor', prepared: 'Not Prepared', level: 1 },
  { name: 'True Strike', prepared: 'Not Prepared', level: 0 },
];

function wizardStats(overrides = {}) {
  return {
    name: 'Thorin',
    level: 5,
    hitPoints: 45,
    proficiency: 3,
    abilities: [{ name: 'Constitution', bonus: 2 }],
    class: { name: 'Wizard', major: { name: 'Wizard' } },
    automation: { passives: [], actions: [], specialActions: [MEMORIZE_ACTION] },
    spellAbilities: { spells: KNOWN_SPELLS },
    inventory: { equipped: [] },
    ...overrides,
  };
}

function renderWizard(overrides) {
  const playerStats = wizardStats(overrides);
  const onClose = vi.fn();
  const rendered = render(
    <ShortRestModal playerStats={playerStats} campaignName={mockCampaignName} onClose={onClose} />
  );
  return { ...rendered, onClose };
}

// CLA-226: fake runtime store so latch stamping/gating behaves like production
// (setRuntimeBatch writes synchronously; modal re-reads on render).
let runtimeStore;

async function enterSwapMode() {
  fireEvent.click(screen.getByRole('button', { name: /Swap Prepared Spell/ }));
  await act(() => Promise.resolve());
}

function optionLabels(text) {
  return Array.from(screen.getByText(text).nextElementSibling.querySelectorAll('option')).map(o => o.textContent);
}

async function armSwap(removeName, addName) {
  await enterSwapMode();
  fireEvent.change(screen.getByText(/Remove prepared spell:/).nextElementSibling, { target: { value: removeName } });
  fireEvent.change(screen.getByText(/Add from spellbook:/).nextElementSibling, { target: { value: addName } });
  await act(() => Promise.resolve());
}

describe('ShortRestModal - Memorize Spell Swap (CLA-226)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeStore = new Map();
    getRuntimeValueMock.mockImplementation((name, key) => (runtimeStore.has(key) ? runtimeStore.get(key) : null));
    setRuntimeBatchMock.mockImplementation((name, props) => {
      Object.entries(props).forEach(([k, v]) => runtimeStore.set(k, v));
    });
    vi.mocked(loadSpellData).mockResolvedValue(SPELLBOOK);
  });

  it('hides the Memorize Spell section entirely when the wizard has no prepared spells', () => {
    renderWizard({ spellAbilities: { spells: [] } });
    expect(screen.queryByRole('button', { name: /Swap Prepared Spell/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Already used this rest/)).not.toBeInTheDocument();
  });

  it('opens swap mode from the swap button, with Swap disabled until both spells are picked', async () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Swap Prepared Spell/ }));
    expect(screen.getByText(/Remove prepared spell:/)).toBeInTheDocument();
    expect(screen.getByText(/Add from spellbook:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Swap Spell' })).toBeDisabled();
  });

  it('offers exactly: prepared lv1+ spells to remove, known unprepared Wizard-list lv1+ spells to add', async () => {
    renderWizard();
    await enterSwapMode();
    // Fireball is prepared lv3 → removable. Shield is not in the known list,
    // True Strike is lv0, Cure Wounds is off the Wizard list — none may appear.
    expect(optionLabels(/Remove prepared spell:/)).toEqual(['-- Select spell to remove --', 'Fireball (level 3)']);
    expect(optionLabels(/Add from spellbook:/)).toEqual(['-- Select spell to add --', 'Mage Armor (level 1)']);
  });

  it('executes a swap with ONE merged batch (preparedSpells + latch) and one ability_use log, then latches the UI', async () => {
    renderWizard();
    await armSwap('Fireball', 'Mage Armor');
    fireEvent.click(screen.getByRole('button', { name: 'Swap Spell' }));
    await act(() => Promise.resolve());

    // CLA-226 §39: no direct preparedSpells write; exact merged batch, once.
    expect(setRuntimeValueMock.mock.calls.filter(c => c[1] === 'preparedSpells')).toHaveLength(0);
    expect(setRuntimeBatchMock).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatchMock).toHaveBeenCalledWith(
      'Thorin',
      { preparedSpells: ['Mage Armor'], memorizeSpellUsedSinceRest: true },
      mockCampaignName
    );

    const swapLogs = vi.mocked(addEntry).mock.calls.filter(c => c[1]?.abilityName === 'Memorize Spell');
    expect(swapLogs).toHaveLength(1);
    expect(swapLogs[0][1].type).toBe('ability_use');
    expect(swapLogs[0][1].description).toContain('Fireball');
    expect(swapLogs[0][1].description).toContain('Mage Armor');

    expect(screen.queryByRole('button', { name: /Swap Prepared Spell/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Already used this rest/)).toBeInTheDocument();
  });

  it('refuses a stale swap once the latch is stamped: one memorize_spell_refused log, zero preparedSpells writes', async () => {
    renderWizard();
    await armSwap('Fireball', 'Mage Armor');
    // Race guard: latch lands while the swap is armed (stale render) — the click
    // must refuse with zero preparedSpells write.
    runtimeStore.set('memorizeSpellUsedSinceRest', true);
    fireEvent.click(screen.getByRole('button', { name: 'Swap Spell' }));
    await act(() => Promise.resolve());

    const refusals = vi.mocked(addEntry).mock.calls.filter(c => c[1]?.automationType === 'memorize_spell_refused');
    expect(refusals).toHaveLength(1);
    expect(refusals[0][1].type).toBe('automation');
    expect(setRuntimeBatchMock.mock.calls.filter(c => c[1] && 'preparedSpells' in c[1])).toHaveLength(0);
    expect(runtimeStore.get('preparedSpells')).toBeUndefined();
    expect(screen.getByText(/Already used this rest/)).toBeInTheDocument();
  });

  it('shows the used-this-rest state instead of the swap button when opened already latched', () => {
    runtimeStore.set('memorizeSpellUsedSinceRest', true);
    renderWizard();
    expect(screen.queryByRole('button', { name: /Swap Prepared Spell/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Already used this rest/)).toBeInTheDocument();
  });

  it('exits swap mode on Cancel with zero runtime writes and clears prior selections', async () => {
    renderWizard();
    await armSwap('Fireball', 'Mage Armor');
    fireEvent.click(within(screen.getByRole('button', { name: 'Swap Spell' }).closest('.short-rest-dice-row')).getByText('Cancel'));
    await act(() => Promise.resolve());

    expect(screen.queryByText(/Remove prepared spell:/)).not.toBeInTheDocument();
    expect(setRuntimeValueMock.mock.calls.filter(c => c[1] === 'preparedSpells')).toHaveLength(0);
    expect(setRuntimeBatchMock.mock.calls.filter(c => c[1] && 'preparedSpells' in c[1])).toHaveLength(0);

    // Re-entry starts from empty selects (selections were cleared, not remembered).
    await enterSwapMode();
    expect(screen.getByText(/Remove prepared spell:/).nextElementSibling.value).toBe('');
    expect(screen.getByText(/Add from spellbook:/).nextElementSibling.value).toBe('');
  });
});
