// @maintained-by-ai
// MA-0687 regression: Elephant Stomp prone-target prerequisite on the ATTACK
// chip (fix c5bdc4a27). This lane keeps MA-0687-distinct legs only:
//  1. BY-name monsters.json Stomp row bytes — target_prerequisite {conditions:
//     ["prone"]} (MA-0019 byte-shape MINUS by_attacker — RAW prone eligibility
//     is source-agnostic) + the attack core the gate guards.
//  2. Refuse leg: non-prone armed target refuses via evaluateTargetPrerequisiteGate
//     (previously SAVE-chip-only) with the MA-0019 popup provenance-omitted
//     ("must be Prone." — the fix's byAttacker-conditional clause, helpers :1011)
//     + stomp_refused log, zero rollAttack, zero spend.
//  3. Fire leg: prone-from-ANY-source click reaches rollAttack with the
//     Bandit 1 ctx; no refusal popup/log.
//  4. Ungated Gore sibling stays byte-inert on the same non-prone target.
// Cite-skip: gate truth table + by_attacker provenance — MA-1275 owner
// (ma1275-tentacle-slam-prerequisite.test.jsx) + MA-1890; prone twin popup —
// MA-0689 hooves lane; rollAttack options transport/auto-damage threading —
// scorching-ray :222-233 + auto-damage #580 owners; consume-memories
// armed→click ctx — #587 modal lane.
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
// (guarded at MonsterCardModal.jsx:2125) — never on this lane; other exports real.
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

const ELEPHANT_ACTIONS = monstersData.find(m => m.name === 'Elephant').actions;
const STOMP = ELEPHANT_ACTIONS.find(a => a.name === 'Stomp');
const GORE = ELEPHANT_ACTIONS.find(a => a.name === 'Gore');

// Elephant carries targetName so getTarget resolves Bandit 1 without a picker.
const CREATURES = [
  { name: 'Elephant 1', type: 'npc', monsterType: 'beast', targetName: 'Bandit 1', currentHp: 76, maxHp: 76, ac: 12, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderElephant() {
  const m = makeMonster({ name: 'Elephant', actions: [GORE, STOMP] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Elephant 1', creatures: CREATURES })} />);
}

function attackChip(actionName) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el =>
    el.closest('.mc-action')?.querySelector('strong')?.textContent.trim().startsWith(actionName)) || null;
}

describe('MA-0687 Elephant Stomp ATTACK-chip prerequisite gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('monsters.json Stomp row authors target_prerequisite {conditions:["prone"]} (no by_attacker) with its attack core', () => {
    expect(STOMP.target_prerequisite).toEqual({ conditions: ['prone'] });
    expect(STOMP.target_prerequisite.by_attacker).toBeUndefined();
    expect(STOMP.attack_bonus).toBe(8);
    expect(STOMP.damage_dice_primary).toBe('3d10 + 6');
    expect(STOMP.damage_type_primary).toBe('bludgeoning');
    expect(GORE.target_prerequisite).toBeUndefined();
  });

  it('non-prone target: popup omits provenance + stomp_refused log, zero rollAttack, zero spend', async () => {
    renderElephant();
    fireEvent.click(attackChip('Stomp'));

    expect(rollAttack).not.toHaveBeenCalled();
    // "must be Prone." proves the byAttacker-conditional provenance clause is OMITTED here
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Prerequisite Not Met');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('must be Prone.');
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'stomp_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.type).toBe('automation');
    expect(refusal.characterName).toBe('Elephant 1');
    expect(refusal.targetName).toBe('Bandit 1');
  });

  it('prone target from ANY source: click reaches rollAttack with the Bandit 1 ctx, no refusal', () => {
    runtime.store['Bandit 1.activeConditions'] = ['prone'];
    runtime.store['Bandit 1.activeConditionMeta'] = { prone: { source: 'Bandit Captain 1' } };
    renderElephant();
    fireEvent.click(attackChip('Stomp'));

    expect(rollAttack).toHaveBeenCalledTimes(1);
    const [name, , options] = rollAttack.mock.calls[0];
    expect(name).toBe('Stomp');
    expect(options.targetName).toBe('Bandit 1');
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('ungated Gore on the same non-prone target still rolls (byte-inert)', () => {
    renderElephant();
    fireEvent.click(attackChip('Gore'));
    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(rollAttack.mock.calls[0][0]).toBe('Gore');
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
