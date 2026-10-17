// @maintained-by-ai
// @improved-by-ai
// SavePromptModal — Holy Aura save advantage (SP-067)
// Cast holy_aura targetEffects must grant advantage (two d20, keep highest) on all saves.
//
// Wiring test: the REAL getHolyAuraSaveAdvantage selector runs here, driven by
// actual `holy_aura` targetEffects in the campaign store — never by stubbing the
// selector or a boolean flag. Only the runtime-store read (SSE-backed data), the
// dice, the network send, and orthogonal seams (Aura of Protection, Circle of
// Power, allies) are stubbed. Selector-level te matching (cross-target, missing
// te, all-save-types) is unit-tested in savePromptUtils.test.js; queue/dismiss
// submit behavior lives in actions.test.jsx; other advantage sources (Dodge,
// Nimbus, bane/bless stacking) live in bonuses.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

const CAMPAIGN = 'test-campaign';
const ROLLER = 'testTarget';

// Test-controlled campaign targetEffects — the single source of truth the real
// savePromptUtils selectors read through the (mocked) runtime store.
let targetEffects = [];

// ── Mocks (seams only — savePromptUtils.js stays REAL on purpose) ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

// Dice stubbed for determinism; full roll semantics tested in rolling.test.jsx.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

// Network boundary.
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

// Aura of Protection is orthogonal to SP-067; pinned neutral so flat-bonus
// stacking can't mask the advantage dice behavior.
vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// Save-bonus boundary: the roller always adds +3, so totals below are honest
// arithmetic against this fixed value.
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
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

// Circle of Power would also grant blanket advantage — pin off so a roll of
// two d20 can only be attributed to Holy Aura.
vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCircleOfPowerActive: vi.fn(() => false),
  };
});

// SSE seam: injects a WIS DC 13 save prompt for ROLLER (advantage and
// disadvantage flags on the prompt itself stay false — the te must be the
// only advantage source).
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      React.createElement('button', {
        'data-testid': 'subscriber-trigger-wis',
        onClick: () => handleEvent({
          key: `change-${campaignName}-savePrompt-testTarget`,
          data: { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false, dcSuccess: 'half' },
        }),
      }),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function renderModal() {
  // Character present so the +3 save-bonus boundary actually resolves
  // (empty characters would fold the bonus to 0 and fake the totals).
  const roller = {
    name: ROLLER,
    level: 1,
    class: { class_levels: [] },
    computedStats: { abilities: [{ name: 'Wisdom', bonus: 3 }], evasionEffects: [] },
    saveModifiers: [],
  };
  render(<SavePromptModal campaignName={CAMPAIGN} characters={[roller]} activeMapName={null} />);
}

async function openPrompt() {
  fireEvent.click(screen.getByTestId('subscriber-trigger-wis'));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

/** Click Roll Save, wait for the result panel, return its visible text. */
async function rollSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(document.querySelector('.sp-result-total strong')).toBeTruthy();
  });
  return document.querySelector('.sp-result-breakdown').textContent;
}

function expectSubmitPayload(expected) {
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(sendSaveResult).toHaveBeenCalledWith(
    CAMPAIGN,
    ROLLER,
    expect.objectContaining({ promptId: 'test-prompt-wis', ...expected })
  );
}

describe('SavePromptModal — Holy Aura save advantage', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    targetEffects = [];
    // Route only campaign-level targetEffects through the store seam.
    getRuntimeValue.mockImplementation((name, key) =>
      name === 'campaign' && key === 'targetEffects' ? targetEffects : null
    );
  });
  afterEach(cleanupDefaults);

  it('rolls two d20 keep-highest, with an Advantage chip, when the roller carries a holy_aura targetEffect', async () => {
    targetEffects = [{ target: ROLLER, effect: 'holy_aura', source: 'Cleric 1' }];
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(16);

    renderModal();
    await openPrompt();

    // Pre-roll advantage chip comes from the te, not the prompt flags.
    expect(screen.getByText('(Advantage)')).toBeInTheDocument();

    const breakdown = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    // keep-highest: 16 + 3 save bonus = 19 ≥ DC 13
    expect(document.querySelector('.sp-result-total strong').textContent).toBe('19');
    expect(breakdown).toBe('d20 (5, 16) + 3 (Advantage)');

    expectSubmitPayload({
      mode: 'advantage',
      rawRolls: [5, 16],
      roll: 16,
      total: 19,
      success: true,
    });
  });

  it.each`
    label                            | effects
    ${'no targetEffects at all'}     | ${[]}
    ${'holy_aura wards another creature only'} | ${[{ target: 'Ally 1', effect: 'holy_aura', source: 'Cleric 1' }]}
  `('rolls a single plain d20 when $label — advantage is te-driven, never spellName-driven', async ({ effects }) => {
    targetEffects = effects;
    rollD20.mockReturnValue(15);

    renderModal();
    await openPrompt();

    expect(screen.queryByText('(Advantage)')).not.toBeInTheDocument();

    const breakdown = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    // 15 + 3 = 18 ≥ DC 13, plain single die
    expect(document.querySelector('.sp-result-total strong').textContent).toBe('18');
    expect(breakdown).toBe('d20 (15) + 3');

    expectSubmitPayload({
      // Normal mode still submits the mirrored pair [roll, roll] upstream.
      mode: 'normal',
      rawRolls: [15, 15],
      roll: 15,
      total: 18,
      success: true,
    });
  });

  it('still keeps the highest die and submits an honest failure when the advantaged save misses the DC', async () => {
    targetEffects = [{ target: ROLLER, effect: 'holy_aura', source: 'Cleric 1' }];
    rollD20.mockReturnValueOnce(3).mockReturnValueOnce(8);

    renderModal();
    await openPrompt();

    const breakdown = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
    // keep-highest applies on failure too: 8 beats 3; 8 + 3 = 11 < DC 13.
    expect(document.querySelector('.sp-result-total strong').textContent).toBe('11');
    expect(breakdown).toBe('d20 (3, 8) + 3 (Advantage)');

    expectSubmitPayload({
      mode: 'advantage',
      rawRolls: [3, 8],
      roll: 8,
      total: 11,
      success: false,
    });
  });
});
