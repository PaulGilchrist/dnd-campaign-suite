// @maintained-by-ai
// MA-0904: Gorgon "Petrifying Breath" 30-ft Cone picker — the MA-0501
// staged-petrify ladder (cockatricePetrifyService, ONE shared ladder, no
// fork) rides the cone picker via the stagedPetrify PROP (parse/transport
// pinned in MonsterCardModal.gorgon-breath.test.jsx; extractor word-scan and
// ladder internals incl. the turn-END repeater pinned in their own lanes).
// This lane pins only the picker seam: armed, the ladder OWNS the fail leg —
// fail#1 lands RESTRAINED ONLY + petrifying_bite_staged te (label
// discriminator 'Petrifying Breath', dc 15 — the generic saveConditions
// auto-grant is SUPPRESSED, §108 clause-supersedes); a successful save
// grants nothing; disarmed, the MA-0063 flat grant stays byte-inert.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 10, rolls: [5, 5], modifier: 0 } : null)),
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

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({ sendSavePrompt: vi.fn() }));
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
      { name: 'Gorgon 1', type: 'npc', currentHp: 50, maxHp: 50, saveBonuses: {}, resistances: [], immunities: [] },
      // Full-lowercase key the modal reads (saveType.toLowerCase() —
      // SaveAttackAoeModal.jsx:47). +2 fails nat 1 (3 < DC 15), passes nat 20 (22 ≥ DC 15).
      { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { constitution: 2 }, resistances: [], immunities: [] },
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
vi.mock('../../../../services/rules/features/sleepService.js', () => ({ stageSleepTargets: vi.fn() }));
vi.mock('../../../../services/rules/features/paralyzingBreathService.js', () => ({ stageParalysisTargets: vi.fn() }));
vi.mock('../../../../services/rules/features/weakeningBreathService.js', () => ({ grantWeakeningBreath: vi.fn() }));

