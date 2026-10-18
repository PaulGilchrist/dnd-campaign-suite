// @maintained-by-ai
// MA-1652: Vampire Spawn "Bite" (actions[2], DC 14 Constitution, 1d4 + 3
// Piercing plus 3d6 Necrotic) — FAIL(a)/DATA fixed at the data layer by
// byte-mirroring the live MA-1639 vampire save-lane twin:
// (1) save_hp_max_reduce:{equal_to:"damage"} + save_attacker_recover:
//     {equal_to:"damage"} — MA-1547/MA-1639 save-path riders, unauthored on
//     this row while the save-lane seam was live; the consumer
//     (saveProcessing.resolveSaveRiderDamage) scopes BOTH riders to the
//     NECROTIC (damage_dice_secondary) leg on this dual-damage row — regain/
//     drain consumer behavior is covered in the saveProcessing/handlePlainDamage
//     lanes (cite-skip, never re-fingerprinted here);
// (2) dc_success:"none" — the disk description is Failure-only (no success
//     clause), so the engine half-default leaked half damage + drain + regain
//     on clean saves (§456/MA-1353 failure-only fingerprint);
// (3) target_prerequisite:{conditions:["grappled","incapacitated","restrained"]}
//     — MA-0019 gate live at handleSaveRoll but unarmed; the clause survives
//     as prose-only. "willing" has no te vocabulary = §70 advisory residual.
// BY-name disk lock for the vampire-spawn row only (#387): the vampire-row
// positive fingerprint lives in MonsterCardHelpers.ma1639-vampire-bite-recover
// .test.js (#554 — never duplicated here); the Claw sibling row appears only
// as a byte-inert null-negative against these parsers.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSaveHpMaxReduce, parseSaveAttackerRecover, parseTargetPrerequisite, targetPrerequisiteSatisfied } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const SPAWN = monsters.find((m) => m.index === 'vampire-spawn');
const BITE = SPAWN.actions[2];
const CLAW = SPAWN.actions.find((a) => a.name === 'Claw');

describe('MA-1652 disk fingerprint: vampire-spawn Bite save row', () => {
    it('keeps the adjudication bytes unchanged (DC 14 CON, dual pools, 5 ft, Failure-only)', () => {
        expect(BITE.name).toBe('Bite');
        expect(BITE.save_dc).toBe(14);
        expect(BITE.save_type).toBe('Constitution');
        expect(BITE.damage_dice_primary).toBe('1d4 + 3');
        expect(BITE.damage_type_primary).toBe('Piercing');
        expect(BITE.damage_dice_secondary).toBe('3d6');
        expect(BITE.damage_type_secondary).toBe('Necrotic');
        expect(BITE.range).toBe('5 feet');
        expect(BITE.dc_success).toBe('none');
        expect(BITE.description).not.toMatch(/Success:/);
    });
});

describe('MA-1652 parsers arm the vampire-spawn row through the live MA-1639 seam', () => {
    it('parseSaveHpMaxReduce + parseSaveAttackerRecover arm; clauseless Claw row stays byte-inert null', () => {
        expect(parseSaveHpMaxReduce(BITE)).toEqual({ equalTo: 'damage' });
        expect(parseSaveAttackerRecover(BITE)).toEqual({ equalTo: 'damage' });
        expect(parseSaveHpMaxReduce(CLAW)).toBeNull();
        expect(parseSaveAttackerRecover(CLAW)).toBeNull();
    });

    it('parseTargetPrerequisite arms the MA-0019 gate (no by_attacker); satisfied truth table; null for Claw', () => {
        const tp = parseTargetPrerequisite(BITE);
        expect(tp).toEqual({ conditions: ['grappled', 'incapacitated', 'restrained'], byAttacker: false, attackName: 'Bite' });
        expect(targetPrerequisiteSatisfied({ prerequisite: tp, conditions: ['incapacitated'], conditionMeta: {}, monsterName: 'Vampire Spawn 1' }).satisfied).toBe(true);
        expect(targetPrerequisiteSatisfied({ prerequisite: tp, conditions: [], conditionMeta: {}, monsterName: 'Vampire Spawn 1' }).satisfied).toBe(false);
        expect(parseTargetPrerequisite(CLAW)).toBeNull();
        expect(targetPrerequisiteSatisfied({ prerequisite: null, conditions: [], conditionMeta: {}, monsterName: 'Vampire Spawn 1' }).satisfied).toBe(true);
    });

    it('block-save context: riders + dc_success none + secondary transport thread together', () => {
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Vampire Spawn 1',
            target: { name: 'Bandit 1', type: 'npc' },
            spellName: null,
            action: BITE,
            saveType: 'CON',
            dcSuccess: BITE.dc_success ?? 'half',
            saveDamageFormula: BITE.damage_dice_primary ?? null,
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction: (action) => [action?.damage_type_primary || 'Piercing'],
        });
        expect(ctx.saveDc).toBe(14);
        expect(ctx.dcSuccess).toBe('none');
        expect(ctx.autoDamageFormula).toBe('1d4 + 3');
        expect(ctx.autoDamageDamageType).toBe('Piercing');
        expect(ctx.autoDamageSecondaryFormula).toBe('3d6');
        expect(ctx.autoDamageSecondaryDamageType).toBe('Necrotic');
        expect(ctx.saveHpMaxReduce).toEqual({ equalTo: 'damage' });
        expect(ctx.saveAttackerRecover).toEqual({ equalTo: 'damage' });
    });
});
