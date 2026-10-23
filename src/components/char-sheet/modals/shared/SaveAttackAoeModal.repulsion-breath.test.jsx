// @maintained-by-ai
// MA-0079: Adult Bronze Dragon Repulsion Breath picker adjudication — damageless
// STR DC 19 cone. This lane owns the CONDITION + push combination path: failed
// saves grant Prone via the MA-0063 canonical applySaveFailConditions path
// (saveConditions non-empty, so the MA-0138 push-only branch stays inert) PLUS
// an instant `push` marker te (value 60, CLA-384 marker shape, token movement
// GM-enforced) with a named condition-applied log naming the push clause.
// Successes grant nothing; ZERO damage is applied (dc_success none, no formula)
// and the picker copy never carries the half-damage boilerplate. PC targets get
// the prompt with saveConditions carried on the payload (quick-roll lastAttack
// stamp keeps them) and the grant lands at the save-result listener seam.
// Row data-pins (recharge/dc) live in MonsterCardModal.repulsion-breath.test.jsx;
// the click-path routing lives there too. Save bonuses are NOT asserted: the
// component reads saveBonuses[saveType.toLowerCase()] and raw rolls pin every
// outcome here, so the mock creatures stay bonus-free (family recipe).
//
// fix#245 vacuous-mock rework (fix#154 recipe): the old local mock of
// ./CreatureSelectionModal.jsx invented .sp-desc / .sp-note-copy divs
// (former :81-82) that appear ZERO times in production source — the copy
// assertions verified the mock, not the app. The mock is DELETED: this lane
// now mounts the REAL picker (house pattern per fix#154's creature-selection
// lane — SaveAttackAoeModal never passes campaignName/attackerName to the
// picker, so its spell-overlay effect early-returns at
// CreatureSelectionModal.jsx:33 and no map/network mock is needed).
// Invented-class vocabulary diff (mock -> real, CreatureSelectionModal.jsx):
//   .sp-desc         -> bare <p dangerouslySetInnerHTML={description}> (:81)
//   .sp-note-copy    -> <p className="sp-note" dangerouslySetInnerHTML={note}> (:83)
//   .sp-header text  -> real, but now pinned against the action.name fallback
//                        (aoePickerTitle, SaveAttackAoeModal.jsx:1226-1228)
//   auto-confirm-all -> the mock's Confirm auto-selected EVERY target; the
//                        real picker gates on user-checked rows and blocks the
//                        empty set (handleConfirm guard, CreatureSelectionModal
//                        .jsx:66-69) — that guard is now pinned, then the GM
//                        checks all three rows so the adjudication stays 3-wide.
// Honest note substitution: the real MA-0063 damageless-condition picker note
// is exactly 'On a failed save, target is Prone.' (buildPickerCopy,
// SaveAttackAoeModal.jsx:1332-1338) — it does NOT name the 60-ft push clause;
// the push copy lives ONLY on the grant-side condition log (applySaveFail-
// Conditions pushNote, :717-718), pinned below, and push is GM-enforced
// movement (no position consumer, §7).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 10, rolls: [3, 3, 4], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((f) => (f ? { total: 10, rolls: [], modifier: 0 } : null)),
}));
vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({ resolveScaling: vi.fn(() => null) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; }),
  };
});
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: runtime.getRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
}));

const promptsSent = vi.hoisted(() => ({ current: [] }));
vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn((campaignName, payload) => { promptsSent.current.push(payload); }),
}));
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));
vi.mock('../../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Adult Bronze Dragon 1', type: 'npc', currentHp: 212, maxHp: 212, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Guard 1', type: 'npc', currentHp: 55, maxHp: 55, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'AberrantSorcerer', type: 'player', currentHp: 52, maxHp: 52, saveBonuses: {}, resistances: [], immunities: [] },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => null) }));
vi.mock('../../../../services/automation/common/damageRollback.js', () => ({ storeSpellLastAttack: vi.fn(), addTargetResult: vi.fn() }));
vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
  isDistanceInRange: vi.fn(() => true),
}));
vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(async () => {}),
}));

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';

