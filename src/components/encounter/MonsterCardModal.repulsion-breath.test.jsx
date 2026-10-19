// @maintained-by-ai
// MA-0079: Adult Bronze Dragon Repulsion Breath click lane — damageless
// Recharge 5-6 STR DC 19 30-ft Cone. This file owns the modal producer seam
// only: the full disk-row identity lock (recharge '5-6', authored dc_success
// 'none' byte — unauthored rows default to 'half' at resolveBlockSaveDcSuccess
// MonsterCardModal.jsx:286, the half-damage leak this damageless row must
// never inherit — and the 'pushed up to 60 feet' prose) and the ONE lifecycle
// press test folding fresh-spend → spent-refuse → recharged-refire (#762
// recharge-cone fold precedent, CLA-384 picker-open spend). The picker arm is
// locked exact-shape BY NAME in one shot with honest nulls for every inert
// rider; pushFeet 60 rides it as this lane's distinct payload
// (pushFeetForAction, MonsterCardModal.jsx:314 — the producer seam cited by
// MonsterCardHelpers.push-clause.test.js:11).
// Cite-skips (covered elsewhere, never re-anchored here):
// • parsePushFeetClause truth table: MonsterCardHelpers.push-clause.test.js
//   (which cites back HERE for the click → picker pushFeet 60 seam)
// • failed-save grant legs (Prone + instant push marker te value 60 + logs)
//   and picker copy: SaveAttackAoeModal.repulsion-breath.test.jsx
// • recharge gate parse / spend / d6 turn-start recovery semantics:
//   monsterRecharge.test.js:41-57 — here only the live arm/spend bytes on
//   the runtime store and the refusal popup/log builder bytes
//   (monsterRecharge.js:71 / :100).
// No diceRoller mock: this lane rolls nothing in the modal (picker IS target
// selection — zero inline rollSavingThrow; recharge d6 lives at the
// turnStartEffects seam). No wall-clock timers.
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

const KEY = `Adult Bronze Dragon 1.${MONSTER_RECHARGE_KEY}`;
const ROW = monsters.find(m => m.index === 'adult-bronze-dragon').actions.find(a => a.name === 'Repulsion Breath');

