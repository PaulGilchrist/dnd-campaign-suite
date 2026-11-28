// @maintained-by-ai 2026-11-28
// MA-1718: Wight "Life Drain" (actions[3], DC 13 Constitution, 5 ft) —
// FAIL(a)/DATA fixed at the data layer: the row authors
// save_hp_max_reduce:{equal_to:"damage"} so the LIVE MA-1547 save-path drain
// seam (parseSaveHpMaxReduce → buildAbilitySaveRollContext.saveHpMaxReduce →
// saveProcessing.applySaveDamage → hpMaxReduceService.applyHpMaxReduce) arms
// on this row: a failed save reduces the victim's max HP by the FULL applied
// necrotic damage. fix#172 family: dc_success:"none" now AUTHORED after
// save_type (MA-0030 placement) — RAW success is NOTHING (no damage, no max-HP
// drain; the §233 both-faces half was the MV-20 leak), so the success face
// reduces by the zeroed finalDamage. Structured-key-only, prose
// never parsed (MA-1547/MA-1489 precedent).
// BY-name disk lock for the wight row only (#387), verbatim full-row toEqual
// fetched live from public/data/monsters.json (today's canon): the Succubus
// byte-shape twin's positive fingerprint lives in
// MonsterCardHelpers.ma1547-draining-kiss.test.js (#554 — never duplicated
// here); the clauseless Necrotic Sword sibling row appears only as a
// byte-inert null-negative against these parsers. Consumer drain/regain
// ledger behavior (applyHpMaxReduce both faces, registerTargetEffect,
// accumulation, lethal) is covered in the saveProcessing lane
// (saveProcessing.ma1547-draining-kiss.test.js) and hit-clause lane
// (handlePlainDamage.hitClause.test.js) — cite-skip, never re-fingerprinted
// here (MA-1652 twin).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSaveHpMaxReduce, parseSaveAttackerRecover } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const WIGHT = monsters.find((m) => m.index === 'wight');
const LIFE_DRAIN = WIGHT.actions[3];
const NECROTIC_SWORD = WIGHT.actions.find((a) => a.name === 'Necrotic Sword');

describe('MA-1718 disk fingerprint: wight Life Drain save row', () => {
    it('pins the full row verbatim (DC 13 CON, 5 ft, rider armed, authored dc_success none) with MA-0030 placement', () => {
        expect(LIFE_DRAIN).toEqual({
            name: 'Life Drain',
            description: "Constitution Saving Throw: DC 13, one creature within 5 feet. Failure: 6 (1d8 + 2) Necrotic damage, and the target's Hit Point maximum decreases by an amount equal to the damage taken. A Humanoid slain by this attack rises 24 hours later as a Zombie under the wight's control, unless the Humanoid is restored to life or its body is destroyed. The wight can have no more than twelve zombies under its control at a time.",
            save_dc: 13,
            save_type: 'Constitution',
            dc_success: 'none',
            save_hp_max_reduce: { equal_to: 'damage' },
            range: '5 feet',
            save_effect: "Failure: 6 (1d8 + 2) Necrotic damage, and the target's Hit Point maximum decreases by an amount equal to the damage taken. A Humanoid slain by this attack rises 24 hours later as a Zombie under the wight's control, unless the Humanoid is restored to life or its body is destroyed. The wight can have no more than twelve zombies under its control at a time.",
        });
        // fix#172 family: RAW save succeeds = NOTHING (no damage, no drain) —
        // dc_success:"none" authored immediately after save_type (MA-0030
        // placement, key order not covered by toEqual), killing the MV-20
        // half-default that halved damage + max-HP drain.
        const keys = Object.keys(LIFE_DRAIN);
        expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
    });
});

describe('MA-1718 parsers arm the wight row through the live MA-1547 seam', () => {
    it('parseSaveHpMaxReduce arms equal_to damage; wight never regains; clauseless sword row byte-inert', () => {
        expect(parseSaveHpMaxReduce(LIFE_DRAIN)).toEqual({ equalTo: 'damage' });
        expect(parseSaveAttackerRecover(LIFE_DRAIN)).toBeNull();
        expect(parseSaveHpMaxReduce(NECROTIC_SWORD)).toBeNull();
        expect(parseSaveAttackerRecover(NECROTIC_SWORD)).toBeNull();
    });

    it('block-save context arms drain-only (no regain) with dc_success none threaded for both faces', () => {
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Wight 1',
            target: { name: 'Bandit 1', type: 'npc' },
            spellName: null,
            action: LIFE_DRAIN,
            saveType: 'CON',
            // literal the modal call-site derives from the row's authored
            // dc_success:"none" (MonsterCardModal.jsx blockSaveDcSuccess) — not
            // re-read from the row under test (#504 self-ref fix)
            dcSuccess: 'none',
            saveDamageFormula: '1d8 + 2',
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction: () => ['Necrotic'],
        });
        expect(ctx.saveDc).toBe(13);
        expect(ctx.dcSuccess).toBe('none');
        expect(ctx.autoDamageFormula).toBe('1d8 + 2');
        expect(ctx.saveHpMaxReduce).toEqual({ equalTo: 'damage' });
        expect(ctx.saveAttackerRecover).toBeNull();
    });
});
