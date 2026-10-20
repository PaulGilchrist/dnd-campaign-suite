// @maintained-by-ai
// MA-0352 Banshee Deathly Wail (1/Day) — ticket lane: banshee-only bytes
// from the REAL on-disk monsters.json row (no transcription, #977).
//
// Owns here:
//  - real-row lock: DC 13 CON, 3d6 Psychic, dc_success "none" (success takes
//    ZERO — no 'half' default leak), hp_threshold_kill 25 (numeric kill arm),
//    numeric usage/uses/maxUses triple (MA-0020 shape);
//  - derived use-key byte: banshee is the family's only row whose NAME itself
//    carries the "(1/Day)" suffix — the real-data suffix-strip leg. The store
//    byte must be 'Deathly Wail', not the full row name, or the gate never
//    sees what spend wrote (same-day double-dip);
//  - full use-economy cycle on the real row: fresh gate → spend → exact store
//    bytes → exhausted gate → refuse-at-zero with a burn (#1026 no-burn) and
//    exact deathly_wail_refused log (#app), ability bytes verbatim row (#993);
//  - off-lane decoy (#948/#1057): banshee's other actions carry no uses
//    fields and cannot spend the day.
//
// Framework-owned (monsterAbilityUses.test.js, MA-0020 Aboleth — cited, not
// re-run here): useKey suffix-strip mechanism, gate ladder used/remaining/
// exhausted, unlimited rows → null, refusal log/popup shape, spend increment,
// double-spend guard, campaign-keyed store (#1019/#1021).
// Effect-owner (saveProcessing.hp-threshold-kill.test.js — delegates row
// locks to this file at :10-11): ≤25 HP drops to 0 at the failed-save seam;
// a successful save never consults the threshold. Key ordering
// (dc_success immediately before hp_threshold_kill): solar-slaying-bow-dc-
// success.test.js. Family: dretch-fetid-cloud and vrock-stunning-scream
// lanes hold their own ticket rows.
//
// old→new: old "ground truth"+"dc_success"+"hp_threshold_kill" → test 1;
// old "numeric 1/Day uses fields" → tests 1+2; old "gate fresh/spent +
// refusal log" → test 3 (real spend cycle through production consumer, the
// refusal text now asserted exact via the guard inside spendMonsterAbilityUse
// rather than a hand-built log).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { abilitySaveUseKey, abilitySaveMaxUses, monsterAbilitySaveUsesGate, spendMonsterAbilityUse } from './monsterAbilityUses.js';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const banshee = monsters.find(m => m.name === 'Banshee');
const wail = banshee.actions.find(a => a.name === 'Deathly Wail (1/Day)');

describe('MA-0352 Banshee Deathly Wail (1/Day) — real on-disk row + uses economy', () => {
    it('real-row lock: DC 13 CON 3d6 Psychic, dc_success none, numeric 1/Day triple, hp_threshold_kill 25', () => {
        expect(wail).toBeTruthy();
        expect(wail.name).toBe('Deathly Wail (1/Day)');
        expect(wail.save_dc).toBe(13);
        expect(wail.save_type).toBe('Constitution');
        expect(wail.damage_dice_primary).toBe('3d6');
        expect(wail.damage_type_primary).toBe('Psychic');
        expect(wail.dc_success).toBe('none'); // success takes ZERO — no half-default leak
        expect(wail.hp_threshold_kill).toBe(25); // numeric kill arm (solar lane: strings → null)
        expect(wail.usage).toBe('1/Day');
        expect(wail.uses).toBe(1);
        expect(wail.maxUses).toBe(1);
        expect(wail.save_effect).toMatch(/Success: The target takes no damage\.$/);
    });

    it('derived use-key byte: the (1/Day) suffix strips to store key "Deathly Wail" (strip mechanism owned by framework file)', () => {
        expect(abilitySaveUseKey(wail)).toBe('Deathly Wail');
        expect(abilitySaveMaxUses(wail)).toBe(1);
    });

    it('use-economy cycle on the real row: fresh fires, spend writes exact store byte, second fire refuses with zero burn and exact deathly_wail_refused log', async () => {
        const store = {};
        const logs = [];
        const deps = {
            getRuntimeValue: (name, key) => store[`${name}.${key}`],
            setRuntimeValue: (name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); },
            addEntry: (_campaign, entry) => { logs.push(entry); return Promise.resolve(); },
        };

        const fresh = monsterAbilitySaveUsesGate(wail, store['Banshee 1.monsterSpellUses']);
        expect(fresh).toMatchObject({ useKey: 'Deathly Wail', maxUses: 1, used: 0, remaining: 1, exhausted: false });

        const use = { useKey: fresh.useKey, maxUses: fresh.maxUses, actionName: wail.name };
        const remaining = await spendMonsterAbilityUse({ monsterName: 'Banshee 1', use, campaignName: 'test-campaign', deps });
        expect(remaining).toBe(0);
        expect(store['Banshee 1.monsterSpellUses']).toEqual({ 'Deathly Wail': 1 }); // exact bytes — key matches what the gate reads
        const spendLog = logs.find(e => e.type === 'ability_use');
        expect(spendLog.abilityName).toBe('Deathly Wail (1/Day)');
        expect(spendLog.description).toBe('Banshee 1 uses Deathly Wail — 1 use spent, 0 left today (resets at dawn, GM-enforced for monsters).');

        const spent = monsterAbilitySaveUsesGate(wail, store['Banshee 1.monsterSpellUses']);
        expect(spent).toMatchObject({ useKey: 'Deathly Wail', remaining: 0, exhausted: true });

        const dup = await spendMonsterAbilityUse({ monsterName: 'Banshee 1', use, campaignName: 'test-campaign', deps });
        expect(dup).toBeNull();
        expect(store['Banshee 1.monsterSpellUses']).toEqual({ 'Deathly Wail': 1 }); // unchanged — refused, no burn (#1026)
        expect(logs.filter(e => e.type === 'ability_use')).toHaveLength(1);
        const refusal = logs.find(e => e.automationType === 'deathly_wail_refused');
        expect(refusal).toBeTruthy();
        expect(refusal.description).toBe('Banshee 1 has already used Deathly Wail today (1/Day) — Deathly Wail refused. Uses reset at dawn; GM-enforced for monsters.');
    });

    it('decoy: banshee\'s other actions carry no uses fields — gate null, only Deathly Wail can spend the day (unlimited→null mechanism owned by framework file)', () => {
        const others = banshee.actions.filter(a => a.name !== wail.name);
        expect(others.length).toBeGreaterThan(0);
        for (const other of others) {
            expect(other.uses).toBeUndefined();
            expect(other.maxUses).toBeUndefined();
            expect(monsterAbilitySaveUsesGate(other, { 'Deathly Wail': 1 })).toBeNull();
        }
    });
});
