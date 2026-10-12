// MA-1931: King Kong "Grab" compound attack+save row — live-verified
// FAIL(b)/DATA: the "+17" attack chip self-resolved exact (2/2 hits,
// "3d10 + 10" Bludgeoning, hp deltas honest) but the save half was
// structurally inert — no save_dc/save_type → ActionSaveRoll never armed
// (§260 DC0-gate Number(save_dc)>0), zero save adjudication across hits
// (lastAttack.saveDc:null, whole-log grep-zero Grappled/Restrained/
// escape_dc). DATA fix on king-kong.actions[2]: save_dc:25 +
// save_type:"Strength" + dc_success:"none" (RAW success = nothing;
// half-default leaks fake half-damage copy, MV-20/§335 family) +
// save_effect byte-carrying the canonical words "Grappled" + "Restrained"
// (§346 save lane word-scans save_effect ONLY) + escape_dc:25 (MA-0010
// byte-shape; save-lane grants carry {source}-only meta — escape badge
// rides the ATTACK-lane seam, accepted MA-1867/§537 residual). Key order
// mirrors the Cthulhu Tentacles MA-1867 twin (same Huge-or-smaller
// save-fail grapple prose): save fields AFTER damage_type_primary.
// Grapple axis is SAVE-FAIL only — NO hit_conditions (§537: hit_conditions
// grants on attack-HIT, wrong axis). save_effect carries NO dice+"damage"
// pool so the rider-only "DC 25 Strength" chip stays CLICKABLE (§259/§536;
// the RAW description byte stays the flavor carrier). Huge-or-smaller
// size gate stays GM-advisory: parseTargetPrerequisite (MA-0019) is
// conditions-only (Helpers:981 requires a non-empty conditions array), no
// structured size byte-shape exists app-wide — MA-1389/1397/1621/1867
// advisory family; no condition prerequisite fabricated on this row.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  buildHitConditionClause,
  evaluateTargetPrerequisiteGate,
  extractConditionsFromSaveEffect,
  parseTargetPrerequisite,
} from '../../components/encounter/MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const KONG = monsters.find((m) => m.index === 'king-kong');
const GRAB = KONG.actions[2];

describe('MA-1931 disk fingerprint: King Kong Grab save half armed (DATA fix)', () => {
  it('row identity + attack half byte-unchanged — row stays compound, attack chip intact', () => {
    expect(KONG.name).toBe('King Kong');
    expect(GRAB.name).toBe('Grab');
    expect(GRAB.attack_bonus).toBe(17);
    expect(GRAB.reach).toBe('10 ft.');
    expect(GRAB.damage_dice_primary).toBe('3d10 + 10');
    expect(GRAB.damage_type_primary).toBe('Bludgeoning');
    expect(canRollExpression(GRAB.damage_dice_primary)).toBe(true);
    expect(GRAB.description).toBe(
      "Melee Attack Roll: +17, reach 10 ft. Hit: 26 (3d10 + 10) Bludgeoning damage. If the target is a Huge or smaller creature, it must succeed on a DC 25 Strength saving throw or have the Grappled condition (escape DC 25) and be Restrained until Kong's next turn."
    );
  });

  it('save fields armed after damage_type_primary (MA-1867 Cthulhu twin key order): DC 25 Strength, dc_success none, escape_dc 25', () => {
    expect(GRAB.save_dc).toBe(25);
    expect(GRAB.save_type).toBe('Strength');
    expect(GRAB.dc_success).toBe('none');
    expect(GRAB.escape_dc).toBe(25);
    const keys = Object.keys(GRAB);
    expect(keys.indexOf('save_dc')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('save_type')).toBe(keys.indexOf('save_dc') + 1);
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
    expect(keys.indexOf('save_effect')).toBe(keys.indexOf('dc_success') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('save_effect') + 1);
  });

  it('save_effect byte-carries canonical "Grappled" + "Restrained"; word-scan yields both save-fail grants', () => {
    expect(GRAB.save_effect).toBe(
      'On a failed save the target has the Grappled condition (escape DC 25) and is Restrained until Kong\'s next turn.'
    );
    // §346 canonical keys pinned in extractor list order (alphabetical).
    expect(extractConditionsFromSaveEffect(GRAB.save_effect)).toEqual(['grappled', 'restrained']);
  });

  it('rider-only pin (§259/§536): save_effect carries NO dice token and NO "damage" word — DC chip stays clickable, no double-charge', () => {
    expect(/\d+\s*d\s*\d+/i.test(GRAB.save_effect)).toBe(false);
    expect(/damage/i.test(GRAB.save_effect)).toBe(false);
  });

  it('grapple axis is SAVE-FAIL only: NO hit_conditions authored, hit-clause stays null (attack chip never grants)', () => {
    expect(GRAB.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(GRAB)).toBeNull();
  });

  it('no condition prerequisite fabricated: MA-0019 parseTargetPrerequisite null, gate inert-satisfied (size gate stays advisory family)', () => {
    // §564 pure-function rig: inject getRuntimeValue closure, no store needed.
    expect(parseTargetPrerequisite(GRAB)).toBeNull();
    const gate = evaluateTargetPrerequisiteGate({
      action: GRAB,
      target: { name: 'Bandit 1' },
      monsterName: 'King Kong 1',
      campaignName: 'test-campaign',
      getRuntimeValue: () => undefined,
    });
    expect(gate).toEqual({ prerequisite: null, satisfied: true });
  });

  it('siblings byte-inert: Slam attack-only, Multiattack header text-only, Thunder Roar untouched (MA-1932 axis)', () => {
    const [multi, slam, , roar] = KONG.actions;
    expect(multi.name).toBe('Multiattack');
    expect(multi.save_dc).toBeUndefined();
    expect(slam.name).toBe('Slam');
    expect(slam.save_dc).toBeUndefined();
    expect(slam.hit_conditions).toBeUndefined();
    expect(roar.name).toBe('Thunder Roar (Recharge 5-6)');
    expect(roar.save_dc).toBe(23);
    expect(roar.save_type).toBe('Wisdom');
    expect(roar.recharge).toBeUndefined(); // MA-1932 stays this row's neighbor, untouched
  });
});