const seenTargets = vi.hoisted(() => ({ current: [] }));
const seenPicker = vi.hoisted(() => ({ current: null }));
vi.mock('./CreatureSelectionModal.jsx', () => ({
  default: ({ title, icon, description, note, targets, onConfirm, onSkip }) => {
    seenTargets.current = targets;
    seenPicker.current = { title, icon, description, note };
    return (
      <div className="sp-overlay">
        <div className="sp-header">{title}</div>
        <div className="sp-note">{note}</div>
        {targets.map(t => (<label key={t.name} className="secondary-target-row"><input type="checkbox" />{t.name}</label>))}
        <button className="sp-roll-btn" onClick={() => onConfirm(seenTargets.current.map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  },
}));

import { addEntry } from '../../../../services/ui/logService.js';
import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { stageSleepTargets } from '../../../../services/rules/features/sleepService.js';
import { stageParalysisTargets } from '../../../../services/rules/features/paralyzingBreathService.js';

const GORGON = 'Gorgon 1';
const TARGET = 'Bandit 1';
const gorgonRow = () => monstersData.find(m => m.name === 'Gorgon').actions.find(a => a.name === 'Petrifying Breath');
// What the extractor word-scan yields for the ladder-word prose (extractor
// correctness owned by MonsterCardHelpers lanes) — supplied as the prop the
// armed ladder must suppress.
const FLAT_SAVE_CONDITIONS = ['petrified', 'restrained'];

let randomSpy;
function spyRandom(value) {
  randomSpy = vi.spyOn(Math, 'random').mockReturnValue(value);
}
afterEach(() => randomSpy?.mockRestore());

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  seenPicker.current = null;
});

function renderBreath(stagedPetrify = { petrifiedRounds: 14400 }, overrides = {}) {
  return render(
    <SaveAttackAoeModal
      action={gorgonRow()}
      playerStats={{ name: GORGON }}
      campaignName="test-campaign"
      range={30}
      damage={null}
      damageType={null}
      saveType="Constitution"
      saveDc={15}
      dcSuccess={null}
      titleOverride="30-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={[GORGON]}
      rangeGateFt={null}
      saveConditions={FLAT_SAVE_CONDITIONS}
      stagedPetrify={stagedPetrify}
      storeLastAttack={false}
      onClose={vi.fn()}
      {...overrides}
    />
  );
}

const conditionLogs = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition' && e.action === 'applied');
const ladderTes = () => (runtime.store['campaign.targetEffects'] || []).filter(t => t.effect === 'petrifying_bite_staged');

describe('MA-0904 Gorgon Petrifying Breath picker — MA-0501 shared ladder', () => {
  it('picker inert until Confirm; failed save arms the ladder: RESTRAINED ONLY + petrifying_bite_staged te, flat saveConditions grant suppressed', async () => {
    spyRandom(0.01); // nat 1 + con +2 = 3 < DC 15 → fail
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual([TARGET]));

    // Pre-confirm inertness: the picker grants nothing before Confirm.
    expect(runtime.store[`${TARGET}.activeConditions`]).toBeUndefined();
    expect(runtime.store['campaign.targetEffects']).toBeUndefined();
    expect(addEntry).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();

    fireEvent.click(getByText('Confirm'));

    // Positive legs: ladder grant + te ride through the REAL cockatricePetrifyService.
    await waitFor(() => expect(runtime.store[`${TARGET}.activeConditions`]).toEqual(['restrained']));
    expect(ladderTes()).toHaveLength(1);
    expect(ladderTes()[0]).toMatchObject({
      target: TARGET,
      effect: 'petrifying_bite_staged',
      stage: 'restrained',
      condition: 'restrained',
      source: GORGON,
      dc: 15,
      saveType: 'CON',
      duration: 'ladder_until_second_failure',
      label: 'Petrifying Breath', // cone-vs-bite discriminator
      petrifiedRounds: 14400,
    });
    const condLog = conditionLogs().find(e => e.characterName === TARGET);
    expect(condLog).toMatchObject({ condition: 'Restrained', reason: 'Petrifying Breath (failed save)', sourceName: GORGON });
    expect(condLog.note).toContain('second failure Petrifies');

    // Gated absence proofs: armed ladder OWNS the fail leg — the extractor's
    // flat ['petrified','restrained'] spray never lands, and no other lane stirs.
    expect(runtime.store[`${TARGET}.activeConditions`]).not.toContain('petrified');
    expect(conditionLogs().filter(e => e.condition === 'Petrified')).toHaveLength(0);
    expect(stageSleepTargets).not.toHaveBeenCalled();
    expect(stageParalysisTargets).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled(); // damageless row
  });

  it('successful save: honest Saved row, zero grants — ladder stays unarmed', async () => {
    spyRandom(0.99); // nat 20 + con +2 = 22 ≥ DC 15 → success
    const { getByText, container } = renderBreath();
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual([TARGET]));
    fireEvent.click(getByText('Confirm'));

    // Positive leg first: the save resolved and rendered its result row.
    await waitFor(() => expect(container.textContent).toContain('Saved — takes no damage (rolled 20)'));

    // Then the absences: no condition, no ladder te, no condition log, no damage.
    expect(runtime.store[`${TARGET}.activeConditions`]).toBeUndefined();
    expect(ladderTes()).toHaveLength(0);
    expect(conditionLogs().filter(e => e.characterName === TARGET)).toHaveLength(0);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  // fix#240 honestly-state the picker: buildPickerCopy now receives
  // stagedPetrify, so the ARMED copy states the live ladder truth
  // (Restrained-staged, save unresolved) instead of the MA-0063 flat
  // "Petrified, Restrained." lie — house stage-1 vocabulary from
  // cockatricePetrifyService (:129 "First failure — Restrained; repeats…
  // a second failure Petrifies it for 24 hours"; :97 "Second failure —
  // Petrified…") and the MA-0248 stagedParalysisPickerCopy phrase shape.
  it('armed picker copy states the staged ladder: Restrained-staged truth, never the MA-0063 flat Petrified+Restrained grant text', () => {
    renderBreath();
    // Positive leg first: the picker rendered with the full ladder copy.
    expect(seenPicker.current).toBeTruthy();
    expect(seenPicker.current.description).toContain('<strong>Constitution</strong> saving throw (DC 15)');
    expect(seenPicker.current.note).toContain('target is Restrained and repeats the save at the end of its next turn');
    expect(seenPicker.current.note).toContain('ending the effect on itself on a success');
    expect(seenPicker.current.note).toContain('Second failure: Petrified for 24 hours');
    expect(seenPicker.current.icon).toBe('fa-diamond');
    // Gated absence proofs: nothing that hasn't resolved is stated as landed.
    expect(seenPicker.current.note).not.toContain('target is Petrified');
    expect(seenPicker.current.note).not.toContain('Petrified, Restrained');
    expect(seenPicker.current.note.toLowerCase()).not.toContain('half damage');
    expect(seenPicker.current.note).not.toContain('null');
    // Copy is advisory only: nothing staged before Confirm.
    expect(ladderTes()).toHaveLength(0);
    expect(runtime.store[`${TARGET}.activeConditions`]).toBeUndefined();
  });

  it('disarmed picker copy keeps the MA-0063 flat grant text byte-intact', () => {
    renderBreath(null);
    expect(seenPicker.current).toBeTruthy();
    // Byte-exact MA-0063 branch (names from the extractor spray, no ladder).
    expect(seenPicker.current.note).toBe('On a failed save, target is Petrified, Restrained.');
    expect(seenPicker.current.icon).toBe('fa-smog');
  });

  // Non-gorgon unaffected: no stagedPetrify authored, MA-0063 flat branch
  // renders exactly as before for other damageless condition rows.
  it('non-gorgon damageless row (no ladder armed) renders the MA-0063 copy untouched', () => {
    renderBreath(null, { saveConditions: ['blinded'], saveType: 'Dexterity', saveDc: 12 });
    expect(seenPicker.current).toBeTruthy();
    expect(seenPicker.current.note).toBe('On a failed save, target is Blinded.');
    expect(seenPicker.current.description).toContain('<strong>Dexterity</strong> saving throw (DC 12)');
    expect(seenPicker.current.note.toLowerCase()).not.toContain('petrified');
    expect(seenPicker.current.note).not.toContain('Second failure');
  });

  it('byte-inert disarmed: stagedPetrify null keeps the MA-0063 flat saveConditions grant untouched (both conditions land, no te)', async () => {
    spyRandom(0.01);
    const { getByText } = renderBreath(null);
    await waitFor(() => expect(seenTargets.current.map(t => t.name)).toEqual([TARGET]));
    fireEvent.click(getByText('Confirm'));

    // Positive leg: the unsuppressed one-shot grant lands BOTH extractor conditions.
    await waitFor(() => expect(runtime.store[`${TARGET}.activeConditions`]).toEqual(expect.arrayContaining(FLAT_SAVE_CONDITIONS)));

    // Gated absence: the ladder never armed on the disarmed row.
    expect(ladderTes()).toHaveLength(0);
    expect(stageSleepTargets).not.toHaveBeenCalled();
    expect(stageParalysisTargets).not.toHaveBeenCalled();
  });
});
