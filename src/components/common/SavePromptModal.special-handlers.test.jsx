// @maintained-by-ai
// @improved-by-ai
/**
 * SavePromptModal — bane attribution & lastAttack/combatSummary persistence.
 *
 * Owned HERE:
 * - Attacker-side bane_penalty die attribution (the "+N [Bane]" token the
 *   target-side lane in bonuses.test.jsx never produces), including proving
 *   attribution by distinct effect-die values in production roll order.
 * - Quick-roll lastAttack persistence (storage.set('lastAttack', …)) with the
 *   full arithmetic payload, MA-0079 saveConditions stamping from the prompt
 *   payload, and the negative path: no combatSummary → nothing persisted.
 * - Reroll submit → combatSummary.lastAttack restamped via
 *   storage.set('combatSummary', …) while non-dice fields merge in.
 *
 * Covered ELSEWHERE — do not re-add here:
 * - Target bane/bless dice, Warding Bond, aura, stacking . bonuses.test.jsx
 * - 2024 Dodge ruleset gate ................ dodge-2024.test.jsx
 * - Beacon of Hope / cosmic omen / evasion  evasion-effects.test.jsx
 * - Zealous Presence ........................ zealous-presence.test.jsx
 * - Holy Aura / Holy Nimbus ............... holy-aura.test.jsx
 * - Conditional frightened/charmed ........ cla034-conditional-save-advantage.test.jsx
 * - Prompt copy (half/none/full notes) .... rendering.test.jsx / infernal-wound.test.jsx
 * - Reroll submit HP restore & wound close  infernal-wound.test.jsx
 * - Reroll availability/resources ......... rerolls.test.jsx, savePromptHandlers.*.test.js
 *
 * History: two near-duplicate quick-roll storage tests were previously
 * consolidated into one (identical storage.set('lastAttack') assertion shape).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';
import { setupDefaults, cleanupDefaults, createRageCharacter, createCharacter } from './SavePromptModal.test-utils.jsx';

const CAMPAIGN = 'test-campaign';
const TARGET = 'testTarget';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn().mockResolvedValue({ bonus: 0, sourceName: null }),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCircleOfPowerActive: vi.fn(() => false),
  };
});

// Only the triggers this file exercises; other lanes have their own files.
// - base: plain CON save DC 12 (quick-roll persistence)
// - attacker: CON save DC 12 with attackerName (attacker-side bane lane)
// - rawdamage: CON save DC 12, rawDamage 10, dcSuccess 'half' (reroll →
//   combatSummary restamp lane)
// - saveconditions: STR save DC 19, saveConditions ['prone'] (MA-0079)
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const fire = (key, data) => () => handleEvent({ key: `change-${campaignName}-${key}`, data });
    const button = (testId, data) =>
      React.createElement('button', { 'data-testid': testId, onClick: fire(`savePrompt-${data.targetName}`, data) });
    return React.createElement('div', { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      button('subscriber-trigger', { promptId: 'test-prompt-1', targetName: TARGET, saveType: 'con', saveDc: 12, disadvantage: false }),
      button('subscriber-trigger-attacker', { promptId: 'test-prompt-attacker', targetName: TARGET, saveType: 'con', saveDc: 12, disadvantage: false, attackerName: 'testAttacker' }),
      button('subscriber-trigger-rawdamage', { promptId: 'test-prompt-rd', targetName: TARGET, saveType: 'con', saveDc: 12, disadvantage: false, rawDamage: 10, dcSuccess: 'half', sourceName: 'Fireball' }),
      button('subscriber-trigger-saveconditions', { promptId: 'test-prompt-saveconditions', targetName: 'testTarget5', saveType: 'str', saveDc: 19, disadvantage: false, dcSuccess: 'none', sourceName: 'Adult Bronze Dragon 1', rawDamage: 0, saveConditions: ['prone'] }),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function renderModal(characters = []) {
  render(
    <SavePromptModal
      campaignName={CAMPAIGN}
      characters={characters}
      activeMapName={null}
    />
  );
}

async function triggerPrompt(testId = 'subscriber-trigger') {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

/** Click Roll Save, wait for the result panel, return its visible totals. */
async function rollSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(document.querySelector('.sp-result-total strong')).toBeTruthy();
  });
  return {
    total: document.querySelector('.sp-result-total strong').textContent,
    breakdown: document.querySelector('.sp-result-breakdown').textContent,
  };
}

/** Route only campaign-level targetEffects through; everything else reads null. */
function mockCampaignTargetEffects(effects) {
  getRuntimeValue.mockImplementation((name, key) =>
    name === 'campaign' && key === 'targetEffects' ? effects : null
  );
}

/** The lastAttack payload persisted under the given storage key, or undefined. */
function persisted(key) {
  const call = vi.mocked(storage.set).mock.calls.find(([k]) => k === key);
  return call?.[1];
}

