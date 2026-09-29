// @improved-by-ai
// MA-1573: Tarrasque "Bite" — inert prose grapple rider fixed on monsters.json Bite row:
// (1) hit_conditions:["grappled","restrained"] + escape_dc:20 ride the LIVE MA-0909/MA-0930
// hit-clause lane (buildHitConditionClause → applyHitClauseConditions, handlePlainDamage.js:553;
// maybeApplyHitClause runs conditions at :841 — MA-1569 multi-rider recipe byte-shape, escape_dc
// top-level). Both conditions granted on hit; activeConditionMeta stamps {dc:20,ability:"str",
// source} for BOTH grappled and restrained (§MA-1274) so the initiative condition badges show the
// STR escape DC 20 save (MA-1569 "Grappled DC N" badge precedent; restrained carries its own badge).
// (2) Cosmetic prose housekeeping in the SAME row: "4dl2"→"4d12" (letter L→d), "Ifthe"→"If the";
// structured damage_dice_primary stayed byte-identical, resolution unaffected.
// ADVISORY, NO CONSUMER, NO CODE: the "can't bite another target" exclusive-bite gate has NO
// consumer anywhere app-wide (no one-target-grapple gate keyed off the attacker's own grapple in
// src/hooks/combat or src/services/combat) — recorded as follow-up per the bug file; a retargeted
// second Bite resolves ungated and that is the EXPECTED honest behavior. Do not gate on the badge.
// Size-gate caveat §1116 does not bite here: RAW clause is "if the target is a creature"
// (unconditional), and the hit_conditions lane carries no size-cap field anyway.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 32, rolls: [7], modifier: 10, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 54, rolls: [7, 7], modifier: 10, formula })),
  rollD20: vi.fn(() => 18),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn().mockResolvedValue();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _setPopupHtml,
    __getPopupHtml: () => _popupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ attackAdvantageCount: 0, attackDisadvantageCount: 0 })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;
  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn(() => _findCreatureReturn),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => (typeof range === 'number' ? range : 5)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(),
}));

vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: () => <div data-testid="popup-stub" />,
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const { _rollAttack: rollAttack, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const RAW = readFileSync('public/data/monsters.json', 'utf8');
const TARRASQUE = monsters.find((m) => m.index === 'tarrasque');
const BITE = TARRASQUE.actions.find((a) => a.name === 'Bite');
const CLAW = TARRASQUE.actions.find((a) => a.name === 'Claw');
const HORNS = TARRASQUE.actions.find((a) => a.name === 'Horns');
const SWALLOW = TARRASQUE.actions.find((a) => a.name === 'Swallow');
const STIRGES = monsters.find((m) => m.index === 'swarm-of-stirges');
const PROBOSCISES = STIRGES.actions.find((a) => a.name === 'Swarm of Proboscises');

const CREATURES = [
  { name: 'Tarrasque 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function renderTarrasque() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Tarrasque', size: 'Gargantuan', actions: TARRASQUE.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Tarrasque 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Tarrasque 1' })} />);
}

function clickBiteChip() {
  const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bite\b/.test(a.textContent.trim()));
  const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+19');
  expect(chip, 'Expected Bite +19 dice link').toBeTruthy();
  fireEvent.click(chip);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1573 monsters.json data lock: Tarrasque Bite grapple+restrained rider', () => {
  it('row identity + core legs byte-unchanged: +19, reach 10 ft., 4d12 + 10 Piercing', () => {
    expect(BITE.name).toBe('Bite');
    expect(BITE.attack_bonus).toBe(19);
    expect(BITE.reach).toBe('10 ft.');
    expect(BITE.damage_dice_primary).toBe('4d12 + 10');
    expect(BITE.damage_type_primary).toBe('Piercing');
  });

  it('authors hit_conditions ["grappled","restrained"] + escape_dc 20 in the MA-1569 byte-shape (escape_dc top-level, after damage_type_primary)', () => {
    expect(BITE.hit_conditions).toEqual(['grappled', 'restrained']);
    expect(BITE.escape_dc).toBe(20);
    const keys = Object.keys(BITE);
    expect(keys).toEqual(['name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary', 'hit_conditions', 'escape_dc']);
  });

  it('description typo housekeeping byte-exact: "4d12" and "If the" fixed, grapple prose intact', () => {
    expect(BITE.description).toBe(
      "Melee Weapon Attack: +19 to hit, reach 10 ft., one target. Hit: 36 (4d12 + 10) piercing damage. If the target is a creature, it is grappled (escape DC 20). Until this grapple ends, the target is restrained, and the tarrasque can't bite another target."
    );
    expect(BITE.description).not.toContain('4dl2');
    expect(BITE.description).not.toContain('Ifthe');
  });

  it('tarrasque-Bite-unique raw bytes appear exactly once file-wide', () => {
    expect(RAW.split('"damage_dice_primary": "4d12 + 10"').length - 1).toBe(1);
    expect(RAW.split('If the target is a creature, it is grappled (escape DC 20)').length - 1).toBe(1);
    expect(RAW.split('36 (4d12 + 10)').length - 1).toBe(1);
    expect(RAW.split('4dl2').length - 1).toBe(0);
  });

  it('no chooser / save decoys on the Bite row', () => {
    expect(BITE.hit_choice).toBeUndefined();
    expect(BITE.save_effect).toBeUndefined();
    expect(BITE.save_dc).toBeUndefined();
    expect(BITE.hit_target_effect).toBeUndefined();
  });

  it('exclusive-bite gate stays ADVISORY prose only — no fake structured gate field authored', () => {
    // "can't bite another target" has NO consumer app-wide (src/hooks/combat +
    // src/services/combat static scan): ungated retargeted second Bite is EXPECTED.
    expect(BITE.exclusive_grapple_attack).toBeUndefined();
    expect(BITE.requires_grappled_target_by).toBeUndefined();
    expect(BITE.target_prerequisite).toBeUndefined();
  });

  it('siblings byte-locked: same-monster attack rows + stirges/swarm twins untouched', () => {
    expect(CLAW.hit_conditions).toBeUndefined();
    expect(CLAW.escape_dc).toBeUndefined();
    expect(CLAW.damage_dice_primary).toBe('4d8 + 10');
    expect(HORNS.hit_conditions).toBeUndefined();
    expect(HORNS.escape_dc).toBeUndefined();
    expect(SWALLOW.hit_conditions).toBeUndefined();
    expect(SWALLOW.escape_dc).toBeUndefined();
    // MA-1569 stirges multi-rider recipe byte-intact (grappled-only, escape_dc 13)
    expect(PROBOSCISES.hit_conditions).toEqual(['grappled']);
    expect(PROBOSCISES.escape_dc).toBe(13);
    expect(PROBOSCISES.hit_target_effect).toBe('attached');
  });
});

