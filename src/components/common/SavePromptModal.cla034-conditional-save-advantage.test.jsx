// @maintained-by-ai 2026-11-27 — CLA-034 conditional save advantage, trimmed to six with full-string pins
// CLA-034: conditional_advantage saveModifiers whose `condition` matches the
// SAVE's own condition (Beguiling Twist / Brave / Fey Ancestry: "advantage on
// saving throws to avoid/end Charmed or Frightened") key on the prompt's
// condition payload — `condition` or `saveConditions` via
// saveConditionsOfPrompt (SavePromptModal.jsx:102-105, :120) — never on the
// target merely having the condition active. The old bug: the AVOID half fired
// normal on fresh saves and unrelated saves were over-granted.
//
// Owned HERE: the mod.condition ∈ saveConditions gating — both condition
// spellings, AVOID/END active-condition irrelevance, the saving_throw+advantage
// row-shape guard, the no-grantor negative control, and the disadvantage-
// precedence interaction WITH a saveConditions match (the bonuses lane pins
// buff-under-disadvantage precedence with Circle of Power as the source; its
// fixture has no saveModifiers row, so only this lane kills a
// modifier-check-before-disadvantage-gate reorder).
//
// Owned ELSEWHERE — do not re-add here:
// - against_spell legs incl. the lastAttack branch ... bonuses.test.jsx (#1936)
// - Done payloads, hold-until-Done, queue counters ........ actions.test.jsx (#1935)
// - Dodge / Circle of Power / Nimbus / Zealous / Beacon / Holy Aura
//   advantage sources .. dodge-2024 / bonuses / zealous-presence /
//                        evasion-effects / holy-aura
// - Leading Evasion .................... cla211-leading-evasion.test.jsx
//
// Every test pins the FULL visible breakdown and total strings (#1936 idiom),
// dice rigged so each roll mode yields a different total or token string — a
// collapsed or swapped roll mode changes the on-screen bytes, not just a call
// count. NOTE (source bug, reported not fixed): SavePromptModal.jsx:121
// (mod.saveType + condition-equality leg) is unreachable — :120 already
// returns true whenever its predicate could hold — so it is intentionally
// unpinned.
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

// sendSavePrompt is a real graph import (savePrompt.js → this module); it must
// exist on the mock or its access throws, even though this lane never sends
// (same audit as actions.test.jsx #1935 / bonuses.test.jsx #1936).
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

// Keys mirror the graph's actual imports (audit shared with actions #1935 /
// bonuses #1936): getStore + setRuntimeObject (applyDamage.js),
// deleteRuntimeKey (savePrompt.js), getAllStoreKeys (infernalWoundService.js).
// The old keys useSyncedState (NOT a useRuntimeState export — phantom) and
// `listeners` (an export, imported by nothing in this graph) are purged.
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

// Beguiling Twist holder: two real-shaped saving_throw advantage rows keyed on
// charmed and frightened. WIS/DEX resolve to +3 via the mocked
// getAbilitySaveBonus; the ability scores mirror that (+3 each) so the fixture
// stays truthful even if the mock is ever lifted.
function beguilingHolder() {
  return {
    name: 'testTarget',
    computedStats: {
      abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Dexterity', bonus: 3 }],
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
  // Testid flushes the async pre-roll breakdown render; prompt copy is the
  // rendering lane's face (#1935 idiom: flush by testid, assert exact copy).
  await screen.findByTestId('active-save-prompt');
}

/** Click Roll Save once, wait for the result panel, return its visible text. */
async function rollSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => expect(screen.getByText(/Total:/i)).toBeInTheDocument());
  return {
    total: screen.getByText(/Total:/i).textContent,
    breakdown: screen.getByText(/^d20 /).textContent,
  };
}

