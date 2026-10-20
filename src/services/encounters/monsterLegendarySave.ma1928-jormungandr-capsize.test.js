// @maintained-by-ai
// MA-1928: Jormungandr legendary "Capsize (Costs 2 Actions)" shipped as a
// save-prose row delegating to Tail — the press adjudicated the delegated
// ATTACK pool (+19 vs AC, live smoking gun lastAttack.saveDc:null) while the
// RAW DC 25 Strength save never ran and Prone rode the hit lane instead of
// the save lane (MA-1847 Apep Devour the Boat fingerprint). DATA fix (this
// file's lock): the row stops delegating and self-resolves its own save
// mechanic — save quartet + dc_success:"none" (save-or-effect, prose says
// "or fall Prone and take…" — no half clause) + save_effect byte-carrying
// canonical "Prone" (§346 word-scan is save_effect-only; description never
// read). Hit-axis absence canaries: hit_conditions absent-if-not-touched
// (#1096 axis-split inverse). REAL on-disk row pinned programmatic
// disk-bytes (#1086), verbatim description ground truth (#993), decoy by
// NAME (#1094 brittle-index fix), no wall-clock (#app).
//
// Framework-owned (cited, not re-run here):
//  - save-quartet consumers (handleSaveRoll / resolveBlockSaveDcSuccess half
//    default) and extractor word-scan truth tables → MonsterCardModal
//    conditions-extraction family; only the REAL Capsize row mapped THROUGH
//    extractConditionsFromSaveEffect is pinned here;
//  - cost/uses: "(Costs 2 Actions)" name-token + header uses:3 (MA-1925
//    PASS) → monsterAbilityUses CANON #1082 / legendary-uses lane — never
//    re-driven here (header pin dropped, exemplar #1093);
//  - hit-axis of this same monster → monsterHitConditions.ma1927 (that file
//    owns Venom Drip bytes and cites ITS save-axis clause-null back here);
//  - recharge axis → monsterRecharge.ma1924 (Venomous Surge gate, #1096);
//  - MA-1952 Nidhogg twin (delegate-kept self-resolve variant) stands alone;
//    no base/framework owner in monsterLegendarySave — each ticket locks its
//    own row; whole-DB save tripwires (prose-agree, dc_success enum) →
//    monsterLairActions #1099 generic join.
//
// old→new: old 5 tests → 2. Old "full RAW save mechanic" + "delegates_to
// REMOVED" + "description/key-order" + "save_effect word-scan" → test 1
// single real-row lock (exact save quartet + verbatim description + delegation
// hijack dead + hit-axis canary + extractor-through-production; brittle
// Object.keys order dropped — no consumer reads key order, absence canaries
// carry the shape). Old "siblings byte-inert" → test 2 save-lane uniqueness
// sweep by NAME (only test-distinct byte here: no other legendary row can
// shadow the DC 25 save); Venom Drip numerics/hit bytes cut (#1927 owns
// them), header uses:3 cut (#1082 CANON), Bite clause-null cut (ma1927:87).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const JORMUNGANDR = monsters.find((m) => m.index === 'jormungandr');
// lookup by NAME, not index (#1094 brittle-index fix)
const CAPSIZE = JORMUNGANDR.legendary_actions.find((a) => a.name === 'Capsize (Costs 2 Actions)');

describe('MA-1928 disk fingerprint: Jormungandr Capsize self-resolving save row', () => {
  it('real-row lock: self-resolves RAW DC 25 STR 4d8 Bludgeoning nothing-on-success — delegation hijack dead, save_effect byte arms Prone through the production word-scan, hit axis stays absent', () => {
    expect(JORMUNGANDR.name).toBe('Jormungandr');
    expect(CAPSIZE.name).toBe('Capsize (Costs 2 Actions)');
    expect(CAPSIZE.description).toBe(
      'Jormungandr thrashes the water beneath a vehicle or structure. Each creature within 30 ft. of it must succeed on a DC 25 Strength saving throw or fall Prone and take 18 (4d8) Bludgeoning damage.'
    );
    // exact save quartet + dc_success ("or fall Prone and take…" — no half clause)
    expect(CAPSIZE.save_dc).toBe(25);
    expect(CAPSIZE.save_type).toBe('Strength');
    expect(CAPSIZE.damage_dice_primary).toBe('4d8');
    expect(CAPSIZE.damage_type_primary).toBe('Bludgeoning');
    expect(CAPSIZE.dc_success).toBe('none');
    expect(canRollExpression(CAPSIZE.damage_dice_primary)).toBe(true);
    // the ticket's fix: no delegation, no attack-pool residue (§225)
    expect(CAPSIZE.delegates_to).toBeUndefined();
    expect(CAPSIZE.attack_bonus).toBeUndefined();
    expect(CAPSIZE.reach).toBeUndefined();
    // axis-split inverse (#1096): Prone rides the SAVE lane only — production
    // word-scan reads save_effect ONLY (§346), never the description.
    expect(CAPSIZE.hit_conditions).toBeUndefined();
    expect(CAPSIZE.save_effect).toBe('The target falls Prone and takes 18 (4d8) Bludgeoning damage.');
    expect(extractConditionsFromSaveEffect(CAPSIZE.save_effect)).toEqual(['prone']);
  });

  it('decoy sweep: Capsize is the ONLY self-DC save row on the legendary lane — no sibling can shadow the DC 25 grant', () => {
    // Pre-fix fingerprint: a save-prose row delegating (or a sibling save
    // byte appearing elsewhere) hijacks or duplicates the adjudication
    // (MA-1952 Nidhogg shape). Sweep by name, not index.
    const saveRows = JORMUNGANDR.legendary_actions
      .filter((a) => a.save_dc != null || a.save_effect != null || a.dc_success != null)
      .map((a) => a.name);
    expect(saveRows).toEqual(['Capsize (Costs 2 Actions)']);
    // Bite stays a pure delegate child (no numeric mechanic of its own).
    const bite = JORMUNGANDR.legendary_actions.find((a) => a.name === 'Bite');
    expect(bite.delegates_to).toBe('Bite');
    expect(bite.save_dc).toBeUndefined();
  });
});
