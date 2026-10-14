// @improved-by-ai
// CLA-034: Beguiling Twist conditional_advantage ("advantage on saving throws
// to avoid/end Charmed or Frightened") must key on the SAVE's own condition
// (prompt condition/saveConditions), never on the target merely having the
// condition active. Avoid half fired normal; unrelated saves were over-granted.
//
// Each test picks dice so the three roll modes produce DIFFERENT visible
// totals (advantage keeps the high die, disadvantage the low, normal the
// single die) — a broken roll mode changes the on-screen total, not just a
// call count or a mode label.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getAllyList } from '../../hooks/useAllySelection.js';
import * as circleOfPowerHandler from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

// All external effects stubbed neutral: dice controlled per-test, no network,
// no aura/other-bonus noise. Only getAbilitySaveBonus→3 is used (WIS/DEX
// saves add +3) so expected totals are exact.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

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

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const trigger = (testId, data) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data }),
      });
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      // Fear-Ray style prompt: WIS save whose own saveConditions carry 'frightened'.
      trigger('prompt-frightened-save', { promptId: 'cla034-fear', targetName: 'testTarget', saveType: 'WIS', saveDc: 12, disadvantage: false, isSpellDamage: true, saveConditions: ['frightened'] }),
      // Frost-Ray style prompt: unrelated DEX save, no charmed/frightened saveConditions.
      trigger('prompt-dex-save', { promptId: 'cla034-frost', targetName: 'testTarget', saveType: 'DEX', saveDc: 12, disadvantage: false, isSpellDamage: true }),
      // condition-route prompt (SetConditionModal style): condition directly on payload.
      trigger('prompt-condition-route', { promptId: 'cla034-cond', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false, condition: 'charmed' }),
      // Frightened save forced at disadvantage — the prompt's disadvantage must win.
      trigger('prompt-frightened-disadv', { promptId: 'cla034-disadv', targetName: 'testTarget', saveType: 'WIS', saveDc: 12, disadvantage: true, isSpellDamage: true, saveConditions: ['frightened'] }),
    );
  }
  return { default: MockSubscriber };
});

// Beguiling Twist holder: conditional advantage keyed on charmed + frightened.
// WIS/DEX get +3 from the mocked getAbilitySaveBonus.
function beguilingHolder() {
  return {
    name: 'testTarget',
    computedStats: {
      abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Dexterity', bonus: 5 }],
      evasionEffects: [],
    },
    saveModifiers: [
      { source: 'Beguiling Twist', target: 'saving_throw', effect: 'advantage', condition: 'charmed', abilities: [], skills: [] },
      { source: 'Beguiling Twist', target: 'saving_throw', effect: 'advantage', condition: 'frightened', abilities: [], skills: [] },
    ],
  };
}

function renderModal(characters, activeConditions = []) {
  getRuntimeValue.mockImplementation((name, key) =>
    key === 'activeConditions' ? activeConditions : null
  );
  render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={characters}
      activeMapName={null}
    />
  );
}

async function triggerPrompt(testId) {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => expect(screen.getByText(/must make a/i)).toBeInTheDocument());
}

/** Click Roll Save, wait for the result panel, return its visible text. */
async function rollSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => expect(screen.getByText(/Total:/i)).toBeInTheDocument());
  return {
    total: screen.getByText(/Total:/i).textContent,
    breakdown: screen.getByText(/^d20 /).textContent,
  };
}

describe('SavePromptModal — CLA-034 Beguiling Twist conditional advantage', () => {
  beforeEach(() => {
    // Neutral baseline: rollD20→15, no aura, store reads null.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(false);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
    vi.mocked(getAllyList).mockReturnValue([]);
  });
  afterEach(cleanupDefaults);

  it('AVOID half: a fresh frightened save rolls with advantage even when not yet frightened', async () => {
    // max(8, 13) + 3 = 16 vs DC 12 → success. A normal roll (8+3=11) or
    // min-pick would fail, so the total proves advantage fired correctly.
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(13);
    renderModal([beguilingHolder()], []);
    await triggerPrompt('prompt-frightened-save');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toMatch(/d20 \(8, 13\) \+ 3 \(Advantage\)/);
    expect(total).toContain('16');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('END half: advantage remains when re-saving against frightened while already frightened', async () => {
    // Active 'frightened' must not suppress the END half of the feature.
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(13);
    renderModal([beguilingHolder()], ['frightened']);
    await triggerPrompt('prompt-frightened-save');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toMatch(/\(Advantage\)$/);
    expect(total).toContain('16');
  });

  it('NO over-grant: unrelated DEX save rolls normal while frightened is active', async () => {
    // Single d20 of 8 → 8 + 3 = 11 vs DC 12 → failure. If Beguiling Twist
    // wrongly applied, a second die (default 15) would lift it to 18/success.
    rollD20.mockReturnValueOnce(8);
    renderModal([beguilingHolder()], ['frightened']);
    await triggerPrompt('prompt-dex-save');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toMatch(/^d20 \(8\) \+ 3$/);
    expect(total).toContain('11');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
  });

  it('condition-route: a payload carrying condition:"charmed" grants advantage', async () => {
    // Prompts built by SetConditionModal carry `condition` directly instead of
    // the saveConditions array — both spellings must match the modifier.
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(13);
    renderModal([beguilingHolder()], []);
    await triggerPrompt('prompt-condition-route');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toMatch(/\(Advantage\)$/);
    expect(total).toContain('16');
  });

  it('no benefit without the modifier: advantage comes from saveModifiers, not from the save being vs frightened', async () => {
    // Same frightened prompt and active frightened condition as the AVOID/END
    // tests, but a character WITHOUT the Beguiling Twist modifier must roll a
    // plain single d20 — proves the advantage is modifier-driven.
    rollD20.mockReturnValueOnce(8);
    const holder = beguilingHolder();
    holder.saveModifiers = [];
    renderModal([holder], ['frightened']);
    await triggerPrompt('prompt-frightened-save');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toMatch(/^d20 \(8\) \+ 3$/);
    expect(total).toContain('11');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
  });

  it('disadvantage wins: a frightened save forced at disadvantage rolls with disadvantage, not advantage', async () => {
    // min(15, 8) + 3 = 11 vs DC 12 → failure. Conditional advantage must
    // never override a prompt's explicit disadvantage.
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(8);
    renderModal([beguilingHolder()], []);
    await triggerPrompt('prompt-frightened-disadv');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toMatch(/d20 \(15, 8\) \+ 3 \(Disadvantage\)/);
    expect(total).toContain('11');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
  });
});
