// @maintained-by-ai
/**
 * HurlThroughHellModal — BRANCH lane (unreached conditionals, fallbacks, guards, ledger shapes).
 *
 * Ownership map (siblings — do not duplicate here):
 * - .test.jsx (base) — info-screen render of the three ternary arms, Cancel/Done close,
 *   confirm→result transition, round-latch + uses stamp (:29-33 owned there, pinned
 *   :232-245 — the old latch-only test in THIS file duplicated it and is trimmed).
 * - .saveResults.test.jsx — save-resolution flows with objectContaining subsets, fiend
 *   routing by monsterType, addExpiration payload (exact, :212 — never re-pinned here).
 * - .resultScreen.test.jsx — result-screen exact copy (fail/success, incl. the fiend-target
 *   interpolation) + the Done-on-result contract; this lane's save-arm ledger it.each kept a
 *   result-copy closer + Done click until they moved there (rec) — trimmed.
 * This lane owns (each verified unreached by siblings): pact-slot consumption (:34-45 — no
 * sibling ever confirms with hasUse=false), needsPactSlot conjunct falsifier FIXTURES at
 * :17 incl. the misleading slotLevel=0 arm (exact note bytes owned by base — here the
 * inline-style flag + inert seam only; rec), featureName || fallback + hardcoded-copy drift
 * (:15 vs :91/:97/:124/:133), the full byte-exact addEntry ledger + popup detail key
 * SHAPES per save arm (siblings spot-check fields), roll-vs-prop precedence and the ||/??
 * fallback matrix (:49/:72 — sibling rolls always equal damageTotal, so precedence was
 * never demonstrated), applyIncapacitation seed shapes (:140-156 — siblings seed [] only),
 * promptId mismatch guard (:166), listener detach (:210) + leak across unmount (:214),
 * the null interim stage (:296 — saveResults masks it with a 15ms sleep), and the
 * .catch console.error seam (:44/:67/:85/:99/:126/:197).
 *
 * NOTE — flagged product defects (audit), pinned to actual, NOT fixed:
 * 1. Inline style (:253): the no-uses note carries style={{ color: '#f87171' }} — the only
 *    non-CSS inline style in the component; house rules forbid it (pinned attribute + color).
 * 2. Negative pact slot (:36-37): pactSlotsAvailable is a UI prop, never reconciled with
 *    the live ledger — an empty/absent cell decrements to -1 (pinned; product fix: read the
 *    store for availability, floor at 0).
 * 3. Hardcoded copy drift: fiend save/popup text hardcodes 'Psychic' regardless of the
 *    damageType prop (:124/:133), and the roll row hardcodes the feature name
 *    (:91/:97 'Hurl Through Hell Damage' / '...from Hurl Through Hell.') even when
 *    action.name is custom (both pinned — the custom-name flow says 'Hellfire Claws'
 *    everywhere else).
 * 4. Listener leak (:214): 'save-result' registers inside handleConfirm with no unmount
 *    cleanup (:210 removes it only at resolution) — a leaked listener still resolves saves
 *    after unmount: store writes, log rows and popups all fire on a dead tree (pinned).
 *    Product fix: useEffect-managed registration + cleanup.
 * 5. Signed-zero copy (:83): negative modifiers render 'rolled 12 + -4 = 8' byte-exact.
 * 6. Silent roll replacement (:49): rollExpression NULL and total-0 both fall through ||
 *    to the damageTotal prop — a legitimate zero roll is indistinguishable from failure
 *    (pinned both arms).
 * 7. Null combatSummary reaches the damage engine (:70-71): applyDamageToTarget(null, …)
 *    with characters: [] (pinned).
 * 8. Roll-row contradiction (:95-96): row total is applyDamage's finalDamage, not the
 *    rolled total — halves resist renders total 11 against rolls [8,7,9,7]/formula 4d10
 *    (pinned).
 * 9. Unguarded store awaits (:30/:33/:37): latch/uses/slot writes are awaited with no
 *    .catch — a rejection strands the modal in the null 'result' stage with no listener
 *    ever registered. FLAG only: pinning would trip Vitest's unhandled-rejection collector
 *    (same realm-split caveat as FontOfMagicModal flag 2).
 * 10. No double-fire possible (contrast Hex/Font flags): setStep('result') at :24 unmounts
 *    the CTA synchronously in the same act flush as the click — click 2 has no target
 *    (pinned in the null-interim test).
 *
 * Anti-vacuity: LIVE runtime store (writes land in cells and are read back by identity;
 * a never-issued write is a missing cell, not a call echo); default roll FIXED to 31 ≠
 * damageTotal 22 so every rolled-vs-prop pin bites; Date.now frozen (FROZEN_TS) — every
 * stamped row pinned byte-exact; frozen fixtures; exact addEntry.call arrays
 * (toStrictEqual — an extra or missing field flips a pin); popup details deep-compared
 * incl. ABSENT keys (fiend/success arms have no rolls/formula); role-scoped queries;
 * fresh vi.fn onClose per makeProps; afterEach mockReset + re-arm (never
 * clearAllMocks/resetAllMocks); no bare setTimeout — microtask flushes only.
 *
 * Cross-file recommendations (not applied here): .resultScreen.test.jsx now owns the real
 * result screen (its lone info-screen note is gone and this lane's copy closer moved there);
 * .saveResults.test.jsx:112
 * '4d10-custom' mock arm is dead (no test overrides damageExpression); base/resultScreen/
 * old-branch fixtures carry `{ type: 'fiend' }` — the component routes fiends via
 * monsterType, so those fixtures would never hit the fiend branch.
 */
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HurlThroughHellModal from './HurlThroughHellModal.jsx';

