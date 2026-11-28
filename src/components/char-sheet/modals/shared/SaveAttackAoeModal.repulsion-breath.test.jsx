// @maintained-by-ai 2026-11-28
// MA-0079: Adult Bronze Dragon Repulsion Breath picker adjudication — damageless
// STR DC 19 cone. This lane owns the CONDITION + push combination path: failed
// saves grant Prone via the MA-0063 canonical applySaveFailConditions path
// (saveConditions non-empty, so the MA-0138 push-only branch in cold-gale's
// lane stays inert) PLUS an instant `push` marker te (value 60, CLA-384 marker
// shape, token movement GM-enforced) with a named condition-applied log naming
// the push clause. Successes grant nothing; ZERO damage is applied (dc_success
// none, no formula) and the picker copy never carries half-damage boilerplate.
// PC targets get the prompt with saveConditions carried on the payload; the
// grant lands at the save-result listener seam.
// Ownership splits: row data-pins (recharge/dc) and the click-path routing live
// in MonsterCardModal.repulsion-breath.test.jsx; generic picker mechanics the
// real DOM mounts here (confirm disabled at (0), selection highlight class,
// count tracking, head-sentence shape) are pinned by
// SaveAttackAoeModal.creature-selection.test.jsx — only the MA-0079-specific
// copy (titleOverride vs action.name confirmLabel, fa-smog icon, the
// damageless prone note) is asserted below. The real MA-0063 note is exactly
// 'On a failed save, target is Prone.' (buildPickerCopy damageless branch,
// SaveAttackAoeModal.jsx:1404-1410) — it does NOT name the 60-ft push clause;
// push copy lives ONLY on the grant-side condition log (applySaveFailConditions
// pushNote, :769-770), pinned below. SaveBonuses are NOT asserted: raw rolls
// pin every outcome here, so the mock creatures stay bonus-free (family
// recipe). Mounts the REAL picker (fix#245: the invented mock was deleted —
// SaveAttackAoeModal never passes campaignName/attackerName, so the picker's
// overlay effect early-returns at CreatureSelectionModal.jsx:131; no
// map/network mock needed).
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
  // three victims each render one REAL secondary-target-row.
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
  it('damageless picker copy + one confirm: failed NPC save grants Prone + instant push te (60) + push advisory log; successful NPC save grants nothing; zero damage, no half-boilerplate', async () => {
    // Draws: Thug raw1/2 low → roll 1 (<DC 19, fail); Guard raw1 high →
    // roll 20 (success). Prompt id for AberrantSorcerer consumes the tail.
    spyRandom([0.01, 0.01, 0.99, 0.99, 0.99]);
    await renderPicker();

    // MA-0079-specific copy on the REAL DOM. Header: titleOverride beats
    // action.name (aoePickerTitle, SaveAttackAoeModal.jsx:1298) + the MA-0063
    // fa-smog icon (damageless condition branch, :1407).
    const header = document.querySelector('.sp-header');
    expect(header.textContent).toContain('30-ft Cone (GM positions tokens; selection advisory)');
    expect(header.textContent).not.toContain('Repulsion Breath');
    expect(header.querySelector('i.fa-smog')).toBeInTheDocument();
    // Description head sentence with the <strong> byte surviving
    // dangerouslySetInnerHTML (CreatureSelectionModal.jsx:179).
    const descP = [...document.querySelectorAll('.sp-body p')].find(p => p.textContent.includes('Select creatures'));
    expect(descP.innerHTML).toBe('Select creatures in the area of effect. Each must make a <strong>Strength</strong> saving throw (DC 19).');
    // Note (.sp-note, CreatureSelectionModal.jsx:181): prone-on-fail prose,
    // never half-damage, never a phantom damage phrase, never push copy.
    const note = document.querySelector('.sp-note');
    expect(note.textContent).toBe('On a failed save, target is Prone.');
    expect(note.textContent).not.toMatch(/half/i);
    expect(note.textContent).not.toMatch(/damage/i);
    expect(note.textContent).not.toMatch(/push/i);

    // confirmLabel is the host-threaded action.name (SaveAttackAoeModal.jsx:
    // 2202) even though the header shows titleOverride — a unique interaction
    // no sibling pins: header ≠ label. Live count drives the 3-wide
    // adjudication (generic (0)-disabled mechanics live in the
    // creature-selection lane).
    checkAllTargets();
    expect(confirmBtn().textContent).toContain('Repulsion Breath');
    expect(confirmBtn().textContent).toContain('(3)');
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
