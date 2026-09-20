import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { abilitySaveUseKey, abilitySaveMaxUses, monsterAbilitySaveUsesGate, buildAbilitySaveRefusalLog } from './monsterAbilityUses.js';

// MA-0633 Dretch Fetid Cloud (1/Day) — on-disk row lock: the legacy
// `usage:{type:"per day",times:1}` object is cosmetic (grep-zero readers for
// usage.type/usage.times); the row now carries the MA-0020 numeric uses/maxUses
// pair (Banshee Deathly Wail / Aboleth Dominate Mind byte-shape twins) so the
// save-chip gate at MonsterCardModal.resolveAbilityUsesGate engages and the
// second fire refuses with a fetid_cloud_refused log, zero spend.
const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const dretch = monsters.find(m => m.name === 'Dretch');
const cloud = dretch.actions.find(a => a.name === 'Fetid Cloud');

describe('MA-0633 Dretch Fetid Cloud data row', () => {
    it('authored ground truth: DC 11 CON damageless poisoned-on-fail aoe-save', () => {
        expect(cloud.save_dc).toBe(11);
        expect(cloud.save_type).toBe('Constitution');
        expect(cloud.save_effect).toBe('Failure: be poisoned until the start of its next turn.');
        expect(cloud.damage_dice_primary).toBeUndefined();
    });

    it('standard numeric 1/Day uses fields replace the cosmetic usage object', () => {
        expect(cloud.usage).toBe('1/Day');
        expect(cloud.uses).toBe(1);
        expect(cloud.maxUses).toBe(1);
        expect(cloud.usage).not.toBeInstanceOf(Object);
        expect(abilitySaveUseKey(cloud)).toBe('Fetid Cloud');
        expect(abilitySaveMaxUses(cloud)).toBe(1);
    });

    it('gate: fresh monster can fire; after 1 spent use the second fire refuses', () => {
        const fresh = monsterAbilitySaveUsesGate(cloud, {});
        expect(fresh).toMatchObject({ useKey: 'Fetid Cloud', maxUses: 1, used: 0, remaining: 1, exhausted: false });

        const spent = monsterAbilitySaveUsesGate(cloud, { 'Fetid Cloud': 1 });
        expect(spent.exhausted).toBe(true);
        expect(spent.remaining).toBe(0);

        const refusal = buildAbilitySaveRefusalLog({ monsterName: 'Dretch 1', useKey: spent.useKey, maxUses: spent.maxUses });
        expect(refusal.automationType).toBe('fetid_cloud_refused');
        expect(refusal.description).toMatch(/already used Fetid Cloud today \(1\/Day\)/);
    });
});