describe('SavePromptModal — Special Handlers', () => {
  beforeEach(() => {
    // setupDefaults clears all mocks and sets neutral defaults:
    // rollD20→15, computeAuraBonus→{bonus:0}, getRuntimeValue→null.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    // clearAllMocks does not drop implementations — reset the effect-die mock
    // explicitly so per-test Once/ReturnValue stubs never leak across tests.
    vi.mocked(rollExpression).mockReset();
    vi.mocked(getCombatSummary).mockReset().mockReturnValue({ creatures: [] });
  });
  afterEach(cleanupDefaults);

  // ── Attacker-side bane attribution ──

  it('folds the attacker bane die into the total as a positive bonus, distinct from target bane and bless', async () => {
    mockCampaignTargetEffects([
      { target: TARGET, effect: 'bane_penalty' },
      { target: 'testAttacker', effect: 'bane_penalty' },
      { target: TARGET, effect: 'bless_bonus' },
    ]);
    // Effect dice roll in production order: target bane, attacker bane, bless.
    // Distinct values so each breakdown token is unambiguously attributable.
    vi.mocked(rollExpression)
      .mockReturnValueOnce({ total: 2 })
      .mockReturnValueOnce({ total: 4 })
      .mockReturnValueOnce({ total: 3 });

    renderModal([createCharacter(TARGET)]);
    await triggerPrompt('subscriber-trigger-attacker');
    const { total, breakdown } = await rollSave();

    // 15 (d20) + 3 (ability) - 2 (target bane) + 4 (attacker bane) + 3 (bless)
    expect(rollExpression).toHaveBeenCalledTimes(3);
    expect(total).toBe('23');
    expect(breakdown).toContain('-2 [Bane]');
    expect(breakdown).toContain('+4 [Bane]');
    expect(breakdown).toContain('+3 [Bless]');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('rolls an attacker bane die even when the target itself is not baned', async () => {
    mockCampaignTargetEffects([{ target: 'testAttacker', effect: 'bane_penalty' }]);
    vi.mocked(rollExpression).mockReturnValue({ total: 4 });

    renderModal([createCharacter(TARGET)]);
    await triggerPrompt('subscriber-trigger-attacker');
    const { total, breakdown } = await rollSave();

    // Only one effect die (the attacker's) — no target bane or bless dice.
    expect(rollExpression).toHaveBeenCalledTimes(1);
    // 15 (d20) + 3 (ability) + 4 (attacker bane). A broken attacker lane
    // would land on "d20 (15) + 3" with no Bane token at all.
    expect(breakdown).toBe('d20 (15) + 7 +4 [Bane]');
    expect(total).toBe('22');
  });

  // ── Quick-roll lastAttack persistence ──

  it('stores the full lastAttack payload when rolling a save with combatSummary present', async () => {
    renderModal([createCharacter(TARGET)]);
    await triggerPrompt();
    const { total } = await rollSave();

    expect(total).toBe('18');
    expect(storage.set).toHaveBeenCalledWith('lastAttack', expect.objectContaining({
      rollType: 'save',
      // Prompt carries no attackerName — the target stands in for itself.
      attackerName: TARGET,
      targetName: TARGET,
      d20: 15,
      bonus: 3,
      total: 18,
      saveType: 'con',
      saveDc: 12,
      saveResult: 'success',
      saveConditions: [],
    }), CAMPAIGN);
  });

  // MA-0079: quick-roll lastAttack keeps the saveConditions carried on the
  // AoE-prompt payload (Repulsion Breath) — previously always [].
  it('quick-roll lastAttack stamps saveConditions from the prompt payload', async () => {
    rollD20.mockReturnValue(11);

    renderModal([createCharacter('testTarget5')]);
    await triggerPrompt('subscriber-trigger-saveconditions');
    const { total } = await rollSave();

    // 11 + 3 (ability) = 14 < DC 19 — failed save, prone still recorded.
    expect(total).toBe('14');
    expect(storage.set).toHaveBeenCalledWith('lastAttack', expect.objectContaining({
      targetName: 'testTarget5',
      saveType: 'str',
      saveDc: 19,
      saveResult: 'failure',
      saveConditions: ['prone'],
    }), CAMPAIGN);
  });

  it('does not persist lastAttack when no combatSummary exists', async () => {
    vi.mocked(getCombatSummary).mockReturnValue(null);

    renderModal([createCharacter(TARGET)]);
    await triggerPrompt();
    // The save itself still resolves normally...
    const { total } = await rollSave();
    expect(total).toBe('18');

    // ...but with no combat in progress nothing is written to storage.
    expect(storage.set).not.toHaveBeenCalled();
  });

  // ── Reroll submit → combatSummary.lastAttack restamp ──

  it('reroll submit restamps combatSummary.lastAttack with the new dice and result, merging prior fields', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === TARGET && key === 'activeBuffs') return [{ effect: 'rage', damageBonusExpression: 'rage_damage' }];
      if (name === TARGET && key === 'fanaticalFocusUsed') return false;
      if (name === TARGET && key === 'hitPoints') return 10;
      if (name === TARGET && key === 'maxHitPoints') return 20;
      return null;
    });
    vi.mocked(getCombatSummary).mockReturnValue({
      creatures: [],
      lastAttack: { attackerName: 'Fireball', targetName: TARGET, rollType: 'spell-save', rawDamage: 10 },
    });
    // Initial save fails (4 + 3 < DC 12); Fanatical Focus reroll succeeds
    // (15 + 3 + 2 >= 12).
    rollD20.mockReturnValueOnce(4).mockReturnValueOnce(15);

    renderModal([createRageCharacter(TARGET, 2)]);
    await triggerPrompt('subscriber-trigger-rawdamage');
    const first = await rollSave();
    // 4 + 3 = 7 < DC 12 — failed save offers the raging reroll lane.
    expect(first.total).toBe('7');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reroll Save (+2)' }));

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.anything(), CAMPAIGN);
    });
    // The rerolled dice and result restamp the existing lastAttack record;
    // non-dice fields (attackerName/rawDamage) merge in untouched.
    expect(persisted('combatSummary').lastAttack).toEqual(expect.objectContaining({
      d20: 15,
      d20Rolls: [15, 15],
      bonus: 5, // 3 (ability) + 2 (Fanatical Focus)
      total: 20,
      saveType: 'con',
      saveDc: 12,
      saveResult: 'success',
      attackerName: 'Fireball',
      targetName: TARGET,
    }));
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });
});
