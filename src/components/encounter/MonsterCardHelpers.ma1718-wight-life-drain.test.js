// @maintained-by-ai
// MA-1718: Wight "Life Drain" (actions[3], DC 13 Constitution, 5 ft) —
// FAIL(a)/DATA fixed at the data layer: the row authors
// save_hp_max_reduce:{equal_to:"damage"} so the LIVE MA-1547 save-path drain
// seam (parseSaveHpMaxReduce → buildAbilitySaveRollContext.saveHpMaxReduce →
// saveProcessing.applySaveDamage → hpMaxReduceService.applyHpMaxReduce) arms
// on this row: a failed save reduces the victim's max HP by the FULL applied
// necrotic damage, a successful save by the HALF-floored finalDamage only
// (dc_success unauthored — engine half default). Structured-key-only, prose
// never parsed (MA-1547/MA-1489 precedent).
// BY-name disk lock for the wight row only (#387): the Succubus byte-shape
// twin's positive fingerprint lives in
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
    it('keeps the adjudication bytes unchanged (DC 13 CON, 5 ft, rider armed, half-default)', () => {
        expect(LIFE_DRAIN.name).toBe('Life Drain');
        expect(LIFE_DRAIN.save_dc).toBe(13);
        expect(LIFE_DRAIN.save_type).toBe('Constitution');
        expect(LIFE_DRAIN.range).toBe('5 feet');
        expect(LIFE_DRAIN.description).toContain("Failure: 6 (1d8 + 2) Necrotic damage, and the target's Hit Point maximum decreases by an amount equal to the damage taken.");
        expect(LIFE_DRAIN.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
        expect(LIFE_DRAIN.dc_success).toBeUndefined();
    });
});

describe('MA-1718 parsers arm the wight row through the live MA-1547 seam', () => {
    it('parseSaveHpMaxReduce arms equal_to damage; regain stays null; clauseless sword row byte-inert', () => {
        expect(parseSaveHpMaxReduce(LIFE_DRAIN)).toEqual({ equalTo: 'damage' });
        expect(parseSaveAttackerRecover(LIFE_DRAIN)).toBeNull();
        expect(parseSaveHpMaxReduce(NECROTIC_SWORD)).toBeNull();
        expect(parseSaveAttackerRecover(NECROTIC_SWORD)).toBeNull();
    });

    it('block-save context arms saveHpMaxReduce for both faces', () => {
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Wight 1',
            target: { name: 'Bandit 1', type: 'npc' },
            spellName: null,
            action: LIFE_DRAIN,
            saveType: 'CON',
            // literal engine default the modal call-site derives for this
            // unauthored key (MonsterCardModal.jsx blockSaveDcSuccess) — not
            // re-read from the row under test (#504 self-ref fix)
            dcSuccess: 'half',
            saveDamageFormula: '1d8 + 2',
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction: () => ['Necrotic'],
        });
        expect(ctx.saveDc).toBe(13);
        expect(ctx.dcSuccess).toBe('half');
        expect(ctx.autoDamageFormula).toBe('1d8 + 2');
        expect(ctx.saveHpMaxReduce).toEqual({ equalTo: 'damage' });
        expect(ctx.saveAttackerRecover).toBeNull();
    });
});
