// @maintained-by-ai 2026-11-27 — four-feature reroll lanes: per-feature token+full-string breakdown pins, spend-shape pins (double-write defect noted), mock keys mirrored to #1935-#1945, phantoms purged, 18→13 trim
// SavePromptModal — class-feature reroll lanes at the save-prompt seam:
// Fanatical Focus (Barbarian, +rage-damage reroll), Disciplined Survivor
// (spends 1 focus point, no bonus), Living Legend (free reroll, spends
// nothing) and Guarded Mind (Mage Slayer feat: failed INT/WIS/CHA save →
// automatic success, once per Short/Long Rest — shape per 2024 feats.json).
//
// Owned HERE (per feature its OWN seam; positive legs exact-pin the visible
// .sp-result-total strong and the full .sp-result-breakdown string, dice
// rigged so a dropped/foreign bonus changes on-screen bytes, not just a call
// count — #1936/#1943 idiom):
// - Fanatical Focus: the 'Reroll Save (+N)' label built from the class-row
//   rage_damage, the '(+N Fanatical Focus)' token, and reroll dice chosen so
//   success is reachable ONLY with the +2 (8 + 3 = 11 < DC 12); plus the
//   shared fanaticalFocusUsed flag that also closes the Disciplined Survivor
//   and Living Legend lanes once spent.
// - Disciplined Survivor: the max-focus-points fallback read (null runtime →
//   class row), the focusPoints decrement WRITE (3 → 2, campaign-scoped), the
//   '(-1 Focus Point)' token, and the exhausted-at-0 boundary.
// - Living Legend: bonus-free reroll — breakdown carries NO token
//   ('d20 (15) + 3'), zero setRuntimeValue writes (free is its identity), and
//   its own hide gates (inactive flag, indomitableUses ≥ 1).
// - Guarded Mind: mental-save gate (CON negative on the SAME armed fixture),
//   the override that never spends a second d20 (rollD20 exactly once), the
//   forced roll 20 / total = DC / saveBonus 0 payload, the '(Guarded Mind)'
//   token, the '_guardedMind_usedRest' write bracketed false↔'rest', and its
//   ability_use log line.
//
// Owned ELSEWHERE — do not re-add here:
// - Done payloads, hold-until-Done, rolled Next Save advancement, Apply(0)
//   presentation gate ................................. .actions.test.jsx (#1935)
// - 5e Dodge arithmetic, CLA-324 against_spell + lastAttack,
//   bane/bless/warding-bond bonus-string arithmetic .... .bonuses.test.jsx (#1936)
// - saveConditions / mod.condition legs ............... .cla034-conditional-save-advantage.test.jsx (#1937)
// - CLA-211 evasion trigger gate/stamp/skip/Apply ..... .cla211-leading-evasion.test.jsx (#1938)
// - chooser row tick UX, overlay inertness, confirm-closes-leaves-PENDING,
//   clear/dismiss advancement ......................... .coverage.test.jsx (#1939)
// - 2024 Dodge ruleset gate (BA-001) .................. .dodge-2024.test.jsx (#1940)
// - Beacon WIS gate, Cosmic Omen consume, charmed/Otto DEX disadvantage .... .evasion-effects.test.jsx (#1941)
// - holy_aura te grant + ALL-saves contrast ........... .holy-aura.test.jsx (#1942)
// - Indomitable availability matrix / cap ladder AND the shared
//   rerollUsedForSave once-per-failed-save gate (a failed reroll offers no
//   second chance — proven there, never restated per-feature)
//   .................................................. .indomitable.test.jsx (#1943)
// - MA-0367 'full'-row copy + reroll-cancel/HP-restore seam (no rawDamage on
//   any prompt here, so no restore leg can fire — #1944 confirmed this lane
//   owns none) ........................................ .infernal-wound.test.jsx (#1944)
// - half/none damage-note copy ........................ .rendering.test.jsx (#1945)
// - DC-boundary/min-math + explicit-flag disadvantage roll layer
//   .................................................. .rolling.test.jsx (NEXT)
// - Handler-level payload threading, unavailable/no-prompt guards for the
//   four factories ............. savePromptHandlers.disciplined-survivor.test.js
//
// SOURCE DEFECTS observed while trimming (reported, NOT fixed here):
// 1. FF/DS/GM spend their runtime key TWICE per click: useSaveRerollHandlers
//    .js:20/:28/:48 writes what savePromptHandlers.js:50/:60/:70 writes again
//    (Indomitable is the only single-write lane). Spend pins therefore assert
//    the value+campaign shape with toContainEqual instead of a call count — a
//    future de-duplication fix keeps these green, a value/campaign regression
//    does not.
// 2. SavePromptModal.jsx:729-730 cross-couples the pools: once
//    fanaticalFocusUsed is truthy, the Monk focus-point and Living Legend
//    lanes are hidden too, and Living Legend additionally hides whenever
//    indomitableUses ≥ 1. Pinned as-is (the cross-lane legs prove it) — but
//    the coupling looks unintended for a Barbarian flag to gate a Monk pool.
//
// Fixture honesty: every runtime seed is a real producer key/value shape —
// 'activeBuffs' rows with damageBonusExpression (isRaging, SavePromptModal
// .jsx:668), 'focusPoints' numeric, 'livingLegendActive' boolean read with
// === true (livingLegendHandler.js:4), '_guardedMind_usedRest' string 'rest'
// (autoRerollHandler.js:191-194), the Mage Slayer automation row copied from
// public/data/2024/feats.json. No clock/timers anywhere — these pools are
// rest-seam resources.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { setupDefaults, cleanupDefaults, createRageCharacter } from './SavePromptModal.test-utils.jsx';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

