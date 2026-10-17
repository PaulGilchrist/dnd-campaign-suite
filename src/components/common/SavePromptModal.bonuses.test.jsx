// @maintained-by-ai
// @improved-by-ai
/**
 * SavePromptModal — save bonus & advantage sources.
 *
 * Covered HERE: spell-conditional save advantage (CLA-324), Dodge (DEX-only),
 * Circle of Power, Holy Nimbus (attacker-type restricted), bane/bless effect
 * dice, Warding Bond flat bonus, Aura of Protection display, and stacking.
 *
 * Covered ELSEWHERE — do not re-add here:
 * - 2024 Dodge ruleset gate ........ dodge-2024.test.jsx
 * - Beacon of Hope / cosmic omen ... evasion-effects.test.jsx
 * - Zealous Presence ............... zealous-presence.test.jsx
 * - Holy Aura advantage chip ....... holy-aura.test.jsx
 * - Conditional frightened/charmed . cla034-conditional-save-advantage.test.jsx
 * - Attacker-side bane ............. special-handlers.test.jsx
 * - Hold-until-Done submit ......... actions.test.jsx
 * - Disadvantage / save-bonus resolve . rolling.test.jsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getAllyList } from '../../hooks/useAllySelection.js';
import * as circleOfPowerHandler from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

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

// Only the triggers this file exercises; other lanes have their own files.
// - base: CON save DC 12, spell-origin (isSpellDamage), no disadvantage
// - dex: DEX save DC 17
// - disadvantage: STR save DC 14 WITH prompt disadvantage flag
// - attacker: CON save DC 12 with attackerName (CLA-324 / Holy Nimbus lanes)
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      React.createElement('button', { 'data-testid': 'subscriber-trigger', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false, isSpellDamage: true } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-dex', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-dex', targetName: 'testTarget', saveType: 'dex', saveDc: 17, disadvantage: false, dcSuccess: 'half', sourceName: 'Sacred Flame' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-disadvantage', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget3`, data: { promptId: 'test-prompt-disadv', targetName: 'testTarget3', saveType: 'str', saveDc: 14, disadvantage: true, dcSuccess: 'half', sourceName: 'Fireball' } }) }),
      React.createElement('button', { 'data-testid': 'subscriber-trigger-attacker', onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-testTarget`, data: { promptId: 'test-prompt-attacker', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false, attackerName: 'Fiend' } }) }),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function renderModal(characters = []) {
  render(
    <SavePromptModal
      campaignName="test-campaign"
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

function expectMode(breakdown, mode) {
  if (mode === 'advantage') expect(breakdown).toMatch(/\(Advantage\)$/);
  else if (mode === 'disadvantage') expect(breakdown).toMatch(/\(Disadvantage\)$/);
  else expect(breakdown).not.toMatch(/Advantage|Disadvantage/);
}

/** Route only campaign-level targetEffects through; everything else reads null. */
function mockCampaignTargetEffects(effects) {
  getRuntimeValue.mockImplementation((name, key) =>
    name === 'campaign' && key === 'targetEffects' ? effects : null
  );
}

function mockTargetBuffs(buffs) {
  getRuntimeValue.mockImplementation((name, key) =>
    name === 'testTarget' && key === 'activeBuffs' ? buffs : null
  );
}

