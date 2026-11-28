// @maintained-by-ai 2026-11-27
/**
 * HurlThroughHellModal — BRANCH lane (unreached conditionals, fallbacks, guards, ledger shapes).
 *
 * Component line cites re-verified against CURRENT HurlThroughHellModal.jsx bytes (321 lines).
 *
 * Ownership map (siblings — do not duplicate here):
 * - .test.jsx (base) — info-screen render of the three ternary arms with their exact note
 *   bytes, overlay/Cancel/Done close, confirm→result transition, round-latch + uses stamp
 *   with the 4-arg write arity on the hasUse arm (pinned :181-187).
 * - .saveResults.test.jsx — save-resolution flows with objectContaining subsets, fiend
 *   routing by monsterType, addExpiration payload exact (:187 — never re-pinned here).
 * - .resultScreen.test.jsx — result-screen exact copy (fail/success/fiend-target
 *   interpolation, 3-arm it.each) + the Done-on-result contract.
 * This lane owns (each verified unreached by siblings): pact-slot consumption (:36-49 — no
 * sibling ever confirms with hasUse=false), needsPactSlot conjunct falsifiers at :21,
 * featureName || fallback + hardcoded-copy drift (:19 vs :95/:101/:128/:137), the full
 * byte-exact addEntry ledger + popup detail key SHAPES per save arm (siblings spot-check
 * fields), roll-vs-prop precedence and the ||/?? fallback matrix (:52-53/:76 — sibling
 * rolls always equal damageTotal, so precedence was never demonstrated), applyIncapacitation
 * seed shapes (:144-160 — siblings seed [] only), promptId mismatch guard (:170), listener
 * detach (:214-215) + leak across unmount (:233-234, no cleanup for listeners registered
 * inside handleConfirm), the null interim stage (:318 — saveResults masks it with a 15ms
 * sleep at their :98), and the addEntry .catch console.error seam.
 *
 * Branch-arm distinctness (mutant analysis, 2026-11-27):
 * - falsifier arms: each drops exactly one :21 conjunct → only that arm re-renders the
 *   pact CTA, so all three legs are mutant-discriminating (recharge=false / slotLevel=0 /
 *   slotsAvailable=false).
 * - roll-matrix legs: (a) finalDamage≠rolled total pins the ?? right side :76 + flag 8;
 *   (b) roll NULL pins the || fallback :53; (c) rolled total 0 is the ONLY leg a ||→??
 *   mutation changes (b cannot see it) — flag 6; (d) applyDamage null pins the ?? left
 *   side :76. Four distinct legs.
 * - seed matrix: (a) missing cell pins `|| []` :144, (b) non-array pins the Array.isArray
 *   falsifier (never char-spread), (c) array pins verbatim append. The campaign-cell
 *   append is the dedicated identity test (dead `effects` param removed from the matrix).
 *
 * Trim pass 2026-11-27 (19 blocks / 31 cases → 18 blocks / 28 cases):
 * - inline-style attribute/color pins REMOVED (old flag 1): style-presence pins launder a
 *   presentation defect as contract (Clairvoyant #1955 canon); flag cited below instead —
 *   the observable face (note rendered, Done-only buttons, fully inert seam) stays pinned.
 * - pact it.each lvl-2/lvl-5 arms hit the SAME coercion branch → one leg (Number '3'→2).
 * - featureName fallback it.each `action {}` / `{ name: '' }` falsify the same `||` — no
 *   mutant discriminates → one leg.
 * - standalone fiend-'Psychic'-hardcode test folded into the save-arm ledger matrix fiend
 *   leg, which now carries damageType 'Necrotic' so the hardcode is mutant-discriminating
 *   (the old matrix fiend leg pinned byte-identical rows under a Psychic prop).
 * - negative-modifier leg KEPT: it discriminates any clamp/abs refactor of the
 *   `${saveTotal - saveRoll}` interpolation (:87) — honest defect pin (flag 5).
 * - post-drain waitFor wrappers replaced with direct asserts (every chain is pure
 *   microtask and fully settled by the flush — the polling tolerance was a no-op).
 * - WRITE-side arity truth added on this lane's exclusive legs: ordered 4-arg
 *   setRuntimeValue.call censuses (the live-cells mock swallows campaignName; the base
 *   only covers the hasUse arm).
 *
 * NOTE — flagged product defects (audit), pinned to actual, NOT fixed:
 * 1. Inline style (:273): the no-uses note carries style={{ color: '#f87171' }} — the only
 *    non-CSS inline style in the component; house rules forbid it. FLAG ONLY (unpinned by
 *    design — see trim note).
 * 2. Negative pact slot (:39-41): pactSlotsAvailable is a UI prop, never reconciled with
 *    the live ledger — an empty/absent cell decrements to -1 (pinned; product fix: read
 *    the store for availability, floor at 0).
 * 3. Hardcoded copy drift: fiend save/popup text hardcodes 'Psychic' regardless of the
 *    damageType prop (:128/:137), and the roll row hardcodes the feature name
 *    ('Hurl Through Hell Damage' :95 / 'from Hurl Through Hell.' :101) even when
 *    action.name is custom (both pinned — the custom-name flow says 'Hellfire Claws'
 *    everywhere else).
 * 4. Listener leak (:233-234): 'save-result' registers inside handleConfirm with no
 *    unmount cleanup (:214-215 remove it only at resolution) — a leaked listener still
 *    resolves saves after unmount: store writes, log rows and popups all fire on a dead
 *    tree (pinned). Product fix: useEffect-managed registration + cleanup.
 * 5. Signed-zero copy (:87): negative modifiers render 'rolled 12 + -4 = 8' byte-exact
 *    (pinned).
 * 6. Silent roll replacement (:52-53): rollExpression NULL and total-0 both fall through ||
 *    to the damageTotal prop — a legitimate zero roll is indistinguishable from failure
 *    (pinned both arms).
 * 7. Null combatSummary reaches the damage engine (:74-75): applyDamageToTarget(null, …)
 *    with characters: [] (pinned).
 * 8. Roll-row contradiction (:100): row total is applyDamage's finalDamage, not the rolled
 *    total — halves resist renders total 11 against rolls [8,7,9,7]/formula 4d10 (pinned).
 * 9. Unguarded store awaits (:34/:37/:41): latch/uses/slot writes are awaited with no
 *    .catch — a rejection strands the modal in the null 'result' stage with no listener
 *    ever registered. FLAG only: pinning would trip Vitest's unhandled-rejection
 *    collector (same realm-split caveat as FontOfMagicModal flag 2).
 * 10. No double-fire possible (contrast Hex/Font flags): setStep('result') at :28 unmounts
 *    the CTA synchronously in the same act flush as the click — click 2 has no target
 *    (pinned in the null-interim test).
 *
 * Anti-vacuity: LIVE runtime store (writes land in cells and are read back by identity;
 * a never-issued write is a missing cell, not a call echo); default roll FIXED to 31 ≠
 * damageTotal 22 so every rolled-vs-prop pin bites; Date.now frozen (FROZEN_TS) — verified:
 * the component stamps Date.now() at :47/:70/:88/:102/:129/:200, every stamped row pinned
 * byte-exact; frozen fixtures; exact addEntry.call arrays (toStrictEqual — an extra or
 * missing field flips a pin); popup details deep-compared incl. ABSENT keys (fiend/success
 * arms have no rolls/formula); role-scoped queries; fresh vi.fn onClose per makeProps;
 * afterEach mockReset + re-arm (never clearAllMocks/resetAllMocks); NO timers — every
 * chain is microtask-only, so post-dispatch asserts are direct, never polled.
 *
 * Mock-key audit (vs the component's 11 imports): every vi.mock key is imported by the
 * component (savePrompt {createSaveListener, logSaveDismissed}, logService {addEntry},
 * useRuntimeState {getRuntimeValue, setRuntimeValue}, applyDamage {applyDamageToTarget},
 * combatData {getCombatSummary, getCurrentCombatRound}, diceRoller {rollExpression},
 * expirations {addExpiration}) — no phantom exports, nothing imported unmocked except
 * useOverlayEntranceFocus (pure DOM focus hook, jsdom-safe, owned by its own lane).
 *
 * Cross-file recommendations (not applied here):
 * - .saveResults.test.jsx: its header self-cites the addExpiration pin at ":212" but the
 *   exact pin lives at :187 in current bytes (stale self-cite), and dispatchSaveResult
 *   still sleeps 15ms (:98) where a microtask flush suffices (this lane never sleeps).
 * - .resultScreen.test.jsx (next lane): keep owning result copy + Done only — it must
 *   NOT confirm with hasUse=false (pact ledger is this lane's) and must NOT re-pin
 *   addEntry rows/popup details.
 */
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
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
  return {
    createSaveListener: vi.fn(() => ({ promptId: 'unused-factory-default' })),
    // save-dismissed sweep (2026-11-05): HurlThroughHellModal imports the shared
    // dismissal log helper (its behavior face is owned by .save-dismissed.test.jsx —
    // mocked here only so the import resolves, and census-pinned inert at mount).
    logSaveDismissed: vi.fn(() => Promise.resolve()),
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
import { createSaveListener, logSaveDismissed } from '../../../services/automation/common/savePrompt.js';
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
const restoreRow = (cost) => ({
  type: 'ability_use',
  characterName: PLAYER,
  abilityName: FEATURE,
  description: `${PLAYER} expended a Pact Magic spell slot (${cost}) to restore a use of ${FEATURE}.`,
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
const rollRow = (total, description, rolls = ROLL_OK.rolls) => ({
  type: 'roll',
  characterName: PLAYER,
  rollType: 'damage',
  name: 'Hurl Through Hell Damage',
  targetName: TARGET,
  damageType: 'Psychic',
  formula: '4d10',
  rolls,
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

// ── Helpers: bounded microtask flush (no timers — every chain is microtask-only) ──
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
  [getRuntimeValue, setRuntimeValue, addEntry, createSaveListener, logSaveDismissed,
    applyDamageToTarget, getCombatSummary, getCurrentCombatRound, rollExpression,
    addExpiration].forEach((m) => m.mockReset());
  armDefaults();
});

describe('HurlThroughHellModal — branch lane', () => {
  // ── Mount purity: census over ALL imported outlets ──

  it('mounting the uses-available arm is fully inert: zero calls on every imported outlet, zero cells, zero popups', () => {
    const props = makeProps();
    render(<HurlThroughHellModal {...props} />);

    expect(screen.getByRole('button', { name: /Hurl Through Hell/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    [getRuntimeValue, setRuntimeValue, addEntry, createSaveListener, logSaveDismissed,
      applyDamageToTarget, getCombatSummary, getCurrentCombatRound, rollExpression,
      addExpiration].forEach((m) => expect(m).not.toHaveBeenCalled());
    expect(popups).toEqual([]);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(cells.size).toBe(0);
  });

  // ── needsPactSlot conjunct falsifiers (:21) — one per dropped conjunct ──

  // NOTE copy is owned by the base it.each arm matrix (rec). Each arm here falsifies a
  // DISTINCT :21 conjunct (mutant-discriminating, header), and pins the observable face
  // only: rendered note, Done-only buttons, fully inert seam. Flag 1 (inline style
  // :273) is cited in the header, NOT pinned — style-presence is a presentation defect.
  it.each([
    { case: 'recharge=false', props: { pactMagicRecharge: false, pactSlotLevel: 2, pactSlotsAvailable: true } },
    // FLAG (copy): slotLevel=0 falsifies needsPactSlot while slots are "available" — the
    // long note then claims no Pact slots exist (its exact bytes are pinned in base).
    { case: 'slotLevel=0', props: { pactMagicRecharge: true, pactSlotLevel: 0, pactSlotsAvailable: true } },
    { case: 'slotsAvailable=false', props: { pactMagicRecharge: true, pactSlotLevel: 2, pactSlotsAvailable: false } },
  ])('no-uses arm ($case): Done-only buttons, inert seam, note rendered', async ({ props: overrides }) => {
    const props = makeProps({ currentUses: 3, maxUses: 3, ...overrides });
    const { container } = render(<HurlThroughHellModal {...props} />);

    expect(container.querySelector('.sp-note')).not.toBeNull();
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
    // Done reports to the parent; the overlay self-unmounts only when the parent closes it.
    expect(container.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  // ── Pact slot consumption branch (:36-49) — no sibling ever confirms here ──

  it('pact arm: confirm expends live spell_slots_level_2 "3" → 2 (Number coercion), logs the exact restore row, never touches hurlThroughHellUses', async () => {
    cells.set(`${PLAYER}|spell_slots_level_2`, '3');
    render(<HurlThroughHellModal {...makeProps({
      currentUses: 3,
      maxUses: 3,
      pactMagicRecharge: true,
      pactSlotLevel: 2,
      pactSlotsAvailable: true,
    })} />);

    expect(screen.getByText('Cost: Expend a Pact Magic spell slot (level 2) to restore a use.')).toBeInTheDocument();
    const pid = await confirmModal();

    expect(cells.get(`${PLAYER}|spell_slots_level_2`)).toBe(2); // number, not string
    expect(cells.has(`${PLAYER}|hurlThroughHellUses`)).toBe(false);
    // Ordered 4-arg write census (WRITE-side arity; live-cells mock swallows campaignName).
    expect(setRuntimeValue.mock.calls).toEqual([
      [PLAYER, 'hurlThroughHellTurnUsed', 5, CAMPAIGN],
      [PLAYER, 'spell_slots_level_2', 2, CAMPAIGN],
    ]);
    expect(addEntry.mock.calls).toStrictEqual([
      [CAMPAIGN, restoreRow('level 2')],
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
    expect(setRuntimeValue.mock.calls[1]).toEqual([PLAYER, 'spell_slots_level_2', -1, CAMPAIGN]);
  });

  it('hasUse arm short-circuits the pact else-if (slot key never read), writes only latch+uses, and opens the save prompt on the exact contract', async () => {
    render(<HurlThroughHellModal {...makeProps({
      pactMagicRecharge: true,
      pactSlotLevel: 2,
      pactSlotsAvailable: true,
    })} />);
    const pid = await confirmModal();

    // :40 is the ONLY getRuntimeValue call site reachable pre-save — never entered.
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue.mock.calls).toEqual([
      [PLAYER, 'hurlThroughHellTurnUsed', 5, CAMPAIGN],
      [PLAYER, 'hurlThroughHellUses', 1, CAMPAIGN],
    ]);
    // uses VALUE stamp (0+1) is base-owned (HurlThroughHellModal.test.jsx:181-187);
    // the live cell key-set above proves the write happened without re-stamping values.
    expect(getCurrentCombatRound.mock.calls).toEqual([[CAMPAIGN]]);
    expect(createSaveListener.mock.calls).toEqual([[CAMPAIGN, { targetName: TARGET, attackerName: PLAYER, saveType: 'WIS', saveDc: 16 }]]);
    expect(addEntry.mock.calls).toStrictEqual([[CAMPAIGN, triggerRow(pid)]]);
  });

  // ── featureName: || fallback (:19) and hardcoded-copy drift (:95/:101/:128/:137) ──

  // `action {}` and `{ name: '' }` falsify the SAME `||` — no mutant discriminates,
  // so one leg stands (trim 2026-11-27).
  it('featureName fallback — missing action.name renders the default copy in the header', () => {
    const { container } = render(<HurlThroughHellModal {...makeProps({ action: {} })} />);
    expect(container.querySelector('.sp-header').textContent.trim()).toBe(FEATURE);
  });

  it('custom action.name flows through header, prompt log and popup — but the roll row hardcodes the feature name (flag 3)', async () => {
    render(<HurlThroughHellModal {...makeProps({ action: { name: 'Hellfire Claws' } })} />);
    expect(screen.getByText('Hellfire Claws')).toBeInTheDocument();

    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    expect(screen.getByText('Goblin1 failed WIS save — hurled through the lower planes.')).toBeInTheDocument();
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
        ...rollRow(31, 'Goblin1 takes 31 Psychic damage from Hurl Through Hell.'),
        // name (:95) and description (:101) hardcoded — not featureName.
      }],
    ]);
    expect(popups[0].detail.spellName).toBe('Hellfire Claws');
  });

  // ── Save-arm ledgers: exact rows + popup key shapes per save arm (:52-234).
  // Result-screen copy + Done-click are owned by .resultScreen.test.jsx (rec).
  // The fiend leg carries damageType 'Necrotic' so the hardcoded 'Psychic' prose
  // (flag 3) is mutant-discriminating; its popup proves the ABSENT rolls/formula keys. ──

  it.each([
    {
      case: 'non-fiend fail',
      props: {},
      core: FAIL_CORE,
      rows: (pid) => [[CAMPAIGN, triggerRow(pid)], [CAMPAIGN, saveFailRow()], [CAMPAIGN, rollRow(31, 'Goblin1 takes 31 Psychic damage from Hurl Through Hell.')]],
      popup: () => popupOf('Goblin1 failed WIS save — hurled through the lower planes and takes 31 Psychic damage.', { rolls: ROLL_OK.rolls, formula: '4d10' }),
    },
    {
      case: 'fiend fail (Necrotic prop, prose hardcodes Psychic; no roll row, popup has no rolls/formula keys)',
      props: { targetName: FIEND, damageType: 'Necrotic' },
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
        damageType: 'Necrotic', // data is honest; the prose is not
      }),
    },
    {
      case: 'success (two rows, no roll row)',
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
    render(<HurlThroughHellModal {...makeProps(overrides)} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid, core));

    expect(addEntry.mock.calls).toStrictEqual(rows(pid));
    expect(popups).toHaveLength(1);
    expect(popups[0].detail).toStrictEqual(popup());
  });

  // ── Roll-vs-prop precedence and the ||/?? fallback matrix (:52-53, :76) — legs are
  // mutant-distinct per the header analysis. ──

  it.each([
    {
      case: 'roll wins over prop; finalDamage replaces the rolled total in the roll row (flag 8)',
      roll: ROLL_OK, apply: Object.freeze({ finalDamage: 11 }),
      appliedTotal: 31,
      row: rollRow(11, 'Goblin1 takes 11 Psychic damage from Hurl Through Hell.'),
      popupText: 'Goblin1 failed WIS save — hurled through the lower planes and takes 11 Psychic damage.',
    },
    {
      case: 'roll NULL falls back to prop damageTotal, rolls render undefined (flag 6)',
      roll: null, apply: Object.freeze({ finalDamage: 20 }),
      appliedTotal: 22,
      // explicit undefined key (default param would resurrect ROLL_OK.rolls)
      row: { ...rollRow(20, 'Goblin1 takes 20 Psychic damage from Hurl Through Hell.'), rolls: undefined },
      popupText: 'Goblin1 failed WIS save — hurled through the lower planes and takes 20 Psychic damage.',
    },
    {
      case: 'rolled total 0 is silently replaced by prop 22 while rolls [1,1] survive (flag 6 — the only ||→?? discriminating leg)',
      roll: Object.freeze({ total: 0, rolls: Object.freeze([1, 1]) }), apply: Object.freeze({ finalDamage: 22 }),
      appliedTotal: 22,
      row: rollRow(22, 'Goblin1 takes 22 Psychic damage from Hurl Through Hell.', [1, 1]),
      popupText: 'Goblin1 failed WIS save — hurled through the lower planes and takes 22 Psychic damage.',
    },
    {
      case: 'applyDamage NULL falls back to the rolled total via ?? (:76)',
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

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][0]).toBe(SUMMARY);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(appliedTotal);
    expect(addEntry.mock.calls).toHaveLength(3);
    expect(addEntry.mock.calls[2]).toStrictEqual([CAMPAIGN, row]);
    expect(popups[0].detail).toStrictEqual(popupOf(popupText, { rolls: row.rolls, formula: '4d10' }));
  });

  it('null combatSummary flows into the damage engine as-is with an empty characters roster (flag 7)', async () => {
    getCombatSummary.mockReturnValue(null);
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    expect(applyDamageToTarget.mock.calls).toStrictEqual([
      [null, TARGET, 31, ['Psychic'],
        { campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: PLAYER }],
    ]);
    expect(screen.getByText('Goblin1 failed WIS save — hurled through the lower planes.')).toBeInTheDocument();
  });

  // ── applyIncapacitation seed shapes (:144-160) — siblings seed empty cells only.
  // The campaign-cell seed/append is the dedicated identity test below. ──

  it.each([
    { case: 'missing cell (|| [] :144)', conds: undefined, expected: ['incapacitated'] },
    { case: 'non-array conds replaced, never char-spread', conds: 'restrained', expected: ['incapacitated'] },
    { case: 'existing entries preserved and appended verbatim', conds: Object.freeze(['stunned', 'poisoned']), expected: ['stunned', 'poisoned', 'incapacitated'] },
  ])('failed save with $conds: conditions $expected read back through the store', async ({ conds, expected }) => {
    if (conds !== undefined) cells.set(`${TARGET}|activeConditions`, conds);
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    expect(cells.get(`${TARGET}|activeConditions`)).toStrictEqual(expected);
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

    const written = cells.get('campaign|targetEffects');
    expect(written).toHaveLength(2);
    expect(written[0]).toBe(MARK); // same object, untouched
    expect(written[1]).toStrictEqual(hurlEffect());
  });

  // ── Guards and listener lifecycle (:170, :214-215, :233-234, :318) ──

  it('confirm resolves to NOTHING until the save lands, and the CTA is gone synchronously (no double-fire, flag 10)', async () => {
    const { container } = render(<HurlThroughHellModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));

    // step='result', result=null → :318 blank stage; button unmounted with the info screen.
    expect(container.querySelector('.sp-modal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hurl Through Hell/ })).not.toBeInTheDocument();
    expect(addEntry).not.toHaveBeenCalled(); // confirm's await chain still pending — nothing logged yet

    await flush(); // let handleConfirm finish: prompt issued, save-result listener registered
    await dispatchSave(saveResultDetail(lastPromptId()));
    expect(screen.getByText('Goblin1 failed WIS save — hurled through the lower planes.')).toBeInTheDocument();
  });

  it('a mismatched promptId is fully inert — state, log, popups and stage untouched until the matching save lands', async () => {
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();

    await dispatchSave({ promptId: 'someone-elses-prompt', roll: 8, total: 10, success: false });

    expect(addEntry.mock.calls).toHaveLength(1); // trigger row only
    expect(popups).toEqual([]);
    expect(cells.has(`${TARGET}|activeConditions`)).toBe(false);
    expect(cells.has('campaign|targetEffects')).toBe(false);
    expect(document.querySelector('.sp-modal')).not.toBeInTheDocument();

    await dispatchSave(saveResultDetail(pid));
    expect(screen.getByText('Goblin1 failed WIS save — hurled through the lower planes.')).toBeInTheDocument();
    expect(addEntry.mock.calls).toHaveLength(3);
  });

  it('the listener detaches at resolution — a duplicate resolved prompt cannot double-write, double-log or double-popup', async () => {
    render(<HurlThroughHellModal {...makeProps()} />);
    const pid = await confirmModal();
    await dispatchSave(saveResultDetail(pid));

    expect(addEntry.mock.calls).toHaveLength(3);
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

    expect(addEntry.mock.calls).toHaveLength(3);
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

    expect(screen.getByText('Goblin1 succeeded on WIS save — resists the effect and is not hurled through the lower planes.')).toBeInTheDocument();
    expect(addEntry).toHaveBeenCalledTimes(2); // trigger + success rows both attempted
    expect(errSpy.mock.calls.map(([msg, e]) => [msg, e.message])).toEqual([
      ['[hurlThroughHell] Error:', 'log down'],
      ['[hurlThroughHell] Error:', 'log down'],
    ]);
    expect(popups).toHaveLength(1); // popup is not gated on log success
  });
});
