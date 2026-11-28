// @maintained-by-ai 2026-11-27 — holy aura lane: te.target matching + ALL-saves grant contrast vs Beacon's WIS gate; mock keys mirrored to #1935-#1941, phantoms purged, exact-string pins
// SavePromptModal — Holy Aura save advantage (SP-067): the REAL
// getHolyAuraSaveAdvantage selector (savePromptUtils.js:41-45) runs here, driven
// by actual `holy_aura` campaign targetEffects through the (mocked) runtime
// store — never by stubbing the selector or a prompt flag. Only the store read,
// the dice, the network send, and orthogonal seams (Aura of Protection, Circle
// of Power, Nimbus, allies) are stubbed.
//
// Owned HERE (each leg exact-pins the full .sp-result-breakdown string AND the
// visible total, dice rigged so every gate leg changes on-screen bytes):
// - Grant on te.target match across save types: WIS AND CON legs sharing one
//   fixture except the prompt save type — the ALL-saves contrast vs Beacon of
//   Hope's WIS gate (#1941 denies the identical-shape row on a non-WIS save).
// - Pre-roll '(Advantage)' chip comes from the te, not the prompt flags.
// - Deny legs: no targetEffects at all, and a holy_aura row naming another
//   creature (te.target mutant-killer — an ignore-target collapse rolls twice
//   and shows 'd20 (15, 15) + 3 (Advantage)').
// - Honest-failure leg: keep-highest still applies below the DC.
//
// Owned ELSEWHERE — do not re-add here:
// - Done payloads, hold-until-Done, rolled Next Save advancement, Apply(0)
//   presentation gate ................................. .actions.test.jsx (#1935)
// - 5e Dodge DEX-vs-CON arithmetic, CLA-324 against_spell + lastAttack,
//   bane/bless/warding-bond bonus-string arithmetic, Holy Nimbus seam wiring
//   (Fiend attacker → advantage) ...................... .bonuses.test.jsx (#1936)
// - saveConditions / mod.condition legs ............... .cla034-conditional-save-advantage.test.jsx (#1937)
// - CLA-211 evasion trigger gate/stamp/skip/Apply ..... .cla211-leading-evasion.test.jsx (#1938)
// - chooser row tick UX, overlay inertness, confirm-closes-leaves-PENDING,
//   clear/dismiss advancement ......................... .coverage.test.jsx (#1939)
// - 2024 Dodge ruleset gate (BA-001) .................. .dodge-2024.test.jsx (#1940)
// - Beacon WIS gate + cross-target deny, cosmic omen,
//   charmed/Otto DEX disadvantage ..................... .evasion-effects.test.jsx (#1941)
// - explicit prompt-flag disadvantage min math / DC boundary ... .rolling.test.jsx
// - holy_aura-vs-concentration-disadvantage offset cancel ... ConcentrationPromptModal.holy-aura.test.jsx (#1896)
// - selector-level te matching unit legs (all save types, missing te, null
//   prompt) .......................................... savePromptUtils.test.js
//
// The Done-payload pins below are mode projections only (advantage/rawRolls on
// THIS fixture) — the submit-flow contract is owned by .actions (#1935).
// ARITY TRUTH (#1878): getRuntimeValue's 3rd campaignName arg at
// savePromptUtils.js:43 is silently ignored (2-param API, store resolves from
// characterKey alone) — cosmetic, not a cross-campaign leak.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getAllyList } from '../../hooks/useAllySelection.js';
import * as circleOfPowerHandler from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';

const CAMPAIGN = 'test-campaign';
const ROLLER = 'testTarget';

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

// Network boundary. sendSavePrompt is a real graph import (savePrompt.js:1 →
// this module); it must exist on the mock even though this lane never sends
// (#1935-#1941 pattern).
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
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

// Keys mirror the graph's actual imports (sibling pattern #1935-#1941):
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

// Circle of Power would also grant blanket advantage — pin off so a roll of
// two d20 can only be attributed to Holy Aura.
vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCircleOfPowerActive: vi.fn(() => false),
  };
});

// SSE seam: only the two triggers this lane exercises. Advantage/disadvantage
// flags stay false on both prompts — the te must be the only advantage source.
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
      fire('subscriber-trigger-wis', { promptId: 'test-prompt-wis', targetName: 'testTarget', saveType: 'WIS', saveDc: 13, disadvantage: false, dcSuccess: 'half' }),
      fire('subscriber-trigger-con', { promptId: 'test-prompt-con', targetName: 'testTarget', saveType: 'CON', saveDc: 13, disadvantage: false, dcSuccess: 'half' })
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

// Canonical producer row shape: holyAuraHandler.js:64 → registerTargetEffect
// (targetEffectDefinitions.js:1534), registry fields ['source'] (:649). Only
// te.target/te.effect gate the selector, but the row mirrors real store bytes.
const holyAuraRow = (target) => ({ target, effect: 'holy_aura', source: 'Cleric 1' });

// Persistent dice rig (no *Once chains): consume scripted values, then clamp
// to the last one so an unexpected extra roll yields a loud, countable
// mismatch rather than a silently reused default.
function rigDice(values) {
  let i = 0;
  rollD20.mockImplementation(() => values[Math.min(i++, values.length - 1)]);
}

