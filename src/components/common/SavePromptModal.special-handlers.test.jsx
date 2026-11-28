// @maintained-by-ai 2026-11-27
// SavePromptModal — special save-handler faces: attacker-side bane token and
// lastAttack/combatSummary persistence at the prompt seam.
//
// Owned HERE (rolling #1947 handoff, verbatim: "lastAttack persistence on
// roll + attacker-side bane +N [Bane] token (delegated by bonuses #1936)";
// each leg exact-pins the visible total AND the full .sp-result-breakdown
// string, and every persistence leg exact-pins the FULL written record shape
// (timestamp: expect.any(Number)), not an objectContaining subset — #1936/
// #1946 idiom):
// - Attacker-side bane_penalty die attribution — the '+N [Bane]' token the
//   target-side lane in bonuses.test.jsx never produces. Attribution proven
//   by distinct effect-die values in production roll order (target bane,
//   attacker bane, bless), and by an attacker-only leg proving the
//   attacker die rolls even when the target itself is not baned.
//   MUTANT-DISCRIMINATING: target-side token bytes are '-N [Bane]', the
//   attacker's are '+N [Bane]' — a sign/attribution swap changes both the
//   bytes and the total.
// - Quick-roll lastAttack persistence: exact 3-arg storage.set('lastAttack',
//   <full record>, CAMPAIGN) write pin (bonus = FULL folded bonus, d20 +
//   bonus === total), including the MA-0079 leg (saveConditions stamped from
//   the prompt payload, AoE Repulsion-Breath shape) and the negative path:
//   no combatSummary → nothing persisted (the save itself still resolves).
// - Reroll submit → combatSummary.lastAttack restamp: the reroll FEATURE
//   lanes (buttons, tokens, spend writes, availability) belong to #1946/
//   #1943; HERE the Fanatical Focus button is only the vehicle that reaches
//   createSubmitSaveResult → applyRerollToCombatSummary. Pins the exact
//   merged record (dice fields restamped, prior non-dice fields — attacker
//   name, rollType, rawDamage — merged untouched, saveConditions reset to
//   []), times(1) on the 'combatSummary' key write. The HP-restore side
//   effect this submit also fires is #1944's seam, never pinned here.
//
// Covered ELSEWHERE — do not re-add here:
// - Done payloads, hold-until-Done, rolled Next Save advancement ......... .actions.test.jsx (#1935)
// - Target bane/bless dice stacking, Warding Bond, CLA-324 lastAttack
//   READ (against_spell), aura fold display ......................... .bonuses.test.jsx (#1936)
// - saveConditions/mod.condition SAVE-ADVANTAGE legs ..................... .cla034-conditional-save-advantage.test.jsx (#1937)
// - CLA-211 evasion trigger gate/stamp/skip/Apply ........................ .cla211-leading-evasion.test.jsx (#1938)
// - chooser row tick UX, overlay inertness, clear/dismiss advancement .... .coverage.test.jsx (#1939)
// - 2024 Dodge ruleset gate (BA-001) ...................................... .dodge-2024.test.jsx (#1940)
// - Beacon WIS gate, Cosmic Omen consume, charmed/Otto DEX disadvantage .. .evasion-effects.test.jsx (#1941)
// - holy_aura te grant + ALL-saves contrast ............................... .holy-aura.test.jsx (#1942)
// - Indomitable availability matrix / cap ladder, rerollUsedForSave gate .. .indomitable.test.jsx (#1943)
// - MA-0367 'full'-row copy + reroll-cancel/HP-restore seam .............. .infernal-wound.test.jsx (#1944)
// - half/none damage-note copy ............................................ .rendering.test.jsx (#1945)
// - Fanatical Focus / Disciplined Survivor / Living Legend / Guarded Mind
//   buttons, tokens and spend writes ...................................... .rerolls.test.jsx (#1946)
// - DC-boundary/min-keeping/both-flags modal face, plain-roll die count,
//   bonus-source routing (char-over-creature precedence) .................. .rolling.test.jsx (#1947)
// - Evasion NOTE display branches .......................... .evasion-note-selection.test.jsx
// - Zealous Presence creature-lookup faces ................... .zealous-presence.test.jsx (queued NEXT)
//
// ARITY TRUTH (#1878): getRuntimeValue is a 2-param API — 3rd campaignName
// args on reads in the module under test are silently ignored; cosmetic.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';
import { setupDefaults, cleanupDefaults, createRageCharacter, createCharacter } from './SavePromptModal.test-utils.jsx';