// ── Live runtime store (anti-vacuous): every write lands in cells; read back directly ──
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const cells = new Map();
  const read = (name, key) => cells.get(`${name}|${key}`) ?? null;
  const write = (name, key, value) => { cells.set(`${name}|${key}`, value); return Promise.resolve(); };
  return {
    cells,
    read,
    write,
    getRuntimeValue: vi.fn(read),
    setRuntimeValue: vi.fn(write),
  };
});

vi.mock('../../../services/automation/common/savePrompt.js', () => {
  let seq = 0;
  return {
    createSaveListener: vi.fn(() => ({ promptId: `branch-prompt-${++seq}` })),
  };
});

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 31 })),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 5),
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 31, rolls: [8, 7, 9, 7] })),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { getCombatSummary, getCurrentCombatRound } from '../../../services/encounters/combatData.js';
import { rollExpression } from '../../../services/dice/diceRoller.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';

const { cells, read, write, getRuntimeValue, setRuntimeValue } = runtimeState;

// ── Frozen fixtures (rolled total 31 deliberately ≠ damageTotal 22 — precedence bites) ──
const FROZEN_TS = 1750000000000;
const PLAYER = 'Throg';
const CAMPAIGN = 'test-campaign';
const TARGET = 'Goblin1';
const FIEND = 'Orc Warrior';
const FEATURE = 'Hurl Through Hell';
// Per-issue unique promptId (flag 4 makes cross-test leaks real): resolves only the
// prompt this instance issued; tests read the issued id back through the mock results.
const lastPromptId = () => createSaveListener.mock.results[createSaveListener.mock.results.length - 1].value.promptId;

const ROLL_OK = Object.freeze({ total: 31, rolls: Object.freeze([8, 7, 9, 7]) });
const SUMMARY = Object.freeze({
  creatures: Object.freeze([
    Object.freeze({ name: TARGET, type: 'npc' }),
    Object.freeze({ name: FIEND, type: 'npc', monsterType: 'fiend' }),
    Object.freeze({ name: 'Elf Mage', type: 'player' }),
  ]),
});
const STATS = Object.freeze({ name: PLAYER, level: 15 });
const STATS_LEDGER = Object.freeze({
  ...STATS,
  spellAbilities: Object.freeze({ spell_slots_level_3: 4 }),
});

function makeProps(overrides = {}) {
  return {
    action: { name: FEATURE },
    playerStats: STATS,
    campaignName: CAMPAIGN,
    targetName: TARGET,
    saveType: 'WIS',
    saveDc: 16,
    damageType: 'Psychic',
    damageExpression: '4d10',
    damageTotal: 22,
    currentUses: 0,
    maxUses: 3,
    pactMagicRecharge: false,
    pactSlotLevel: 0,
    pactSlotsAvailable: 0,
    onClose: vi.fn(),
    ...overrides,
  };
}

