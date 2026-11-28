// @maintained-by-ai 2026-11-27
// SavePromptModal — bonus folding & advantage-mode arithmetic at the roll seam.
//
// Owned HERE (each leg exact-pins the visible total AND the full
// .sp-result-breakdown string, with dice rigged so every stacking-rule branch
// changes the bytes):
// - CLA-324 against_spell spell-origin gate: prompt isSpellDamage flag, the
//   campaign lastAttack rollType 'spell-save' branch (attacker-match grants,
//   foreign attacker withholds), and the no-evidence plain roll.
// - Dodge DEX-only advantage vs CON plain (5e; the 2024 gate is dodge-2024).
// - Circle of Power blanket advantage, and buff-under-prompt-disadvantage
//   precedence (2d20 stay on the table, min wins, Disadvantage label wins)
//   plus its roll-seam Evasion-note grant on a half-damage prompt.
// - Holy Nimbus seam wiring (Fiend attacker → advantage). The attacker-type/
//   ally-list gate itself is unit-pinned in savePromptUtils.test.js.
// - Bane + bless 1d4 effect-die stacking in production roll order (values 3/4
//   so a sign or order swap changes the total AND both tokens), with the
//   silent decoy leg proving the (target, effect) filter: foreign-target bane
//   and an unlisted effect roll NO die at all.
// - Warding Bond flat folds: truthy saveBonus only (missing → no token, no
//   fabricated bonus) and first-matching-buff-wins selection (5 before 1).
//
// Covered ELSEWHERE — do not re-add here:
// - Hold-until-Done submit + exact payload shape ... actions.test.jsx (#1935)
// - Queue-counter copy: this lane NEVER mounts a multi-prompt queue, so it
//   pins no '(x of N)'/'(N remaining)' face — promptQueueCounterText still has
//   NO unit test anywhere (census note for the eventual unit-census owner).
// - Aura-of-Protection fold display ..... pre-roll-bonus.test.jsx:255 and
//   live-breakdown.test.jsx:199 exact-pin the same resolved 'd20 (…) + N
//   (+M aura from X)' string — stronger real-store reads, deleted from here.
// - Attacker-side bane '+N [Bane]' .......... special-handlers.test.jsx
// - Plain-d20 disadvantage min / DC boundary . rolling.test.jsx
// - Beacon of Hope / cosmic omen ............ evasion-effects.test.jsx
// - Zealous Presence ........................ zealous-presence.test.jsx
// - Holy Aura advantage chip ................ holy-aura.test.jsx
// - Conditional frightened/charmed (CLA-034)  cla034-conditional-save-advantage.test.jsx
// - 2024 Dodge ruleset gate ................... dodge-2024.test.jsx
// - Leading Evasion stamping/skip ............. cla211-leading-evasion.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

// sendSavePrompt is a real graph import (savePrompt.js → this module); it must
// exist on the mock or its access throws, even though this lane never sends
// (same audit as actions.test.jsx #1935).
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

// Keys mirror the graph's actual imports (audit shared with actions.test.jsx):
// getStore + setRuntimeObject (applyDamage.js), deleteRuntimeKey
// (savePrompt.js), getAllStoreKeys (infernalWoundService.js). The old mock's
// useSyncedState key was PHANTOM (not a useRuntimeState export) and `listeners`
// is imported by nothing in this graph — both purged.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getStore: vi.fn(() => new Map()),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  deleteRuntimeKey: vi.fn(),
  setRuntimeObject: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
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
// - base: CON save DC 12, spell-origin flag, no disadvantage
// - dex: DEX save DC 17 (Dodge boundary: total 18 must beat DC 17)
// - disadvantage: STR save DC 14, prompt disadvantage flag, dcSuccess 'half'
// - attacker: CON save DC 12 with attackerName 'Fiend', NO spell-origin flag
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

// Persistent dice rig (no *Once chains): consume the scripted values, then
// clamp to the last one so an unexpected extra roll still yields a loud,
// countable total mismatch rather than a silently reused default.
function rigDice(values) {
  let i = 0;
  rollD20.mockImplementation(() => values[Math.min(i++, values.length - 1)]);
}

/** Route store reads through a `${name}.${key}` table; everything else null. */
function mockStore(reads) {
  getRuntimeValue.mockImplementation((name, key) => reads[`${name}.${key}`] ?? null);
}

async function triggerPrompt(testId = 'subscriber-trigger') {
  fireEvent.click(screen.getByTestId(testId));
  await screen.findByTestId('active-save-prompt');
}

/** Click Roll Save, wait for the result panel, return its visible strings. */
async function rollSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await screen.findByText('SAVE SUCCESS');
  return {
    total: document.querySelector('.sp-result-total strong').textContent,
    breakdown: document.querySelector('.sp-result-breakdown').textContent,
  };
}

