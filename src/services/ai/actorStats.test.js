// @maintained-by-ai
// Backlog 2026-10-31 (stat-blind referee dice) — client-side actor-stats
// projection. Fixtures mirror the REAL character-file shape on disk
// (public/campaigns/test-campaign/*.json): abilities as
// {name, baseScore, featIncrease, backgroundIncrease, miscIncrease} arrays.
import { describe, it, expect } from 'vitest';
import { projectActorStats } from './actorStats.js';

// Byte-faithful to public/campaigns/test-campaign/DivinationWizard.json
// (INT 16+4+1 = 21 → clamped 20 → +5; level 20 ⇒ PB +6; Arcana expert).
const WIZARD = {
    name: 'DivinationWizard',
    level: 20,
    rules: '2024',
    race: { name: 'Human', subrace: { name: '' } },
    class: { name: 'Wizard', subclass: { name: 'Evoker' } },
    abilities: [
        { name: 'Strength', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
        { name: 'Dexterity', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
        { name: 'Constitution', baseScore: 10, featIncrease: 0, backgroundIncrease: 1, miscIncrease: 0 },
        { name: 'Intelligence', baseScore: 16, featIncrease: 4, backgroundIncrease: 1, miscIncrease: 0 },
        { name: 'Wisdom', baseScore: 10, featIncrease: 0, backgroundIncrease: 1, miscIncrease: 0 },
        { name: 'Charisma', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    ],
    skillProficiencies: ['Arcana', 'History', 'Sleight of Hand'],
    expertSkills: ['Arcana'],
};

describe('projectActorStats — real character-file data', () => {
    it('derives mods from baseScore+increases (score-10)/2, clamped at 20', () => {
        const stats = projectActorStats(WIZARD);
        expect(stats.abilityMods).toEqual({ str: -1, dex: -1, con: 0, int: 5, wis: 0, cha: -1 });
        expect(stats.name).toBe('DivinationWizard');
    });

    it('carries the level-progression proficiency bonus (level 20 ⇒ +6)', () => {
        expect(projectActorStats({ ...WIZARD, level: 1 }).proficiencyBonus).toBe(2);
        expect(projectActorStats({ ...WIZARD, level: 5 }).proficiencyBonus).toBe(3);
        expect(projectActorStats(WIZARD).proficiencyBonus).toBe(6);
    });

    it('passes skill proficiency + expertise through so the model can compose checks', () => {
        const stats = projectActorStats(WIZARD);
        expect(stats.skillProficiencies).toEqual(['Arcana', 'History', 'Sleight of Hand']);
        expect(stats.expertSkills).toEqual(['Arcana']);
    });

    it('level-20 Barbarian/Monk epic boons raise the score (+4, cap 25)', () => {
        const barb = {
            name: 'Hork', level: 20, class: { name: 'Barbarian' },
            abilities: [{ name: 'Strength', baseScore: 20, featIncrease: 4, backgroundIncrease: 0, miscIncrease: 0 }],
        };
        expect(projectActorStats(barb).abilityMods.str).toBe(7); // 24+4 → 25 → +7
        const wizardStr = { ...WIZARD, class: { name: 'Wizard' } };
        expect(projectActorStats(wizardStr).abilityMods.str).toBe(-1); // no boon for Wizards
    });

    it('ignores junk entries but keeps the valid ones', () => {
        const stats = projectActorStats({
            name: 'Half', level: 3,
            abilities: [null, { name: 'Nope' }, { name: 'Wisdom', baseScore: 'x' }, { name: 'Charisma', baseScore: 16 }],
        });
        expect(stats.abilityMods).toEqual({ cha: 3 });
        expect(stats.proficiencyBonus).toBe(2);
    });
});

describe('projectActorStats — stats-less inputs never change the wire shape', () => {
    it('null/undefined/no-abilities/no-usable-entries ⇒ null (ask omits actorStats)', () => {
        expect(projectActorStats(null)).toBeNull();
        expect(projectActorStats(undefined)).toBeNull();
        expect(projectActorStats({ name: 'Rakan' })).toBeNull();
        expect(projectActorStats({ name: 'Rakan', abilities: [] })).toBeNull();
        expect(projectActorStats({ name: 'Rakan', abilities: [{ name: 'Ghost' }] })).toBeNull();
    });

    it('omits empty skill lists; caps long ones', () => {
        const noSkills = projectActorStats({ ...WIZARD, skillProficiencies: [], expertSkills: undefined });
        expect(noSkills.skillProficiencies).toBeUndefined();
        expect(noSkills.expertSkills).toBeUndefined();
        const many = projectActorStats({ ...WIZARD, skillProficiencies: Array.from({ length: 40 }, (_, i) => `S${i}`) });
        expect(many.skillProficiencies).toHaveLength(25);
    });
});
