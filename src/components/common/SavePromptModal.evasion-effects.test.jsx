// @maintained-by-ai 2026-11-27 — evasion effects lane: Beacon WIS gate + te.target matching, cosmic-omen consume, charmed/Otto DEX disadvantage (rolling-delegated)
// SavePromptModal — Evasion Effects: effect-driven save advantage/disadvantage
// and one-shot Cosmic Omen consumption at the roll seam.
//
// Owned HERE (each leg exact-pins the full .sp-result-breakdown string AND the
// visible total, dice rigged so every gate leg changes on-screen bytes):
// - Beacon of Hope root-targetEffects WIS gate (isBeaconOfHopeAdvantage,
//   SavePromptModal.jsx:139-142): grant on WIS + matching te.target; deny on
//   non-WIS; deny on mismatched te.target (the cross-target leg — dies to an
//   ignore-te.target mutant); the beacon-check-vs-disadvantage-gate ORDER leg
//   (the bonuses lane pins buff-under-prompt-disadvantage with Circle of
//   Power and its fixture has no beacon row, so only THIS leg kills a
//   move-beacon-above-the-gate reorder).
// - Cosmic Omen pending-bonus consume at the save seam: Weal fold, Woe sign,
//   the exactly-once clear pin, and the corrupt-payload guard (no phantom
//   bonus, no clear).
// - DEX-save disadvantage modal seams for charmed (conditions lane) and
//   Otto's Irresistible Dance (te lane) — rolling.test.jsx:12 delegates both
//   here; unit-level getSaveDisadvantage rules (Slow, ability-scoped, hex)
//   live in savePromptUtils.test.js.
//
// Owned ELSEWHERE — do not re-add here:
// - Done payloads, hold-until-Done, rolled Next Save advancement, Apply(0)
//   presentation gate ................................. .actions.test.jsx (#1935)
// - 5e Dodge DEX-vs-CON arithmetic, CLA-324 against_spell + lastAttack,
//   bane/bless/warding-bond bonus-string arithmetic .... .bonuses.test.jsx (#1936)
// - saveConditions / mod.condition legs ............... .cla034-conditional-save-advantage.test.jsx (#1937)
// - CLA-211 evasion trigger gate/stamp/skip/Apply ..... .cla211-leading-evasion.test.jsx (#1938)
// - chooser row tick UX, overlay inertness, confirm-closes-leaves-PENDING,
//   clear/dismiss advancement ......................... .coverage.test.jsx (#1939)
// - 2024 Dodge ruleset gate (BA-001) .................. .dodge-2024.test.jsx (#1940)
// - explicit prompt-flag disadvantage min math / DC boundary ... .rolling.test.jsx
// - Evasion NOTE display branches ..................... .evasion-note-selection.test.jsx
//
// The Done-payload pins below are consume projections only (total/saveBonus/
// bonusDetail on THIS fixture) — the submit-flow contract itself is owned by
// .actions. ARITY TRUTH (#1878): getRuntimeValue is a 2-param API
// (useRuntimeState.js:63 — store resolves from characterKey alone), so the
// savePromptUtils.js:350-adjacent root read without a campaignName 3rd arg is
// cosmetic, not a cross-campaign leak; the 3rd args at :139/:27 read sites are
// silently ignored.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';

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
// exist on the mock or its access throws, even though this lane never sends.
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// Flat +3 save bonus for every ability — totals below are computed against it.
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

// Keys mirror the graph's actual imports (sibling pattern #1935-#1940):
// getStore (applyDamage.js), deleteRuntimeKey (savePrompt.js),
// setRuntimeObject + getAllStoreKeys (applyDamage.js / expirationQueue.js /
// infernalWoundService.js). The old useSyncedState + listeners keys were
// phantom (exported-but-not-imported, #1910) — purged.
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