/** Render the modal and open the given prompt, flushed on its testid. */
async function openPrompt(triggerTestId) {
  render(
    <SavePromptModal
      campaignName={CAMPAIGN}
      characters={[createCharacter(ROLLER)]}
      activeMapName={null}
    />
  );
  fireEvent.click(screen.getByTestId(triggerTestId));
  await screen.findByTestId('active-save-prompt');
}

/** Open the prompt, roll, flush on the exact caption; return visible bytes. */
async function rollPrompt(triggerTestId, expectedCaption) {
  await openPrompt(triggerTestId);
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  // Caption and total/breakdown land in the SAME result render — flushing on
  // the exact copy (#1936 idiom) needs no DOM polling.
  await screen.findByText(expectedCaption);
  return {
    total: document.querySelector('.sp-result-total strong').textContent,
    breakdown: document.querySelector('.sp-result-breakdown').textContent,
  };
}

async function expectSubmitPayload(expected) {
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => {
    expect(sendSaveResult).toHaveBeenCalledWith(
      CAMPAIGN,
      ROLLER,
      expect.objectContaining(expected)
    );
  });
}

describe('SavePromptModal — Holy Aura save advantage', () => {
  beforeEach(() => {
    // Clears all mocks; rollD20→15, computeAuraBonus→{bonus:0}, getRuntimeValue→null.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    vi.mocked(circleOfPowerHandler.isCircleOfPowerActive).mockReturnValue(false);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
    vi.mocked(getAllyList).mockReturnValue([]);
  });
  afterEach(cleanupDefaults);

  it.each`
    label                                                                                          | trigger                    | saveType
    ${'Wisdom save (the spell\'s default face)'}                                                   | ${'subscriber-trigger-wis'} | ${'WIS'}
    ${'Constitution save — ALL-saves contrast: #1941 denies the same row shape on non-WIS beacons'} | ${'subscriber-trigger-con'} | ${'CON'}
  `('grants advantage (two d20, keep highest) on a $saveType save when the roller carries a holy_aura targetEffect — $label', async ({ trigger }) => {
    // One fixture, both save types: only the prompt save type differs, so the
    // CON leg proves the grant is save-type-blind (vs Beacon's WIS gate).
    getRuntimeValue.mockImplementation((name, key) =>
      name === 'campaign' && key === 'targetEffects' ? [holyAuraRow(ROLLER)] : null
    );
    rigDice([5, 16]);

    await openPrompt(trigger);

    // Pre-roll advantage chip comes from the te, not the prompt flags.
    expect(screen.getByText('(Advantage)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
    await screen.findByText('SAVE SUCCESS');

    expect(rollD20).toHaveBeenCalledTimes(2);
    // keep-highest: 16 + 3 save bonus = 19 ≥ DC 13.
    expect(document.querySelector('.sp-result-breakdown').textContent).toBe('d20 (5, 16) + 3 (Advantage)');
    expect(document.querySelector('.sp-result-total strong').textContent).toBe('19');

    await expectSubmitPayload({
      promptId: trigger === 'subscriber-trigger-wis' ? 'test-prompt-wis' : 'test-prompt-con',
      mode: 'advantage',
      rawRolls: [5, 16],
      roll: 16,
      total: 19,
      success: true,
    });
  });

  it.each`
    label                                          | effects
    ${'no targetEffects at all'}                   | ${[]}
    ${'holy_aura wards another creature only'}     | ${[holyAuraRow('Ally 1')]}
  `('rolls a single plain d20 when $label — advantage is te-driven, never spellName-driven', async ({ effects }) => {
    getRuntimeValue.mockImplementation((name, key) =>
      name === 'campaign' && key === 'targetEffects' ? effects : null
    );
    rigDice([15]);

    const { total, breakdown } = await rollPrompt('subscriber-trigger-wis', 'SAVE SUCCESS');

    expect(screen.queryByText(/Advantage|Disadvantage/)).not.toBeInTheDocument();
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (15) + 3');
    expect(total).toBe('18'); // 15 + 3 ≥ DC 13, plain single die
  });

  it('still keeps the highest die and submits an honest failure when the advantaged save misses the DC', async () => {
    getRuntimeValue.mockImplementation((name, key) =>
      name === 'campaign' && key === 'targetEffects' ? [holyAuraRow(ROLLER)] : null
    );
    rigDice([3, 8]);

    const { total, breakdown } = await rollPrompt('subscriber-trigger-wis', 'SAVE FAILURE');

    expect(rollD20).toHaveBeenCalledTimes(2);
    // keep-highest applies on failure too: 8 beats 3; 8 + 3 = 11 < DC 13
    // (a min-kept mutant would show 6).
    expect(breakdown).toBe('d20 (3, 8) + 3 (Advantage)');
    expect(total).toBe('11');

    await expectSubmitPayload({
      promptId: 'test-prompt-wis',
      mode: 'advantage',
      rawRolls: [3, 8],
      roll: 8,
      total: 11,
      success: false,
    });
  });
});
