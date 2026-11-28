// @maintained-by-ai 2026-11-27
// CLA-394 modal lane: the Zealous Presence buff (effect advantage_attacks_and_saves
// read from the target's activeBuffs via hasBuffEffect) must grant BLANKET
// saving-throw advantage at the SavePromptModal roll seam.
//
// Owned HERE (the blanked-advantage face of the component :152 gate):
// - The gate only runs when the prompt carries NO explicit advantage flag and
//   NO disadvantage (:145/:146 short-circuit above it), and the PRE-ROLL header
//   stays blank — computePromptDisplayState's promptHasAdvantage (:395) lists
//   only the prompt flag + Holy Aura, so buff-granted advantage surfaces
//   exclusively in the post-roll breakdown. Both faces pinned.
// - MUTANT-DISCRIMINATING buff-off vs buff-on pair on the SAME prompt: the legs
//   differ in breakdown string, total, AND physical die count (rollD20 calls).
// - Blanket clause: a non-Dexterity (WIS) save benefits identically (kills a
//   DEX-only copy of the Dodge-shape gate).
// - Gate specificity (#1941 te.target-style mismatch legs): a wrong-effect
//   activeBuffs row and a right-buff-on-wrong-creature row must NOT trigger.
//
// Covered ELSEWHERE — do not re-add here:
// - Done payloads, hold-until-Done, rolled Next Save advancement ......... .actions.test.jsx (#1935)
// - Target bane/bless dice stacking, Warding Bond, CLA-324 lastAttack
//   READ (against_spell), aura fold display, Circle of Power blanket
//   advantage + buff-under-prompt-disadvantage precedence (the :146
//   short-circuit above ALL buff gates) ...................... .bonuses.test.jsx (#1936)
// - saveConditions/mod.condition SAVE-ADVANTAGE legs ..................... .cla034-conditional-save-advantage.test.jsx (#1937)
// - 2024 Dodge ruleset gate (BA-001) ...................................... .dodge-2024.test.jsx (#1940)
// - Beacon WIS gate, Cosmic Omen consume, charmed/Otto DEX disadvantage .. .evasion-effects.test.jsx (#1941)
// - holy_aura te grant + ALL-saves contrast ............................... .holy-aura.test.jsx (#1942)
// - half/none damage-note copy ............................................ .rendering.test.jsx (#1945)
// - DC-boundary/min-keeping/both-flags modal face, plain-roll die count,
//   bonus-source routing (char-over-creature precedence) .................. .rolling.test.jsx (#1947)
// - Server-side advantage faces ............. handlePlayerSaveDamage/handleNpcSaveDamage.zealousPresence.test.js
//
// The NPC target lives outside the player roster, so its +3 save bonus resolves
// through the real combat-summary saveBonuses lookup (routing precedence itself
// is the rolling lane's pin — this lane only *uses* the lookup to keep the
// on-screen math honest; the getAbilitySaveBonus stub returns a decoy 7 so the
// on-screen '+ 3' bytes can only come from saveBonuses).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

vi.mock('../../services/ui/utils.js', () => ({
  default: { getName: (name) => name || 'Unknown' },
}));

// Dice controlled per-test so every roll mode changes the visible outcome.
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

// The modal resolves this off-roster NPC target's bonus through the
// combat-summary saveBonuses lookup, never through getAbilitySaveBonus; the
// stub's decoy 7 would flash on screen if that routing ever regressed here.
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 7),
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

// Other blanket-advantage producers must stay inert so any advantage seen here
// can only come from the Zealous Presence buff branch.
vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCircleOfPowerActive: vi.fn(() => false),
  };
});

// Real producer row: confirmZealousPresence (zealousPresenceHandler.js) writes
// the buff through toggleBuff → computeToggledBuffs, which stores this full
// field spread on the target's activeBuffs.
const ZEALOUS_ROW = {
  name: 'Zealous Presence',
  effect: 'advantage_attacks_and_saves',
  duration: 'until_start_of_next_turn',
  enemiesDisadvantageSaves: [],
  distance: '',
  extendedDistance: '',
  sourceCharacter: 'DraconicDragon',
  blocksSpellcasting: false,
  flySpeed: null,
  hover: false,
  seeInvisibleRange: null,
  narrowSpace: false,
  castingTime: '',
  resistanceTypes: [],
  acBonus: 0,
  saveBonus: 0,
};

