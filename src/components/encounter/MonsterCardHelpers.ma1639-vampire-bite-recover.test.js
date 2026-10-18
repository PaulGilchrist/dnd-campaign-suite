// @maintained-by-ai — MA-1639 OWNER lane: vampire "Bite" (actions[2], DC 17 Constitution,
// 1d4 + 4 Piercing plus 3d8 Necrotic) save-path ATTACKER-RECOVER rider.
// Owns the vampire Bite disk fingerprint + parseSaveAttackerRecover structured-key-only
// parser + block-save context threading for THIS row. Regain is HP recover
// ("the vampire regains Hit Points equal to that amount" — disk RAW, rides the
// NECROTIC riderDamage, NOT half total, NOT temp HP), the regain twin of
// MA-1547's save_hp_max_reduce, threaded via buildAbilitySaveRollContext →
// saveProcessing.applySaveAttackerRecoverLeg → canonical applyHealingToTarget
// choke point (MA-0651 self-damage mirror). Byte-inert for every row without the key.
// Other monsters' fingerprints owned elsewhere (REC #542): succubus/incubus Draining
// Kiss + parseSaveHpMaxReduce truth table → ma1547-draining-kiss (maintained);
// vampire-clone Spawn Bite → ma1652; nightbringer hit-lane twin → ma1645;
// wight Life Drain → ma1718. Consumer regain behavior (both faces, choke
// points, logging) → saveProcessing.ma1639-vampire-bite-recover.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSaveHpMaxReduce, parseSaveAttackerRecover } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const BITE = monsters.find((m) => m.index === 'vampire').actions[2];
// Lane-separation negatives (by name): other-row shapes that must NOT arm the recover parser.
const SUCCUBUS_KISS = monsters.find((m) => m.index === 'succubus').actions.find((a) => a.name === 'Draining Kiss');
const SPECTER_HIT = monsters.find((m) => m.index === 'specter').actions[0];

describe('MA-1639 vampire Bite recover lane — disk fingerprint, parser, threading', () => {
    it('disk fingerprint: DC 17 CON dual-pool 5 ft row with explicit half + both save riders in canonical order', () => {
        expect(BITE.name).toBe('Bite');
        expect(BITE.save_dc).toBe(17);
        expect(BITE.save_type).toBe('Constitution');
        expect(BITE.damage_dice_primary).toBe('1d4 + 4');
        expect(BITE.damage_type_primary).toBe('Piercing');
        expect(BITE.damage_dice_secondary).toBe('3d8');
        expect(BITE.damage_type_secondary).toBe('Necrotic');
        expect(BITE.range).toBe('5 feet');
        // §1095 explicit-authoring, MA-1547 twin placement: half after save_type,
        // drain after half, regain after drain (same-amount twin).
        expect(BITE.dc_success).toBe('half');
        expect(BITE.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
        expect(BITE.save_attacker_recover).toEqual({ equal_to: 'damage' });
        const keys = Object.keys(BITE);
        expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
        expect(keys.indexOf('save_hp_max_reduce')).toBe(keys.indexOf('dc_success') + 1);
        expect(keys.indexOf('save_attacker_recover')).toBe(keys.indexOf('save_hp_max_reduce') + 1);
        // regain rides the NECROTIC amount, NOT half total (disk text is canonical).
        expect(BITE.description).toContain("The target's Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount.");
    });

    it('parseSaveAttackerRecover truth table: arms only on the structured save_attacker_recover:{equal_to:"damage"} key', () => {
        expect(parseSaveAttackerRecover(BITE)).toEqual({ equalTo: 'damage' });
        // inert false-branches: missing key, undefined action, scalar rider, wrong magnitude
        expect(parseSaveAttackerRecover({ name: 'Constrict', save_dc: 17, save_type: 'Strength' })).toBeNull();
        expect(parseSaveAttackerRecover(undefined)).toBeNull();
        expect(parseSaveAttackerRecover({ save_attacker_recover: 'damage' })).toBeNull();
        expect(parseSaveAttackerRecover({ save_attacker_recover: { equal_to: 'half' } })).toBeNull();
        // lane separation: drain-only save rows (succubus) and attack-lane rows
        // (specter hit_hp_max_reduce) never arm the recover parser
        expect(parseSaveAttackerRecover(SUCCUBUS_KISS)).toBeNull();
        expect(parseSaveAttackerRecover(SPECTER_HIT)).toBeNull();
        // drain twin still arms on this row (byte-inertness partner)
        expect(parseSaveHpMaxReduce(BITE)).toEqual({ equalTo: 'damage' });
    });

    it('buildAbilitySaveRollContext threads both riders + dc_success half + secondary transport; clauseless row stays byte-inert', () => {
        const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Piercing'];
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Vampire 1',
            target: { name: 'Bandit', type: 'npc' },
            spellName: null,
            action: BITE,
            saveType: 'CON',
            dcSuccess: BITE.dc_success ?? 'half',
            saveDamageFormula: BITE.damage_dice_primary ?? null,
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        });
        expect(ctx.saveDc).toBe(17);
        expect(ctx.dcSuccess).toBe('half');
        expect(ctx.autoDamageFormula).toBe('1d4 + 4');
        expect(ctx.autoDamageDamageType).toBe('Piercing');
        expect(ctx.autoDamageSecondaryFormula).toBe('3d8');
        expect(ctx.autoDamageSecondaryDamageType).toBe('Necrotic');
        expect(ctx.saveHpMaxReduce).toEqual({ equalTo: 'damage' });
        expect(ctx.saveAttackerRecover).toEqual({ equalTo: 'damage' });

        const inert = buildAbilitySaveRollContext({
            monsterName: 'Vampire 1',
            target: { name: 'Bandit', type: 'npc' },
            spellName: null,
            action: { name: 'Constrict', save_dc: 15, save_type: 'Strength', damage_dice_primary: '2d6', damage_type_primary: 'Bludgeoning' },
            saveType: 'CON',
            dcSuccess: 'half',
            saveDamageFormula: '2d6',
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        });
        expect(inert.saveHpMaxReduce).toBeNull();
        expect(inert.saveAttackerRecover).toBeNull();
    });
});