// CLA-324 fixture: CON save character whose only advantage source is a
// saveModifiers against_spell entry (getAbilitySaveBonus is stubbed to +3).
const SPELL_MOD_CHAR = {
  name: 'testTarget',
  level: 1,
  class: { class_levels: [] },
  computedStats: {
    abilities: [{ name: 'Constitution', bonus: 3 }],
    evasionEffects: [],
  },
  saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
};

describe('SavePromptModal — save bonus sources', () => {
  beforeEach(() => {
    // setupDefaults clears all mocks and re-baselines rollD20→15,
    // computeAuraBonus→{bonus:0}, getRuntimeValue→null.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    // rollExpression has no default: it may only return a die when a matching
    // targetEffect exists, so a leak from an earlier leg must be impossible.
    vi.mocked(rollExpression).mockReset();
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(false);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
    vi.mocked(getAllyList).mockReturnValue([]);
  });
  afterEach(cleanupDefaults);

  // ── CLA-324: against_spell advantage, spell-origin gate ──

  it.each`
    label                          | triggerTestId                 | lastAttack                                              | dice        | rolls | total    | breakdown
    ${'spell-origin prompt flag'}  | ${'subscriber-trigger'}      | ${null}                                                 | ${[15, 18]} | ${2}  | ${'21'}  | ${'d20 (15, 18) + 3 (Advantage)'}
    ${'no spell evidence'}         | ${'subscriber-trigger-attacker'} | ${null}                                             | ${[15]}     | ${1}  | ${'18'}  | ${'d20 (15) + 3'}
    ${'lastAttack spell-save, matching attacker'} | ${'subscriber-trigger-attacker'} | ${{ rollType: 'spell-save', attackerName: 'Fiend' }}  | ${[15, 18]} | ${2}  | ${'21'}  | ${'d20 (15, 18) + 3 (Advantage)'}
    ${'lastAttack spell-save, foreign attacker'}  | ${'subscriber-trigger-attacker'} | ${{ rollType: 'spell-save', attackerName: 'Dragon' }} | ${[15]}     | ${1}  | ${'18'}  | ${'d20 (15) + 3'}
  `('CLA-324 $label → $rolls die(s), total $total', async ({ triggerTestId, lastAttack, dice, rolls, total, breakdown }) => {
    rigDice(dice);
    mockStore({ 'campaign.lastAttack': lastAttack });

    renderModal([SPELL_MOD_CHAR]);
    await triggerPrompt(triggerTestId);
    const result = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(rolls);
    expect(result.total).toBe(total);
    expect(result.breakdown).toBe(breakdown);
  });

  // ── Dodge buff (DEX saves only, 2014 ruleset) ──

  it.each`
    saveType | triggerTestId            | dice        | rolls | total    | breakdown                       | success
    ${'DEX'} | ${'subscriber-trigger-dex'} | ${[15, 18]} | ${2}  | ${'18'}  | ${'d20 (15, 18) + 0 (Advantage)'} | ${'SAVE SUCCESS'}
    ${'CON'} | ${'subscriber-trigger'}     | ${[15]}     | ${1}  | ${'15'}  | ${'d20 (15) + 0'}                   | ${'SAVE SUCCESS'}
  `('Dodge buff leaves a $saveType save plain-vs-advantaged by ability gate', async ({ triggerTestId, dice, rolls, total, breakdown, success }) => {
    rigDice(dice);
    mockStore({ 'testTarget.activeBuffs': [{ effect: 'dodge' }] });

    renderModal();
    await triggerPrompt(triggerTestId);
    const result = await rollSave();

    // DEX keeps the highest of 2 (18 ≥ DC 17); CON rolls once and Dodge
    // contributes nothing to the breakdown.
    expect(rollD20).toHaveBeenCalledTimes(rolls);
    expect(result.total).toBe(total);
    expect(result.breakdown).toBe(breakdown);
    expect(screen.getByText(success)).toBeInTheDocument();
  });

  // ── Circle of Power (all saves; precedence vs prompt disadvantage) ──

  it.each`
    label                    | triggerTestId                      | expectedRolls | total    | breakdown
    ${'armed prompt'}        | ${'subscriber-trigger'}            | ${2}          | ${'18'}  | ${'d20 (15, 18) + 0 (Advantage)'}
    ${'prompt disadvantage'} | ${'subscriber-trigger-disadvantage'} | ${2}          | ${'15'}  | ${'d20 (15, 18) + 0 (Disadvantage)'}
  `('Circle of Power keeps 2d20 on any save ($label lane)', async ({ triggerTestId, expectedRolls, total, breakdown }) => {
    rigDice([15, 18]);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(true);

    renderModal();
    await triggerPrompt(triggerTestId);
    const result = await rollSave();

    // Even where the prompt disadvantage flag wins die selection and the mode
    // label (min(15, 18) = 15 vs DC 14), the buff never reduces the roll to
    // one die and never out-labels the disadvantage marker.
    expect(rollD20).toHaveBeenCalledTimes(expectedRolls);
    expect(result.total).toBe(total);
    expect(result.breakdown).toBe(breakdown);
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('Circle of Power grants its roll-seam Evasion note on a half-damage prompt', async () => {
    rigDice([15, 18]);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(true);

    renderModal();
    await triggerPrompt('subscriber-trigger-disadvantage');
    await rollSave();

    expect(screen.getByText('Evasion: No damage on success, half damage on failure')).toBeInTheDocument();
    expect(screen.queryByText('Half damage on successful save')).not.toBeInTheDocument();
  });

  // ── Holy Nimbus seam (source-restricted advantage reaches the roll) ──

  it('routes a Fiend attacker through getHolyNimbusSaveAdvantage into 2d20 advantage', async () => {
    rigDice([15, 18]);
    mockStore({ 'testAlly.holyNimbusActive': true });
    vi.mocked(getCombatSummary).mockReturnValue({
      creatures: [
        { name: 'Fiend', type: 'npc', monsterType: 'Fiend' },
        { name: 'testTarget', type: 'player' },
      ],
    });
    vi.mocked(getAllyList).mockReturnValue(['testTarget']);

    // Real object grantor: the old lane passed the bare string 'testAlly',
    // whose missing .name made nimbusCoversTarget fall through to the
    // non-player creatures loop — the catch-all mock then flagged the ATTACKER
    // 'Fiend' as the grantor, never exercised the intended character path.
    renderModal([{ name: 'testAlly' }]);
    await triggerPrompt('subscriber-trigger-attacker');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(total).toBe('18');
    expect(breakdown).toBe('d20 (15, 18) + 0 (Advantage)');
    // The monsterType gate itself (Humanoid withholds, undead grants, ally
    // list rules) is unit-pinned in savePromptUtils.test.js — not restated.
  });

  // ── Bane + bless effect dice (stacking, production order, filter silence) ──

  it.each`
    label                | effects                                                                                                            | dice          | total    | breakdown
    ${'stacked on target'} | ${[{ target: 'testTarget', effect: 'bane_penalty' }, { target: 'testTarget', effect: 'bless_bonus' }]}           | ${[3, 4]}     | ${'16'}  | ${'d20 (15) + 1 -3 [Bane] +4 [Bless]'}
    ${'none matching'}     | ${[{ target: 'someoneElse', effect: 'bane_penalty' }, { target: 'testTarget', effect: 'shield_of_faith' }]}      | ${[]}         | ${'15'}  | ${'d20 (15) + 0'}
  `('bane/bless effect dice — $label', async ({ effects, dice, total, breakdown }) => {
    rigDice([15]);
    mockStore({ 'campaign.targetEffects': effects });
    if (dice.length) {
      let i = 0;
      vi.mocked(rollExpression).mockImplementation(() => ({ total: dice[i++] }));
    }

    renderModal();
    await triggerPrompt();
    const result = await rollSave();

    // Loud leg: target bane rolls before target bless, and the 3/4 values make
    // any sign flip, order swap, or single-die collapse change the total AND
    // both tokens. Silent leg: nothing matches (target, effect), so NO 1d4 is
    // rolled and no token renders.
    expect(rollExpression).toHaveBeenCalledTimes(dice.length);
    if (dice.length) {
      expect(rollExpression).toHaveBeenCalledWith('1d4');
      expect(result.total).toBe(total);
      expect(result.breakdown).toBe(breakdown);
      expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    } else {
      expect(result.total).toBe(total);
      expect(result.breakdown).toBe(breakdown);
    }
  });

  // ── Warding Bond flat bonus (truthy gate + first-buff selection) ──

  it.each`
    label                       | buffs                                                          | total    | breakdown
    ${'saveBonus: 1'}           | ${[{ effect: 'warding_bond', saveBonus: 1 }]}                  | ${'16'}  | ${'d20 (15) + 1 +1 [Warding Bond]'}
    ${'missing saveBonus'}      | ${[{ effect: 'warding_bond' }]}                                | ${'15'}  | ${'d20 (15) + 0'}
    ${'two buffs, first wins'}  | ${[{ effect: 'warding_bond', saveBonus: 5 }, { effect: 'warding_bond', saveBonus: 1 }]} | ${'20'}  | ${'d20 (15) + 5 +5 [Warding Bond]'}
  `('warding_bond buff — $label', async ({ buffs, total, breakdown }) => {
    rigDice([15]);
    mockStore({ 'testTarget.activeBuffs': buffs });

    renderModal();
    await triggerPrompt();
    const { total: visibleTotal, breakdown: visibleBreakdown } = await rollSave();

    expect(visibleTotal).toBe(total);
    expect(visibleBreakdown).toBe(breakdown);
    // A warding_bond buff without saveBonus must not fake a bonus token.
    if (total === '15') expect(visibleBreakdown).not.toMatch(/Warding Bond/);
  });
});
