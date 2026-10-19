// @maintained-by-ai
// MA-1568: Swarm of Spiders Bites — conditional_damage:{dice:"2d4",damage_type:"piercing",
// condition:"half HP or fewer"} authored on monsters.json swarm-of-spiders actions[0] so the
// HIT popup offers the "or 5 (2d4) piercing damage if the swarm has half of its hit points or
// fewer" variant via the live MA-0007 GM-adjudication seam (additive: base Done still pays
// 4d4; grant rolls its own 2d4 leg). No auto-half-HP eval (§70 residual); offer shows even
// healthy (MA-1363 static-state recipe). Honest twin identity: this row is BYTE-IDENTICAL to
// the MA-1553 swarm-of-beetles row (full-object equality verified 2026-10-18 — cd, base
// bytes, reach, even prose), a twin of the modifier-less MA-0885 goat / MA-1363 quaggoth /
// MA-1552 swarm-of-bats shape (keys dice/damage_type/condition, no modifier). Prose-only
// clause was FAIL(a)/DATA (buildChargeBonusOffer arms on cd.dice only — Helpers:666).
// Trim pass (2026-10-18), two seams, one press each — mirrors the maintained ma1553/ma1564
// template:
//   1. Disk-row bytes: full cd-object toEqual identity + inline key order (no modifier key =
//      modifier-0 additive delta; lowercase 'half HP or fewer' family casing), immediate-
//      after-and-last placement, spider-row base bytes (+3 / 0 ft. / 4d4 / piercing), single-
//      action census, full RAW prose anchor, hit_conditions absent (half-HP threshold rides
//      conditional_damage only, never an auto-grant rider), and the fix-scope guard: the lone
//      spider's same-name Bite stays inert — only the swarm carries the variant.
//      Twin-key comparisons vs beetles/centipedes/quippers/goat/quaggoth cut — each twin
//      byte-pinned by its own owner (beetles ma1553, centipedes ma1554, quippers ma1564,
//      bats ma1552, goat ma0885, quaggoth ma1363).
//   2. ONE click→rollAttack ctx press (MonsterCardModal.jsx:1407): full 7-key offer identity
//      incl. the condition-text label chrome — first-char capitalization only,
//      "Half HP or fewer: +2d4 piercing?" (damage_type stays lowercase on disk) + hitClause
//      toBeNull.
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :210-250):
// grant, crit accept, decline — generic mechanics twins of owner Talons bytes;
// popup offer-render — popup chrome owned by common/AttackResultPopup.ma1363 :105-120.
// Charge-row label loop + direct buildChargeBonusOffer label test cut: every row byte-pinned
// by its own owner (talons charge-bonus :51, goat ma0885, quaggoth ma1363, bats ma1552) and
// the spiders label is subsumed by the ctx offer toEqual.
// Dead-mock purge per ma1552 baseline: diceRoller stub (rollAttack mocked, no roller fires
// without the cut grant tests), AttackResultPopup stub (popup never renders — popupHtml null),
// never-fired hook members (minimal shape renders per ma1160/ma1363).
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
const SWARM = monsters.find((m) => m.index === 'swarm-of-spiders');
const BITES = SWARM.actions.find((a) => a.name === 'Bites');
const LONE_SPIDER = monsters.find((m) => m.index === 'spider');

// Exact buildChargeBonusOffer(BITES, 'Bites') output FROM the disk row — full identity,
// incl. the modifier-0 formula ('2d4', never '2d4 + 0') and the first-capitalized condition-
// text label ("Half HP or fewer: +2d4 piercing?", no feet-token head, lowercase 'piercing'
// carried from disk — MA-1363 label generalization).
const SPIDERS_OFFER = {
  dice: '2d4',
  modifier: 0,
  damageType: 'piercing',
  condition: 'half HP or fewer',
  formula: '2d4',
  label: 'Half HP or fewer: +2d4 piercing?',
  attackName: 'Bites',
};

const CREATURES = [
  { name: 'Swarm of Spiders 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function renderBites() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Swarm of Spiders', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Spiders 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Spiders 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1568 monsters.json data lock: Swarm of Spiders Bites half-HP variant', () => {
  it('authors the modifier-less additive half-HP clause with last-key placement and RAW prose anchor', () => {
    expect(BITES.attack_bonus).toBe(3);
    expect(BITES.reach).toBe('0 ft.');
    expect(BITES.damage_dice_primary).toBe('4d4');
    expect(BITES.damage_type_primary).toBe('piercing');
    // Full cd identity + inline key order — absence of a modifier key marks the modifier-less
    // additive convention (resolver pays base + clause; half-HP swarm family of beetles/
    // centipedes/wasps, byte-pinned by their own owners).
    expect(BITES.conditional_damage).toEqual({
      dice: '2d4',
      damage_type: 'piercing',
      condition: 'half HP or fewer',
    });
    expect(Object.keys(BITES.conditional_damage)).toEqual(['dice', 'damage_type', 'condition']);
    expect(BITES.conditional_damage.dice).not.toMatch(/\+/);
    // Key placement: cd immediately after damage_type_primary, last key on the row.
    const keys = Object.keys(BITES);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('conditional_damage');
    // Half-HP-only row: no auto-grant hit-clause riders authored.
    expect(BITES.hit_conditions).toBeUndefined();
    // RAW prose anchor — the spider row's own "10 (4d4) ... or 5 (2d4) ... half of its hit
    // points" sentence (shared byte-twin of the beetles row, honestly not bestiary-unique).
    expect(BITES.description).toMatch(/Hit: 10 \(4d4\) piercing damage, or 5 \(2d4\) piercing damage if the swarm has half of its hit points or fewer\./);
    // Single-action parent census: Bites is the swarm's only action.
    expect(SWARM.actions.map((a) => a.name)).toEqual(['Bites']);
    // Fix-scope guard: the lone spider's same-name Bite stays inert (no cd) —
    // only the swarm carries the half-HP variant.
    const loneBite = LONE_SPIDER.actions.find((a) => a.name === 'Bite');
    expect(loneBite.conditional_damage).toBeUndefined();
  });
});

describe('MA-1568 Bites click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +3 chip forwards the full disk offer + null hitClause (half-HP is a pre-condition, never auto-granted)', () => {
    renderBites();
    const bitesRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bites/.test(a.textContent.trim()));
    const chip = Array.from(bitesRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+3');
    expect(chip, 'Expected Bites +3 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(SPIDERS_OFFER);
    expect(ctx.hitClause).toBeNull();
  });
});
