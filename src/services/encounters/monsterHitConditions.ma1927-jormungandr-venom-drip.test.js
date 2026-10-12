// MA-1927: Jormungandr legendary "Venom Drip" hit-clause rider — live-verified
// FAIL(b)/DATA: +17 ranged chip self-resolved exact (nat 18+17=35 vs AC12 HIT,
// "4d8 + 1" Poison, hp_change −21 unclamped) but the Poisoned rider NEVER
// granted — the row authored `conditions:["poisoned"]`, which NO attack-path
// consumer reads (buildHitConditionClause consumes ONLY structured
// action.hit_conditions, MonsterCardHelpers; applied in handlePlainDamage;
// §153/§399, MA-0291/0361 Brown Bear Claw family — fourth instance).
// One-field DATA fix: rename conditions → hit_conditions (MA-0621/MA-0763
// trailing-key byte-shape, Apep Venomous Sting MA-1846 twin). Plain
// `conditions` stays GONE — no duplicate-state keys, no consumer reads it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { buildHitConditionClause } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const JORMUNGANDR = monsters.find((m) => m.index === 'jormungandr');
const DRIP = JORMUNGANDR.legendary_actions[2];

describe('MA-1927 disk fingerprint: Jormungandr Venom Drip hit_conditions authored', () => {
  it('row identity + numerics byte-unchanged (live-verified exact): +17, 60 ft., 4d8 + 1 Poison', () => {
    expect(JORMUNGANDR.name).toBe('Jormungandr');
    expect(DRIP.name).toBe('Venom Drip');
    expect(DRIP.attack_bonus).toBe(17);
    expect(DRIP.range).toBe('60 ft.');
    expect(DRIP.damage_dice_primary).toBe('4d8 + 1');
    expect(DRIP.damage_type_primary).toBe('Poison');
    expect(DRIP.delegates_to).toBeUndefined();
    expect(DRIP.save_dc).toBeUndefined();
  });

  it('hit_conditions:["poisoned"] authored (was inert conditions:["poisoned"]) and conditions GONE', () => {
    expect(DRIP.hit_conditions).toEqual(['poisoned']);
    // Renamed, not duplicated: plain `conditions` has zero attack-path consumers.
    expect(DRIP.conditions).toBeUndefined();
  });

  it('buildHitConditionClause arms the poisoned rider on the row (lane proven live via Tail control)', () => {
    expect(buildHitConditionClause(DRIP)).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Venom Drip',
      targetEffect: null,
    });
  });

  it('sibling legendary rows byte-inert (header/delegate/capsize stay clause-less)', () => {
    expect(buildHitConditionClause(JORMUNGANDR.legendary_actions[0])).toBeNull();
    expect(buildHitConditionClause(JORMUNGANDR.legendary_actions[1])).toBeNull();
    expect(buildHitConditionClause(JORMUNGANDR.legendary_actions[3])).toBeNull();
  });
});
