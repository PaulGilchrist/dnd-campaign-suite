// MA-1639: Vampire "Bite" (actions[2], DC 17 Constitution, 1d4 + 4 Piercing
// plus 3d8 Necrotic) — FAIL(a)/DATA fixed at the data layer + sanctioned
// regain build:
// (1) save_hp_max_reduce:{equal_to:"damage"} — the live MA-1547 save-path
//     drain seam (parseSaveHpMaxReduce → buildAbilitySaveRollContext →
//     saveProcessing.applySaveHpMaxReduceLeg → hpMaxReduceService) was
//     UNAUTHORED on this row; byte-mirrors the in-file Succubus Draining
//     Kiss twin shape;
// (2) dc_success:"half" authored explicitly (the disk description names no
//     success clause, so the engine half-default was un-frozen — §1095
//     explicit-authoring convention, MA-1547 twin placement: right after
//     save_type);
// (3) NEW structured save_attacker_recover:{equal_to:"damage"} rider — the
//     attacker-regain lane ("the vampire regains Hit Points equal to that
//     amount", disk RAW) was grep-zero app-wide (self_heal existed only on
//     legendary rows); parser arms ONLY on the structured key, threaded
//     through buildAbilitySaveRollContext to
//     saveProcessing.applySaveAttackerRecoverLeg which heals the ATTACKER
//     via the canonical applyHealingToTarget choke point (MA-0651
//     self-damage mirror). Byte-inert for every row without the key.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSaveHpMaxReduce, parseSaveAttackerRecover } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const VAMPIRE = monsters.find((m) => m.index === 'vampire');
const BITE = VAMPIRE.actions[2];
const SUCCUBUS_KISS = monsters.find((m) => m.index === 'succubus').actions.find((a) => a.name === 'Draining Kiss');
const SPECTER_HIT = monsters.find((m) => m.index === 'specter').actions[0];

describe('MA-1639 disk fingerprint: vampire Bite save row', () => {
    it('keeps the adjudication bytes unchanged (DC 17 CON, dual pools, 5 ft)', () => {
        expect(BITE.name).toBe('Bite');
        expect(BITE.save_dc).toBe(17);
        expect(BITE.save_type).toBe('Constitution');
        expect(BITE.damage_dice_primary).toBe('1d4 + 4');
        expect(BITE.damage_type_primary).toBe('Piercing');
        expect(BITE.damage_dice_secondary).toBe('3d8');
        expect(BITE.damage_type_secondary).toBe('Necrotic');
        expect(BITE.range).toBe('5 feet');
    });

    it('authors dc_success:"half" explicitly right after save_type (§1095/MA-1547 placement)', () => {
        expect(BITE.dc_success).toBe('half');
        const keys = Object.keys(BITE);
        expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
    });

    it('authors save_hp_max_reduce:{equal_to:"damage"} right after dc_success (succubus twin parity)', () => {
        expect(BITE.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
        expect(SUCCUBUS_KISS.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
        const keys = Object.keys(BITE);
        expect(keys.indexOf('save_hp_max_reduce')).toBe(keys.indexOf('dc_success') + 1);
    });

    it('authors save_attacker_recover:{equal_to:"damage"} right after save_hp_max_reduce (same-amount twin)', () => {
        expect(BITE.save_attacker_recover).toEqual({ equal_to: 'damage' });
        const keys = Object.keys(BITE);
        expect(keys.indexOf('save_attacker_recover')).toBe(keys.indexOf('save_hp_max_reduce') + 1);
    });

    it('description byte-unchanged (regain rides the NECROTIC amount, NOT half total)', () => {
        expect(BITE.description).toContain("The target's Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount.");
    });
});

describe('MA-1639 parseSaveAttackerRecover — structured-key-only parser', () => {
    it('arms the vampire row clause', () => {
        expect(parseSaveAttackerRecover(BITE)).toEqual({ equalTo: 'damage' });
    });

    it('byte-inert null for rows without the key (clauseless rows)', () => {
        expect(parseSaveAttackerRecover({ name: 'Constrict', save_dc: 17, save_type: 'Strength' })).toBeNull();
        expect(parseSaveAttackerRecover(undefined)).toBeNull();
    });

    it('does NOT read save_hp_max_reduce or the attack-lane keys (lane separation)', () => {
        expect(parseSaveAttackerRecover(SUCCUBUS_KISS)).toBeNull();
        expect(parseSaveAttackerRecover(SPECTER_HIT)).toBeNull();
        expect(parseSaveHpMaxReduce(BITE)).toEqual({ equalTo: 'damage' });
        expect(parseSaveAttackerRecover(BITE)).toEqual({ equalTo: 'damage' });
    });

    it('equal_to must name "damage" — any other magnitude is inert', () => {
        expect(parseSaveAttackerRecover({ save_attacker_recover: { equal_to: 'half' } })).toBeNull();
        expect(parseSaveAttackerRecover({ save_attacker_recover: 'damage' })).toBeNull();
    });
});

describe('MA-1639 block-save context threading (buildAbilitySaveRollContext)', () => {
    const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Piercing'];

    function biteContext(action) {
        return buildAbilitySaveRollContext({
            monsterName: 'Vampire 1',
            target: { name: 'Bandit', type: 'npc' },
            spellName: null,
            action,
            saveType: 'CON',
            dcSuccess: action.dc_success ?? 'half',
            saveDamageFormula: action.damage_dice_primary ?? null,
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        });
    }

    it('both riders ride the save context alongside dc_success half + secondary transport', () => {
        const ctx = biteContext(BITE);
        expect(ctx.saveDc).toBe(17);
        expect(ctx.dcSuccess).toBe('half');
        expect(ctx.autoDamageFormula).toBe('1d4 + 4');
        expect(ctx.autoDamageDamageType).toBe('Piercing');
        expect(ctx.autoDamageSecondaryFormula).toBe('3d8');
        expect(ctx.autoDamageSecondaryDamageType).toBe('Necrotic');
        expect(ctx.saveHpMaxReduce).toEqual({ equalTo: 'damage' });
        expect(ctx.saveAttackerRecover).toEqual({ equalTo: 'damage' });
    });

    it('clauseless save row stays byte-inert: both riders null', () => {
        const ctx = biteContext({ name: 'Constrict', save_dc: 15, save_type: 'Strength', damage_dice_primary: '2d6', damage_type_primary: 'Bludgeoning' });
        expect(ctx.saveHpMaxReduce).toBeNull();
        expect(ctx.saveAttackerRecover).toBeNull();
    });
});