describe('SavePromptModal — save bonus sources', () => {
  beforeEach(() => {
    // setupDefaults clears all mocks and sets neutral defaults:
    // rollD20→15, computeAuraBonus→{bonus:0}, getRuntimeValue→null.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(false);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
    vi.mocked(getAllyList).mockReturnValue([]);
  });
  afterEach(cleanupDefaults);

  // ── saveModifiers advantage against spells (CLA-324) ──

  it('grants advantage on spell-origin saves for against_spell saveModifiers (CLA-324)', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(18);
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
      },
      saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
    };

    renderModal([targetChar]);
    await triggerPrompt();
    const { total, breakdown } = await rollSave();

    // Two dice, keep highest: max(15, 18) + 3 (ability) = 21.
    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(total).toBe('21');
    expectMode(breakdown, 'advantage');
  });

  it('does NOT grant against_spell advantage when the save is not spell-origin (CLA-324)', async () => {
    const targetChar = {
      name: 'testTarget',
      level: 1,
      class: { class_levels: [] },
      computedStats: {
        abilities: [{ name: 'Constitution', bonus: 3 }],
        evasionEffects: [],
      },
      saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
    };

    renderModal([targetChar]);
    // Same character, but the prompt carries an attackerName and no spell-origin
    // flag, and there is no spell-save lastAttack in the store.
    await triggerPrompt('subscriber-trigger-attacker');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(total).toBe('18');
    expectMode(breakdown, 'normal');
  });

  // ── Dodge buff (DEX saves only, 2014 ruleset) ──

  it.each`
    saveType    | triggerTestId                 | expectedRolls | expectedTotal | mode
    ${'DEX'}    | ${'subscriber-trigger-dex'}  | ${2}          | ${'18'}       | ${'advantage'}
    ${'CON'}    | ${'subscriber-trigger'}      | ${1}          | ${'15'}       | ${'normal'}
  `('Dodge buff leaves a $saveType save in $mode mode (2014)', async ({ triggerTestId, expectedRolls, expectedTotal, mode }) => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(18);
    mockTargetBuffs([{ effect: 'dodge' }]);

    renderModal();
    await triggerPrompt(triggerTestId);
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(expectedRolls);
    expect(total).toBe(expectedTotal);
    expectMode(breakdown, mode);
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  // ── Circle of Power (all saves) ──

  it.each`
    triggerTestId                            | expectedRolls | expectedTotal | mode
    ${'subscriber-trigger'}                  | ${2}          | ${'18'}       | ${'advantage'}
    ${'subscriber-trigger-disadvantage'}    | ${2}          | ${'15'}       | ${'disadvantage'}
  `('Circle of Power rolls 2d20 on any save ($mode lane)', async ({ triggerTestId, expectedRolls, expectedTotal, mode }) => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(18);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(true);

    renderModal();
    await triggerPrompt(triggerTestId);
    const { total, breakdown } = await rollSave();

    // Even in the disadvantage lane (where the prompt flag wins dice
    // selection: min(15, 18) = 15 vs DC 14) the buff still puts 2d20 on
    // the table — it never silently reduces the roll to one die.
    expect(rollD20).toHaveBeenCalledTimes(expectedRolls);
    expect(total).toBe(expectedTotal);
    expectMode(breakdown, mode);
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  // ── Holy Nimbus (advantage only against Fiends/Undead) ──

  it.each`
    attackerName | monsterType  | expectedRolls | expectedTotal | mode
    ${'Fiend'}   | ${'Fiend'}   | ${2}          | ${'18'}       | ${'advantage'}
    ${'Goblin'}  | ${'Humanoid'} | ${1}         | ${'15'}       | ${'normal'}
  `('Holy Nimbus grants $mode vs a $monsterType attacker', async ({ attackerName, monsterType, expectedRolls, expectedTotal, mode }) => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(18);
    getRuntimeValue.mockImplementation((name, key) =>
      key === 'holyNimbusActive' ? true : null
    );
    vi.mocked(getCombatSummary).mockReturnValue({
      creatures: [
        { name: attackerName, type: 'npc', monsterType },
        { name: 'testTarget', type: 'player' },
      ],
    });
    vi.mocked(getAllyList).mockReturnValue(['testTarget']);

    renderModal(['testAlly']);
    await triggerPrompt('subscriber-trigger-attacker');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(expectedRolls);
    expect(total).toBe(expectedTotal);
    expectMode(breakdown, mode);
  });

  // ── Bane (target effect die) ──

  it.each`
    hasBane | expectedTotal | expectToken
    ${true} | ${'13'}       | ${'-2 [Bane]'}
    ${false}| ${'15'}       | ${null}
  `('bane_penalty target effect ($hasBane) → total $expectedTotal', async ({ hasBane, expectedTotal, expectToken }) => {
    mockCampaignTargetEffects(hasBane ? [{ target: 'testTarget', effect: 'bane_penalty' }] : []);
    if (hasBane) vi.mocked(rollExpression).mockReturnValue({ total: 2 });

    renderModal();
    await triggerPrompt();
    const { total, breakdown } = await rollSave();

    expect(total).toBe(expectedTotal);
    if (expectToken) {
      expect(breakdown).toContain(expectToken);
      expect(rollExpression).toHaveBeenCalledWith('1d4');
    } else {
      // No effect on the target → no effect die rolled at all.
      expect(breakdown).not.toMatch(/Bane/);
      expect(rollExpression).not.toHaveBeenCalled();
    }
  });

  // ── Bless (target effect die) ──

  it.each`
    hasBless | expectedTotal | expectToken
    ${true}  | ${'19'}       | ${'+4 [Bless]'}
    ${false} | ${'15'}       | ${null}
  `('bless_bonus target effect ($hasBless) → total $expectedTotal', async ({ hasBless, expectedTotal, expectToken }) => {
    mockCampaignTargetEffects(hasBless ? [{ target: 'testTarget', effect: 'bless_bonus' }] : []);
    if (hasBless) vi.mocked(rollExpression).mockReturnValue({ total: 4 });

    renderModal();
    await triggerPrompt();
    const { total, breakdown } = await rollSave();

    expect(total).toBe(expectedTotal);
    if (expectToken) {
      expect(breakdown).toContain(expectToken);
      expect(rollExpression).toHaveBeenCalledWith('1d4');
    } else {
      expect(breakdown).not.toMatch(/Bless/);
      expect(rollExpression).not.toHaveBeenCalled();
    }
  });

  // ── Warding Bond (flat bonus from buff, no effect die) ──

  it.each`
    buffLabel                       | buff                                    | expectedTotal | expectToken
    ${'with saveBonus: 1'}          | ${{ effect: 'warding_bond', saveBonus: 1 }} | ${'16'}       | ${'+1 [Warding Bond]'}
    ${'missing saveBonus'}          | ${{ effect: 'warding_bond' }}     | ${'15'}       | ${null}
  `('warding_bond buff $buffLabel → total $expectedTotal, token "$expectToken"', async ({ buff, expectedTotal, expectToken }) => {
    mockTargetBuffs([buff]);

    renderModal();
    await triggerPrompt();
    const { total, breakdown } = await rollSave();

    expect(total).toBe(expectedTotal);
    if (expectToken) {
      expect(breakdown).toContain(expectToken);
    } else {
      // A warding_bond buff without saveBonus must not fake a bonus.
      expect(breakdown).not.toMatch(/Warding Bond/);
      expect(rollExpression).not.toHaveBeenCalled();
    }
  });

  // ── Aura of Protection (display + total) ──

  it('folds aura bonus into the total and names its source in the breakdown', async () => {
    vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: 2, sourceName: 'Aura of Protection' });

    renderModal();
    await triggerPrompt();
    const { total, breakdown } = await rollSave();

    expect(total).toBe('17'); // 15 + 2 aura
    expect(breakdown).toContain('(+2 aura from Aura of Protection)');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  // ── Multiple bonus sources stacking ──

  it('stacks bane penalty and bless bonus in the same save', async () => {
    mockCampaignTargetEffects([
      { target: 'testTarget', effect: 'bane_penalty' },
      { target: 'testTarget', effect: 'bless_bonus' },
    ]);
    // Effect dice roll in production order: target bane first, then bless.
    vi.mocked(rollExpression).mockReturnValueOnce({ total: 2 }).mockReturnValueOnce({ total: 4 });

    renderModal();
    await triggerPrompt();
    const { total, breakdown } = await rollSave();

    // 15 (d20) - 2 (bane) + 4 (bless) = 17
    expect(rollExpression).toHaveBeenCalledTimes(2);
    expect(total).toBe('17');
    expect(breakdown).toContain('-2 [Bane]');
    expect(breakdown).toContain('+4 [Bless]');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });
});