// Only the triggers this lane exercises (per-targetName savePrompt keys).
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const fire = (testId, data) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-${data.targetName}`, data }),
      });
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      fire('subscriber-trigger-con', { promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false }),
      fire('subscriber-trigger-wis', { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false, dcSuccess: 'half' }),
      fire('subscriber-trigger-wis-dis', { promptId: 'test-prompt-wis-dis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: true, dcSuccess: 'half' }),
      fire('subscriber-trigger-dex', { promptId: 'test-prompt-dex', targetName: 'testTarget', saveType: 'dex', saveDc: 17, disadvantage: false, dcSuccess: 'half', sourceName: 'Sacred Flame' })
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

const targetChar = () => createCharacter('testTarget');

// Persistent dice rig (no *Once chains): consume scripted values, then clamp
// to the last one so an unexpected extra roll yields a loud, countable
// mismatch rather than a silently reused default.
function rigDice(values) {
  let i = 0;
  rollD20.mockImplementation(() => values[Math.min(i++, values.length - 1)]);
}

/** Route store reads through a `${name}.${key}` table; everything else null. */
function mockStore(reads) {
  getRuntimeValue.mockImplementation((name, key) => reads[`${name}.${key}`] ?? null);
}

// Canonical producer row shapes (beaconOfHopeHandler.js:104-109 /
// ottosDanceHandler.js:165-171). Only te.target/te.effect gate the modal, but
// the rows mirror the real store bytes so a shape drift is honest.
const beaconRow = (target) => ({
  target,
  effect: 'beacon_of_hope',
  label: 'Beacon of Hope',
  caster: 'testCaster',
  duration: 'concentration',
});
const ottoRow = (target) => ({
  target,
  effect: 'ottos_irresistible_dance',
  source: 'testCaster',
  dc: 15,
  duration: 'concentration',
  conditions: ['charmed', 'speed_zero'],
});

/** Open the prompt, roll, flush on the exact caption; return visible result bytes. */
async function rollPrompt(triggerTestId, expectedCaption) {
  render(<SavePromptModal campaignName="test-campaign" characters={[targetChar()]} activeMapName={null} />);
  fireEvent.click(screen.getByTestId(triggerTestId));
  await screen.findByTestId('active-save-prompt');
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  // Caption and total/breakdown land in the SAME result render — flushing on
  // the exact copy (#1936 idiom) needs no DOM polling.
  await screen.findByText(expectedCaption);
  return {
    total: document.querySelector('.sp-result-total strong').textContent,
    breakdown: document.querySelector('.sp-result-breakdown').textContent,
  };
}

/** Cosmic-omen clear calls: exactly-once detector + 5-arg write pin (#1878). */
function expectOmenClearedOnce() {
  const clears = setRuntimeValue.mock.calls.filter(([, key]) => key === 'cosmicOmenPendingBonus');
  expect(clears).toHaveLength(1);
  expect(clears[0]).toEqual(['cosmicOmen', 'cosmicOmenPendingBonus', null, 'test-campaign', true]);
}

describe('SavePromptModal — Evasion Effects', () => {
  beforeEach(() => {
    // Clears all mocks; rollD20→15, computeAuraBonus→{bonus:0}, getRuntimeValue→null.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    getCombatSummary.mockReturnValue({ creatures: [] });
  });
  afterEach(cleanupDefaults);

  // ── Beacon of Hope (campaign-root targetEffects, WIS-only, te.target) ──

  it('grants advantage on a Wisdom save to the beaconed target and keeps the higher d20', async () => {
    rigDice([7, 17]);
    mockStore({ 'campaign.targetEffects': [beaconRow('testTarget')] });

    const { total, breakdown } = await rollPrompt('subscriber-trigger-wis', 'SAVE SUCCESS');

    // Two dice, maximum (17) kept: 17 + 3 = 20 ≥ DC 13.
    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (7, 17) + 3 (Advantage)');
    expect(total).toBe('20');
  });

  it('does not grant beacon_of_hope advantage on a non-Wisdom save', async () => {
    rigDice([15]);
    mockStore({ 'campaign.targetEffects': [beaconRow('testTarget')] });

    const { total, breakdown } = await rollPrompt('subscriber-trigger-dex', 'SAVE SUCCESS');

    // A WIS-gate collapse would roll twice: (15, 15) + 3 (Advantage).
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (15) + 3');
    expect(total).toBe('18');
    expect(screen.queryByText(/Advantage|Disadvantage/)).not.toBeInTheDocument();
  });

  it('does not grant advantage when the beacon targetEffect names another creature', async () => {
    rigDice([15]);
    mockStore({ 'campaign.targetEffects': [beaconRow('someoneElse')] });

    const { total, breakdown } = await rollPrompt('subscriber-trigger-wis', 'SAVE SUCCESS');

    // te.target matching leg: an ignore-target mutant rolls twice and shows
    // 'd20 (15, 15) + 3 (Advantage)'.
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (15) + 3');
    expect(total).toBe('18');
    expect(screen.queryByText(/Advantage|Disadvantage/)).not.toBeInTheDocument();
  });

  it('does not let beacon_of_hope override explicit prompt disadvantage', async () => {
    // Order pin for the beacon check inside computeSaveAdvantage: the gate at
    // :147 (`if (hasDisadvantage) return false`) must stay ahead of it.
    rigDice([14, 6]);
    mockStore({ 'campaign.targetEffects': [beaconRow('testTarget')] });

    const { total, breakdown } = await rollPrompt('subscriber-trigger-wis-dis', 'SAVE FAILURE');

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (14, 6) + 3 (Disadvantage)');
    expect(total).toBe('9'); // 6 + 3 < DC 13 — max-kept mutant would show 17.
  });

  // ── Cosmic Omen (one-shot pending bonus consumed at the roll seam) ──

  it('folds a Weal pending bonus into the save total, clears it exactly once, and posts the projection on Done', async () => {
    rigDice([15]);
    mockStore({ 'cosmicOmen.cosmicOmenPendingBonus': JSON.stringify({ type: 'Weal', value: 2 }) });

    const { total, breakdown } = await rollPrompt('subscriber-trigger-con', 'SAVE SUCCESS');

    // 15 + 3 save + 2 Weal = 20, with the omen itemized in the breakdown.
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (15) + 5 (+2 from Weal)');
    expect(total).toBe('20');
    expectOmenClearedOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
        promptId: 'test-prompt-1',
        success: true,
        total: 20,
        saveBonus: 5,
        bonusDetail: '(+2 from Weal)',
      }));
    });
  });

  it('subtracts a Woe pending bonus from the save total and clears it exactly once', async () => {
    rigDice([15]);
    mockStore({ 'cosmicOmen.cosmicOmenPendingBonus': JSON.stringify({ type: 'Woe', value: 3 }) });

    const { total, breakdown } = await rollPrompt('subscriber-trigger-con', 'SAVE SUCCESS');

    // Woe is NEGATIVE: 15 + 3 − 3 = 15 (a sign bug would show 21 / '+3 from Woe').
    expect(breakdown).toBe('d20 (15) + 0 (-3 from Woe)');
    expect(total).toBe('15');
    expectOmenClearedOnce();
  });

  it('rolls normally when the pending cosmic omen payload is unparseable and does not clear it', async () => {
    rigDice([15]);
    mockStore({ 'cosmicOmen.cosmicOmenPendingBonus': '{not json' });

    const { total, breakdown } = await rollPrompt('subscriber-trigger-con', 'SAVE SUCCESS');

    // Corrupt payload must not corrupt the roll: no phantom bonus, no omen copy.
    expect(breakdown).toBe('d20 (15) + 3');
    expect(total).toBe('18');
    expect(screen.queryByText(/from (Weal|Woe)/i)).not.toBeInTheDocument();
    expect(setRuntimeValue.mock.calls.filter(([, key]) => key === 'cosmicOmenPendingBonus')).toHaveLength(0);
  });

  // ── DEX-save disadvantage modal seams (rolling.test.jsx:12 delegates both) ──

  it('rolls with disadvantage (keeps the lower d20) on a DEX save while the target is charmed', async () => {
    rigDice([16, 9]);
    mockStore({ 'testTarget.activeConditions': ['charmed'] });

    const { total, breakdown } = await rollPrompt('subscriber-trigger-dex', 'SAVE FAILURE');

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (16, 9) + 3 (Disadvantage)');
    expect(total).toBe('12'); // 9 + 3 < DC 17 — max-kept mutant would show 19.
  });

  it('rolls with disadvantage on a DEX save under an ottos_irresistible_dance targetEffect', async () => {
    rigDice([16, 9]);
    // te lane only: activeConditions stay null so this pins the Otto te-row
    // branch, not the charmed-conditions branch above.
    mockStore({ 'campaign.targetEffects': [ottoRow('testTarget')] });

    const { total, breakdown } = await rollPrompt('subscriber-trigger-dex', 'SAVE FAILURE');

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (16, 9) + 3 (Disadvantage)');
    expect(total).toBe('12');
  });
});
