// @maintained-by-ai 2026-11-27
// SavePromptModal — rolling (roll/resolve layer of the save prompt).
//
// Owned HERE (each leg exact-pins the full .sp-result-breakdown string AND
// the visible total, dice rigged so a broken mode/boundary changes on-screen
// bytes, not just a die count — #1936 idiom; physical-die-count via
// rollD20 call count, 2 under disadvantage / 1 plain — #1946 idiom):
// - Explicit prompt-flag disadvantage: two physical d20s, the LOWER die kept
//   and identifiable in the breakdown ('d20 (18, 5) + 0 (Disadvantage)').
// - Explicit-flag disadvantage arithmetic (#1938/#1945 handoff): with BOTH
//   explicit prompt flags the modal does NOT offset — the disadvantage ternary
//   in rollSaveDice (SavePromptModal.jsx:316) keeps the min and the mode
//   reports '(Disadvantage)'. The RAW offset-to-plain-d20 rule is
//   service-owned at concentrationPromptRoll.js:100 (#1896 deleted the
//   ConcentrationPromptModal twin as redundant with that unit pin), so the
//   offset MATH is cited here, never restated — this lane pins only the
//   modal face (min-keeping + label + 2 physical dice) that only this seam
//   can show. The modal's non-offset divergence is reported as a source bug,
//   not endorsed: if the modal is ever fixed to the concentration doctrine,
//   this pin flips with it.
// - DC boundary bracket (#1938: "plain min/DC boundary — keep that split"):
//   total === DC succeeds (source SavePromptModal.jsx:362 uses >=) AND
//   total === DC-1 fails — together they kill both the >= → > swap and a
//   >= dc-1 slack mutant. DC+1 adds no discriminating power (integer
//   > dc-1 is identical to >= dc).
// - Plain roll face: single physical d20, breakdown carries NO mode suffix.
//   The charmed decoy proves the modal's REAL getSaveDisadvantage read does
//   not bleed onto a CON save; the DEX-only selector gate itself is
//   unit-pinned in savePromptUtils.test.js and the charmed/Otto DEX
//   positives are the evasion-effects lane (#1941) — this leg pins only
//   what only the modal shows: one die, no label.
// - Bonus-source routing at the roll seam: a found roster character wins
//   over combatSummary saveBonuses (decoy +9), and an off-roster target
//   resolves through the creature lookup instead of the +3 character stub.
//   The bonuses lane folds modifiers ON TOP of the character stub; it
//   delegates "Plain-d20 disadvantage min / DC boundary" here (#1936) and
//   pins neither routing branch.
//
// Owned ELSEWHERE — do not re-add here:
// - Done payloads, hold-until-Done, rolled Next Save advancement, Apply(0)
//   presentation gate ................................. .actions.test.jsx (#1935)
// - 5e Dodge DEX-vs-CON arithmetic, CLA-324 against_spell + lastAttack,
//   bane/bless/warding-bond bonus-string arithmetic, CoP buff-under-
//   prompt-disadvantage precedence (and its CoP-disadv note face)
//   .................................................. .bonuses.test.jsx (#1936)
// - saveConditions / mod.condition legs ............... .cla034-conditional-save-advantage.test.jsx (#1937)
// - CLA-211 evasion trigger gate/stamp/skip/Apply ..... .cla211-leading-evasion.test.jsx (#1938)
// - chooser row tick UX, overlay inertness, confirm-closes-leaves-PENDING,
//   clear/dismiss advancement ......................... .coverage.test.jsx (#1939)
// - 2024 Dodge ruleset gate (BA-001) .................. .dodge-2024.test.jsx (#1940)
// - Beacon WIS gate, Cosmic Omen consume, charmed/Otto DEX disadvantage .... .evasion-effects.test.jsx (#1941)
// - holy_aura te grant + ALL-saves contrast ........... .holy-aura.test.jsx (#1942)
// - Indomitable availability matrix / cap ladder AND the shared
//   rerollUsedForSave once-per-failed-save gate
//   .................................................. .indomitable.test.jsx (#1943)
// - MA-0367 'full'-row copy + reroll-cancel/HP-restore seam ................. .infernal-wound.test.jsx (#1944)
// - half/none damage-note copy ........................ .rendering.test.jsx (#1945)
// - Fanatical Focus / Disciplined Survivor / Living Legend / Guarded Mind
//   buttons, tokens and spend writes .................. .rerolls.test.jsx (#1946)
// - Evasion NOTE display branches (shared/own/incapacitated, cross-prompt
//   stamp inertness) ..................... .evasion-note-selection.test.jsx
// - lastAttack persistence ............................ .special-handlers.test.jsx (queued)
//
// ARITY TRUTH (#1878): getRuntimeValue is a 2-param API — the store resolves
// from characterKey alone — so 3rd campaignName args on reads in the module
// under test are silently ignored; cosmetic, not a cross-campaign leak.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