describe('MA-1573 buildHitConditionClause: grappled+restrained ride together, escapeDc 20', () => {
  it('arms both conditions + escapeDc 20 on one clause (no riders authored)', () => {
    expect(buildHitConditionClause(BITE)).toEqual({
      conditions: ['grappled', 'restrained'],
      escapeDc: 20,
      attackName: 'Bite',
      targetEffect: null,
    });
  });

  it('applyHitClauseConditions seam contract: escapeDc stamps meta {dc:20,ability:"str"} for BOTH conditions', () => {
    const clause = buildHitConditionClause(BITE);
    expect(clause.escapeDc).toBe(20);
    expect(clause.conditions).toEqual(['grappled', 'restrained']);
    // handlePlainDamage.js:568-575 stamps {dc, ability:"str", source} per condition when escapeDc != null
    const meta = {};
    for (const cond of clause.conditions) {
      meta[cond] = { source: 'Tarrasque 1' };
      if (clause.escapeDc != null) {
        meta[cond].dc = clause.escapeDc;
        meta[cond].ability = 'str';
      }
    }
    expect(meta.grappled).toEqual({ source: 'Tarrasque 1', dc: 20, ability: 'str' });
    expect(meta.restrained).toEqual({ source: 'Tarrasque 1', dc: 20, ability: 'str' });
  });

  it('same-monster siblings stay clause-less (byte-inert)', () => {
    expect(buildHitConditionClause(CLAW)).toBeNull();
    expect(buildHitConditionClause(HORNS)).toBeNull();
  });
});

describe('MA-1573 Bite chip forwards the grapple clause to the attack roll', () => {
  it('+19 chip click arms base attack + hitClause [grappled, restrained] escapeDc 20', () => {
    renderTarrasque();
    clickBiteChip();
    expect(attackRowMissingToHit(BITE)).toBe(false);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.hitClause).toEqual({
      conditions: ['grappled', 'restrained'],
      escapeDc: 20,
      attackName: 'Bite',
      targetEffect: null,
    });
    expect(ctx.autoDamageFormula).toBe('4d12 + 10');
  });

  it('Claw +19 chip stays clause-less (base-only lane intact)', () => {
    renderTarrasque();
    const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Claw\b/.test(a.textContent.trim()));
    const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+19');
    expect(chip, 'Expected Claw +19 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const clawCall = rollAttack.mock.calls.find((c) => c[2]?.autoDamageFormula === '4d8 + 10');
    expect(clawCall[2].hitClause).toBeNull();
  });
});
