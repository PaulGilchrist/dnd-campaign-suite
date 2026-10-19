// @maintained-by-ai
// MA-1573: Tarrasque "Bite" — inert prose grapple rider fixed on monsters.json Bite row:
// hit_conditions:["grappled","restrained"] + escape_dc:20 ride the LIVE MA-0909/MA-0930
// hit-clause lane (buildHitConditionClause → applyHitClauseConditions, handlePlainDamage.js:553;
// maybeApplyHitClause runs conditions at :841 — MA-1569 multi-rider recipe byte-shape, escape_dc
// top-level). Both conditions granted on hit; activeConditionMeta stamps {dc:20,ability:"str",
// source} for BOTH grappled and restrained (§MA-1274) so the initiative condition badges show the
// STR escape DC 20 save (owned by handlePlainDamage.hitClause.test.js — never re-pinned at the
// modal). Cosmetic prose housekeeping in the SAME row: "4dl2"→"4d12", "Ifthe"→"If the".
// ADVISORY, NO CONSUMER, NO CODE: the "can't bite another target" exclusive-bite gate has NO
// consumer anywhere app-wide — ungated retargeted second Bite is the EXPECTED honest behavior;
// no fake structured gate field authored (locked by the full-row toEqual exhaustiveness).
// Size-gate caveat §1116 does not bite here: RAW clause is "if the target is a creature"
// (unconditional), and the hit_conditions lane carries no size-cap field anyway.
// Trim pass (2026-10-18), two seams, one press each — mirrors the maintained ma1569 template:
//   1. Disk-row bytes: FULL-row toEqual (base legs + grapple pair + typo-fixed RAW prose,
//      byte-exact) + tail key placement + same-monster inert guard (riders Bite-row-only;
//      Swallow's save lane owned by ma1578).
//   2. Click→ctx press (MonsterCardModal.jsx:1156/:1180): Bite chip forwards the family's only
//      dual-condition clause [grappled, restrained] escapeDc 20, targetEffect null (no te here —
//      registry lane pinned at ma1569); Claw chip stays clause-less (base-only lane).
// Cut (owner cites): stirges/swarm-of-proboscises byte pins — FOREIGN row, owned by maintained
// ma1569 (:176-193, #707); direct buildHitConditionClause unit tests — subsumed by the ctx
// hitClause toEqual; applyHitClauseConditions meta-stamp — re-implemented test-local logic,
// landing owned by handlePlainDamage.hitClause; attackRowMissingToHit truth table — ma0286
// :89-113; raw-file uniqueness census — per-row byte pins own their bytes.
// Dead-mock purge per ma1569 baseline: diceRoller stub (rollAttack mocked, no roller fires),
// AttackResultPopup stub (popup never renders — popupHtml stays null), never-fired hook members.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn().mockResolvedValue();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
  return {
    default: vi.fn(() => ({
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: _rollAttack,
      rollDamage: _rollDamage,
    })),
    _rollAttack,
    _setPopupHtml,
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

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const { _rollAttack: rollAttack, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TARRASQUE = monsters.find((m) => m.index === 'tarrasque');
const BITE = TARRASQUE.actions.find((a) => a.name === 'Bite');
const CLAW = TARRASQUE.actions.find((a) => a.name === 'Claw');
const HORNS = TARRASQUE.actions.find((a) => a.name === 'Horns');
const SWALLOW = TARRASQUE.actions.find((a) => a.name === 'Swallow');

// Exact disk row, byte-for-byte — full-row toEqual locks every rider at once: base legs
// (+19, reach 10 ft., 4d12 + 10 Piercing), the MA-0909/MA-0930 grapple pair, and the RAW
// prose with both typo fixes ("4d12", "If the"). Exhaustiveness also locks the ABSENCE of
// hit_choice/save_effect/save_dc decoys and of any fake exclusive-bite gate field — the
// "can't bite another target" prose stays advisory-only.
const FULL_ROW = {
  name: 'Bite',
  description: "Melee Weapon Attack: +19 to hit, reach 10 ft., one target. Hit: 36 (4d12 + 10) piercing damage. If the target is a creature, it is grappled (escape DC 20). Until this grapple ends, the target is restrained, and the tarrasque can't bite another target.",
  attack_bonus: 19,
  reach: '10 ft.',
  damage_dice_primary: '4d12 + 10',
  damage_type_primary: 'Piercing',
  hit_conditions: ['grappled', 'restrained'],
  escape_dc: 20,
};

// Exact buildHitConditionClause(BITE) output relayed into the roll ctx — the family's ONLY
// dual-condition clause (both conditions granted on hit; escapeDc 20 stamps STR escape meta
// for both, landing owned by handlePlainDamage.hitClause.test.js §MA-1274). targetEffect
// null: Bite authors no te (stirges' attached lane pinned at ma1569).
const BITE_CLAUSE = {
  conditions: ['grappled', 'restrained'],
  escapeDc: 20,
  attackName: 'Bite',
  targetEffect: null,
};

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

function clickChip(name) {
  const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => new RegExp(`^${name}\\b`).test(a.textContent.trim()));
  const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+19');
  expect(chip, `Expected ${name} +19 dice link`).toBeTruthy();
  fireEvent.click(chip);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1573 monsters.json data lock: Tarrasque Bite grapple+restrained rider', () => {
  it('authors the full byte-exact row: hit_conditions [grappled, restrained] + escape_dc 20 tail keys, typo-fixed RAW prose, same-monster rows inert', () => {
    expect(BITE).toEqual(FULL_ROW);
    // Key placement: grapple pair trails damage_type_primary (MA-1569 byte-shape).
    expect(Object.keys(BITE)).toEqual(['name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary', 'hit_conditions', 'escape_dc']);
    // Inert guard: the dual rider is Bite-row-only — Claw/Horns stay clause-less
    // (chip-forward pinned below); Swallow's separate save lane owned by ma1578.
    for (const sibling of [CLAW, HORNS, SWALLOW]) {
      expect(sibling.hit_conditions, `${sibling.name} must stay clause-less`).toBeUndefined();
      expect(sibling.escape_dc, `${sibling.name} must carry no escape_dc`).toBeUndefined();
    }
  });
});

describe('MA-1573 Bite chip→ctx forward (MonsterCardModal.jsx:1156/:1180)', () => {
  it('clicking the Bite +19 chip forwards the family\'s only dual-condition hitClause [grappled, restrained] escapeDc 20 with 4d12 + 10 auto-damage', () => {
    renderTarrasque();
    clickChip('Bite');
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.hitClause).toEqual(BITE_CLAUSE);
    expect(ctx.autoDamageFormula).toBe('4d12 + 10');
  });

  it('Claw +19 chip click stays clause-less — rider never leaks onto sibling rows (base-only lane)', () => {
    renderTarrasque();
    clickChip('Claw');
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls.find((c) => c[2]?.autoDamageFormula === '4d8 + 10')[2];
    expect(ctx.hitClause).toBeNull();
  });
});