// Bare factory (NOT an importOriginal spread, per the #1946 documented
// contrast): no fixture here carries bane/bless targetEffects or reroll
// saveModifiers rows, so the expression evaluator never runs and
// rollExpression is never called.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

// sendSavePrompt is a real graph import (savePrompt.js → this module); it must
// exist on the mock even though this lane never sends (#1935-#1946 pattern).
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// Stubbed so the bonus-source routing can be pinned by arithmetic: every
// found-character save resolves through this stub returning +3, and every
// creature-lane save must show its combatSummary bonus instead.
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

// Graph keys mirrored to the sibling lanes (#1935-#1946): no
// useSyncedState/listeners phantoms — this modal never imports them.
// deleteRuntimeKey/setRuntimeObject/getAllStoreKeys back real graph imports
// (savePrompt.js, applyDamage.js, infernalWoundService.js/store probes).
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

// Test-event feeder: each button dispatches one SSE-shaped event through the
// real handleEvent the modal passes down (campaign-scoped keys, as production
// Subscriber delivers them). Table-driven — only prompts this file needs.
vi.mock('./Subscriber.jsx', () => {
  const promptEvent = (handleEvent, testId, campaign, data) =>
    React.createElement('button', {
      'data-testid': testId,
      onClick: () => handleEvent({ key: `change-${campaign}-savePrompt-${data.targetName}`, data }),
    });

  const PROMPTS = {
    'subscriber-trigger': {
      promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false,
    },
    'subscriber-trigger-disadvantage': {
      promptId: 'test-prompt-disadv', targetName: 'testTarget3', saveType: 'str', saveDc: 14,
      disadvantage: true, dcSuccess: 'half', sourceName: 'Fireball',
    },
    // Both explicit flags: pins the modal's non-offset keep-min face (the
    // RAW offset-to-plain rule is service-owned, see the header).
    'subscriber-trigger-adv-dis': {
      promptId: 'test-prompt-adv-dis', targetName: 'testTarget6', saveType: 'cha', saveDc: 13,
      advantage: true, disadvantage: true,
    },
  };

  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement('div', { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      ...Object.entries(PROMPTS).map(([testId, data]) => promptEvent(handleEvent, testId, campaignName, data)),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function renderModal(props = {}) {
  return render(
    <SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} {...props} />
  );
}

async function openPrompt(testId = 'subscriber-trigger') {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

async function rollSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/^(SAVE SUCCESS|SAVE FAILURE)$/)).toBeInTheDocument();
  });
}

// The total renders as: Total: <strong>{total}</strong> vs DC {dc} — split
// across elements, so match the owning <p> by its full textContent.
function expectTotalLine(total, dc) {
  const line = screen.getByText((_content, element) =>
    element?.tagName === 'P' && element.textContent === `Total: ${total} vs DC ${dc}`);
  expect(line).toBeInTheDocument();
}

