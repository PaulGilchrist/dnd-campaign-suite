import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { abilitySaveUseKey, abilitySaveMaxUses, monsterAbilitySaveUsesGate, buildAbilitySaveRefusalLog, buildAbilitySaveRefusalPopup, spendMonsterAbilityUse } from './monsterAbilityUses.js';

// MA-1674 Vrock Stunning Scream (1/Day, DC 15 CON, 3d6 Thunder + Stunned)
// — on-disk row lock, MA-0633 Dretch Fetid Cloud byte-shape twin: the
// legacy `uses:"1/Day"` STRING made abilitySaveMaxUses Number("1/Day")=NaN
// → monsterAbilitySaveUsesGate null → unenforced AND unrecorded same-day
// double-dip on a damage+condition dealer (live: second press fired FULL,
// zero refusal, monsterSpellUses never written, no "(N left)" counter chip).
// The numeric usage/uses/maxUses triple arms resolveAbilityUsesGate
// (MonsterCardModal :1506) + picker-open spendMonsterAbilityUse
// (:455, MA-0633 sanctioned consumer) + the counter at MonsterAction :123.
const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const vrock = monsters.find(m => m.index === 'vrock');
const scream = vrock.actions.find(a => a.name === 'Stunning Scream');

describe('MA-1674 Vrock Stunning Scream data row', () => {
    it('authored ground truth: DC 15 CON emanation 3d6 Thunder stunned-on-fail', () => {
        expect(scream.save_dc).toBe(15);
        expect(scream.save_type).toBe('Constitution');
        expect(scream.range).toBe('20-foot Emanation');
        expect(scream.damage_dice_primary).toBe('3d6');
        expect(scream.save_effect).toMatch(/Stunned/i);
    });

    it('standard numeric 1/Day uses fields replace the NaN uses-STRING', () => {
        expect(scream.usage).toBe('1/Day');
        expect(scream.usage).not.toBeInstanceOf(Object);
        expect(scream.uses).toBe(1);
        expect(scream.maxUses).toBe(1);
        expect(abilitySaveUseKey(scream)).toBe('Stunning Scream');
        expect(abilitySaveMaxUses(scream)).toBe(1);
    });

    it('gate: fresh monster can fire; after 1 spent use the second fire refuses', () => {
        const fresh = monsterAbilitySaveUsesGate(scream, {});
        expect(fresh).toMatchObject({ useKey: 'Stunning Scream', maxUses: 1, used: 0, remaining: 1, exhausted: false });

        const spent = monsterAbilitySaveUsesGate(scream, { 'Stunning Scream': 1 });
        expect(spent.exhausted).toBe(true);
        expect(spent.remaining === 0).toBe(true);

        const refusal = buildAbilitySaveRefusalLog({ monsterName: 'Vrock 1', useKey: spent.useKey, maxUses: spent.maxUses });
        expect(refusal.type).toBe('automation');
        expect(refusal.automationType).toBe('stunning_scream_refused');
        expect(refusal.description).toMatch(/already used Stunning Scream today \(1\/Day\)/);
        const popup = buildAbilitySaveRefusalPopup({ monsterName: 'Vrock 1', useKey: spent.useKey, maxUses: spent.maxUses });
        expect(popup).toMatch(/Uses Exhausted/);
        expect(popup).toMatch(/No save rolled, nothing spent/);
    });

    it('counter decrements through spend and the double-spend guard refuses zero-spend', async () => {
        const store = { 'Vrock 1.monsterSpellUses': {} };
        const deps = {
            getRuntimeValue: (name, key) => store[`${name}.${key}`],
            setRuntimeValue: (name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); },
            addEntry: vi.fn(() => Promise.resolve()),
        };
        const remaining = await spendMonsterAbilityUse({
            monsterName: 'Vrock 1',
            use: { useKey: 'Stunning Scream', maxUses: 1, actionName: 'Stunning Scream' },
            campaignName: 'test-campaign',
            deps,
        });
        expect(remaining).toBe(0);
        expect(store['Vrock 1.monsterSpellUses']).toEqual({ 'Stunning Scream': 1 });
        const gateAfter = monsterAbilitySaveUsesGate(scream, store['Vrock 1.monsterSpellUses']);
        expect(gateAfter).toMatchObject({ remaining: 0, exhausted: true });

        const dup = await spendMonsterAbilityUse({
            monsterName: 'Vrock 1',
            use: { useKey: 'Stunning Scream', maxUses: 1, actionName: 'Stunning Scream' },
            campaignName: 'test-campaign',
            deps,
        });
        expect(dup).toBeNull();
        expect(store['Vrock 1.monsterSpellUses']).toEqual({ 'Stunning Scream': 1 });
        const refusalEntry = deps.addEntry.mock.calls.map(c => c[1]).find(e => e && e.automationType === 'stunning_scream_refused');
        expect(refusalEntry).toBeTruthy();
    });
});