// Bare factory (NOT the #1943 importOriginal spread): no fixture here carries
// a reroll saveModifiers row, so the live evaluateAutoExpression path never
// runs and canRollExpression/rollExpressionMaximized are never read.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

// sendSavePrompt is a real graph import (savePrompt.js → this module); it must
// exist on the mock even though this lane never sends (#1935-#1944 pattern).
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// Flat +3 save bonus for every character/ability; no leg overrides it.
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

// Graph keys mirrored to the sibling lanes (#1935-#1944): no
// useSyncedState/listeners phantoms — this modal never imports them.
// deleteRuntimeKey/setRuntimeObject/getAllStoreKeys back real graph imports
// (savePrompt.js, infernalWoundService.js, store probes).
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
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

// Subscriber feeds SSE save-prompt events through the modal's handleEvent
// seam. Only the two triggers this file needs, both targeted at 'testTarget'
// so negative paths exercise the SAME character the positives arm.
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const trigger = (testId, data) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-${data.targetName}`, data }),
      });
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      trigger('subscriber-trigger-con', { promptId: 'test-prompt-con', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false }),
      trigger('subscriber-trigger-wis', { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false })
    );
  }
  return { default: MockSubscriber };
});

// ── Fixtures & helpers ──

const RAGE_BUFF = [{ damageBonusExpression: 'rage_damage' }];

// Mage Slayer feat automation, byte-from public/data/2024/feats.json
// (findGuardedMindAction keys on type/effect/oncePer).
const GUARDED_MIND_ACTION = {
  type: 'auto_reroll',
  trigger: 'failed_int_wis_cha_save',
  effect: 'override_fail_to_success',
  oncePer: 'short_or_long_rest',
  casting_time: 'passive',
};

// Seeds EVERY reroll-related runtime read (producer shapes) so only the lane
// under test can open — no foreign reroll button ever leaks into a lane's
// matrix (#1944 full-resource-seeding idiom). focusPoints: null leaves the
// `?? maxFocusPoints` class-row fallback observable.
function mockRuntime({
  raging = false,
  focusUsed = false,
  focusPoints = 0,
  legendActive = false,
  indomitableUses = 0,
  guardedMindUsed = false,
} = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    switch (key) {
      case 'activeBuffs': return raging ? RAGE_BUFF : [];
      case 'activeConditions': return [];
      case 'fanaticalFocusUsed': return focusUsed;
      case 'focusPoints': return focusPoints;
      case 'livingLegendActive': return legendActive;
      case 'indomitableUses': return indomitableUses;
      case '_guardedMind_usedRest': return guardedMindUsed;
      default: return null;
    }
  });
}

function makeCharacter({ classLevels = [{}], specialActions = [] } = {}) {
  return {
    name: 'testTarget',
    level: 1,
    class: { class_levels: classLevels },
    computedStats: {
      abilities: [{ name: 'Constitution', bonus: 3 }],
      evasionEffects: [],
      automation: { passives: [], specialActions },
    },
    saveModifiers: [],
  };
}

const writesFor = (key) => setRuntimeValue.mock.calls.filter(([, k]) => k === key);
const visibleTotal = () => document.querySelector('.sp-result-total strong').textContent;
const visibleBreakdown = () => document.querySelector('.sp-result-breakdown').textContent;

function expectRerollLog(note) {
  expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
    note,
    targetName: 'testTarget',
    saveResult: 'success',
  }));
}

// Walks prompt → Roll Save → failed caption (die 1 + the mocked +3 bonus
// fails both DCs used here: 4 < 12 and 4 < 13).
async function openFailedSave(character, triggerTestId = 'subscriber-trigger-con') {
  rollD20.mockReturnValue(1);
  render(
    <SavePromptModal
      campaignName="test-campaign"
      characters={[character]}
      activeMapName={null}
    />
  );
  fireEvent.click(screen.getByTestId(triggerTestId));
  await screen.findByTestId('active-save-prompt');
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await screen.findByText('SAVE FAILURE');
}

// Every reroll affordance the result panel can offer, for "no way out"
// negative assertions (Roll Save cannot match — it lacks 'Reroll').
function rerollButtons() {
  return screen.queryAllByRole('button', { name: /Reroll Save|Guarded Mind|Indomitable/ });
}

describe('SavePromptModal — class-feature rerolls', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Fanatical Focus ──

  it('offers no reroll lane after a failed save when every resource is closed', async () => {
    mockRuntime();
    await openFailedSave(createRageCharacter('testTarget', 2));

    expect(rerollButtons()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('shows the +2 Fanatical Focus reroll button only after the save actually fails', async () => {
    mockRuntime({ raging: true });
    rollD20.mockReturnValue(1);
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[createRageCharacter('testTarget', 2)]}
        activeMapName={null}
      />
    );
    fireEvent.click(screen.getByTestId('subscriber-trigger-con'));
    await screen.findByTestId('active-save-prompt');

    expect(rerollButtons()).toHaveLength(0); // nothing offered before the roll

    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
    await screen.findByText('SAVE FAILURE');

    // Exactly the FF lane is open: label +N comes from the class-row
    // rage_damage (SavePromptModal.jsx:1171), not a fabricated constant.
    expect(rerollButtons()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Reroll Save (+2)' })).toBeInTheDocument();
  });

  it('rerolls with the +2 Fanatical Focus bonus folded into total, token and spend write', async () => {
    mockRuntime({ raging: true });
    await openFailedSave(createRageCharacter('testTarget', 2));
    expect(visibleTotal()).toBe('4'); // 1 + 3, pre-reroll face
    expect(visibleBreakdown()).toBe('d20 (1) + 3');

    // Reroll die 8: 8 + 3 = 11 still fails DC 12 — success is reachable ONLY
    // with the +2 rage bonus (8 + 5 = 13). A dropped extraBonus flips the
    // caption, not just the payload.
    rollD20.mockReturnValue(8);
    fireEvent.click(screen.getByRole('button', { name: 'Reroll Save (+2)' }));
    await screen.findByText('d20 (8) + 5 (+2 Fanatical Focus)');

    expect(visibleTotal()).toBe('13');
    expect(visibleBreakdown()).toBe('d20 (8) + 5 (+2 Fanatical Focus)');
    expect(rollD20).toHaveBeenCalledTimes(2); // the reroll physically happened
    // Spend write (value + WRITE-side campaign pin; SOURCE DEFECT 1 explains
    // why this is a shape pin, not a call count).
    expect(writesFor('fanaticalFocusUsed')).toContainEqual(['testTarget', 'fanaticalFocusUsed', true, 'test-campaign']);
    expect(writesFor('focusPoints')).toHaveLength(0); // no foreign lane spent
    // Rerolls auto-submit exactly once (hold-until-Done is .actions, #1935).
    expect(sendSaveResult).toHaveBeenCalledTimes(1);
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-con',
      success: true,
      roll: 8,
      total: 13,
      bonusDetail: '(+2 Fanatical Focus)',
    }));
    expectRerollLog('fanatical_focus_reroll');
  });

  it('closes the Disciplined Survivor and Living Legend lanes too once Fanatical Focus is spent (shared flag)', async () => {
    // Focus points AND an active Living Legend would each offer their own
    // button; the fanaticalFocusUsed flag (SavePromptModal.jsx:729-730) must
    // suppress both. SOURCE DEFECT 2 pinned as-is.
    mockRuntime({ raging: true, focusUsed: true, focusPoints: 2, legendActive: true });
    await openFailedSave(createRageCharacter('testTarget', 2));

    expect(rerollButtons()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // ── Disciplined Survivor ──

  it('falls back to the class-row focus maximum, spends one point, and submits the un-bonused reroll', async () => {
    mockRuntime({ focusPoints: null }); // unseeded read → ?? maxFocusPoints
    await openFailedSave(makeCharacter({ classLevels: [{ focus_points: 3 }] }));

    expect(rerollButtons()).toHaveLength(1); // only the DS lane is open
    expect(screen.getByRole('button', { name: 'Reroll Save (1 Focus Point)' })).toBeInTheDocument();

    rollD20.mockReturnValue(15);
    fireEvent.click(screen.getByRole('button', { name: 'Reroll Save (1 Focus Point)' }));
    await screen.findByText('d20 (15) + 3 (-1 Focus Point)');

    expect(visibleTotal()).toBe('18'); // no extraBonus — this reroll is bare
    expect(visibleBreakdown()).toBe('d20 (15) + 3 (-1 Focus Point)');
    expect(rollD20).toHaveBeenCalledTimes(2);
    // Decrement derived from the fallback max: 3 → 2, campaign-scoped write.
    expect(writesFor('focusPoints')).toContainEqual(['testTarget', 'focusPoints', 2, 'test-campaign']);
    for (const key of ['fanaticalFocusUsed', 'indomitableUses', '_guardedMind_usedRest']) {
      expect(writesFor(key)).toHaveLength(0);
    }
    expect(sendSaveResult).toHaveBeenCalledTimes(1);
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-con',
      success: true,
      roll: 15,
      total: 18,
      bonusDetail: '(-1 Focus Point)',
    }));
    expectRerollLog('disciplined_survivor_reroll');
  });

  it('offers no reroll and spends nothing when focus points are exhausted', async () => {
    mockRuntime({ focusPoints: 0 }); // explicit-zero beats the class max
    await openFailedSave(makeCharacter({ classLevels: [{ focus_points: 3 }] }));

    expect(rerollButtons()).toHaveLength(0);
    expect(writesFor('focusPoints')).toHaveLength(0);
  });

  // ── Guarded Mind ──

  it('converts a failed mental save to an automatic success without a second die, locking the feat until the next rest', async () => {
    mockRuntime({ guardedMindUsed: false });
    await openFailedSave(makeCharacter({ specialActions: [GUARDED_MIND_ACTION] }), 'subscriber-trigger-wis');

    expect(rerollButtons()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Guarded Mind' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guarded Mind' }));
    await screen.findByText('d20 (20) + 0 (Guarded Mind)');

    expect(visibleTotal()).toBe('13'); // forced total = the prompt's DC
    expect(visibleBreakdown()).toBe('d20 (20) + 0 (Guarded Mind)');
    expect(rollD20).toHaveBeenCalledTimes(1); // override, not reroll — no second d20
    expect(writesFor('_guardedMind_usedRest')).toContainEqual(['testTarget', '_guardedMind_usedRest', 'rest', 'test-campaign']);
    for (const key of ['fanaticalFocusUsed', 'focusPoints', 'indomitableUses']) {
      expect(writesFor(key)).toHaveLength(0);
    }
    expect(sendSaveResult).toHaveBeenCalledTimes(1);
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-wis',
      success: true,
      roll: 20,
      total: 13,
      saveBonus: 0,
      mode: 'normal',
      bonusDetail: '(Guarded Mind)',
    }));
    expectRerollLog('guarded_mind_reroll');
    // The feat use also logs its own ability_use row with the upper-cased
    // save label (automation-must-log rule).
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'ability_use',
      abilityName: 'Guarded Mind',
      characterName: 'testTarget',
      description: 'testTarget used Guarded Mind to override a failed WIS save.',
    }));
  });

  it('does not offer Guarded Mind on a non-mental CON save from the same armed character', async () => {
    mockRuntime({ guardedMindUsed: false });
    await openFailedSave(makeCharacter({ specialActions: [GUARDED_MIND_ACTION] }));

    expect(rerollButtons()).toHaveLength(0); // no lane at all, GM or otherwise
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('offers no Guarded Mind once it has been used since the last rest', async () => {
    mockRuntime({ guardedMindUsed: 'rest' }); // producer value, autoRerollHandler.js:194
    await openFailedSave(makeCharacter({ specialActions: [GUARDED_MIND_ACTION] }), 'subscriber-trigger-wis');

    expect(rerollButtons()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // ── Living Legend ──

  it('rerolls for free — no bonus token in the breakdown and no tracked resource spent', async () => {
    mockRuntime({ legendActive: true });
    await openFailedSave(makeCharacter());

    expect(rerollButtons()).toHaveLength(1); // label is the bare 'Reroll Save'
    expect(screen.getByRole('button', { name: 'Reroll Save' })).toBeInTheDocument();

    rollD20.mockReturnValue(15);
    fireEvent.click(screen.getByRole('button', { name: 'Reroll Save' }));
    await screen.findByText('d20 (15) + 3'); // NO token: the breakdown must stay bare

    expect(visibleTotal()).toBe('18');
    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(setRuntimeValue).not.toHaveBeenCalled(); // free is Living Legend's identity
    expect(sendSaveResult).toHaveBeenCalledTimes(1);
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-con',
      success: true,
      roll: 15,
      total: 18,
      bonusDetail: undefined,
    }));
    expectRerollLog('living_legend_reroll');
  });

  it.each([
    ['inactive', { legendActive: false }],
    ['blocked by one spent Indomitable use (its own uses gate)', { legendActive: true, indomitableUses: 1 }],
  ])('hides the Living Legend reroll when the feature is %s', async (_case, seed) => {
    mockRuntime(seed);
    await openFailedSave(makeCharacter());

    expect(rerollButtons()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // ── Across all lanes ──

  it('offers no reroll button on a successful save, even with every lane available', async () => {
    // All four availabilities are genuinely open on this WIS prompt (rage +
    // focus points + legend + feat row) — the !result.success gate must
    // still close the whole reroll seam.
    mockRuntime({ raging: true, focusPoints: 2, legendActive: true });
    rollD20.mockReturnValue(15); // 15 + 3 = 18 passes DC 13
    render(
      <SavePromptModal
        campaignName="test-campaign"
        characters={[makeCharacter({
          classLevels: [{ rage_damage: 2, focus_points: 3 }],
          specialActions: [GUARDED_MIND_ACTION],
        })]}
        activeMapName={null}
      />
    );
    fireEvent.click(screen.getByTestId('subscriber-trigger-wis'));
    await screen.findByTestId('active-save-prompt');
    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
    await screen.findByText('SAVE SUCCESS');

    expect(rerollButtons()).toHaveLength(0);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