const REPULSION = monstersData.find(m => m.index === 'adult-bronze-dragon').actions.find(a => a.name === 'Repulsion Breath');

let randomSpy;
// Each NPC save consumes exactly two draws (raw1, raw2 — SaveAttackAoeModal
// computeNpcSave); the PC prompt id consumes one more. Target order:
// Thug 1, Guard 1, AberrantSorcerer. 0.01 → raw 1 (<DC 19, fail),
// 0.99 → raw 20 (success).
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderBreath() {
  return render(
    <SaveAttackAoeModal
      action={REPULSION}
      playerStats={{ name: 'Adult Bronze Dragon 1' }}
      campaignName="test-campaign"
      range={30}
      damage={null}
      damageType=""
      saveType="Strength"
      saveDc={19}
      dcSuccess="none"
      titleOverride="30-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={['Adult Bronze Dragon 1']}
      rangeGateFt={30}
      saveConditions={['prone']}
      pushFeet={60}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

// ── REAL picker vocabulary helpers (fix#154 house shape) ──
function rowFor(name) {
  return [...document.querySelectorAll('.secondary-target-row')]
    .find(row => row.textContent.includes(name));
}
function confirmBtn() {
  return document.querySelector('.sp-roll-btn');
}
async function renderPicker() {
  const view = renderBreath();
  // buildEligibleTargets + excludeNames: the attacker is filtered out; the
  // three victims each render one REAL secondary-target-row (:84-141).
  await waitFor(() => expect(document.querySelectorAll('.secondary-target-row')).toHaveLength(3));
  expect(rowFor('Thug 1')).toBeInTheDocument();
  expect(rowFor('Guard 1')).toBeInTheDocument();
  expect(rowFor('AberrantSorcerer')).toBeInTheDocument();
  expect(rowFor('Adult Bronze Dragon 1')).toBeUndefined();
  return view;
}
function checkAllTargets() {
  document.querySelectorAll('.secondary-target-row input[type="checkbox"]').forEach(input => fireEvent.click(input));
}

const loggedEntries = () => addEntry.mock.calls.map(c => c[1]);
const pushTes = () => (runtime.store['campaign.targetEffects'] || []).filter(te => te.effect === 'push');

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  promptsSent.current = [];
});

