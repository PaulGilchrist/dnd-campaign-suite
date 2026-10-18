// @maintained-by-ai
// MA-0689 regression: Elk Hooves prone-target prerequisite on the ATTACK chip.
// Twin of MA-0687 (Elephant Stomp, #662 lane): the row authors target_prerequisite
// {conditions:["prone"]} (MA-0019 byte-shape minus by_attacker — RAW prone
// eligibility is source-agnostic) and handleAttack reuses
// evaluateTargetPrerequisiteGate. Distinct-bytes vs Stomp, NOT a byte-twin except
// name: hooves +5 / 2d4 + 3 vs stomp +8 / 3d10 + 6 (identical prereq shape only).
// This lane keeps MA-0689-distinct legs only:
//  1. BY-name monsters.json Hooves row bytes + the attack core the gate guards;
//     Ram sibling byte-inert.
//  2. Refuse leg: non-prone armed target refuses with the MA-0019 popup
//     provenance-OMITTED ("must be Prone." — byAttacker-conditional clause,
//     helpers :1011) + hooves_refused log, zero rollAttack, zero damage.
//  3. Fire leg: prone-from-ANY-source click reaches rollAttack once with the
//     Bandit 1 ctx; no refusal popup/log.
//  4. Ungated Ram sibling stays byte-inert on the same non-prone target.
// Cite-skip: helper-direct gate truth table + refusal shape + by_attacker
// provenance — MA-1275 owner (ma1275-tentacle-slam-prerequisite.test.jsx
// :141-195); twin prerequisite shape — MA-0687 stomp lane :112 self-asserts
// {conditions:["prone"]} (both-bytes-equal-shape makes the cross-equal test
// redundant); rollAttack options transport (+bonus / autoDamageFormula /
// damageType threading) — scorching-ray :232 + auto-damage #580 owners.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollAttack = vi.fn();
  const _setPopupHtml = vi.fn();
  const mockHook = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollAttack, _setPopupHtml };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

// Network-guard: getCombatContext only fetches when `creatures` is absent
// (guarded at MonsterCardModal.jsx:2125) — never on this lane; other exports real
// (findCreatureByName byte-mirror purged — identical to helpers :2651 default).
vi.mock('../../services/rules/combat/damageUtils.js', async (importActual) => ({
  ...(await importActual()),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

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

const rollAttack = useLoggedDiceRoll._rollAttack;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const ELK_ACTIONS = monstersData.find(m => m.name === 'Elk').actions;
const HOOVES = ELK_ACTIONS.find(a => a.name === 'Hooves');
const RAM = ELK_ACTIONS.find(a => a.name === 'Ram');

// Elk carries targetName so getTarget resolves Bandit 1 without a picker.
const CREATURES = [
  { name: 'Elk 1', type: 'npc', monsterType: 'beast', targetName: 'Bandit 1', currentHp: 13, maxHp: 13, ac: 10, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderElk() {
  const m = makeMonster({ name: 'Elk', actions: [RAM, HOOVES] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Elk 1', creatures: CREATURES })} />);
}

function attackChip(actionName) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el =>
    el.closest('.mc-action')?.querySelector('strong')?.textContent.trim().startsWith(actionName)) || null;
}

describe('MA-0689 Elk Hooves ATTACK-chip prerequisite gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('monsters.json Hooves row authors target_prerequisite {conditions:["prone"]} (no by_attacker) with its attack core', () => {
    expect(HOOVES.target_prerequisite).toEqual({ conditions: ['prone'] });
    expect(HOOVES.target_prerequisite.by_attacker).toBeUndefined();
    expect(HOOVES.attack_bonus).toBe(5);
    expect(HOOVES.damage_dice_primary).toBe('2d4 + 3');
    expect(HOOVES.damage_type_primary).toBe('bludgeoning');
    expect(RAM.target_prerequisite).toBeUndefined();
  });

  it('non-prone target: popup omits provenance + hooves_refused log, zero rollAttack, zero damage', async () => {
    renderElk();
    fireEvent.click(attackChip('Hooves'));

    expect(rollAttack).not.toHaveBeenCalled();
    // "must be Prone." proves the byAttacker-conditional provenance clause is OMITTED here
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('must be Prone.');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'hooves_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.type).toBe('automation');
    expect(refusal.characterName).toBe('Elk 1');
    expect(refusal.targetName).toBe('Bandit 1');
  });

  it('prone target from ANY source: click reaches rollAttack once with the Bandit 1 ctx, no refusal', () => {
    runtime.store['Bandit 1.activeConditions'] = ['prone'];
    runtime.store['Bandit 1.activeConditionMeta'] = { prone: { source: 'Bandit Captain 1' } };
    renderElk();
    fireEvent.click(attackChip('Hooves'));

    expect(rollAttack).toHaveBeenCalledTimes(1);
    const [name, , options] = rollAttack.mock.calls[0];
    expect(name).toBe('Hooves');
    expect(options.targetName).toBe('Bandit 1');
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('ungated Ram on the same non-prone target still rolls (byte-inert)', () => {
    renderElk();
    fireEvent.click(attackChip('Ram'));
    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(rollAttack.mock.calls[0][0]).toBe('Ram');
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
