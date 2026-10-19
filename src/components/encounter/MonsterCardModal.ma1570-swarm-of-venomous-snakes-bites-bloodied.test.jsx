// @maintained-by-ai
// MA-1570: Swarm of Venomous Snakes "Bites" — inert prose Bloodied variant
// fixed on monsters.json swarm-of-venomous-snakes actions[0] via
// conditional_damage riding the live MA-0007 GM-adjudication seam
// (buildChargeBonusOffer arms on cd?.dice). DUAL-POOL twin: the row keeps its
// LIVE damage_dice_secondary "3d6" Poison combo rider (MA-0427/§516
// combined_damage_roll) UNTOUCHED — the Bloodied variant applies to PRIMARY
// only, exactly like the MA-0647 drow-mage Staff first-versatile-with-live-
// secondary precedent, on the MA-1552/MA-1562 swarm-family bloodied lane.
// Byte-shape mirrors the modifier-bearing MA-0485/MA-1555/MA-1562/MA-1569
// twins (separate numeric modifier key, NEVER embedded "+" in dice — §MA-1555).
// Seam is ADDITIVE (MA-1160/§MA-1555): accept pays bonus leg + base primary
// + poison rider intact; RAW full-variant replacement caveat is the accepted
// family residual (§70).
// Trim pass (2026-10-18), two tests mirroring the maintained ma1562 template:
//   1. Disk-row bytes: full cd-object toEqual identity as this monster's LONE
//      lock — cd {1d4, modifier 4, Piercing, Bloodied} genuinely differs by
//      VALUE from every swarm twin (piranhas {1d4,3}, stirges {1d10,3}, claws
//      {2d8,2}, bats modifier-less) — plus inline key order, full row-key
//      census locking cd placement AFTER the live secondary pair (giant-elk
//      Ram / mimic Bite multi-key ordering precedent, owned ma0805/ma1160),
//      base legs + live poison rider bytes, RAW em-dash prose regex with
//      fix-scope anchor count==1, single-action parent census, and lone
//      CR0 venomous-snake same-name Bite inert (blast-radius guard).
//   2. ONE click→rollAttack ctx press: full 7-key offer identity incl. this
//      monster's distinct label chrome ("Bloodied: +1d4+4 Piercing?") +
//      hitClause toBeNull (Bloodied-only row) + dual-pool transport — variant
//      is primary-only while the live 3d6 Poison secondary rides the ctx
//      (this monster's genuinely distinct behavior vs the rider-less twins).
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :210-250):
// grant, crit accept, decline — generic mechanics twins of the owner's lane;
// popup offer-render — popup chrome owned by common/AttackResultPopup.ma1363
// :105-120; direct buildChargeBonusOffer label test — subsumed by the ctx offer
// toEqual; attackRowMissingToHit — truth table owned by helper census
// (MonsterAction.ma0286 :89-113; a suppressed row would fail the +6-chip click
// in test 2 anyway). Foreign-row cross-pins cut with owners: piranhas cd/key-
// order/label→ma1562, stirges→ma1569, bats→ma1552, claws→ma1555,
// centipedes→ma1554, mimic Bite cd→ma1160, giant-elk Ram→ma0805. Fix scope
// stays guarded without them via the monster-exclusive RAW prose anchor
// count==1. NOTE for orchestrator: the MA-0647 drow-mage Staff precedent bytes
// cut here (cd absence + 1d6 poison secondary) have no other test owner —
// they belong to a future ma0647 owner file, not to this swarm's lock.
// Dead-mock purge per ma1552/ma1558/ma1561 baseline: diceRoller stub (rollAttack
// mocked, no roller fires without the cut grant tests), AttackResultPopup stub
// (popup never renders — popupHtml null), never-fired hook members (minimal
// shape renders).
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

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(RAW);
const SWARM = monsters.find((m) => m.index === 'swarm-of-venomous-snakes');
const BITES = SWARM.actions.find((a) => a.name === 'Bites');
const LONE_SNAKE = monsters.find((m) => m.index === 'venomous-snake');

// Exact buildChargeBonusOffer(BITES, 'Bites') output FROM the disk row — full
// identity, incl. the modifier-bearing formula ('1d4 + 4', MA-0485 shape) and
// the condition-text label chrome ("Bloodied: +1d4+4 Piercing?", no feet-token
// head, MA-1363 label generalization with the +4 modifier token).
const SNAKES_OFFER = {
  dice: '1d4',
  modifier: 4,
  damageType: 'Piercing',
  condition: 'Bloodied',
  formula: '1d4 + 4',
  label: 'Bloodied: +1d4+4 Piercing?',
  attackName: 'Bites',
};

