// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyWarCasterReaction } from './reactionSpellHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'TestCleric';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 10,
        spellAbilities: {
            spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: 'Always', level: 1, range: '30 feet' },
                { name: 'Shield', casting_time: '1 reaction', prepared: 'Always', level: 1, range: 'Self' },
                { name: 'Fireball', casting_time: '1 action', prepared: 'Always', level: 3, range: '150 feet', area_of_effect: { shape: 'sphere', size: '20-foot-radius' } },
                { name: 'Mage Armor', casting_time: '1 bonus action', prepared: 'Always', level: 1, range: 'Touch' },
            ],
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Reactive Spell',
        automation: { type: 'reaction_spell', ...overrides },
    };
}

// ── Tests ────────────────────────────────────────────────────────

describe('reactionSpellHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('return structure', () => {
        it('returns a popup with automation_info type and correct payload fields', async () => {
            const action = makeAction();
            const ps = makePlayerStats();

            const result = await handle(action, ps, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.trigger).toBe('opportunity_attack_reaction');
            expect(result.payload.automation).toEqual(action.automation);
            expect(result.payload.name).toBe('Reactive Spell');
        });

        it('returns a popup with custom action name', async () => {
            const action = { name: 'My Reactive Spell', automation: { type: 'reaction_spell' } };
            const ps = makePlayerStats();

            const result = await handle(action, ps, campaignName);

            expect(result.payload.name).toBe('My Reactive Spell');
        });
    });

    describe('spell eligibility filtering', () => {
        it('includes 1 action spells and excludes reaction and bonus action spells', async () => {
            const ps = makePlayerStats();
            const result = await handle(makeAction(), ps, campaignName);

            const spellNames = result.payload.eligibleSpells.map(s => s.name);
            expect(spellNames).toContain('Burning Hands');
            expect(spellNames).toContain('Fireball');
            expect(spellNames).not.toContain('Shield');
        });

        it('excludes unprepared spells', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: 'Not Prepared', level: 1 },
            ] } });
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.eligibleSpells).toHaveLength(0);
        });

        it('excludes spells with prepared=false', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: false, level: 1 },
            ] } });
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.eligibleSpells).toHaveLength(0);
        });

        it('includes spells with prepared=Prepared', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: 'Prepared', level: 1 },
            ] } });
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.eligibleSpells).toHaveLength(1);
            expect(result.payload.eligibleSpells[0].name).toBe('Burning Hands');
        });

        it('handles null or missing spellAbilities/spells gracefully', async () => {
            expect((await handle(makeAction(), makePlayerStats({ spellAbilities: null }), campaignName)).payload.eligibleSpells).toHaveLength(0);
            expect((await handle(makeAction(), makePlayerStats({ spellAbilities: {} }), campaignName)).payload.eligibleSpells).toHaveLength(0);
            expect((await handle(makeAction(), null, campaignName)).payload.eligibleSpells).toHaveLength(0);
        });
    });

    describe('spell data structure', () => {
        it('includes name, level, casting_time, range and target fields in eligible spell data', async () => {
            const ps = makePlayerStats();
            const result = await handle(makeAction(), ps, campaignName);

            const spell = result.payload.eligibleSpells.find(s => s.name === 'Burning Hands');
            expect(spell.name).toBe('Burning Hands');
            expect(spell.level).toBe(1);
            expect(spell.casting_time).toBe('1 action');
            expect(spell.range).toBe('30 feet');
            expect(spell.isSingleTarget).toBe(true);
            expect(spell.hasAreaOfEffect).toBe(false);
            expect(spell.maxTargets).toBe(1);
        });

        it('marks spells with area_of_effect as multi-target', async () => {
            const ps = makePlayerStats();
            const result = await handle(makeAction(), ps, campaignName);

            const spell = result.payload.eligibleSpells.find(s => s.name === 'Fireball');
            expect(spell.isSingleTarget).toBe(false);
            expect(spell.hasAreaOfEffect).toBe(true);
        });

        it('marks spells with automation.maxTargets > 1 as multi-target', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Acid Splash', casting_time: '1 action', prepared: 'Always', level: 1, automation: { maxTargets: 2 } },
            ] } });
            const result = await handle(makeAction(), ps, campaignName);

            const spell = result.payload.eligibleSpells[0];
            expect(spell.isSingleTarget).toBe(false);
            expect(spell.maxTargets).toBe(2);
        });

        it('defaults level to 0 when not specified', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Cantrip', casting_time: '1 action', prepared: 'Always' },
            ] } });
            const result = await handle(makeAction(), ps, campaignName);

            const spell = result.payload.eligibleSpells[0];
            expect(spell.level).toBe(0);
        });
    });

    describe('warnings for multi-target spells', () => {
        it('flags warnings when multi-target spells are present', async () => {
            const ps = makePlayerStats();
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.hasWarnings).toBe(true);
            expect(result.payload.description).toContain('Warning');
            expect(result.payload.description).toContain('Fireball');
        });

        it('does not flag warnings when only single-target or no spells exist', async () => {
            const ps1 = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Burning Hands', casting_time: '1 action', prepared: 'Always', level: 1 },
                { name: 'Magic Missile', casting_time: '1 action', prepared: 'Always', level: 1 },
            ] } });
            const result1 = await handle(makeAction(), ps1, campaignName);
            expect(result1.payload.hasWarnings).toBe(false);

            const ps2 = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Shield', casting_time: '1 reaction', prepared: 'Always' },
            ] } });
            const result2 = await handle(makeAction(), ps2, campaignName);
            expect(result2.payload.hasWarnings).toBe(false);
        });
    });

    describe('description content', () => {
        it('describes the trigger behavior and lists available spells', async () => {
            const ps = makePlayerStats();
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.description).toContain('leaves your reach');
            expect(result.payload.description).toContain('Burning Hands');
            expect(result.payload.description).toContain('Fireball');
        });

        it('reports no available spells when none match', async () => {
            const ps = makePlayerStats({ spellAbilities: { spells: [
                { name: 'Shield', casting_time: '1 reaction', prepared: 'Always' },
                { name: 'Mage Armor', casting_time: '1 bonus action', prepared: 'Always' },
            ] } });
            const result = await handle(makeAction(), ps, campaignName);

            expect(result.payload.description).toContain('No spells');
        });
    });

    describe('applyWarCasterReaction', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('stores reaction with target, spell, and character info', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Burning Hands', level: 3 };

            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            applyWarCasterReaction('Goblin', 'Burning Hands', spellData, ps, campaignName);

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                'warCasterReactions',
                expect.arrayContaining([
                    expect.objectContaining({
                        targetName: 'Goblin',
                        spellName: 'Burning Hands',
                        spellData,
                        characterName: playerName,
                    }),
                ]),
                campaignName,
            );
        });

        it('returns ok:true on success', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Burning Hands', level: 3 };

            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const result = applyWarCasterReaction('Goblin', 'Burning Hands', spellData, ps, campaignName);

            expect(result).toEqual({ ok: true });
        });

        it('appends to existing reactions', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Fireball', level: 3 };

            useRuntimeState.getRuntimeValue.mockReturnValue([
                { targetName: 'Orc', spellName: 'Magic Missile' },
            ]);

            applyWarCasterReaction('Goblin', 'Fireball', spellData, ps, campaignName);

            const storedCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'warCasterReactions');
            expect(storedCall[2].length).toBe(2);
        });

        it('logs an ability_use entry', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Burning Hands', level: 3 };

            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            applyWarCasterReaction('Goblin', 'Burning Hands', spellData, ps, campaignName);

            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'War Caster - Reactive Spell',
                    description: 'War Caster Reactive Spell: Casting Burning Hands as a reaction on Goblin.',
                }),
            );
        });

        it('swallows addEntry errors and still returns ok', async () => {
            const ps = makePlayerStats();
            const spellData = { name: 'Fireball', level: 3 };

            useRuntimeState.getRuntimeValue.mockReturnValue([]);
            logService.addEntry.mockRejectedValue(new Error('network'));

            const result = applyWarCasterReaction('Goblin', 'Fireball', spellData, ps, campaignName);

            expect(result).toEqual({ ok: true });
        });
    });
});