const CAMPAIGN = 'test-campaign';
const TARGET = 'testTarget';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

// Bare factory (NOT an importOriginal spread, per the #1946/#1947 documented
// contrast): the only expression evaluator this lane reaches is the
// bane/bless rollEffectDie lane, and rollExpression itself is the mock — no
// fixture here needs real parse/roll behavior.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

// sendSavePrompt is a real graph import (savePrompt.js → this module); it
// must exist on the mock or its access throws, even though this lane never
// sends (#1935-#1947 pattern).
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn().mockResolvedValue({ bonus: 0, sourceName: null }),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

// Graph keys mirrored to the sibling lanes (#1935-#1947): no
// useSyncedState/listeners phantoms — this modal never imports them.
// deleteRuntimeKey/setRuntimeObject/getAllStoreKeys back real graph imports
// (savePrompt.js, applyDamage.js, infernalWoundService.js store probes).
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
// - base: plain CON save DC 12 (quick-roll persistence)
// - attacker: CON save DC 12 with attackerName (attacker-side bane lane)
// - rawdamage: CON save DC 12, rawDamage 10, dcSuccess 'half' (reroll →
//   combatSummary restamp lane)
// - saveconditions: STR save DC 19, saveConditions ['prone'] (MA-0079)
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const fire = (key, data) => () => handleEvent({ key: `change-${campaignName}-${key}`, data });
    const button = (testId, data) =>
      React.createElement('button', { 'data-testid': testId, onClick: fire(`savePrompt-${data.targetName}`, data) });
    return React.createElement('div', { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      button('subscriber-trigger', { promptId: 'test-prompt-1', targetName: TARGET, saveType: 'con', saveDc: 12, disadvantage: false }),
      button('subscriber-trigger-attacker', { promptId: 'test-prompt-attacker', targetName: TARGET, saveType: 'con', saveDc: 12, disadvantage: false, attackerName: 'testAttacker' }),
      button('subscriber-trigger-rawdamage', { promptId: 'test-prompt-rd', targetName: TARGET, saveType: 'con', saveDc: 12, disadvantage: false, rawDamage: 10, dcSuccess: 'half', sourceName: 'Fireball' }),
      button('subscriber-trigger-saveconditions', { promptId: 'test-prompt-saveconditions', targetName: 'testTarget5', saveType: 'str', saveDc: 19, disadvantage: false, dcSuccess: 'none', sourceName: 'Adult Bronze Dragon 1', rawDamage: 0, saveConditions: ['prone'] }),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function renderModal(characters = []) {
  render(
    <SavePromptModal
      campaignName={CAMPAIGN}
      characters={characters}
      activeMapName={null}
    />
  );
}

/** Feed a prompt through the real handleEvent; flush on the ACTIVE-prompt
 *  testid (never a caption already on screen, #1943-#1947 idiom). */
async function triggerPrompt(testId = 'subscriber-trigger') {
  fireEvent.click(screen.getByTestId(testId));
  await screen.findByTestId('active-save-prompt');
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

/** Route only campaign-level targetEffects through; everything else reads null. */
function mockCampaignTargetEffects(effects) {
  getRuntimeValue.mockImplementation((name, key) =>
    name === 'campaign' && key === 'targetEffects' ? effects : null
  );
}

/** The payload persisted under the given storage key, or undefined. */
function persisted(key) {
  const call = vi.mocked(storage.set).mock.calls.find(([k]) => k === key);
  return call?.[1];
}

/** How many storage.set writes went to the given key. */
function writeCount(key) {
  return vi.mocked(storage.set).mock.calls.filter(([k]) => k === key).length;
}

describe('SavePromptModal — Special Handlers', () => {
  beforeEach(() => {
    // setupDefaults clears all mocks and sets neutral defaults:
    // rollD20→15, computeAuraBonus→{bonus:0}, getRuntimeValue→null.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    // clearAllMocks does not drop implementations — reset the effect-die mock
    // explicitly so per-test Once/ReturnValue stubs never leak across tests.
    vi.mocked(rollExpression).mockReset();
    vi.mocked(getCombatSummary).mockReset().mockReturnValue({ creatures: [] });
  });
  afterEach(cleanupDefaults);

  // ── Attacker-side bane attribution ──

  it('folds the attacker bane die into the total as a positive bonus, distinct from target bane and bless', async () => {
    mockCampaignTargetEffects([
      { target: TARGET, effect: 'bane_penalty' },
      { target: 'testAttacker', effect: 'bane_penalty' },
      { target: TARGET, effect: 'bless_bonus' },
    ]);
    // Effect dice roll in production order: target bane, attacker bane, bless.
    // Distinct values so each breakdown token is unambiguously attributable.
    vi.mocked(rollExpression)
      .mockReturnValueOnce({ total: 2 })
      .mockReturnValueOnce({ total: 4 })
      .mockReturnValueOnce({ total: 3 });

    renderModal([createCharacter(TARGET)]);
    await triggerPrompt('subscriber-trigger-attacker');
    const { total, breakdown } = await rollSave();

    // 15 (d20) + 3 (ability) - 2 (target bane) + 4 (attacker bane) + 3 (bless)
    // = 23. Full-string pin: an order swap would read '-4 [Bane] +2 [Bane]'
    // and a sign swap would total 17 — both change bytes here.
    expect(rollExpression).toHaveBeenCalledTimes(3);
    expect(breakdown).toBe('d20 (15) + 8 -2 [Bane] +4 [Bane] +3 [Bless]');
    expect(total).toBe('23');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('rolls an attacker bane die even when the target itself is not baned', async () => {
    mockCampaignTargetEffects([{ target: 'testAttacker', effect: 'bane_penalty' }]);
    vi.mocked(rollExpression).mockReturnValue({ total: 4 });

    renderModal([createCharacter(TARGET)]);
    await triggerPrompt('subscriber-trigger-attacker');
    const { total, breakdown } = await rollSave();

    // Only one effect die (the attacker's) — no target bane or bless dice.
    expect(rollExpression).toHaveBeenCalledTimes(1);
    // 15 (d20) + 3 (ability) + 4 (attacker bane). A broken attacker lane
    // would land on "d20 (15) + 3" with no Bane token at all.
    expect(breakdown).toBe('d20 (15) + 7 +4 [Bane]');
    expect(total).toBe('22');
  });

  // ── Quick-roll lastAttack persistence ──

  it('stores the full lastAttack record when rolling a save with combatSummary present', async () => {
    renderModal([createCharacter(TARGET)]);
    await triggerPrompt();
    const { total } = await rollSave();

    expect(total).toBe('18');
    // Exact 3-arg write pin: key, FULL canonical record, campaign. The
    // prompt carries no attackerName — the target stands in for itself.
    // Full-shape (not subset) pin: d20 + bonus === total, and the damage
    // block stays zeroed for a damage-less prompt; no secondary keys leak in.
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith('lastAttack', {
      attackerName: TARGET,
      targetName: TARGET,
      d20: 15,
      d20Rolls: [15, 15],
      bonus: 3,
      total: 18,
      rollType: 'save',
      saveType: 'con',
      saveDc: 12,
      saveResult: 'success',
      saveConditions: [],
      damageFormula: null,
      attackName: null,
      damageType: null,
      rawDamage: 0,
      primaryDamage: 0,
      primaryDamageType: null,
      actualDamage: 0,
      damageApplied: false,
      timestamp: expect.any(Number),
    }, CAMPAIGN);
  });

  // MA-0079: quick-roll lastAttack keeps the saveConditions carried on the
  // AoE-prompt payload (Repulsion Breath) — previously always [].
  it('quick-roll lastAttack stamps saveConditions from the prompt payload', async () => {
    rollD20.mockReturnValue(11);

    renderModal([createCharacter('testTarget5')]);
    await triggerPrompt('subscriber-trigger-saveconditions');
    const { total } = await rollSave();

    // 11 + 3 (ability) = 14 < DC 19 — failed save, prone still recorded,
    // and the source row lands in attackName.
    expect(total).toBe('14');
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith('lastAttack', {
      attackerName: 'testTarget5',
      targetName: 'testTarget5',
      d20: 11,
      d20Rolls: [11, 11],
      bonus: 3,
      total: 14,
      rollType: 'save',
      saveType: 'str',
      saveDc: 19,
      saveResult: 'failure',
      saveConditions: ['prone'],
      damageFormula: null,
      attackName: 'Adult Bronze Dragon 1',
      damageType: null,
      rawDamage: 0,
      primaryDamage: 0,
      primaryDamageType: null,
      actualDamage: 0,
      damageApplied: false,
      timestamp: expect.any(Number),
    }, CAMPAIGN);
  });

  it('does not persist lastAttack when no combatSummary exists', async () => {
    vi.mocked(getCombatSummary).mockReturnValue(null);

    renderModal([createCharacter(TARGET)]);
    await triggerPrompt();
    // The save itself still resolves normally...
    const { total } = await rollSave();
    expect(total).toBe('18');

    // ...but with no combat in progress nothing is written to storage.
    expect(storage.set).not.toHaveBeenCalled();
  });

  // ── Reroll submit → combatSummary.lastAttack restamp ──
  // (The reroll feature's button/token/spend faces are #1946's; this leg
  // pins only the persistence seam the submit reaches.)

  it('reroll submit restamps combatSummary.lastAttack with the new dice and result, merging prior fields', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === TARGET && key === 'activeBuffs') return [{ effect: 'rage', damageBonusExpression: 'rage_damage' }];
      if (name === TARGET && key === 'fanaticalFocusUsed') return false;
      if (name === TARGET && key === 'hitPoints') return 10;
      if (name === TARGET && key === 'maxHitPoints') return 20;
      return null;
    });
    vi.mocked(getCombatSummary).mockReturnValue({
      creatures: [],
      lastAttack: { attackerName: 'Fireball', targetName: TARGET, rollType: 'spell-save', rawDamage: 10 },
    });
    // Initial save fails (4 + 3 < DC 12); Fanatical Focus reroll succeeds
    // (15 + 3 + 2 >= 12).
    rollD20.mockReturnValueOnce(4).mockReturnValueOnce(15);

    renderModal([createRageCharacter(TARGET, 2)]);
    await triggerPrompt('subscriber-trigger-rawdamage');
    const first = await rollSave();
    // 4 + 3 = 7 < DC 12 — failed save offers the raging reroll lane.
    expect(first.total).toBe('7');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reroll Save (+2)' }));

    await waitFor(() => {
      expect(writeCount('combatSummary')).toBe(1);
    });
    // The rerolled dice and result restamp the existing lastAttack record;
    // non-dice fields (attackerName/rollType/rawDamage) merge in untouched,
    // saveConditions reset to [], and no secondary-damage block appears.
    expect(persisted('combatSummary').lastAttack).toEqual({
      attackerName: 'Fireball',
      targetName: TARGET,
      rollType: 'spell-save',
      rawDamage: 10,
      d20: 15,
      d20Rolls: [15, 15],
      bonus: 5, // 3 (ability) + 2 (Fanatical Focus)
      total: 20,
      saveType: 'con',
      saveDc: 12,
      saveResult: 'success',
      saveConditions: [],
      timestamp: expect.any(Number),
    });
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });
});