const CREATURES = [
  { name: 'Swarm of Venomous Snakes 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function renderSnakes() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Swarm of Venomous Snakes', size: 'Medium', type: 'swarm', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Venomous Snakes 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Venomous Snakes 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1570 monsters.json data lock: Swarm of Venomous Snakes Bites Bloodied fix', () => {
  it('authors the modifier-bearing Bloodied cd over the live 3d6 poison rider, with key placement and RAW prose anchor', () => {
    expect(BITES.attack_bonus).toBe(6);
    expect(BITES.reach).toBe('5 ft.');
    expect(BITES.damage_dice_primary).toBe('1d8 + 4');
    expect(BITES.damage_type_primary).toBe('Piercing');
    // Full cd identity — the modifier-bearing MA-0485 byte-shape (separate numeric
    // modifier key, dice string never carries '+'), key order pinned inline.
    // {1d4, modifier 4} is THIS monster's lone lock: piranhas {1d4,3}, stirges
    // {1d10,3}, claws {2d8,2} differ by dice/modifier value, bats is modifier-less.
    expect(BITES.conditional_damage).toEqual({
      dice: '1d4',
      modifier: 4,
      damage_type: 'Piercing',
      condition: 'Bloodied',
    });
    expect(Object.keys(BITES.conditional_damage)).toEqual(['dice', 'modifier', 'damage_type', 'condition']);
    expect(BITES.conditional_damage.dice).not.toMatch(/\+/);
    // Dual-pool (MA-0427/§516): the live poison rider is untouched, the Bloodied
    // variant applies to PRIMARY only (MA-0647 drow-mage Staff precedent shape).
    expect(BITES.damage_dice_secondary).toBe('3d6');
    expect(BITES.damage_type_secondary).toBe('Poison');
    expect(BITES.flat_damage_secondary).toBeUndefined();
    expect(BITES.secondary_condition).toBeUndefined();
    // Full row-key census: cd sits AFTER the live secondary pair as the last key
    // (multi-key ordering precedent giant-elk Ram ma0805 / mimic Bite ma1160) and
    // no escape_dc/hit_conditions/hit_choice/two-handed chooser is authored.
    expect(Object.keys(BITES)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'damage_dice_secondary',
      'damage_type_secondary',
      'conditional_damage',
    ]);
    // RAW prose anchor for the fixed Bloodied variant — monster-exclusive seam
    // (the em-dash "or 6 (1d4 + 4)" clause never appears on any other row).
    expect(BITES.description).toMatch(/Hit: 8 \(1d8 \+ 4\) Piercing damage\u2014or 6 \(1d4 \+ 4\) Piercing damage if the swarm is Bloodied\u2014plus 10 \(3d6\) Poison damage\./);
    const anchor = 'or 6 (1d4 + 4) Piercing damage if the swarm is Bloodied';
    expect(RAW.split(anchor).length - 1).toBe(1);
    // Single-action parent census: Bites is the swarm's only action.
    expect(SWARM.actions.map((a) => a.name)).toEqual(['Bites']);
    // Fix-scope guard: the lone CR0 venomous-snake's same-name Bite stays inert
    // (fixed-form 1d4 + 2 Piercing, no cd) — only the swarm carries the variant.
    const loneBite = LONE_SNAKE.actions.find((a) => a.name === 'Bite');
    expect(loneBite.conditional_damage).toBeUndefined();
    expect(loneBite.damage_dice_primary).toBe('1d4 + 2');
  });
});

describe('MA-1570 Swarm of Venomous Snakes Bites click→ctx forward (dual-pool: variant primary-only, poison rides)', () => {
  it('clicking the +6 chip forwards the full disk offer with Bloodied label chrome, null hitClause, and the live 3d6 poison secondary intact', () => {
    renderSnakes();
    const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bites/.test(a.textContent.trim()));
    const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+6');
    expect(chip, 'Expected Bites +6 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(SNAKES_OFFER);
    // toBeNull like the Bloodied-only swarm twins (contrast ma1555's prone twin).
    expect(ctx.hitClause).toBeNull();
    // Dual-pool transport: base primary AND the live poison rider ride alongside
    // the bonus offer — the Bloodied variant never consumes the secondary.
    expect(ctx.autoDamageFormula).toBe('1d8 + 4');
    expect(ctx.damageType).toBe('Piercing');
    expect(ctx.autoDamageSecondaryFormula).toBe('3d6');
    expect(ctx.autoDamageSecondaryDamageType).toBe('Poison');
  });
});