// ── Byte-exact row builders (all timestamps FROZEN_TS) ──
const FAIL_CORE = Object.freeze({ roll: 8, total: 10, success: false });
const SUCC_CORE = Object.freeze({ roll: 15, total: 17, success: true });
const saveResultDetail = (pid, core = FAIL_CORE) => Object.freeze({ promptId: pid, ...core });
const triggerRow = (pid, target = TARGET) => ({
  type: 'ability_use',
  characterName: PLAYER,
  abilityName: FEATURE,
  description: `${FEATURE} triggered — ${target} must make WIS save (DC 16) or be hurled through the lower planes.`,
  targetName: target,
  promptId: pid,
  timestamp: FROZEN_TS,
});
const saveFailRow = (desc = 'Goblin1 failed WIS save (rolled 8 + 2 = 10 vs DC 16) — hurled through the lower planes.', saveRoll = 8, saveTotal = 10) => ({
  type: 'save_result',
  characterName: PLAYER,
  targetName: TARGET,
  saveDc: 16,
  saveType: 'WIS',
  success: false,
  saveRoll,
  saveTotal,
  description: desc,
  timestamp: FROZEN_TS,
});
const rollRow = (total, description) => ({
  type: 'roll',
  characterName: PLAYER,
  rollType: 'damage',
  name: 'Hurl Through Hell Damage',
  targetName: TARGET,
  damageType: 'Psychic',
  formula: '4d10',
  rolls: ROLL_OK.rolls,
  total,
  description,
  timestamp: FROZEN_TS,
});
const hurlEffect = (target = TARGET) => ({
  target,
  source: FEATURE,
  effect: 'incapacitated',
  condition: 'incapacitated',
  duration: 'until_end_of_next_turn',
  saveType: 'WIS',
  saveDc: 16,
  teleport: true,
  returnToSpace: true,
});
const popupOf = (text, extra) => ({
  targetName: TARGET,
  sourceName: PLAYER,
  spellName: FEATURE,
  popupText: text,
  damageType: 'Psychic',
  ...extra,
});

// ── Helpers: bounded microtask flush (no bare setTimeout) ──
const flush = () => act(async () => { await Promise.resolve(); });
const confirmModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));
  await flush();
  return lastPromptId();
};
const dispatchSave = async (detail) => {
  await act(async () => {
    window.dispatchEvent(new CustomEvent('save-result', { detail }));
    await Promise.resolve();
  });
  await flush();
};

const sortKeys = () => [...cells.keys()].sort();

// ── Setup / teardown ──
let popups = [];
const popupListener = (e) => popups.push(e);
let nowSpy = null;
let errSpy = null;
let promptSeq = 0;

function armDefaults() {
  getRuntimeValue.mockImplementation(read);
  setRuntimeValue.mockImplementation(write);
  addEntry.mockResolvedValue(undefined);
  createSaveListener.mockImplementation(() => ({ promptId: `branch-prompt-${++promptSeq}` }));
  applyDamageToTarget.mockReturnValue(Object.freeze({ finalDamage: 31 }));
  getCombatSummary.mockReturnValue(SUMMARY);
  getCurrentCombatRound.mockReturnValue(5);
  rollExpression.mockReturnValue(ROLL_OK);
  addExpiration.mockReturnValue(undefined);
}

beforeEach(() => {
  popups = [];
  window.addEventListener('damage-popup', popupListener);
  nowSpy = vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
  armDefaults();
});

// House rule: mockReset + re-arm (never clearAllMocks/resetAllMocks); live cells wiped.
afterEach(() => {
  cleanup();
  window.removeEventListener('damage-popup', popupListener);
  nowSpy.mockRestore();
  errSpy?.mockRestore();
  errSpy = null;
  cells.clear();
  [getRuntimeValue, setRuntimeValue, addEntry, createSaveListener, applyDamageToTarget,
    getCombatSummary, getCurrentCombatRound, rollExpression, addExpiration].forEach((m) => m.mockReset());
  armDefaults();
});

