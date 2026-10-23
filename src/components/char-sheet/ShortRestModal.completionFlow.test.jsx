// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();
const addEntryMock = vi.hoisted(() => vi.fn(() => Promise.resolve({})));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  // useRuntimeValue mirrors the same fake store as getRuntimeValue (production shape)
  // so meal-pool fixtures reach the modal's hasMeal gate (run2#297 probe).
  useRuntimeValue: (...args) => getRuntimeValueMock(...args),
  getRuntimeValue: vi.fn((...args) => getRuntimeValueMock(...args)),
  setRuntimeValue: vi.fn((...args) => setRuntimeValueMock(...args)),
  setRuntimeBatch: vi.fn(),
}));

// Mocked dice: rollDice(1, d) => { total: 4, rolls: [4] }; CON bonus 2 => 6 HP per die.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: vi.fn((count, _die) => ({ total: count * 4, rolls: Array(count).fill(4) })),
}));

// REAL static-data producer: getShortRestResourceLabels passes through
// restRules-constants.js untouched (canned [] mocks masked the :175-179 dead-branch
// defect — the producer returns STRINGS, restRules-constants.js:41). Only dice and
// applyShortRest stay stubbed for determinism.
vi.mock('../../services/rules/effects/restRules.js', async () => {
  const constants = await import('../../services/rules/effects/restRules-constants.js');
  return {
    getHitDieSize: vi.fn(() => 8),
    computeHitDieRecovery: vi.fn((roll, conBonus) => roll + conBonus),
    getShortRestResourceLabels: vi.fn((playerStats) => constants.getShortRestResourceLabels(playerStats)),
    applyShortRest: vi.fn(async () => ({})),
  };
});

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
  addEntry: addEntryMock,
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
      spells: [],
    },
    inventory: { equipped: [] },
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  const playerStats = createPlayerStats(overrides);
  const rendered = render(
    <ShortRestModal
      playerStats={playerStats}
      campaignName={mockCampaignName}
      onClose={vi.fn()}
      onComplete={vi.fn()}
    />
  );
  return { ...rendered, playerStats };
}

function setupGetRuntimeValue(returns) {
  getRuntimeValueMock.mockImplementation((_name, key) => {
    if (key in returns) return returns[key];
    return null;
  });
}

function clickRollOne() {
  fireEvent.click(screen.getByRole('button', { name: /Roll One/i }));
}

async function completeRest() {
  fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
  await act(async () => {});
}

// Exactly one short_rest log entry, returned for message assertions.
function shortRestEntry() {
  const entries = addEntryMock.mock.calls.map(c => c[1]).filter(e => e && e.type === 'short_rest');
  expect(entries).toHaveLength(1);
  return entries[0];
}

