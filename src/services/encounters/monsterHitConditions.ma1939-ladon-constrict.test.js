// MA-1939: Ladon Constrict — live-verified FAIL(b)/DATA, two-field core fix.
// Disk actions[2] carried attack_bonus 15 / 4d8 + 8 Bludgeoning / hit_conditions
// ["grappled"] but NO escape_dc (grant reason rendered "Constrict (escape DC —)",
// meta {source}-only, grapple unescapable by badge — MA-1937 em-dash signature)
// and NO grapple_ongoing_damage (victim turn-start zero hp loss, te
// constrict_grapple absent, MA-1842 tick lane never armed; Grappled persisted
// harmlessly). Fix = apep Constrict twin byte-shape (MA-1842 disk-confirmed):
// escape_dc:22 (MA-0010 seam → meta {dc,ability:'str'} + badge) + structured
// grapple_ongoing_damage:{dice:"4d8",damage_type:"Bludgeoning"} →
// parseGrappleOngoingDamage → handlePlainDamage te producer + rounds:100 clock
// → constrictGrappleService victim-turn-start tick + release lane. Size-gate
// prose stays advisory family (MA-1931 codified — no size byte-shape app-wide);
// five-coils flavor unmodelable (§70) — one te per victim-grappler pair.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { parseGrappleOngoingDamage, buildHitConditionClause } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const LADON = monsters.find((m) => m.index === 'ladon');
const CONSTRICT = LADON.actions[2];

describe('MA-1939 disk fingerprint: Ladon Constrict two-field fix', () => {
  it('row identity + existing keys byte-unchanged: +15, reach 10 ft., 4d8 + 8 Bludgeoning, grappled', () => {
    expect(LADON.name).toBe('Ladon');
    expect(CONSTRICT.name).toBe('Constrict');
    expect(CONSTRICT.attack_bonus).toBe(15);
    expect(CONSTRICT.reach).toBe('10 ft.');
    expect(CONSTRICT.damage_dice_primary).toBe('4d8 + 8');
    expect(CONSTRICT.damage_type_primary).toBe('Bludgeoning');
    expect(CONSTRICT.hit_conditions).toEqual(['grappled']);
    // No fabricated siblings: size gate stays advisory (MA-1931), no save lane on the attack chip.
    expect(CONSTRICT.target_prerequisite).toBeUndefined();
    expect(CONSTRICT.save_dc).toBeUndefined();
  });

  it('escape_dc 22 authored (MA-0010 byte-shape; was absent → "escape DC —" em-dash grants)', () => {
    expect(CONSTRICT.escape_dc).toBe(22);
  });

  it('grapple_ongoing_damage apep Constrict byte-shape: dice 4d8, type Bludgeoning', () => {
    expect(CONSTRICT.grapple_ongoing_damage).toEqual({ dice: '4d8', damage_type: 'Bludgeoning' });
  });

  it('parseGrappleOngoingDamage recognizes the row rider (tick producer input)', () => {
    expect(parseGrappleOngoingDamage(CONSTRICT)).toEqual({ dice: '4d8', damageType: 'Bludgeoning' });
  });

  it('buildHitConditionClause threads grappled + escapeDc 22 + rider onto the hit clause', () => {
    const clause = buildHitConditionClause(CONSTRICT);
    expect(clause.conditions).toEqual(['grappled']);
    expect(clause.escapeDc).toBe(22);
    expect(clause.grappleOngoingDamage).toEqual({ dice: '4d8', damageType: 'Bludgeoning' });
  });

  it('apep twin stays byte-intact (fix template innocence)', () => {
    const apep = monsters.find((m) => m.index === 'apep');
    const apepConstrict = apep.actions.find((a) => a.name === 'Constrict');
    expect(apepConstrict.escape_dc).toBe(26);
    expect(apepConstrict.grapple_ongoing_damage).toEqual({ dice: '4d8', damage_type: 'Bludgeoning' });
  });

  it('Ladon sibling rows byte-inert (Multiattack/Bite/Sleeping Mist unchanged)', () => {
    expect(LADON.actions[0].escape_dc).toBeUndefined();
    expect(LADON.actions[0].grapple_ongoing_damage).toBeUndefined();
    expect(LADON.actions[1].escape_dc).toBeUndefined();
    expect(LADON.actions[1].grapple_ongoing_damage).toBeUndefined();
    expect(LADON.actions[3].escape_dc).toBeUndefined();
    expect(LADON.actions[3].grapple_ongoing_damage).toBeUndefined();
  });
});
