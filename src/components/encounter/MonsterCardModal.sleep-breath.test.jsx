// @maintained-by-ai
// MA-0068/MA-0179 Brass Dragon Sleep Breath click lane — the staged-sleep
// CONE producer seam of MonsterCardModal. This file owns the disk-row byte
// locks (adult: recharge '5-6' + authored dc_success 'none' + staged_sleep
// {unconscious_minutes:10} on DC 18 CON 60-ft Cone; ancient MA-0179: same
// staged shape on DC 21 CON 90-ft Cone, NO recharge key) and the live
// picker arm locked exact-shape BY NAME in one shot (#764 exact-shape
// discipline): sleepStaging {unconsciousRounds:100} is THIS lane's LIVE
// rider — sleepStagingForAction (MonsterCardModal.jsx:293-296, minutes×10
// rounds CLA-334) — with honest nulls for every inert rider
// (pushFeet/stagedParalysis/stagedPetrify/zoneTe/slowedClauses/secondary*),
// dc_success 'none' overriding the app-wide 'half' default
// (resolveBlockSaveDcSuccess, MonsterCardModal.jsx:283-287) and zero
// inline rollSavingThrow (the picker IS target selection).
// Adult press folds the ONE lifecycle test (#762/#764 precedent, CLA-384
// picker-open spend, MonsterCardModal.jsx:465): fresh-spend → spent-refuse
// (.mc-recharge-refusal popup + sleep_breath_refused refusal byte,
// monsterRecharge.js:70-83) → recharged-refire, exact totals. The ancient
// row is ungated on disk — its press pins the same staged contract with
// ZERO recharge writes.
// Cite-skips (covered elsewhere, never re-anchored here):
// • recharge gate parse / d6 turn-start recovery / tri-state:
//   monsterRecharge.test.js:41-57 — here only live arm/spend/refusal bytes
// • picker failed-save grant leg (stageSleepTargets 100 rounds, Incapacitated
//   staged NOT Unconscious, never half-damage copy):
//   SaveAttackAoeModal.staged-sleep.test.jsx:151-183 (:178 no-Unconscious)
// • turn-END sleep ladder: sleepService.staged-breath.test.js
// • saveConditions prose-parse truth table: extractConditionsFromSaveEffect,
//   MonsterCardHelpers.js:383-393
// • damageless-row secondary transport honest nulls:
//   MonsterCardModal.secondary-save-transport.test.js:139-151
// • half-damage math (never applies here — dc_success 'none'):
//   applyDamage.save-full.test.js:18-25
// No diceRoller mock: this lane rolls nothing in the modal (recharge d6
// lives at the turnStartEffects seam). No wall-clock timers — sleep duration
// is rounds at GM seams (100 rounds), never a setTimeout auto-wake.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monsters from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return (
      <div className="sp-overlay cone-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
        <button className="cone-picker-close" onClick={() => props.onClose()}>Close</button>
      </div>
    );
  },
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn();
  const mockHook = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollSavingThrow, _setPopupHtml };
});

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { MONSTER_RECHARGE_KEY } from '../../services/encounters/monsterRecharge.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const ADULT = monsters.find(m => m.index === 'adult-brass-dragon');
const ANCIENT = monsters.find(m => m.index === 'ancient-brass-dragon');
const ADULT_ROW = ADULT.actions.find(a => a.name === 'Sleep Breath');
const ANCIENT_ROW = ANCIENT.actions.find(a => a.name === 'Sleep Breath');