describe('HurlThroughHellModal — branch lane', () => {
  // ── Mount purity ──

  it('mounting the uses-available arm is fully inert: zero mock calls, zero cells, zero popups, no inline style', () => {
    const props = makeProps();
    const { container } = render(<HurlThroughHellModal {...props} />);

    expect(screen.getByRole('button', { name: /Hurl Through Hell/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('style=');
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(getCurrentCombatRound).not.toHaveBeenCalled();
    expect(addExpiration).not.toHaveBeenCalled();
    expect(popups).toEqual([]);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(cells.size).toBe(0);
  });

  // ── needsPactSlot conjunct falsifiers (:17) ──

  // NOTE copy is owned by the base it.each arm matrix (rec); these arms keep the
  // falsifier fixtures at the :17 seam plus the inline-style flag + inert seam only.
  it.each([
    { case: 'recharge=false', props: { pactMagicRecharge: false, pactSlotLevel: 2, pactSlotsAvailable: true } },
    // FLAG (copy): slotLevel=0 falsifies needsPactSlot while slots are "available" — the
    // long note then claims no Pact slots exist (its exact bytes are pinned in base).
    { case: 'slotLevel=0', props: { pactMagicRecharge: true, pactSlotLevel: 0, pactSlotsAvailable: true } },
    { case: 'slotsAvailable=false', props: { pactMagicRecharge: true, pactSlotLevel: 2, pactSlotsAvailable: false } },
  ])('no-uses arm ($case): Done-only buttons, inert seam, inline-style note (flag 1)', async ({ props: overrides }) => {
    const props = makeProps({ currentUses: 3, maxUses: 3, ...overrides });
    const { container } = render(<HurlThroughHellModal {...props} />);

    // FLAG 1: house-rule inline style rides the note element.
    const noteEl = container.querySelector('.sp-note');
    expect(noteEl).not.toBeNull();
    expect(noteEl).toHaveAttribute('style');
    expect(noteEl).toHaveStyle({ color: 'rgb(248, 113, 113)' });
    expect(screen.queryByRole('button', { name: /Hurl Through Hell/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    const done = screen.getByRole('button', { name: 'Done' });
    expect(screen.getAllByRole('button')).toHaveLength(1);

    fireEvent.click(done);
    await flush();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(addExpiration).not.toHaveBeenCalled();
    expect(popups).toEqual([]);
    expect(cells.size).toBe(0);
    expect(container.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  // ── Pact slot consumption branch (:34-45) — no sibling ever confirms here ──

  it.each([
    { lvl: 2, seed: '3', after: 2, cost: 'level 2' },
    { lvl: 5, seed: '1', after: 0, cost: 'level 5' },
  ])('pact arm: confirm expends live spell_slots_level_$lvl "$seed" → $after (Number coercion), logs the exact restore row, never touches hurlThroughHellUses', async ({ lvl, seed, after, cost }) => {
    cells.set(`${PLAYER}|spell_slots_level_${lvl}`, seed);
    render(<HurlThroughHellModal {...makeProps({
      currentUses: 3,
      maxUses: 3,
      pactMagicRecharge: true,
      pactSlotLevel: lvl,
      pactSlotsAvailable: true,
    })} />);

    expect(screen.getByText(`Cost: Expend a Pact Magic spell slot (${cost}) to restore a use.`)).toBeInTheDocument();
    const pid = await confirmModal();

    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledTimes(2);
    });
    expect(cells.get(`${PLAYER}|spell_slots_level_${lvl}`)).toBe(after); // number, not string
    expect(cells.has(`${PLAYER}|hurlThroughHellUses`)).toBe(false);
    expect(sortKeys()).toEqual([`Throg|hurlThroughHellTurnUsed`, `Throg|spell_slots_level_${lvl}`]);
    expect(addEntry.mock.calls).toStrictEqual([
      [CAMPAIGN, {
        type: 'ability_use',
        characterName: PLAYER,
        abilityName: FEATURE,
        description: `Throg expended a Pact Magic spell slot (${cost}) to restore a use of ${FEATURE}.`,
        timestamp: FROZEN_TS,
      }],
      [CAMPAIGN, triggerRow(pid)],
    ]);
  });

  it('pact arm falls back to playerStats.spellAbilities when the ledger cell is empty (4 → 3)', async () => {
    render(<HurlThroughHellModal {...makeProps({
      playerStats: STATS_LEDGER,
      currentUses: 3,
      maxUses: 3,
      pactMagicRecharge: true,
      pactSlotLevel: 3,
      pactSlotsAvailable: true,
    })} />);
    await confirmModal();

    expect(cells.get(`${PLAYER}|spell_slots_level_3`)).toBe(3);
  });

  it('pact arm with no cell AND no stats writes -1 — pactSlotsAvailable is never reconciled with the ledger (flag 2)', async () => {
    render(<HurlThroughHellModal {...makeProps({
      currentUses: 3,
      maxUses: 3,
      pactMagicRecharge: true,
      pactSlotLevel: 2,
      pactSlotsAvailable: true,
    })} />);
    await confirmModal();

    expect(cells.get(`${PLAYER}|spell_slots_level_2`)).toBe(-1);
  });

  it('hasUse arm leaves the pact ledger unwritten and opens the save prompt on the exact contract', async () => {
    const pid = await confirmModalFor(makeProps({
      pactMagicRecharge: true,
      pactSlotLevel: 2,
      pactSlotsAvailable: true,
    }));

    // hasUse short-circuits the pact else-if: the slot cell is never even read/written.
    expect(cells.has(`${PLAYER}|spell_slots_level_2`)).toBe(false);
    expect(sortKeys()).toEqual([`Throg|hurlThroughHellTurnUsed`, `Throg|hurlThroughHellUses`]);
    expect(cells.get(`${PLAYER}|hurlThroughHellUses`)).toBe(1); // 0 + 1 through the live store
    expect(getCurrentCombatRound.mock.calls).toEqual([[CAMPAIGN]]);
    expect(createSaveListener.mock.calls).toEqual([[CAMPAIGN, { targetName: TARGET, attackerName: PLAYER, saveType: 'WIS', saveDc: 16 }]]);
    expect(addEntry.mock.calls).toStrictEqual([[CAMPAIGN, triggerRow(pid)]]);
  });

  async function confirmModalFor(props) {
    render(<HurlThroughHellModal {...props} />);
    return confirmModal();
  }

  // ── featureName: || fallback and hardcoded-copy drift (:15 vs :91/:97/:124/:133) ──

  it.each([
    { case: 'action {}', action: {} },
    { case: 'action { name: "" }', action: { name: '' } },
  ])('featureName fallback — $case renders the default copy in the header', ({ action }) => {
    const { container } = render(<HurlThroughHellModal {...makeProps({ action })} />);
    expect(container.querySelector('.sp-header').textContent.trim()).toBe(FEATURE);
  });

  it('custom action.name flows through header, prompt log and popup — but the roll row hardcodes the feature name (flag 3)', async () => {
    const props = makeProps({ action: { name: 'Hellfire Claws' } });
    render(<HurlThroughHellModal {...props} />);
    expect(screen.getByText('Hellfire Claws')).toBeInTheDocument();

    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    await waitFor(() => {
      expect(screen.getByText('Goblin1 failed WIS save — hurled through the lower planes.')).toBeInTheDocument();
    });
    expect(addEntry.mock.calls).toStrictEqual([
      [CAMPAIGN, {
        type: 'ability_use',
        characterName: PLAYER,
        abilityName: 'Hellfire Claws',
        description: 'Hellfire Claws triggered — Goblin1 must make WIS save (DC 16) or be hurled through the lower planes.',
        targetName: TARGET,
        promptId: pid,
        timestamp: FROZEN_TS,
      }],
      [CAMPAIGN, saveFailRow()],
      [CAMPAIGN, {
        type: 'roll',
        characterName: PLAYER,
        rollType: 'damage',
        name: 'Hurl Through Hell Damage', // hardcoded (:91) — not featureName
        targetName: TARGET,
        damageType: 'Psychic',
        formula: '4d10',
        rolls: ROLL_OK.rolls,
        total: 31,
        description: 'Goblin1 takes 31 Psychic damage from Hurl Through Hell.', // hardcoded (:97)
        timestamp: FROZEN_TS,
      }],
    ]);
    expect(popups[0].detail.spellName).toBe('Hellfire Claws');
  });

  it('fiend copy hardcodes "Psychic" whatever damageType the props carry (flag 3)', async () => {
    render(<HurlThroughHellModal {...makeProps({ targetName: FIEND, damageType: 'Necrotic' })} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledTimes(2);
    });
    expect(addEntry.mock.calls).toStrictEqual([
      [CAMPAIGN, triggerRow(pid, FIEND)],
      [CAMPAIGN, {
        type: 'save_result',
        characterName: PLAYER,
        targetName: FIEND,
        saveDc: 16,
        saveType: 'WIS',
        success: false,
        saveRoll: 8,
        saveTotal: 10,
        description: 'Orc Warrior (Fiend) failed WIS save (rolled 8 + 2 = 10 vs DC 16) — hurled through the lower planes but takes no Psychic damage.',
        timestamp: FROZEN_TS,
      }],
    ]);
    expect(popups[0].detail).toStrictEqual({
      targetName: FIEND,
      sourceName: PLAYER,
      spellName: FEATURE,
      popupText: 'Orc Warrior (Fiend) failed WIS save — hurled through the lower planes but takes no Psychic damage.',
      damageType: 'Necrotic', // data is honest; the prose is not
    });
  });

  // ── Save-arm ledgers: exact rows + popup key shapes per save arm (:59-211).
  // Result-screen copy + Done-click are owned by .resultScreen.test.jsx (rec). ──

  it.each([
    {
      case: 'non-fiend fail',
      props: {},
      core: FAIL_CORE,
      rows: (pid) => [[CAMPAIGN, triggerRow(pid)], [CAMPAIGN, saveFailRow()], [CAMPAIGN, rollRow(31, 'Goblin1 takes 31 Psychic damage from Hurl Through Hell.')]],
      popup: () => popupOf('Goblin1 failed WIS save — hurled through the lower planes and takes 31 Psychic damage.', { rolls: ROLL_OK.rolls, formula: '4d10' }),
    },
    {
      case: 'fiend fail (no roll row, popup has no rolls/formula keys)',
      props: { targetName: FIEND },
      core: FAIL_CORE,
      rows: (pid) => [[CAMPAIGN, triggerRow(pid, FIEND)], [CAMPAIGN, {
        type: 'save_result',
        characterName: PLAYER,
        targetName: FIEND,
        saveDc: 16,
        saveType: 'WIS',
        success: false,
        saveRoll: 8,
        saveTotal: 10,
        description: 'Orc Warrior (Fiend) failed WIS save (rolled 8 + 2 = 10 vs DC 16) — hurled through the lower planes but takes no Psychic damage.',
        timestamp: FROZEN_TS,
      }]],
      popup: () => ({
        targetName: FIEND,
        sourceName: PLAYER,
        spellName: FEATURE,
        popupText: 'Orc Warrior (Fiend) failed WIS save — hurled through the lower planes but takes no Psychic damage.',
        damageType: 'Psychic',
      }),
    },
    {
      case: 'success (two rows, no roll row, inert cells)',
      props: {},
      core: SUCC_CORE,
      rows: (pid) => [[CAMPAIGN, triggerRow(pid)], [CAMPAIGN, {
        type: 'save_result',
        characterName: PLAYER,
        targetName: TARGET,
        saveDc: 16,
        saveType: 'WIS',
        success: true,
        saveRoll: 15,
        saveTotal: 17,
        description: 'Goblin1 succeeded on WIS save (rolled 15 + 2 = 17 vs DC 16) — not hurled through the lower planes.',
        timestamp: FROZEN_TS,
      }]],
      popup: () => popupOf('Goblin1 succeeded on WIS save — resists the effect and is not hurled through the lower planes.'),
    },
    {
      case: 'negative modifier fail renders "rolled 12 + -4 = 8" verbatim (flag 5)',
      props: {},
      core: Object.freeze({ roll: 12, total: 8, success: false }),
      rows: (pid) => [[CAMPAIGN, triggerRow(pid)], [CAMPAIGN, saveFailRow('Goblin1 failed WIS save (rolled 12 + -4 = 8 vs DC 16) — hurled through the lower planes.', 12, 8)], [CAMPAIGN, rollRow(31, 'Goblin1 takes 31 Psychic damage from Hurl Through Hell.')]],
      popup: () => popupOf('Goblin1 failed WIS save — hurled through the lower planes and takes 31 Psychic damage.', { rolls: ROLL_OK.rolls, formula: '4d10' }),
    },
  ])('$case: full addEntry ledger byte-exact, popup detail strict-equal', async ({ props: overrides, core, rows, popup }) => {
    const props = makeProps(overrides);
    render(<HurlThroughHellModal {...props} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid, core));

    await waitFor(() => {
      expect(addEntry.mock.calls).toStrictEqual(rows(pid));
    });
    expect(popups).toHaveLength(1);
    expect(popups[0].detail).toStrictEqual(popup());
  });

  // ── Roll-vs-prop precedence and the ||/?? fallback matrix (:48-49, :72) ──

  it.each([
    {
      case: 'roll wins over prop; finalDamage replaces the rolled total in the roll row (flags 8)',
      roll: ROLL_OK, apply: Object.freeze({ finalDamage: 11 }),
      appliedTotal: 31,
      row: rollRow(11, 'Goblin1 takes 11 Psychic damage from Hurl Through Hell.'),
      popupText: 'Goblin1 failed WIS save — hurled through the lower planes and takes 11 Psychic damage.',
    },
    {
      case: 'roll NULL falls back to prop damageTotal, rolls render undefined (flag 6)',
      roll: null, apply: Object.freeze({ finalDamage: 20 }),
      appliedTotal: 22,
      row: { ...rollRow(20, 'Goblin1 takes 20 Psychic damage from Hurl Through Hell.'), rolls: undefined },
      popupText: 'Goblin1 failed WIS save — hurled through the lower planes and takes 20 Psychic damage.',
    },
    {
      case: 'rolled total 0 is silently replaced by prop 22 while rolls [1,1] survive (flag 6)',
      roll: Object.freeze({ total: 0, rolls: Object.freeze([1, 1]) }), apply: Object.freeze({ finalDamage: 22 }),
      appliedTotal: 22,
      row: { ...rollRow(22, 'Goblin1 takes 22 Psychic damage from Hurl Through Hell.'), rolls: [1, 1] },
      popupText: 'Goblin1 failed WIS save — hurled through the lower planes and takes 22 Psychic damage.',
    },
    {
      case: 'applyDamage NULL falls back to the rolled total via ?? (:72)',
      roll: ROLL_OK, apply: null,
      appliedTotal: 31,
      row: rollRow(31, 'Goblin1 takes 31 Psychic damage from Hurl Through Hell.'),
      popupText: 'Goblin1 failed WIS save — hurled through the lower planes and takes 31 Psychic damage.',
    },
  ])('save-resolve fallback — $case', async ({ roll, apply, appliedTotal, row, popupText }) => {
    rollExpression.mockReturnValue(roll);
    applyDamageToTarget.mockReturnValue(apply);
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    await waitFor(() => {
      expect(addEntry.mock.calls).toHaveLength(3);
    });
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][0]).toBe(SUMMARY);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(appliedTotal);
    expect(addEntry.mock.calls[2]).toStrictEqual([CAMPAIGN, row]);
    expect(popups[0].detail).toStrictEqual(popupOf(popupText, { rolls: row.rolls, formula: '4d10' }));
  });

  it('null combatSummary flows into the damage engine as-is with an empty characters roster (flag 7)', async () => {
    getCombatSummary.mockReturnValue(null);
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    await waitFor(() => {
      expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    });
    expect(applyDamageToTarget.mock.calls[0]).toStrictEqual([
      null, TARGET, 31, ['Psychic'],
      { campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: PLAYER },
    ]);
    expect(screen.getByText('Goblin1 failed WIS save — hurled through the lower planes.')).toBeInTheDocument();
  });

  // ── applyIncapacitation seed shapes (:140-156) — siblings seed empty cells only ──

  it.each([
    { case: 'missing cells (null)', conds: undefined, effects: undefined, expectedConds: ['incapacitated'] },
    { case: 'non-array conds replaced, never char-spread', conds: 'restrained', effects: undefined, expectedConds: ['incapacitated'] },
    { case: 'existing entries preserved and appended verbatim', conds: Object.freeze(['stunned', 'poisoned']), effects: undefined, expectedConds: ['stunned', 'poisoned', 'incapacitated'] },
  ])('failed save with $conds: conditions $expectedConds read back through the store', async ({ conds, effects, expectedConds }) => {
    if (conds !== undefined) cells.set(`${TARGET}|activeConditions`, conds);
    if (effects !== undefined) cells.set('campaign|targetEffects', effects);
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    await waitFor(() => {
      expect(cells.get(`${TARGET}|activeConditions`)).toStrictEqual(expectedConds);
    });
    const written = cells.get('campaign|targetEffects');
    expect(written).toHaveLength(1);
    expect(written[0]).toStrictEqual(hurlEffect());
  });

  it('seeded campaign targetEffects are preserved by identity and the hurl effect appends second', async () => {
    const MARK = Object.freeze({ marker: 'pre-existing' });
    cells.set('campaign|targetEffects', [MARK]);
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    await waitFor(() => {
      expect(cells.get('campaign|targetEffects')).toHaveLength(2);
    });
    const written = cells.get('campaign|targetEffects');
    expect(written[0]).toBe(MARK); // same object, untouched
    expect(written[1]).toStrictEqual(hurlEffect());
  });

  // ── Guards and listener lifecycle (:166, :210-214, :270/:296) ──

  it('confirm resolves to NOTHING until the save lands, and the CTA is gone synchronously (no double-fire, flag 10)', async () => {
    const { container } = render(<HurlThroughHellModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));

    // step='result', result=null → :296 blank stage; button unmounted with the info screen.
    expect(container.querySelector('.sp-modal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hurl Through Hell/ })).not.toBeInTheDocument();
    expect(addEntry).not.toHaveBeenCalled(); // confirm's await chain still pending — nothing logged yet

    await flush(); // let handleConfirm finish: prompt issued, save-result listener registered
    await dispatchSave(saveResultDetail(lastPromptId()));
    await waitFor(() => {
      expect(screen.getByText('Goblin1 failed WIS save — hurled through the lower planes.')).toBeInTheDocument();
    });
  });

  it('a mismatched promptId is fully inert — state, log, popups and stage untouched until the matching save lands', async () => {
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();

    await dispatchSave({ promptId: 'someone-elses-prompt', roll: 8, total: 10, success: false });

    expect(addEntry.mock.calls).toHaveLength(1);
    expect(popups).toEqual([]);
    expect(cells.has(`${TARGET}|activeConditions`)).toBe(false);
    expect(cells.has('campaign|targetEffects')).toBe(false);
    expect(document.querySelector('.sp-modal')).not.toBeInTheDocument();

    await dispatchSave(saveResultDetail(pid));
    await waitFor(() => {
      expect(screen.getByText('Goblin1 failed WIS save — hurled through the lower planes.')).toBeInTheDocument();
    });
    expect(addEntry.mock.calls).toHaveLength(3);
  });

  it('the listener detaches at resolution — a duplicate resolved prompt cannot double-write, double-log or double-popup', async () => {
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    await waitFor(() => {
      expect(addEntry.mock.calls).toHaveLength(3);
    });
    const conds = cells.get(`${TARGET}|activeConditions`);
    const effects = cells.get('campaign|targetEffects');

    await dispatchSave(saveResultDetail(pid)); // exact same resolved prompt — dead
    await dispatchSave(saveResultDetail(pid, SUCC_CORE)); // success re-fire — dead

    expect(addEntry.mock.calls).toHaveLength(3);
    expect(popups).toHaveLength(1);
    expect(cells.get(`${TARGET}|activeConditions`)).toBe(conds); // same array instance
    expect(cells.get('campaign|targetEffects')).toBe(effects);
    expect(screen.getByText('Goblin1 failed WIS save — hurled through the lower planes.')).toBeInTheDocument();
  });

  it('unmounting mid-save leaks the listener: the late save still writes, logs and pops up on the dead tree (flag 4)', async () => {
    const { unmount, container } = render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();
    unmount();

    await dispatchSave(saveResultDetail(pid));

    await waitFor(() => {
      expect(addEntry.mock.calls).toHaveLength(3);
    });
    expect(popups).toHaveLength(1);
    expect(cells.get(`${TARGET}|activeConditions`)).toStrictEqual(['incapacitated']);
    expect(cells.get('campaign|targetEffects')).toHaveLength(1);
    expect(container.querySelector('.sp-modal')).not.toBeInTheDocument();
  });

  // ── Log rejection seam (.catch × 6 with console.error) ──

  it('every addEntry rejection is caught, logged byte-exact, and the save flow stays intact', async () => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    addEntry.mockImplementation(() => Promise.reject(new Error('log down')));
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid, SUCC_CORE));

    await waitFor(() => {
      expect(screen.getByText('Goblin1 succeeded on WIS save — resists the effect and is not hurled through the lower planes.')).toBeInTheDocument();
    });
    expect(addEntry).toHaveBeenCalledTimes(2); // trigger + success rows both attempted
    expect(errSpy.mock.calls.map(([msg, e]) => [msg, e.message])).toEqual([
      ['[hurlThroughHell] Error:', 'log down'],
      ['[hurlThroughHell] Error:', 'log down'],
    ]);
    expect(popups).toHaveLength(1); // popup is not gated on log success
  });
});