const CREATURES = [
  { name: 'Adult Bronze Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'AberrantSorcerer', currentHp: 212, maxHp: 212, ac: 18, conditions: [] },
  { name: 'AberrantSorcerer', type: 'player', currentHp: 52, maxHp: 52, conditions: [] },
];

function dragonProps() {
  const m = makeMonster({ name: 'Adult Bronze Dragon', actions: monsters.find(m => m.index === 'adult-bronze-dragon').actions });
  return makeProps(m, { creatureName: 'Adult Bronze Dragon 1', creatures: CREATURES });
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
// pushFeet 60 (parsed from the authored push clause) is the MA-0079 payload;
// the picker grants Prone + the push marker te on fails
// (SaveAttackAoeModal.repulsion-breath.test.jsx owns the grant leg).
const PICKER_KEYS = ['action', 'playerStats', 'range', 'damage', 'damageType', 'secondaryDamage', 'secondaryDamageType', 'saveType', 'saveDc', 'dcSuccess', 'titleOverride', 'excludeNames', 'rangeGateFt', 'zoneTe', 'zoneOnly', 'saveConditions', 'sleepStaging', 'stagedParalysis', 'stagedPetrify', 'pushFeet', 'slowedClauses', 'weakeningBreath', 'acPenaltyClause', 'speedZeroClause', 'speedReduceClause', 'bothOutcomesClause', 'storeLastAttack'];
const pickerArm = (props) => Object.fromEntries(PICKER_KEYS.map(k => [k, props[k]]));

const ARMED = {
  action: ROW,
  playerStats: { name: 'Adult Bronze Dragon 1' },
  range: 30,
  damage: null,
  // honest empty-pool byte: the row authors no damage_type_primary, and the
  // live pickerPrimaryDamageType(extractDamageTypes → []) yields null
  damageType: null,
  secondaryDamage: null,
  secondaryDamageType: null,
  saveType: 'Strength',
  saveDc: 19,
  dcSuccess: 'none',
  titleOverride: '30-ft Cone (GM positions tokens; selection advisory)',
  excludeNames: ['Adult Bronze Dragon 1'],
  rangeGateFt: 30,
  zoneTe: null,
  zoneOnly: false,
  saveConditions: ['prone'],
  sleepStaging: null,
  stagedParalysis: null,
  stagedPetrify: null,
  pushFeet: 60,
  slowedClauses: null,
  weakeningBreath: null,
  acPenaltyClause: null,
  speedZeroClause: null,
  speedReduceClause: null,
  bothOutcomesClause: null,
  storeLastAttack: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0079 Adult Bronze Dragon Repulsion Breath cone lane', () => {
  it('disk row full identity: recharge 5-6 + authored dc_success none bytes, DC 19 STR 30-ft Cone, 60-ft push prose, zero damage keys', () => {
    // Full disk identity locks the byte contract behind the live press test —
    // the exact key set is part of the lock (no damage_dice_primary to leak).
    expect(ROW).toEqual({
      name: 'Repulsion Breath',
      description: 'Strength Saving Throw: DC 19, each creature in a 30-foot <strong>Cone</strong>. <strong>Failure:</strong> The target is pushed up to 60 feet straight away from the dragon and has the <strong>Prone</strong> condition.',
      save_dc: 19,
      save_type: 'Strength',
      recharge: '5-6',
      dc_success: 'none',
      save_effect: 'The target is pushed up to 60 feet straight away from the dragon and has the Prone condition.',
    });
  });

  it('press lifecycle: fresh press spends at picker-open and arms the exact damageless push+prone contract (zero inline roll); spent press refuses popup+log with zero spend; recharged row re-arms and refires', async () => {
    const ui = render(<MonsterCardModal {...dragonProps()} />);

    // press 1 — fresh: cone routes to the picker, spend stamped, spend logged.
    fireEvent.click(chipInRow('Repulsion Breath'));
    await waitFor(() => expect(document.querySelector('.cone-picker-stub')).toBeTruthy());
    // the picker IS target selection — no single-target block save on a cone row
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store[KEY]).toEqual({ 'Repulsion Breath': { recharged: false, threshold: 5 } });
    expect(pickerArm(aoeProps.current)).toEqual(ARMED);
    const spends = logEntries(e => e.type === 'ability_use');
    expect(spends).toHaveLength(1);
    expect(spends[0].description).toMatch(/Repulsion Breath.*Recharge 5-6; unavailable until a d6 5\+/);
    // row re-rendered SPENT behind the open picker
    expect(chipInRow('Repulsion Breath').className).toContain('mc-dice-link-spell-spent');
    expect(actionRow('Repulsion Breath').textContent).toContain('(Recharge 5-6 — unavailable)');

    // close keeps it spent (picker-open spend convention, CLA-384)
    fireEvent.click(document.querySelector('.cone-picker-close'));
    expect(document.querySelector('.cone-picker-stub')).toBeNull();
    expect(runtime.store[KEY]['Repulsion Breath'].recharged).toBe(false);

    // press 2 — spent: refusal popup byte + refused log, picker stays closed,
    // zero rolls, zero extra spend, store bytes unchanged.
    aoeProps.current = null;
    fireEvent.click(chipInRow('Repulsion Breath'));
    await waitFor(() => expect(logEntries(e => e.automationType === 'repulsion_breath_refused')).toHaveLength(1));
    const refusal = logEntries(e => e.automationType === 'repulsion_breath_refused')[0];
    expect(refusal.description).toMatch(/refused \(not recharged\)/);
    expect(refusal.characterName).toBe('Adult Bronze Dragon 1');
    expect(setPopupHtml.mock.calls.map(c => String(c[0])).some(h => h.includes('mc-recharge-refusal'))).toBe(true);
    expect(document.querySelector('.cone-picker-stub')).toBeNull();
    expect(aoeProps.current).toBeNull();
    expect(runtime.store[KEY]).toEqual({ 'Repulsion Breath': { recharged: false, threshold: 5 } });

    // press 3 — recharged (turn-start d6 recovery is monsterRecharge.test.js-owned):
    // label drops "unavailable", picker re-arms and RE-SPENDS with the same
    // push+prone contract.
    runtime.store[KEY] = { 'Repulsion Breath': { recharged: true, threshold: 5 } };
    ui.rerender(<MonsterCardModal {...dragonProps()} />);
    expect(chipInRow('Repulsion Breath').className).not.toContain('mc-dice-link-spell-spent');
    expect(actionRow('Repulsion Breath').textContent).not.toContain('unavailable');
    fireEvent.click(chipInRow('Repulsion Breath'));
    await waitFor(() => expect(document.querySelector('.cone-picker-stub')).toBeTruthy());
    await waitFor(() => expect(runtime.store[KEY]['Repulsion Breath']).toEqual({ recharged: false, threshold: 5 }));
    expect(pickerArm(aoeProps.current)).toEqual(ARMED);

    // lifecycle totals: two spends, one refusal, never a single-target roll
    expect(logEntries(e => e.type === 'ability_use')).toHaveLength(2);
    expect(logEntries(e => e.automationType === 'repulsion_breath_refused')).toHaveLength(1);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });
});
