import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { abilitySaveUseKey, abilitySaveMaxUses, monsterAbilitySaveUsesGate, buildAbilitySaveRefusalLog } from './monsterAbilityUses.js';

// MA-0352 Banshee Deathly Wail (1/Day) — on-disk row lock: dc_success none
// (success takes ZERO, no 'half' default leak), numeric 1/Day uses gate fields
// (MA-0020 Aboleth shape), and the authored HP-threshold kill arm.
const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const banshee = monsters.find(m => m.name === 'Banshee');
const wail = banshee.actions.find(a => a.name === 'Deathly Wail (1/Day)');

describe('MA-0352 Deathly Wail data row', () => {
    it('authored ground truth: DC 13 CON, 3d6 Psychic', () => {
        expect(wail.save_dc).toBe(13);
        expect(wail.save_type).toBe('Constitution');
        expect(wail.damage_dice_primary).toBe('3d6');
        expect(wail.damage_type_primary).toBe('Psychic');
    });

    it('dc_success none: successful save takes no damage (no half-default)', () => {
        expect(wail.dc_success).toBe('none');
    });

    it('numeric 1/Day uses fields engage the MA-0020 ability-uses gate', () => {
        expect(wail.usage).toBe('1/Day');
        expect(wail.uses).toBe(1);
        expect(wail.maxUses).toBe(1);
        expect(abilitySaveUseKey(wail)).toBe('Deathly Wail');
        expect(abilitySaveMaxUses(wail)).toBe(1);
    });

    it('hp_threshold_kill 25 armed for the failed-save threshold seam', () => {
        expect(wail.hp_threshold_kill).toBe(25);
    });

    it('gate: fresh monster can fire; after 1 spent use the second fire refuses', () => {
        const fresh = monsterAbilitySaveUsesGate(wail, {});
        expect(fresh).toMatchObject({ useKey: 'Deathly Wail', maxUses: 1, used: 0, remaining: 1, exhausted: false });

        const spent = monsterAbilitySaveUsesGate(wail, { 'Deathly Wail': 1 });
        expect(spent.exhausted).toBe(true);
        expect(spent.remaining).toBe(0);

        const refusal = buildAbilitySaveRefusalLog({ monsterName: 'Banshee 1', useKey: spent.useKey, maxUses: spent.maxUses });
        expect(refusal.automationType).toBe('deathly_wail_refused');
        expect(refusal.description).toMatch(/already used Deathly Wail today \(1\/Day\)/);
    });
});
