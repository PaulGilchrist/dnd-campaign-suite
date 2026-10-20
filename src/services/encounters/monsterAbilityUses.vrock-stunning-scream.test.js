// @maintained-by-ai
// MA-1674 Vrock Stunning Scream (1/Day, DC 15 CON, 3d6 Thunder + Stunned) —
// ticket lane: vrock-only bytes from the REAL on-disk monsters.json row
// (no transcription, #977; ground-truth verbatim, #993).
//
// Incident-class data fix pinned here: the legacy `uses:"1/Day"` STRING made
// abilitySaveMaxUses Number("1/Day")=NaN → monsterAbilitySaveUsesGate null →
// unenforced AND unrecorded same-day double-dip on a damage+condition dealer
// (live: second press fired FULL, zero refusal, monsterSpellUses never
// written, no "(N left)" counter chip). The numeric usage/uses/maxUses triple
// on this real row is the fix — this row pin is ticket-distinct (#1082
// explicit) and the legacy-NaN→null half of the incident is pinned by the
// framework below on the same row shape.
//
// Owns here:
//  - real-row lock: DC 15 CON, 20-foot Emanation, 3d6 Thunder,
//    stunned-on-fail save_effect verbatim row text, dc_success "none"
//    (half-leak close — the other half of this ticket's data fix), and the
//    numeric 1/Day triple replacing the NaN uses-STRING;
//  - off-lane decoy (#948, banshee test-4 shape verbatim): the vrock's
//    other actions carry no uses fields and cannot spend the day.
//
// Framework-owned (monsterAbilityUses.test.js, MA-0020 Aboleth — cited, not
// re-run here): useKey suffix-strip mechanism incl. no-suffix verbatim
// passthrough ('Stunning Scream' is a no-suffix row, dretch leg covers it),
// maxUses coercion census (#959) + honest NaN leg, gate ladder truth-table
// incl. over-spend clamp, unlimited→null, refusal log/popup canonical shape
// pinned ONCE (#829), campaign-keyed spend cycle + double-spend guard
// (#932/#1019/#1026). Store faithful keyed (#1019); no wall-clock — resets
// are dawn/seam-adjacent text only (#app).
//
// Applied-recs verdicts (#1080/#1081/#1082 forwards):
//  - #1080 :37-51 hand-built gate/refusal block → DELETED (gate truth-table
//    and refusal shape owned by framework);
//  - #1081 :28-35 numeric 1/Day uses fields → CONSOLIDATED into the row-lock
//    test citing MA-0020; tautological not.toBeInstanceOf(Object) dropped;
//  - #1082 :45-51 refusal asserts → DELETED (duplicate the #829 pin);
//    :54-82 generic hand-crafted spend cycle → DELETED, superseded by the
//    folded-up framework cycle; tests 1-2 kept as the NaN-string data-fix
//    row bytes (ticket-distinct core).
//
// old→new: old "authored ground truth" + old "numeric 1/Day uses fields
// replace the NaN uses-STRING" → test 1 (single real-row lock); old
// "gate: fresh/spent + refusal log/popup" and old "counter decrements
// through spend…" → deleted, cited to framework; decoy added (#948).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { abilitySaveMaxUses, monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const vrock = monsters.find(m => m.index === 'vrock');
const scream = vrock.actions.find(a => a.name === 'Stunning Scream');

describe('MA-1674 Vrock Stunning Scream (1/Day) — real on-disk row', () => {
    it('real-row lock: DC 15 CON 20-ft emanation 3d6 Thunder stunned-on-fail, dc_success none, numeric 1/Day triple replaces the legacy NaN uses-string', () => {
        expect(scream).toBeTruthy();
        expect(scream.name).toBe('Stunning Scream');
        expect(scream.save_dc).toBe(15);
        expect(scream.save_type).toBe('Constitution');
        expect(scream.range).toBe('20-foot Emanation');
        expect(scream.damage_dice_primary).toBe('3d6');
        expect(scream.dc_success).toBe('none'); // success takes ZERO — half-leak close (this ticket's data fix)
        expect(scream.save_effect).toBe("10 (3d6) Thunder damage, and the target has the Stunned condition until the end of the vrock's next turn");
        // the MA-1674 data-fix bytes: numeric triple arms the gate that the
        // legacy uses:"1/Day" string left null (Number("1/Day")=NaN).
        expect(scream.usage).toBe('1/Day');
        expect(scream.uses).toBe(1);
        expect(scream.maxUses).toBe(1);
        expect(abilitySaveMaxUses(scream)).toBe(1); // fixed row resolves through the gate (coercion census owned by MA-0020 framework)
    });

    it('decoy: vrock\'s other actions carry no uses fields — gate null, only Stunning Scream can spend the day (unlimited→null mechanism owned by framework file)', () => {
        const others = vrock.actions.filter(a => a.name !== scream.name);
        expect(others.length).toBeGreaterThan(0);
        for (const other of others) {
            expect(other.uses).toBeUndefined();
            expect(other.maxUses).toBeUndefined();
            expect(monsterAbilitySaveUsesGate(other, { 'Stunning Scream': 1 })).toBeNull();
        }
    });
});