describe('SavePromptModal — rolling', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    // mockReturnValue from a previous test is NOT removed by clearAllMocks —
    // reset explicitly so tests stay order-independent.
    vi.mocked(getCombatSummary).mockReset();
  });
  afterEach(cleanupDefaults);

  // ── Disadvantage: explicit prompt flag keeps the lower die ──

  it('rolls two d20s and keeps the minimum when the prompt sets the disadvantage flag', async () => {
    // Distinct dice so a broken keep logic changes the visible outcome, not
    // just the die count: normal/max mode would keep 18 (≥ DC 14 → success).
    rollD20.mockReturnValueOnce(18).mockReturnValueOnce(5);

    renderModal();
    await openPrompt('subscriber-trigger-disadvantage');
    expect(screen.getByText('(Disadvantage)')).toBeInTheDocument();

    await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    // min(18, 5) = 5; no character on the roster so the bonus is 0; 5 < DC 14.
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
    expect(screen.queryByText('SAVE SUCCESS')).not.toBeInTheDocument();
    expectTotalLine(5, 14);
    expect(screen.getByText('d20 (18, 5) + 0 (Disadvantage)')).toBeInTheDocument();
  });

  // ── Explicit-flag disadvantage arithmetic (#1938/#1945 handoff) ──

  it('keeps the lower die with a (Disadvantage) label when the prompt carries both explicit flags', async () => {
    // Modal face only: the RAW offset-to-plain-d20 math is owned at service
    // level (concentrationPromptRoll.js:100, #1896) and is NOT restated here.
    // This modal currently lets disadvantage WIN over an explicit advantage
    // flag (computeSaveAdvantage returns at the :145 advantage line, but
    // rollSaveDice :316 keeps Math.min and saveRollMode reports
    // 'disadvantage'). Dice 16/6 discriminate every collapse: plain (first
    // die) and max would both yield 16 ≥ DC 13 → SUCCESS, flipping the
    // caption; only min yields 6 → FAILURE. (The modal's refusal to offset
    // is reported as a source divergence, pinned as-is.)
    rollD20.mockReturnValueOnce(16).mockReturnValueOnce(6);

    renderModal();
    await openPrompt('subscriber-trigger-adv-dis');
    expect(screen.getByText('(Disadvantage)')).toBeInTheDocument();

    await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
    expect(screen.queryByText('SAVE SUCCESS')).not.toBeInTheDocument();
    expectTotalLine(6, 13);
    expect(screen.getByText('d20 (16, 6) + 0 (Disadvantage)')).toBeInTheDocument();
  });

  // ── Plain roll: single physical die, no mode label ──

  it('rolls a single d20, unlabeled, for a non-DEX save while the target is charmed', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'testTarget' && key === 'activeConditions') return ['charmed'];
      return null;
    });
    rollD20.mockReturnValue(15);

    renderModal();
    await openPrompt();

    // The charmed-DEX positives are evasion-effects (#1941) and the DEX-only
    // selector gate is unit-pinned in savePromptUtils.test.js — only the
    // modal shows this face: the real getSaveDisadvantage read must not
    // bleed onto a CON prompt (badge hidden) or add a second physical die.
    expect(screen.queryByText('(Disadvantage)')).not.toBeInTheDocument();

    await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    // 15 + 0 bonus (empty roster, empty combatSummary) ≥ DC 12.
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    expectTotalLine(15, 12);
    // Plain roll: breakdown shows a single die and no mode suffix.
    expect(screen.getByText('d20 (15) + 0')).toBeInTheDocument();
    expect(screen.queryByText(/Disadvantage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Advantage/i)).not.toBeInTheDocument();
  });

  // ── Bonus-source routing ──

  it('uses the found character save bonus, not combatSummary saveBonuses', async () => {
    // Decoy creature bonus: if the creature lane wrongly ran, the total would
    // be 15 + 9 = 24 instead of 15 + 3 = 18.
    rollD20.mockReturnValue(15);
    vi.mocked(getCombatSummary).mockReturnValue({
      creatures: [{ name: 'testTarget', saveBonuses: { con: 9 } }],
    });

    renderModal({ characters: [createCharacter('testTarget')] });
    await openPrompt();
    await rollSave();

    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    expectTotalLine(18, 12);
    expect(screen.getByText('d20 (15) + 3')).toBeInTheDocument();
  });

  it('uses creature saveBonuses from combatSummary when the target is not on the character roster', async () => {
    // +5 proves the creature lane ran: the character stub returns +3, so a
    // mistaken character lane would show 18, not 20.
    rollD20.mockReturnValue(15);
    vi.mocked(getCombatSummary).mockReturnValue({
      creatures: [{ name: 'testTarget', saveBonuses: { con: 5 } }],
    });

    renderModal();
    await openPrompt();
    await rollSave();

    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    expectTotalLine(20, 12);
    expect(screen.getByText('d20 (15) + 5')).toBeInTheDocument();
  });

  // ── DC boundary bracket (>= per SavePromptModal.jsx:362) ──

  it('counts a save total that exactly meets the DC as a success', async () => {
    rollD20.mockReturnValue(9);

    renderModal({ characters: [createCharacter('testTarget')] });
    await openPrompt();
    await rollSave();

    // RAW: succeeding means meeting or beating the DC — 9 + 3 = 12 vs DC 12.
    // Kills the >= → > swap (this caption would flip to FAILURE).
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    expect(screen.queryByText('SAVE FAILURE')).not.toBeInTheDocument();
    expectTotalLine(12, 12);
    expect(screen.getByText('d20 (9) + 3')).toBeInTheDocument();
  });

  it('counts a save total one below the DC as a failure', async () => {
    rollD20.mockReturnValue(8);

    renderModal({ characters: [createCharacter('testTarget')] });
    await openPrompt();
    await rollSave();

    // Bracket mate of the exact-DC leg: 8 + 3 = 11 vs DC 12 fails. Kills a
    // >= dc-1 slack mutant that the exact-DC success alone would survive.
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
    expect(screen.queryByText('SAVE SUCCESS')).not.toBeInTheDocument();
    expectTotalLine(11, 12);
    expect(screen.getByText('d20 (8) + 3')).toBeInTheDocument();
  });
});
