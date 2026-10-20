// @maintained-by-ai
// MA-1931: King Kong "Grab" compound attack+save row — DATA fix pinned on the
// REAL on-disk monsters.json row (programmatic disk-bytes, never transcribed
// prose, #1086-#1088 class; ground-truth verbatim #993). The shipped row was
// attack-only: no save_dc/save_type → ActionSaveRoll never armed (DC0-gate
// Number(save_dc)>0), zero save adjudication across hits. Fix: save_dc 25 +
// save_type "Strength" + dc_success "none" (RAW success = nothing; half-default
// leaks a fake half-damage copy, §335 family) + save_effect byte-carrying the
// canonical words "Grappled" + "Restrained" (§346 save lane word-scans
// save_effect ONLY) + escape_dc 25 (MA-0010 byte-shape; save-lane grants carry
// {source}-only meta — escape badge rides the ATTACK-lane seam, accepted
// MA-1867/§537 residual). Grapple axis is SAVE-FAIL only: NO hit_conditions
// (§537 hit_conditions grants on attack-HIT, wrong axis) and NO fabricated
// target_prerequisite — the Huge-or-smaller size gate stays GM-advisory
// (MA-1389/1397/1621/1867 advisory family). save_effect carries NO dice+"damage"
// pool so the rider-only "DC 25 Strength" chip stays CLICKABLE (§259/§536).
//
// Framework-owned (cited, not re-run here):
//  - canRollExpression formula truth-table → diceRoller.test.js (canRollExpression
//    it.each census); '3d10 + 10' verbatim byte stays pinned in the row-lock;
//  - extractConditionsFromSaveEffect canonical word census →
//    MonsterCardModal.conditions-extraction.test.jsx (only the REAL kong row
//    mapped through the extractor is pinned here);
//  - parseTargetPrerequisite/evaluateTargetPrerequisiteGate truth tables +
//    refuse/admit legs → monsterSnatch.ma1981 + MonsterCardModal.ma1275
//    (MA-0019 conditions-only codification); only the null-on-this-row pin
//    lives here — no hand-built gate rig on an ungated row;
//  - riderOnly chip truth table → MonsterCardModal.ma1000;
//  - Thunder Roar save core + recharge:"5-6" → monsterRecharge.ma1932
//    (its incidental grab.save_dc sibling pin stays there).
//
// old→new: old 7 tests → 2. Old "row identity + attack half" + "save fields
// armed (key order)" + "save_effect byte + extractor" + "rider-only regex" +
// "save-fail axis" + "prerequisite parse/gate" → test 1 single real-row lock
// (key-index adjacency pins and rider-only regex DROPPED: derivable from the
// verbatim save_effect byte; gate rig DELETED citing ma1981/ma1275).
// Old "siblings byte-inert" → test 2 decoy narrowed to the closest-confusion
// rows (Slam/Multiattack, #948); roar asserts DELETED citing ma1932.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  buildHitConditionClause,
  extractConditionsFromSaveEffect,
  parseTargetPrerequisite,
} from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const KONG = monsters.find((m) => m.index === 'king-kong');
const GRAB = KONG.actions[2];

describe('MA-1931 disk fingerprint: King Kong Grab save half armed (DATA fix)', () => {
  it('real-row lock: attack half byte-unchanged + save half armed — DC 25 Strength, dc_success none, escape_dc 25, save-fail axis only', () => {
    expect(KONG.name).toBe('King Kong');
    expect(GRAB.name).toBe('Grab');
    expect(GRAB.attack_bonus).toBe(17);
    expect(GRAB.reach).toBe('10 ft.');
    expect(GRAB.damage_dice_primary).toBe('3d10 + 10');
    expect(GRAB.damage_type_primary).toBe('Bludgeoning');
    expect(GRAB.description).toBe(
      "Melee Attack Roll: +17, reach 10 ft. Hit: 26 (3d10 + 10) Bludgeoning damage. If the target is a Huge or smaller creature, it must succeed on a DC 25 Strength saving throw or have the Grappled condition (escape DC 25) and be Restrained until Kong's next turn."
    );
    // the ticket's data fix: save half armed (§260 DC-gate now passes).
    expect(GRAB.save_dc).toBe(25);
    expect(GRAB.save_type).toBe('Strength');
    expect(GRAB.dc_success).toBe('none'); // RAW success = nothing — half-leak close
    expect(GRAB.escape_dc).toBe(25);
    // rider-only pool (§259/§536): the verbatim byte carries NO dice+"damage"
    // pool so the standalone "DC 25 Strength" chip stays CLICKABLE (riderOnly
    // truth table owned by MA-1000); the RAW description byte is flavor.
    expect(GRAB.save_effect).toBe(
      'On a failed save the target has the Grappled condition (escape DC 25) and is Restrained until Kong\'s next turn.'
    );
    // save-fail axis through the production word scan (§346): both grants land.
    expect(extractConditionsFromSaveEffect(GRAB.save_effect)).toEqual(['grappled', 'restrained']);
    // NO hit_conditions and NO fabricated prerequisite: the attack chip never
    // grants and the size gate stays GM-advisory (§537; gate mechanism ma1981).
    expect(GRAB.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(GRAB)).toBeNull();
    expect(GRAB.target_prerequisite).toBeUndefined();
    expect(parseTargetPrerequisite(GRAB)).toBeNull();
  });

  it('decoy: Kong\'s closest-confusion rows stay byte-inert — only Grab arms grapple adjudication', () => {
    // Slam/Multiattack: the attack rows most confused with Grab carry no save
    // core and no hit grants — they can never adjudicate or grant Grappled.
    const slam = KONG.actions.find((a) => a.name === 'Slam');
    const multi = KONG.actions.find((a) => a.name === 'Multiattack');
    expect(slam.save_dc).toBeUndefined();
    expect(slam.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(slam)).toBeNull();
    expect(multi.save_dc).toBeUndefined();
    expect(multi.hit_conditions).toBeUndefined();
    // Thunder Roar keeps its OWN save core (DC 23 Wis frightened lane, MA-1932
    // fingerprint cited there) with ZERO grapple bytes leaking onto it.
    const roar = KONG.actions.find((a) => a.name.startsWith('Thunder Roar'));
    expect(roar.save_dc).toBe(23);
    expect(roar.save_type).toBe('Wisdom');
    expect(extractConditionsFromSaveEffect(roar.save_effect)).not.toContain('grappled');
  });
});