describe('SavePromptModal — CLA-034 conditional save advantage', () => {
  beforeEach(() => {
    // Explicit re-baseline of EVERY override (clearAllMocks keeps
    // mockReturnValue): dice→15, aura neutral, store reads null, and the
    // three bare vi.fn graph stubs back to their lane defaults.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(false);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
    vi.mocked(getAllyList).mockReturnValue([]);
  });
  afterEach(cleanupDefaults);

  it('AVOID half: a fresh frightened save rolls with advantage even when not yet frightened', async () => {
    // max(8, 13) + 3 = 16 vs DC 12. Normal (8 + 3 = 11) and disadvantage
    // (min 8 + 3 = 11) both fail — only correct advantage succeeds.
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(13);
    renderModal([beguilingHolder()], []);
    await triggerPrompt('prompt-frightened-save');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (8, 13) + 3 (Advantage)');
    expect(total).toBe('Total: 16 vs DC 12');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('END half: advantage remains when re-saving against frightened while already frightened', async () => {
    // The active condition must NOT suppress the END half: identical dice and
    // identical full pins to the AVOID test — the modifier read is blind to
    // activeConditions in both directions.
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(13);
    renderModal([beguilingHolder()], ['frightened']);
    await triggerPrompt('prompt-frightened-save');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (8, 13) + 3 (Advantage)');
    expect(total).toBe('Total: 16 vs DC 12');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('NO over-grant: unrelated DEX save rolls normal while frightened is active', async () => {
    // Single d20 of 8 → 8 + 3 = 11 vs DC 12 → failure. If the grant keyed on
    // the active condition, a second die (default 15) would lift it to
    // 18/success; a min-pick mutant keeps the total but loses the times(1)
    // and the mode-suffix-free breakdown.
    rollD20.mockReturnValueOnce(8);
    renderModal([beguilingHolder()], ['frightened']);
    await triggerPrompt('prompt-dex-save');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (8) + 3');
    expect(total).toBe('Total: 11 vs DC 12');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
  });

  it('condition-route: a payload carrying condition:"charmed" grants advantage', async () => {
    // Prompts built by SetConditionModal carry `condition` directly instead of
    // the saveConditions array — saveConditionsOfPrompt's condition branch.
    // DC 13 keeps the total string distinct from the saveConditions tests.
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(13);
    renderModal([beguilingHolder()], []);
    await triggerPrompt('prompt-condition-route');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (8, 13) + 3 (Advantage)');
    expect(total).toBe('Total: 16 vs DC 13');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('non-matching grantors: rows wrong on target or effect grant nothing on a frightened save', async () => {
    // Same frightened prompt + active frightened as the AVOID/END tests, but
    // the only modifier rows are an ability_check advantage and a
    // saving_throw flat bonus — the :110 row-shape guard must skip both.
    // (Replaces the old empty-saveModifiers face: deleting the length-0 guard
    // cannot change behavior, so only row-shape decoys discriminate here.)
    rollD20.mockReturnValueOnce(8);
    const holder = beguilingHolder();
    holder.saveModifiers = [
      { source: 'Decoy One', target: 'ability_check', effect: 'advantage', condition: 'frightened', abilities: [], skills: [] },
      { source: 'Decoy Two', target: 'saving_throw', effect: 'bonus', condition: 'frightened', abilities: [], skills: [] },
    ];
    renderModal([holder], ['frightened']);
    await triggerPrompt('prompt-frightened-save');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (8) + 3');
    expect(total).toBe('Total: 11 vs DC 12');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
  });

  it('disadvantage wins: a frightened save forced at disadvantage rolls with disadvantage, not advantage', async () => {
    // min(15, 8) + 3 = 11 vs DC 12 → failure. Conditional advantage must
    // never override a prompt's explicit disadvantage — the only lane killing
    // a modifier-check-before-gate reorder (bonuses #1936 uses CoP there).
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(8);
    renderModal([beguilingHolder()], []);
    await triggerPrompt('prompt-frightened-disadv');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (15, 8) + 3 (Disadvantage)');
    expect(total).toBe('Total: 11 vs DC 12');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
  });
});
