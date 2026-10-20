// @maintained-by-ai
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
//
// Framework-owned (cited, not re-run here):
//  - parseGrappleOngoingDamage branch table + Apep twin threading →
//    MonsterCardHelpers.grapple-ongoing-damage.test.js (MA-1842 owns the parser
//    seam AND the Apep 4d8/Bludgeoning disk lock — the old "apep twin stays
//    byte-intact" test here was a duplicate of that owner, purged);
//  - clause consumer / Grappled+escape meta+te constrict_grapple producer +
//    rounds:100 tick → handlePlainDamage.constrict-grapple.test.js (engine
//    family — cited, never re-driven); te registry registration LOW VALUE #1012;
//  - buildHitConditionClause guard truth tables → MonsterCardHelpers.hit-choice
//    .test.js / handlePlainDamage.hitClause.test.js; extractor word-scan owner →
//    MonsterCardModal.conditions-extraction.test.jsx (#1093 exemplar shape) —
//    only the REAL Constrict row mapped THROUGH the extractor is pinned here
//    (decoys hit the clause-less guard branch, #1035);
//  - Ladon save/recharge siblings: Sleeping Mist save core + recharge gate →
//    monsterRecharge.ma1940 (save-axis ONLY here: its plain `conditions` byte
//    NEVER arms a hit clause — cited, its save DC owned there);
//  - family: no base owner — MA-1927 and MA-1939 are byte-distinct data tickets,
//    each locking its own row; this file never re-runs Jormungandr bytes.
//
// old→new: old 7 tests → 2. Old "row identity + existing keys" + "escape_dc
// 22" + "grapple_ongoing_damage shape" + "parseGrappleOngoingDamage rider" +
// "buildHitConditionClause threading" → test 1 single real-row lock (adds
// verbatim description bytes #993, no-duplicate-key + save-axis/target-
// prerequisite absence canaries #1093, full clause toEqual absorbing both
// fragment tests). Old "apep twin" → deleted citing MA-1842 owner above.
// Old "siblings byte-inert" → test 2 decoy via name-lookup (#1094, brittle
// index gone): Bite closest-confusion numerics twin + Sleeping Mist save-axis
// row (#948); Multiattack dropped — trivial inert header row.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { buildHitConditionClause } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const LADON = monsters.find((m) => m.index === 'ladon');
const CONSTRICT = LADON.actions.find((a) => a.name === 'Constrict');

describe('MA-1939 disk fingerprint: Ladon Constrict two-field fix', () => {
  it('real-row lock: numerics byte-unchanged + fix armed — escape_dc 22 and grapple_ongoing_damage 4d8 Bludgeoning verbatim, extractor builds full grapple clause', () => {
    expect(LADON.name).toBe('Ladon');
    expect(CONSTRICT.name).toBe('Constrict');
    expect(CONSTRICT.description).toBe(
      'Melee Attack Roll: +15, reach 10 ft., one Huge or smaller creature. Hit: 25 (4d8 + 8) Bludgeoning damage and the target has the Grappled condition (escape DC 22). Ladon has five coils; each Grappled target is held by a separate coil. While Grappled this way, a target takes 18 (4d8) Bludgeoning damage at the start of its turn.'
    );
    // pre-existing bytes untouched by the two-field fix:
    expect(CONSTRICT.attack_bonus).toBe(15);
    expect(CONSTRICT.reach).toBe('10 ft.');
    expect(CONSTRICT.damage_dice_primary).toBe('4d8 + 8');
    expect(CONSTRICT.damage_type_primary).toBe('Bludgeoning');
    expect(CONSTRICT.hit_conditions).toEqual(['grappled']);
    // the ticket's two-field DATA fix, exact disk bytes (apep MA-1842 twin
    // shape): escape lane + turn-start tick rider — no duplicate-state keys.
    expect(CONSTRICT.escape_dc).toBe(22);
    expect(CONSTRICT.grapple_ongoing_damage).toEqual({ dice: '4d8', damage_type: 'Bludgeoning' });
    expect(CONSTRICT.conditions).toBeUndefined();
    // axis canaries (#1093 split): hit-axis ONLY — no save half on the attack
    // chip (Sleeping Mist owns the save lane, ma1940); size gate stays advisory
    // prose (MA-1931) — no target_prerequisite byte-shape.
    expect(CONSTRICT.save_dc).toBeUndefined();
    expect(CONSTRICT.save_type).toBeUndefined();
    expect(CONSTRICT.save_effect).toBeUndefined();
    expect(CONSTRICT.target_prerequisite).toBeUndefined();
    // production extractor arms the full grapple grant on the REAL row:
    // grappled + escapeDc 22 + parsed tick rider (consumer = handlePlainDamage
    // constrict-grapple producer, cited above; parser table owned by MA-1842).
    expect(buildHitConditionClause(CONSTRICT)).toEqual({
      conditions: ['grappled'],
      escapeDc: 22,
      attackName: 'Constrict',
      targetEffect: null,
      grappleOngoingDamage: { dice: '4d8', damageType: 'Bludgeoning' },
    });
  });

  it('decoy: Ladon closest-confusion sibling rows stay hit-axis inert — only Constrict arms a grapple grant', () => {
    // Bite shares the +15 / 10 ft. / 4d8 numerics with Constrict (Piercing
    // + Poison instead of Bludgeoning) but carries no grapple lanes — the
    // clause-less guard branch (#1035) stays live for it.
    const bite = LADON.actions.find((a) => a.name === 'Bite');
    expect(bite.attack_bonus).toBe(15);
    expect(bite.damage_dice_primary).toBe('4d8 + 8');
    expect(bite.hit_conditions).toBeUndefined();
    expect(bite.escape_dc).toBeUndefined();
    expect(bite.grapple_ongoing_damage).toBeUndefined();
    expect(buildHitConditionClause(bite)).toBeNull();
    // Sleeping Mist is save-axis (ma1940): its plain `conditions` byte is
    // invisible to the attack path — buildHitConditionClause reads only the
    // hit_* keys and stays null.
    const mist = LADON.actions.find((a) => a.name.startsWith('Sleeping Mist'));
    expect(mist.save_dc).toBe(23); // its own save core, owned by ma1940
    expect(mist.hit_conditions).toBeUndefined();
    expect(mist.escape_dc).toBeUndefined();
    expect(buildHitConditionClause(mist)).toBeNull();
  });
});