const ADULT_CREATURES = [
  { name: 'Adult Brass Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 172, maxHp: 172, ac: 18, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];
const ANCIENT_CREATURES = [
  { name: 'Ancient Brass Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 546, maxHp: 546, ac: 22, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

function dragonProps(row, creatureName, creatures) {
  const m = makeMonster({ name: row.name, actions: row.actions });
  return makeProps(m, { creatureName, creatures });
}

function actionRow(namePrefix) {
  return Array.from(document.querySelectorAll('.mc-action')).find(el => el.textContent.trim().startsWith(namePrefix)) || null;
}

function chipInRow(namePrefix) {
  const row = actionRow(namePrefix);
  return row ? row.querySelector('.mc-dice-link') : null;
}

function logEntries(pred) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e && pred(e));
}

// Picker-arm transport: exact-shape one-shot of every semantic prop the cone
// row hands SaveAttackAoeModal — authored bytes plus honest nulls for every
// rider this row does NOT write, so a wrongly-armed new rider fails here.
// sleepStaging is the LIVE rider on this lane (#764 pinned it inert on the
// repulsion row; here its exact payload is the MA-0068 contract).
const PICKER_KEYS = ['action', 'playerStats', 'range', 'damage', 'damageType', 'secondaryDamage', 'secondaryDamageType', 'saveType', 'saveDc', 'dcSuccess', 'titleOverride', 'excludeNames', 'rangeGateFt', 'zoneTe', 'zoneOnly', 'saveConditions', 'sleepStaging', 'stagedParalysis', 'stagedPetrify', 'pushFeet', 'slowedClauses', 'weakeningBreath', 'acPenaltyClause', 'speedZeroClause', 'speedReduceClause', 'bothOutcomesClause', 'storeLastAttack'];
const pickerArm = (props) => Object.fromEntries(PICKER_KEYS.map(k => [k, props[k]]));

const ARMED_RIDERS_INERT = {
  damage: null,
  // honest empty-pool byte: no damage_type authored, pickerPrimaryDamageType
  // (extractDamageTypes → [] → formatDamageTypes, damageUtils.js:16-19) = null
  damageType: null,
  secondaryDamage: null,
  secondaryDamageType: null,
  // raw prose parse of the ladder save_effect (MonsterCardHelpers.js:383);
  // the picker's sleepStaging takes precedence on the grant leg
  // (SaveAttackAoeModal.staged-sleep.test.jsx:151-183)
  saveConditions: ['incapacitated', 'unconscious'],
  stagedParalysis: null,
  stagedPetrify: null,
  pushFeet: null,
  slowedClauses: null,
  weakeningBreath: null,
  acPenaltyClause: null,
  speedZeroClause: null,
  speedReduceClause: null,
  bothOutcomesClause: null,
  zoneTe: null,
  zoneOnly: false,
  storeLastAttack: false,
};

const ADULT_ARMED = {
  action: ADULT_ROW,
  playerStats: { name: 'Adult Brass Dragon 1' },
  range: 60,
  saveType: 'Constitution',
  saveDc: 18,
  dcSuccess: 'none',
  titleOverride: '60-ft Cone (GM positions tokens; selection advisory)',
  excludeNames: ['Adult Brass Dragon 1'],
  rangeGateFt: 60,
  sleepStaging: { unconsciousRounds: 100 },
  ...ARMED_RIDERS_INERT,
};

const ANCIENT_ARMED = {
  action: ANCIENT_ROW,
  playerStats: { name: 'Ancient Brass Dragon 1' },
  range: 90,
  saveType: 'Constitution',
  saveDc: 21,
  dcSuccess: 'none',
  titleOverride: '90-ft Cone (GM positions tokens; selection advisory)',
  excludeNames: ['Ancient Brass Dragon 1'],
  rangeGateFt: 90,
  sleepStaging: { unconsciousRounds: 100 },
  ...ARMED_RIDERS_INERT,
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0068/MA-0179 Brass Dragon Sleep Breath cone lane', () => {
  it('disk rows lock the staged-sleep identity: adult recharge 5-6 + dc_success none + staged_sleep 10 min on DC 18 CON; ancient same shape ungated on DC 21; zero damage keys', () => {
    // Full disk identity locks the byte contract behind the live press tests —
    // the exact key set is part of the lock (no damage_dice_primary to leak).
    expect(ADULT_ROW).toEqual({
      name: 'Sleep Breath',
      description: 'Constitution Saving Throw: DC 18, each creature in a 60-foot <strong>Cone</strong>. <strong>Failure:</strong> The target has the <strong>Incapacitated</strong> condition until the end of its next turn, at which point it repeats the save. Second Failure: The target has the <strong>Unconscious</strong> condition for 10 minutes. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.',
      save_dc: 18,
      save_type: 'Constitution',
      recharge: '5-6',
      dc_success: 'none',
      staged_sleep: { unconscious_minutes: 10 },
      save_effect: 'The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. Second Failure: The target has the Unconscious condition for 10 minutes. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it. Target repeats the save at the end of each of its turns.',
    });
    // MA-0179: the ancient row carries the same staged shape, ungated, no
    // damage — dc_success 'none' keeps it out of the app-wide 'half' default.
    expect(ANCIENT_ROW).toEqual({
      name: 'Sleep Breath',
      description: 'Constitution Saving Throw: DC 21, each creature in a 90-foot <strong>Cone</strong>. <strong>Failure:</strong> The target has the <strong>Incapacitated</strong> condition until the end of its next turn, at which point it repeats the save. Second Failure: The target has the <strong>Unconscious</strong> condition for 10 minutes. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.',
      save_dc: 21,
      save_type: 'Constitution',
      dc_success: 'none',
      staged_sleep: { unconscious_minutes: 10 },
      save_effect: 'Failure: The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. Second Failure: The target has the Unconscious condition for 10 minutes. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.',
    });
  });

  it('press lifecycle: fresh press spends at picker-open and arms the exact staged-sleep contract sleepStaging 100 rounds (zero inline roll); spent press refuses popup+log with zero spend; recharged row re-arms and refires', async () => {
    const ui = render(<MonsterCardModal {...dragonProps(ADULT, 'Adult Brass Dragon 1', ADULT_CREATURES)} />);

    // press 1 — fresh: cone routes to the picker, spend stamped, spend logged.
    fireEvent.click(chipInRow('Sleep Breath'));
    await waitFor(() => expect(document.querySelector('.cone-picker-stub')).toBeTruthy());
    // the picker IS target selection — no single-target block save on a cone row
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store[`Adult Brass Dragon 1.${MONSTER_RECHARGE_KEY}`]).toEqual({ 'Sleep Breath': { recharged: false, threshold: 5 } });
    expect(pickerArm(aoeProps.current)).toEqual(ADULT_ARMED);
    const spends = logEntries(e => e.type === 'ability_use');
    expect(spends).toHaveLength(1);
    expect(spends[0].description).toMatch(/Sleep Breath.*Recharge 5-6; unavailable until a d6 5\+/);
    // row re-rendered SPENT behind the open picker
    expect(chipInRow('Sleep Breath').className).toContain('mc-dice-link-spell-spent');

    // close keeps it spent (picker-open spend convention, CLA-384)
    fireEvent.click(document.querySelector('.cone-picker-close'));
    expect(document.querySelector('.cone-picker-stub')).toBeNull();
    expect(runtime.store[`Adult Brass Dragon 1.${MONSTER_RECHARGE_KEY}`]['Sleep Breath'].recharged).toBe(false);

    // press 2 — spent: refusal popup byte + refused log, picker stays closed,
    // zero rolls, zero extra spend, store bytes unchanged.
    aoeProps.current = null;
    fireEvent.click(chipInRow('Sleep Breath'));
    await waitFor(() => expect(logEntries(e => e.automationType === 'sleep_breath_refused')).toHaveLength(1));
    const refusal = logEntries(e => e.automationType === 'sleep_breath_refused')[0];
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.characterName).toBe('Adult Brass Dragon 1');
    expect(setPopupHtml.mock.calls.map(c => String(c[0])).some(h => h.includes('mc-recharge-refusal'))).toBe(true);
    expect(document.querySelector('.cone-picker-stub')).toBeNull();
    expect(aoeProps.current).toBeNull();
    expect(runtime.store[`Adult Brass Dragon 1.${MONSTER_RECHARGE_KEY}`]).toEqual({ 'Sleep Breath': { recharged: false, threshold: 5 } });

    // press 3 — recharged (turn-start d6 recovery is monsterRecharge.test.js-owned):
    // row re-arms, picker RE-ARMS with the same staged-sleep contract and RE-SPENDS.
    runtime.store[`Adult Brass Dragon 1.${MONSTER_RECHARGE_KEY}`] = { 'Sleep Breath': { recharged: true, threshold: 5 } };
    ui.rerender(<MonsterCardModal {...dragonProps(ADULT, 'Adult Brass Dragon 1', ADULT_CREATURES)} />);
    expect(chipInRow('Sleep Breath').className).not.toContain('mc-dice-link-spell-spent');
    fireEvent.click(chipInRow('Sleep Breath'));
    await waitFor(() => expect(document.querySelector('.cone-picker-stub')).toBeTruthy());
    await waitFor(() => expect(runtime.store[`Adult Brass Dragon 1.${MONSTER_RECHARGE_KEY}`]['Sleep Breath']).toEqual({ recharged: false, threshold: 5 }));
    expect(pickerArm(aoeProps.current)).toEqual(ADULT_ARMED);

    // lifecycle totals: two spends, one refusal, never a single-target roll
    expect(logEntries(e => e.type === 'ability_use')).toHaveLength(2);
    expect(logEntries(e => e.automationType === 'sleep_breath_refused')).toHaveLength(1);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('MA-0179 ancient press: ungated disk row arms the DC 21 90-ft staged-sleep contract twice with ZERO recharge writes', async () => {
    render(<MonsterCardModal {...dragonProps(ANCIENT, 'Ancient Brass Dragon 1', ANCIENT_CREATURES)} />);
    fireEvent.click(chipInRow('Sleep Breath'));
    await waitFor(() => expect(document.querySelector('.cone-picker-stub')).toBeTruthy());
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(pickerArm(aoeProps.current)).toEqual(ANCIENT_ARMED);

    fireEvent.click(document.querySelector('.cone-picker-close'));
    fireEvent.click(chipInRow('Sleep Breath'));
    await waitFor(() => expect(document.querySelector('.cone-picker-stub')).toBeTruthy());
    expect(pickerArm(aoeProps.current)).toEqual(ANCIENT_ARMED);

    // no recharge key on disk → the gate never touches the runtime store,
    // and the modal never emits a refusal (never gated).
    expect(runtime.store[`Ancient Brass Dragon 1.${MONSTER_RECHARGE_KEY}`]).toBeUndefined();
    expect(logEntries(e => e.automationType === 'sleep_breath_refused')).toHaveLength(0);
    expect(logEntries(e => e.type === 'ability_use')).toHaveLength(0);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });
});
