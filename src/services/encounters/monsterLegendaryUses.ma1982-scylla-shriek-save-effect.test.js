// @maintained-by-ai
// MA-1982: Scylla legendary "Shriek (Costs 2 Actions)" shipped save core
// live-verified EXACT (DC 23 WIS, 2d10 Thunder, half-on-success default
// RAW-correct — dc_success stays ABSENT, do NOT author it) but the
// "Deafened for 1 minute" rider was description-prose-only — inert (§53
// MA-0090 family: extractConditionsFromSaveEffect Helpers:383 is
// save_effect-scoped, description never read; live MA-1982: 4 failed saves,
// activeConditions ABSENT, zero deaf log). One-field DATA fix (MA-1970 twin
// template): save_effect byte rides the row after damage_type_primary,
// byte-carrying canonical "Deafened". REAL on-disk row pinned programmatic
// disk-bytes (#1086), verbatim description ground truth (#993), fix byte
// exact-once across the whole DB (#829), decoy sweep by NAME (#1094/#948),
// pure-save-row axis canaries (#1096 inverse), extractor THROUGH production,
// honest titles (#910), determinism disk-only (#1057), no wall-clock (#app),
// key-order lock dropped (#1100).
//
// Framework-owned (cited, not re-run here):
//  - "Costs 2 Actions" name-cost parse + 2-use spend + gate/refusal/regain
//    vocabulary → MA-1883 ma1883 / MA-0021 monsterLegendaryUses.test.js
//    :79-110 / header uses CANON #1082 (ma1579) — never re-driven;
//  - extractor word-scan truth tables + save-quartet consumers →
//    MonsterCardModal conditions-extraction family / resolveBlockSave
//    half-default lane; only the REAL Shriek row mapped through
//    extractConditionsFromSaveEffect is pinned here;
//  - Blood Tide recharge axis → monsterRecharge.ma1978 owns those bytes;
//  - Snatch prerequisite axis → monsterSnatch.ma1981 owns those bytes
//    (its :124-128 even byte-locks Shriek's save core — cited, not doubled);
//  - description-scoping hardening (§53) → helpers unit family.
//
// old→new: old 5 tests → 2. Old "save core" + "dc_success absent" +
// "save_effect byte-mirror" + "extractor grants deafened" → test 1
// single real-row lock (brittle-index lookup replaced by NAME lookup,
// inert-pre-fix fingerprint kept, confused description-comparison cut —
// word-scan scoping is framework-owned §53). Old "MA-1978/MA-1981
// siblings byte-guarded" → test 2 save-lane uniqueness sweep by name
// (only test-distinct byte here: no sibling rider can shadow or duplicate
// the Deafened grant); Blood Tide/Snatch numerics cut (#1978/#1981 own
// them).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { canRollExpression } from '../dice/diceRoller.js';

const raw = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(raw);
const SCYLLA = monsters.find((m) => m.index === 'scylla');
// lookup by NAME, not index (#1094 brittle-index fix)
const SHRIEK = SCYLLA.legendary_actions.find((a) => a.name === 'Shriek (Costs 2 Actions)');

describe('MA-1982 disk fingerprint: Scylla Shriek Deafened rider save_effect authored', () => {
  it('real-row lock: live-verified save core DC 23 WIS 2d10 Thunder half-on-success unchanged — fix byte arms Deafened exact-once through the production word-scan, attack axis stays absent', () => {
    expect(SCYLLA.name).toBe('Scylla');
    expect(SHRIEK.name).toBe('Shriek (Costs 2 Actions)');
    expect(SHRIEK.description).toBe(
      'Wisdom Saving Throw: DC 23, each enemy within 60 ft. Failure: 11 (2d10) Thunder damage and the target is Deafened for 1 minute. Success: half damage and not Deafened.'
    );
    // exact save quartet — live-verified EXACT pre-fix, byte-unchanged
    expect(SHRIEK.save_dc).toBe(23);
    expect(SHRIEK.save_type).toBe('Wisdom');
    expect(SHRIEK.damage_dice_primary).toBe('2d10');
    expect(SHRIEK.damage_type_primary).toBe('Thunder');
    expect(SHRIEK.dc_success).toBeUndefined(); // "Success: half damage" — default is RAW-correct
    expect(canRollExpression(SHRIEK.damage_dice_primary)).toBe(true);
    // pure save row: no delegation/attack-pool hijack residue (#1096 axis canaries)
    expect(SHRIEK.delegates_to).toBeUndefined();
    expect(SHRIEK.attack_bonus).toBeUndefined();
    expect(SHRIEK.hit_conditions).toBeUndefined();
    // the ticket's fix byte, exact-once across the WHOLE DB (#829)
    expect(raw.split('"save_effect": "The target is Deafened for 1 minute."').length - 1).toBe(1);
    expect(SHRIEK.save_effect).toBe('The target is Deafened for 1 minute.');
    // extractor THROUGH production on the REAL row: rider was description-only inert
    expect(extractConditionsFromSaveEffect(SHRIEK.save_effect)).toEqual(['deafened']);
    // pre-fix fingerprint: no save_effect → zero conditions (rider inert)
    expect(extractConditionsFromSaveEffect(undefined)).toEqual([]);
  });

  it('decoy sweep: Shriek is the ONLY save_effect rider row on Scylla — no sibling byte can shadow or duplicate the Deafened grant', () => {
    // Sweep both lanes by NAME: the one-field fix touched exactly this row.
    // Blood Tide (save core, recharge axis → ma1978 owns) and Snatch
    // (prerequisite axis → ma1981 owns) legitimately ride NO rider byte.
    const riderRows = [...SCYLLA.actions, ...SCYLLA.legendary_actions]
      .filter((a) => a.save_effect != null)
      .map((a) => a.name);
    expect(riderRows).toEqual(['Shriek (Costs 2 Actions)']);
  });
});