// Decoy carries a REAL activeBuffs effect key that merely SOUNDS like
// advantage (advantage_on_stealth, read at CharSheet.conditionEffects.js:123)
// — the strongest wrong-effect mismatch for the :152 string comparison.
const NON_QUALIFYING_ROW = { ...ZEALOUS_ROW, name: 'Blessing of the Trickster', effect: 'advantage_on_stealth' };

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const trigger = (testId, data) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-zealotTarget`, data }),
      });
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber' },
      // The reported CLA-394 repro: Frost Ray DEX save vs DC 12.
      trigger('prompt-dex', { promptId: 'zp-dex', targetName: 'zealotTarget', saveType: 'dex', saveDc: 12, disadvantage: false, dcSuccess: 'half', sourceName: 'Frost Ray' }),
      // Blanket clause: a non-Dexterity save must benefit identically.
      trigger('prompt-wis', { promptId: 'zp-wis', targetName: 'zealotTarget', saveType: 'WIS', saveDc: 12, disadvantage: false, dcSuccess: 'half', sourceName: 'Thunderclap' }),
    );
  }
  return { default: MockSubscriber };
});

// The buff lives in the target's runtime activeBuffs; feed it there and keep
// every other store read neutral.
function seedBuffs(buffs, targetName = 'zealotTarget') {
  getRuntimeValue.mockImplementation((name, key) =>
    (key === 'activeBuffs' && name === targetName) ? buffs : null
  );
}

async function openPrompt(testId) {
  render(<SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
  fireEvent.click(screen.getByTestId(testId));
  await screen.findByTestId('active-save-prompt');
}

/** Click Roll Save, wait for the post-roll panel, return its visible strings. */
async function rollSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(document.querySelector('.sp-result-breakdown')).toBeTruthy();
  });
  return {
    total: document.querySelector('.sp-result-total strong').textContent,
    breakdown: document.querySelector('.sp-result-breakdown').textContent,
  };
}

describe('SavePromptModal — CLA-394 Zealous Presence blanket save advantage', () => {
  beforeEach(() => {
    // Neutral baseline: rollD20→15, no aura, all store reads null.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    // NPC target resolved through the combat-summary save-bonus lane: +3 saves.
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'zealotTarget', saveBonuses: { dex: 3, wis: 3 } }],
    });
  });
  afterEach(cleanupDefaults);

  it('buff OFF: the same prompt rolls one plain d20 with no Advantage bytes anywhere', async () => {
    // 15 + 3 = 18 ≥ DC 12. Off leg of the mutant pair: if the :152 gate were
    // unconditional, this prompt would roll max(15,15)+3 and grow an
    // '(Advantage)' suffix — the exact breakdown, total AND die count differ
    // from the buff-ON leg below.
    seedBuffs([]);
    rollD20.mockReturnValueOnce(15);

    await openPrompt('prompt-dex');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (15) + 3');
    expect(total).toBe('18');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
    expect(screen.queryByText(/Advantage/i)).not.toBeInTheDocument();
  });

  it('buff ON, prompt flag ABSENT: pre-roll face stays blank, roll keeps the high die with an (Advantage) breakdown', async () => {
    // max(4, 16) + 3 = 19 ≥ DC 12 → success. A plain roll keeps the 4 (7 →
    // failure) and disadvantage would too, so breakdown + total + outcome +
    // die count all prove the :152 gate fired. The pre-roll header carries NO
    // (Advantage) badge: promptHasAdvantage (:395) covers only the prompt
    // flag and Holy Aura — buff-granted advantage is intentionally blank
    // until the roll seam (same face as Dodge/Circle-of-Power sources).
    seedBuffs([ZEALOUS_ROW]);
    rollD20.mockReturnValueOnce(4).mockReturnValueOnce(16);

    await openPrompt('prompt-dex');
    expect(screen.queryByText(/Advantage/i)).not.toBeInTheDocument();

    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (4, 16) + 3 (Advantage)');
    expect(total).toBe('19');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('is blanket: the buff grants advantage on a non-Dexterity (WIS) save too', async () => {
    // max(5, 13) + 3 = 16 ≥ DC 12 → success; a DEX-only gate (copying the
    // Dodge clause) would roll the first die plain: 5 + 3 = 8 → failure.
    seedBuffs([ZEALOUS_ROW]);
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(13);

    await openPrompt('prompt-wis');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (5, 13) + 3 (Advantage)');
    expect(total).toBe('16');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('does not trigger on buffs with other effects: a real advantage-sounding but non-qualifying row rolls a plain single d20', async () => {
    // 8 + 3 = 11 < DC 12 → failure. If the check were vacuous (any buff
    // counts), the second die (default 15) would lift this to 18/SUCCESS.
    seedBuffs([NON_QUALIFYING_ROW]);
    rollD20.mockReturnValueOnce(8);

    await openPrompt('prompt-dex');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (8) + 3');
    expect(total).toBe('11');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
  });

  it('does not bleed across creatures: the same buff on another creature grants nothing', async () => {
    // Same mismatch family as #1941's te.target legs: the query keys on
    // current.targetName, so another creature's row must be invisible.
    seedBuffs([ZEALOUS_ROW], 'otherTarget');
    rollD20.mockReturnValueOnce(8);

    await openPrompt('prompt-dex');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (8) + 3');
    expect(total).toBe('11');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
    expect(screen.queryByText(/Advantage/i)).not.toBeInTheDocument();
  });
});
