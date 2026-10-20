// @maintained-by-ai
// MA-0633 Dretch Fetid Cloud (1/Day) — ticket lane: dretch-only bytes from
// the REAL on-disk monsters.json row (no transcription, #977).
//
// Owns here:
//  - real-row lock: DC 11 CON, damageless (both damage fields absent — the
//    family's pure condition-dealer AoE save), save_effect verbatim poisoned-
//    on-fail row (#993), numeric usage/uses/maxUses triple (MA-0020 shape;
//    the legacy cosmetic `usage:{type:"per day"}` object is gone);
//  - derived use-key byte: unlike banshee, the dretch row NAME carries no
//    "(1/Day)" suffix — the store byte is the row name verbatim, pinning the
//    exact key gate and spend share;
//  - full use-economy cycle on the real row through the production consumer
//    spendMonsterAbilityUse: fresh gate → spend → exact store bytes → gate
//    re-read sees what spend wrote (double-dip prevention) → second fire
//    refuses at zero with a burn (#1026 store-unchanged) and exactly one
//    ability_use log; refusal is produced by the guard inside the consumer,
//    asserted exact (#app), never hand-built (#1080);
//  - off-lane decoy (#948, banshee test-4 shape verbatim): the dretch's
//    other actions carry no uses fields and cannot spend the day.
//
// Framework-owned (monsterAbilityUses.test.js, MA-0020 Aboleth — cited, not
// re-run here): useKey suffix-strip mechanism, gate ladder used/remaining/
// exhausted, unlimited rows → null, refusal log/popup shape, spend increment,
// double-spend guard, campaign-keyed store (#1019/#1021).
// Poisoned-condition application at the failed-save seam is owned by the
// effect/save-processing consumers (grep fetid_cloud consumers: zero
// per-spell service — generic aoe-save path); the "until the start of its
// next turn" clause rides extractConditionDurationNote advisory (CLA-325),
// mechanism owned by the framework file. Family: banshee-deathly-wail and
// vrock-stunning-scream lanes hold their own ticket rows.
//
// old→new: old "authored ground truth" + old "numeric 1/Day uses fields"
// (incl. the `usage not.toBeInstanceOf(Object)` tautology, dropped) → test 1;
// old "gate fresh/spent + hand-built fetid_cloud_refused log" → test 2 (real
// spend cycle through the production consumer, refusal asserted exact via the
// guard inside spendMonsterAbilityUse rather than a hand-built log, #1080).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { abilitySaveUseKey, abilitySaveMaxUses, monsterAbilitySaveUsesGate, spendMonsterAbilityUse } from './monsterAbilityUses.js';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const dretch = monsters.find(m => m.name === 'Dretch');
const cloud = dretch.actions.find(a => a.name === 'Fetid Cloud');

describe('MA-0633 Dretch Fetid Cloud (1/Day) — real on-disk row + uses economy', () => {
    it('real-row lock: DC 11 CON damageless poisoned-on-fail AoE save, numeric 1/Day triple, store byte "Fetid Cloud"', () => {
        expect(cloud).toBeTruthy();
        expect(cloud.name).toBe('Fetid Cloud');
        expect(cloud.save_dc).toBe(11);
        expect(cloud.save_type).toBe('Constitution');
        expect(cloud.save_effect).toBe('Failure: be poisoned until the start of its next turn.');
        expect(cloud.damage_dice_primary).toBeUndefined(); // damageless — condition-only dealer
        expect(cloud.damage_type_primary).toBeUndefined();
        expect(cloud.usage).toBe('1/Day');
        expect(cloud.uses).toBe(1);
        expect(cloud.maxUses).toBe(1);
        expect(abilitySaveUseKey(cloud)).toBe('Fetid Cloud'); // no (1/Day) suffix in name — key is the row name verbatim
        expect(abilitySaveMaxUses(cloud)).toBe(1);
    });

    it('use-economy cycle on the real row: fresh fires, spend writes exact store byte, second fire refuses with zero burn and exact fetid_cloud_refused log', async () => {
        const store = {};
        const logs = [];
        const deps = {
            getRuntimeValue: (name, key) => store[`${name}.${key}`],
            setRuntimeValue: (name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); },
            addEntry: (_campaign, entry) => { logs.push(entry); return Promise.resolve(); },
        };

        const fresh = monsterAbilitySaveUsesGate(cloud, store['Dretch 1.monsterSpellUses']);
        expect(fresh).toMatchObject({ useKey: 'Fetid Cloud', maxUses: 1, used: 0, remaining: 1, exhausted: false });

        const use = { useKey: fresh.useKey, maxUses: fresh.maxUses, actionName: cloud.name };
        const remaining = await spendMonsterAbilityUse({ monsterName: 'Dretch 1', use, campaignName: 'test-campaign', deps });
        expect(remaining).toBe(0);
        expect(store['Dretch 1.monsterSpellUses']).toEqual({ 'Fetid Cloud': 1 }); // exact bytes — key matches what the gate reads
        const spendLog = logs.find(e => e.type === 'ability_use');
        expect(spendLog.abilityName).toBe('Fetid Cloud');
        expect(spendLog.description).toBe('Dretch 1 uses Fetid Cloud — 1 use spent, 0 left today (resets at dawn, GM-enforced for monsters).');

        const spent = monsterAbilitySaveUsesGate(cloud, store['Dretch 1.monsterSpellUses']); // gate reads what spend wrote
        expect(spent).toMatchObject({ useKey: 'Fetid Cloud', remaining: 0, exhausted: true });

        const dup = await spendMonsterAbilityUse({ monsterName: 'Dretch 1', use, campaignName: 'test-campaign', deps });
        expect(dup).toBeNull();
        expect(store['Dretch 1.monsterSpellUses']).toEqual({ 'Fetid Cloud': 1 }); // unchanged — refused, no burn (#1026)
        expect(logs.filter(e => e.type === 'ability_use')).toHaveLength(1);
        const refusal = logs.find(e => e.automationType === 'fetid_cloud_refused');
        expect(refusal).toBeTruthy();
        expect(refusal.description).toBe('Dretch 1 has already used Fetid Cloud today (1/Day) — Fetid Cloud refused. Uses reset at dawn; GM-enforced for monsters.');
    });

    it('decoy: dretch\'s other actions carry no uses fields — gate null, only Fetid Cloud can spend the day (unlimited→null mechanism owned by framework file)', () => {
        const others = dretch.actions.filter(a => a.name !== cloud.name);
        expect(others.length).toBeGreaterThan(0);
        for (const other of others) {
            expect(other.uses).toBeUndefined();
            expect(other.maxUses).toBeUndefined();
            expect(monsterAbilitySaveUsesGate(other, { 'Fetid Cloud': 1 })).toBeNull();
        }
    });
});
