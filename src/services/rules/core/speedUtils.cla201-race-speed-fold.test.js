// @maintained-by-ai
// CLA-201 lane — owns applySpeedIncreasePassives and resolveHalfSpeedFeet as pure units.
// Bug this lane pins: the automation-layer playerStats may carry no speed (the sheet's
// canonical Speed is derived from the race JSON at the display layer), so a 2014-saved
// Dragonborn Barbarian's Fast Movement +10 folded to nothing and Instinctive Pounce
// showed 15 ft instead of 20 ft.
// Ownership split (do not duplicate here):
// - speedUtils.cla118-elfish-lineage.test.js — applyElfisLineageSpeed seed arithmetic.
// - rules-playerStats-senses-speed.test.js (#1259) — speed_bonus +15 end-to-end
//   through rules.getPlayerStats (this function runs for real there).
// - combatStanceHandler.instinctive-pounce.test.js — the pounce advisory consumer.
import { describe, it, expect, vi } from 'vitest';

import { applySpeedIncreasePassives, resolveHalfSpeedFeet } from './speedUtils.js';

// Fast Movement-shaped character: +10 speed_bonus, gated on no_heavy_armor.
function fastMovement(passiveOverrides = {}) {
    return {
        type: 'passive_buff',
        effect: 'speed_bonus',
        bonusExpression: '10',
        condition: 'no_heavy_armor',
        ...passiveOverrides,
    };
}

function barbarian(passiveOverrides = {}, statsOverrides = {}) {
    return {
        name: 'DraconicDragon',
        speed: undefined,
        race: { name: 'Dragonborn', speed: 30, subrace: { name: 'Red Dragonborn' } },
        inventory: { equipped: [] },
        equipment: [],
        automation: { passives: [fastMovement(passiveOverrides)] },
        ...statsOverrides,
    };
}

const heavyArmorKit = {
    inventory: { equipped: ['Plate Armor'] },
    equipment: [{ name: 'Plate Armor', equipment_category: 'Armor', armor_category: 'Heavy' }],
};

describe('applySpeedIncreasePassives (CLA-201)', () => {
    it('folds the bonus onto the base ladder: explicit speed > subrace JSON > race JSON', () => {
        // Explicit summary speed outranks every race-JSON rung (magic-item layer wins).
        expect(applySpeedIncreasePassives(barbarian({}, { speed: 40 }))).toBe(50);
        // Subrace ladder rung (a 2024 race with its own subrace speed) beats race.speed.
        const subrace = barbarian({}, { race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf', speed: 35 } } });
        expect(applySpeedIncreasePassives(subrace)).toBe(45);
        // CLA-201 core regression: no speed key at all — fold onto the race JSON base.
        expect(applySpeedIncreasePassives(barbarian())).toBe(40);
    });

    it('stacks every qualifying speed passive', () => {
        // +10 conditional bonus and +10 unconditional increase must accumulate, not last-write.
        const stats = barbarian({}, {
            speed: 30,
            automation: { passives: [fastMovement(), fastMovement({ effect: 'speed_increase' })] },
        });
        expect(applySpeedIncreasePassives(stats)).toBe(50);
    });

    it('leaves speed undefined when no passive qualifies — never invents the race base', () => {
        // bonus === 0 must fall through to playerStats.speed, not surface race.speed 30.
        const stats = barbarian({}, { automation: { passives: [] } });
        expect(applySpeedIncreasePassives(stats)).toBeUndefined();
    });

    it('ignores passives that are not a parseable speed buff', () => {
        // Guard truth table: wrong type, missing bonusExpression, unparseable
        // expression, and unknown effect all contribute 0 — speed passes through.
        const stats = barbarian({}, {
            speed: 30,
            automation: {
                passives: [
                    { type: 'passive_debuff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_heavy_armor' },
                    { type: 'passive_buff', effect: 'speed_bonus', condition: 'no_heavy_armor' },
                    { type: 'passive_buff', effect: 'speed_bonus', bonusExpression: 'ten', condition: 'no_heavy_armor' },
                    { type: 'passive_buff', effect: 'darkvision_bonus', bonusExpression: '10' },
                ],
            },
        });
        expect(applySpeedIncreasePassives(stats)).toBe(30);
    });

    it('gates speed_bonus by armor condition but applies speed_increase unconditionally', () => {
        // no_heavy_armor: heavy armor worn denies the bonus.
        expect(applySpeedIncreasePassives(barbarian({}, heavyArmorKit))).toBeUndefined();
        // speed_increase never consults the condition — same heavy armor still folds.
        const increase = barbarian({ effect: 'speed_increase' }, heavyArmorKit);
        expect(applySpeedIncreasePassives(increase)).toBe(40);
        // no_armor_no_shield (classes.json Fast Strike-style gating): a bare Shield denies.
        const shieldOnly = barbarian({ condition: 'no_armor_no_shield' }, { inventory: { equipped: ['Shield'] } });
        expect(applySpeedIncreasePassives(shieldOnly)).toBeUndefined();
        // Same passive unarmoured and shield-less: folds onto the race JSON base.
        expect(applySpeedIncreasePassives(barbarian({ condition: 'no_armor_no_shield' }))).toBe(40);
    });

    it('logs an error and returns undefined when a bonus has no base to fold into', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const stats = barbarian({}, { race: undefined });
        expect(applySpeedIncreasePassives(stats)).toBeUndefined();
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('no base speed'), 'DraconicDragon');
        spy.mockRestore();
    });

    it('throws a readable error when automation.passives is missing', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => applySpeedIncreasePassives({ name: 'Broken' })).toThrow(/passives.*Broken/);
        spy.mockRestore();
    });
});

describe('resolveHalfSpeedFeet (CLA-201)', () => {
    it('halves along the same base ladder and floors odd results', () => {
        expect(resolveHalfSpeedFeet({ name: 'X', speed: 40 })).toBe(20);
        // Rounding direction pinned as implemented: Math.floor (35 → 17, not 18).
        expect(resolveHalfSpeedFeet({ name: 'X', speed: 35 })).toBe(17);
        // Subrace rung beats race rung; race JSON mirrors charSummaryCalc.getBaseSpeed.
        expect(resolveHalfSpeedFeet({ name: 'X', race: { speed: 30, subrace: { speed: 35 } } })).toBe(17);
        expect(resolveHalfSpeedFeet({ name: 'X', race: { speed: 30 } })).toBe(15);
    });

    it('logs an error and falls back to 15 ft when there is no speed anywhere', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(resolveHalfSpeedFeet({ name: 'X' })).toBe(15);
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('no speed to halve'), 'X');
        spy.mockRestore();
    });
});