describe('MA-0079 Repulsion Breath picker — damageless prone + push adjudication', () => {
  it('one confirm: failed NPC save grants Prone + instant push te (60) + push advisory log; successful NPC save grants nothing; zero damage, no half-boilerplate', async () => {
    // Draws: Thug raw1/2 low → roll 1 (<DC 19, fail); Guard raw1 high →
    // roll 20 (success). Prompt id for AberrantSorcerer consumes the tail.
    spyRandom([0.01, 0.01, 0.99, 0.99, 0.99]);
    await renderPicker();

    // Damageless picker copy on the REAL DOM. Header: titleOverride beats
    // action.name (aoePickerTitle :1226-1228) + MA-0063 fa-smog icon
    // (buildPickerCopy :1335). Description: the :1324 head sentence with the
    // <strong> byte surviving dangerouslySetInnerHTML (:81).
    const header = document.querySelector('.sp-header');
    expect(header.textContent).toContain('30-ft Cone (GM positions tokens; selection advisory)');
    expect(header.textContent).not.toContain('Repulsion Breath');
    expect(header.querySelector('i.fa-smog')).toBeInTheDocument();
    const descP = [...document.querySelectorAll('.sp-body p')].find(p => p.textContent.includes('Select creatures'));
    expect(descP.innerHTML).toBe('Select creatures in the area of effect. Each must make a <strong>Strength</strong> saving throw (DC 19).');
    // Note (.sp-note, :83): prone-on-fail prose, never half-damage, never a
    // phantom damage phrase.
    const note = document.querySelector('.sp-note');
    expect(note.textContent).toBe('On a failed save, target is Prone.');
    expect(note.textContent).not.toMatch(/half/i);
    expect(note.textContent).not.toMatch(/damage/i);

    // REAL selection lane the invented mock faked: confirm is disabled at
    // zero picks (CreatureSelectionModal.jsx:153) and handleConfirm blocks
    // an empty set (:66-69); the label carries the host-threaded action.name
    // with a live count (:156, confirmLabel from SaveAttackAoeModal.jsx:2037).
    expect(confirmBtn()).toBeDisabled();
    fireEvent.click(confirmBtn());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(runtime.store['campaign.targetEffects']).toBeUndefined();

    checkAllTargets();
    expect(confirmBtn().textContent).toContain('Repulsion Breath');
    expect(confirmBtn().textContent).toContain('(3)');
    expect(confirmBtn()).toBeEnabled();
    expect(rowFor('Thug 1').className).toContain('secondary-target-selected');

    // Pre-grant inertness: nothing granted before the adjudication runs.
    expect(runtime.store['campaign.targetEffects']).toBeUndefined();
    expect(runtime.store['Thug 1.activeConditions']).toBeUndefined();

    fireEvent.click(confirmBtn());

    // FAIL leg — Thug 1: Prone (MA-0063 meta) + push marker te + named log.
    await waitFor(() => expect(runtime.store['Thug 1.activeConditions']).toEqual(['prone']));
    expect(runtime.store['Thug 1.activeConditionMeta'].prone).toEqual({ dc: 19, ability: 'str', source: 'Adult Bronze Dragon 1' });
    await waitFor(() => expect(pushTes()).toHaveLength(1));
    const push = pushTes()[0];
    expect(push).toMatchObject({ target: 'Thug 1', value: 60, duration: 'instant', source: 'Adult Bronze Dragon 1' });
    const conditionLogs = loggedEntries().filter(e => e.type === 'condition');
    expect(conditionLogs).toHaveLength(1);
    expect(conditionLogs[0].characterName).toBe('Thug 1');
    expect(conditionLogs[0].condition).toBe('Prone');
    expect(conditionLogs[0].description).toMatch(/Pushed up to 60 ft straight away from Adult Bronze Dragon 1/);

    // SUCCESS leg — Guard 1: nothing granted (push te set holds Thug only).
    expect(runtime.store['Guard 1.activeConditions']).toBeFalsy();
    expect(pushTes().some(te => te.target === 'Guard 1')).toBe(false);
    expect(loggedEntries().some(e => e.characterName === 'Guard 1')).toBe(false);

    // Damageless row (dc_success none): no damage lane fires at all.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('PC prompt carries saveConditions + dc_success none + zero raw damage; failed save-result lands Prone + push at the listener seam', async () => {
    spyRandom([0.01, 0.01, 0.99, 0.99, 0.99]);
    await renderPicker();
    checkAllTargets();
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(promptsSent.current).toHaveLength(1));
    const prompt = promptsSent.current[0];
    expect(prompt).toMatchObject({ targetName: 'AberrantSorcerer', saveType: 'Strength', saveDc: 19, saveConditions: ['prone'], dcSuccess: 'none', rawDamage: 0 });

    // No PC-side grant until the player answers: Thug's push te is the only one.
    expect(pushTes().some(te => te.target === 'AberrantSorcerer')).toBe(false);

    // Re-dispatch until the listener (registered once pendingPrompts state
    // flushes) consumes it — consumed events no-op on -1 index.
    await waitFor(() => {
      fireEvent(window, new CustomEvent('save-result', { detail: { promptId: prompt.promptId, success: false, roll: 5, total: 4, saveBonus: -1 } }));
      expect(runtime.store['AberrantSorcerer.activeConditions']).toContain('prone');
    });
    expect(runtime.store['AberrantSorcerer.activeConditionMeta'].prone).toEqual({ dc: 19, ability: 'str', source: 'Adult Bronze Dragon 1' });
    expect(pushTes().some(te => te.target === 'AberrantSorcerer' && te.value === 60 && te.duration === 'instant')).toBe(true);
    const pcLog = loggedEntries().find(e => e.type === 'condition' && e.characterName === 'AberrantSorcerer');
    expect(pcLog.description).toMatch(/Pushed up to 60 ft straight away from Adult Bronze Dragon 1/);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });
});