describe('ShortRestModal - Completion Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValueMock.mockImplementation(() => null);
  });

  it.each([
    { hpBefore: 30, expected: 36, why: 'applies rolled recovery to below-max HP' },
    { hpBefore: 42, expected: 45, why: 'clamps recovery at max hit points (45)' },
  ])('on completion delegates applyShortRest(skipAutoRecovery) and writes currentHitPoints and consumed hit dice — $why', async ({ hpBefore, expected }) => {
    setupGetRuntimeValue({ currentHitPoints: hpBefore });
    const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
    const { playerStats } = renderModal();
    clickRollOne();
    await completeRest();

    // Base rest logic delegated once, with UI-driven recovery skipped so it is not double-applied.
    expect(applyShortRest).toHaveBeenCalledTimes(1);
    expect(applyShortRest).toHaveBeenCalledWith(playerStats, mockCampaignName, { skipAutoRecovery: true });
    // Mocked dice: roll 4 + CON 2 = 6 HP. Exactly one HP write, computed from the runtime baseline.
    expect(setRuntimeValueMock.mock.calls.filter(c => c[1] === 'currentHitPoints')).toHaveLength(1);
    expect(setRuntimeValueMock).toHaveBeenCalledWith('Thorin', 'currentHitPoints', expected, mockCampaignName);
    // One of five hit dice consumed, persisted for the next rest.
    expect(setRuntimeValueMock).toHaveBeenCalledWith('Thorin', 'shortRestHitDice', 4, mockCampaignName);
  });

  it('logs exactly one short_rest entry with roll detail and HP transition, no phantom restorations', async () => {
    setupGetRuntimeValue({ currentHitPoints: 30 });
    renderModal();
    clickRollOne();
    await completeRest();

    const { message } = shortRestEntry();
    expect(message).toContain('Thorin takes a short rest.');
    expect(message).toContain('Hit Dice: 1d8 (4→6) = 6 HP recovered');
    expect(message).toContain('Current HP: 30 → 36');
    // Plain Cleric: channelDivinityCharges IS in SHORT_REST_RESOURCES (applyShortRest
    // null re-arm), so the real producer label is an honest claim, not a phantom.
    expect(message).toContain('Resources restored: Channel Divinity');
    // Features the Cleric does not own must never appear.
    expect(message).not.toContain('Second Wind');
    expect(message).not.toContain('Arcane Recovery');
  });

  // Producer-shaped completion pin (test-maintain-bugs plan): plain Cleric through the
  // REAL constants producer must expose 'Channel Divinity' in the message layer.
  // Pre-fix this was RED — collectRestoredResources keyed find over string output
  // never matched and the resources line was absent entirely.
  it('plain Cleric completion exposes the producer base-class label in the restored-resources line', async () => {
    renderModal();
    await completeRest();

    const { message } = shortRestEntry();
    expect(message).toContain('Hit Dice: 0 used');
    expect(message).toContain('Resources restored: Channel Divinity');
  });

  it('logs a zero-dice rest honestly and every resting feature label in one completion', async () => {
    setupGetRuntimeValue({ exhaustionLevel: 1 });
    renderModal({
      level: 10,
      class: { name: 'Ranger', major: { name: 'Ranger' } },
      specialActions: [{ name: 'Improved Warding Flare' }],
      automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
    });
    await completeRest();

    const { message } = shortRestEntry();
    expect(message).toContain('Hit Dice: 0 used');
    expect(message).toContain('Resources restored: Warding Flare, Bolstering Treats, Tireless (exhaustion reduced)');
  });

  it.each([
    {
      desc: 'logs Second Wind for a Fighter below max',
      stats: { class: { name: 'Fighter', major: { name: 'Fighter' }, class_levels: [{ level: 5, second_wind: 1 }] } },
      runtime: { secondWindUses: 0 },
      // Real producer labels: ['Second Wind','Action Surge']; 'Action Surge' rides the
      // unconditional SHORT_REST_RESOURCES re-arm, 'Second Wind' the conditional collector.
      resources: 'Action Surge, Second Wind',
    },
    {
      desc: 'omits Second Wind when the Fighter is already at max',
      stats: { class: { name: 'Fighter', major: { name: 'Fighter' }, class_levels: [{ level: 5, second_wind: 1 }] } },
      runtime: { secondWindUses: 1 },
      resources: 'Action Surge',
      absent: 'Second Wind',
    },
    {
      desc: 'logs Rage for a 2024 Barbarian below max',
      stats: { rules: '2024', class: { name: 'Barbarian', major: { name: 'Barbarian' }, class_levels: [{ level: 5, rages: 2 }] } },
      runtime: { ragePoints: 0 },
      resources: 'Rage (2024)',
    },
    {
      desc: 'omits Rage for a 5e Barbarian (2024-only gate)',
      stats: { rules: '5e', class: { name: 'Barbarian', major: { name: 'Barbarian' }, class_levels: [{ level: 5, rages: 2 }] } },
      runtime: { ragePoints: 0 },
      resources: null,
    },
  ])('$desc', async ({ stats, runtime, resources, absent }) => {
    setupGetRuntimeValue(runtime);
    renderModal(stats);
    await completeRest();

    const { message } = shortRestEntry();
    expect(message).toContain('takes a short rest.');
    if (resources) {
      expect(message).toContain(`Resources restored: ${resources}`);
    } else {
      expect(message).not.toContain('Resources restored');
    }
    if (absent) expect(message).not.toContain(absent);
  });

  // CLA-145: the Font of Inspiration label must ride applyShortRest's write output,
  // never availability alone — both cases run with the pool below max (CHA 3, uses 0);
  // the only difference is what the producer reports it restored.
  it.each([true, false])(
    'CLA-145: Font label attribution follows applyShortRest (fontOfInspirationRestored: %s)',
    async (restored) => {
      setupGetRuntimeValue({ bardicInspirationUses: 0 });
      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
      applyShortRest.mockResolvedValueOnce({ fontOfInspirationRestored: restored });
      renderModal({
        class: { name: 'Warlock', major: { name: 'Archfey' } },
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      });
      await completeRest();

      const { message } = shortRestEntry();
      if (restored) {
        expect(message).toContain('Resources restored: Bardic Inspiration (Font of Inspiration), Pact Magic (Warlock spell slots)');
      } else {
        expect(message).not.toContain('Bardic Inspiration');
        expect(message).toContain('Resources restored: Pact Magic (Warlock spell slots)');
      }
    }
  );

  // run2#297 ledger probe: single spend owner (handleComplete). Rolls stage locally;
  // the pool is decremented exactly once, from the fresh end-of-rest read.
  describe('Replenishing Meal ledger (single spend owner)', () => {
    const MEAL_PASSIVE = [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }];
    const mealWrites = () => setRuntimeValueMock.mock.calls.filter(c => c[1] === 'replenishingMeals');

    it('roll + complete spends exactly one meal: start 3 → end 2', async () => {
      setupGetRuntimeValue({ replenishingMeals: 3, currentHitPoints: 30 });
      renderModal({ automation: { passives: MEAL_PASSIVE } });
      clickRollOne();
      expect(mealWrites()).toHaveLength(0); // staged roll burns nothing
      await completeRest();
      expect(mealWrites()).toEqual([['Thorin', 'replenishingMeals', 2, mockCampaignName]]);
      expect(shortRestEntry().message).toContain('Replenishing Meal consumed: +1d8 HP');
    });

    it('Roll All after Roll One cannot double-spend: one meal bonus, one write', async () => {
      setupGetRuntimeValue({ replenishingMeals: 3, currentHitPoints: 30 });
      renderModal({ automation: { passives: MEAL_PASSIVE } });
      clickRollOne(); // meal consumed here: 4+2+4 = 10
      fireEvent.click(screen.getByRole('button', { name: /Roll All/i })); // 4 dice, no second meal
      await completeRest();
      expect(mealWrites()).toHaveLength(1);
      const { message } = shortRestEntry();
      expect(message).toContain('(4→10, 4→6, 4→6, 4→6, 4→6) = 34 HP recovered');
      expect(message).toContain('Current HP: 30 → 45');
    });
  });
});
