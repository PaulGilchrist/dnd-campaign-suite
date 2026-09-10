// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { handle, confirmSummonSpirit } from './summonSpiritHandler.js';
import summonFeySpells from '../../../../../public/data/2024/spells.json' with { type: 'json' };
import summonFeyMonsters from '../../../../../public/data/monsters.json' with { type: 'json' };

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../buffs/tempHpService.js', () => ({
    setTempHpOnKey: vi.fn(),
}));

vi.mock('../../../encounters/encounterToInitiative.js', () => ({
    getMonsterSaveBonuses: vi.fn().mockImplementation((monster) => {
        const map = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        for (const [abbr] of Object.entries(map)) {
            if (monster.saving_throws?.[abbr]?.modifier != null) {
                map[abbr] = monster.saving_throws[abbr].modifier;
            }
        }
        return map;
    }),
}));

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { setTempHpOnKey } from '../buffs/tempHpService.js';

describe('summonSpiritHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const targetEffects = [];
        getRuntimeValue.mockImplementation((_entity, key) => {
            if (key === 'targetEffects') return targetEffects;
            return null;
        });
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
            ],
        });
    });

    const mockPlayerStats = {
        name: 'TestCaster',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        spellAbilities: { toHit: 6, saveDc: 13, modifier: 3 },
    };
    const mockCampaignName = 'test-campaign';

    const bestialVariants = [
        { name: 'Bestial Spirit (Air)', monsterIndex: 'bestial-spirit-air' },
        { name: 'Bestial Spirit (Land)', monsterIndex: 'bestial-spirit-land' },
        { name: 'Bestial Spirit (Water)', monsterIndex: 'bestial-spirit-water' },
    ];

    function makeAction(overrides = {}) {
        return {
            name: 'Summon Beast',
            automation: {
                type: 'summon_spirit',
                typeLabel: 'Bestial Spirit',
                baseLevel: 2,
                hpPerLevelAbove: 5,
                variants: bestialVariants,
                ...overrides.automation,
            },
            spell: { level: 2 },
            ...overrides,
        };
    }

    const mockMonsters = [
        {
            index: 'animated-object-medium', name: 'Animated Object (Medium)', type: 'construct',
            armor_class: 15, hit_points: 10, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: {}, actions: [{
                name: 'Slam',
                description: 'Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d4+3 Force damage.',
                attack_bonus: null,
                reach: '5 ft.',
                damage_dice_primary: '1d4+3',
                damage_type_primary: 'force',
            }],
        },
        {
            index: 'bestial-spirit-air', name: 'Bestial Spirit (Air)', type: 'beast',
            armor_class: 11, hit_points: 20, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 4 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: -3 }, wis: { modifier: 2 }, cha: { modifier: -3 } },
            actions: [{
                name: "Beast's Strike",
                description: 'Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d8+2+WIS modifier Piercing damage.',
                attack_bonus: null,
                reach: '5 ft.',
                damage_dice_primary: '1d8+2+WIS modifier',
                damage_type_primary: 'piercing',
            }],
        },
        {
            index: 'bestial-spirit-land', name: 'Bestial Spirit (Land)', type: 'beast',
            armor_class: 11, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 4 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: -3 }, wis: { modifier: 2 }, cha: { modifier: -3 } },
            actions: [
                {
                    name: "Beast's Strike",
                    description: 'Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d8+2+WIS modifier damage.',
                    attack_bonus: null,
                    reach: '5 ft.',
                    damage_dice_primary: '1d8+2+WIS modifier',
                    damage_type_primary: 'bludgeoning',
                },
                {
                    name: "Beast's Strike — Charge",
                    description: 'The target must succeed on a DC 20 Strength saving throw or be knocked prone.',
                    save_dc: 20,
                    save_type: 'Str',
                },
            ],
        },
        {
            index: 'bestial-spirit-water', name: 'Bestial Spirit (Water)', type: 'beast',
            armor_class: 11, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 4 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: -3 }, wis: { modifier: 2 }, cha: { modifier: -3 } },
            actions: [{
                name: "Beast's Strike",
                description: 'Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d6+2+WIS modifier damage.',
                attack_bonus: null,
                reach: '5 ft.',
                damage_dice_primary: '1d6+2+WIS modifier',
                damage_type_primary: 'bludgeoning',
            }],
        },
        {
            index: 'aberrant-spirit-mind-flayer', name: 'Aberrant Spirit (Mind Flayer)', type: 'aberration',
            armor_class: 11, hit_points: 40, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 2 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: 4 }, wis: { modifier: 2 }, cha: { modifier: 3 } },
            actions: [{
                name: 'Psychic Slam',
                description: 'Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 3d6+spellcasting modifier Psychic damage.',
                attack_bonus: null,
                reach: '5 ft.',
                damage_dice_primary: '3d6+spellcasting modifier',
                damage_type_primary: 'psychic',
            }],
        },
        {
            index: 'animate-objects-medium', name: 'Animated Object (Medium)', type: 'construct',
            armor_class: 15, hit_points: 10, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: {}, actions: [{
                name: 'Slam',
                description: 'Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d4+3 Force damage.',
                attack_bonus: null,
                reach: '5 ft.',
                damage_dice_primary: '1d4+3',
                damage_type_primary: 'force',
            }],
        },
    ];

    describe('handle', () => {
        it('returns a summonSpirit modal for multi-variant spells', async () => {
            const result = await handle(makeAction(), mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('summonSpirit');
            expect(result.payload.action).toBeDefined();
            expect(result.payload.playerStats).toBe(mockPlayerStats);
            expect(result.payload.campaignName).toBe(mockCampaignName);
        });

        it('summons directly for single-variant spells', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const action = makeAction({
                name: 'Fey Spirit',
                automation: { typeLabel: 'Fey Spirit', baseLevel: 3, variants: [{ name: 'Fey Spirit', monsterIndex: 'bestial-spirit-air' }] },
            });

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Fey Spirit');
        });
    });

    describe('confirmSummonSpirit', () => {
        it('adds the creature at caster initiative - 0.1 with summoned effect and concentration', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);

            const result = await confirmSummonSpirit(makeAction(), mockPlayerStats, mockCampaignName, 'Bestial Spirit (Air)');

            const added = combatSummary.creatures.find(c => c.name === 'Bestial Spirit (Air)');
            expect(added).toBeDefined();
            expect(added.initiative).toBe('14.9');
            expect(added.summonedBy).toBe('TestCaster');
            expect(added.summonSource).toBe('spell');
            expect(added.maxHp).toBe(20);
            expect(added.ac).toBe(11);

            const effect = getRuntimeValue('campaign', 'targetEffects').find(te => te.target === 'Bestial Spirit (Air)');
            expect(effect).toMatchObject({
                effect: 'summoned',
                source: 'TestCaster',
                summonSource: 'spell',
                duration: 'concentration',
            });

            expect(addConcentration).toHaveBeenCalledWith(combatSummary, 'TestCaster', 'Summon Beast', 13);
            expect(storage.set).toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
                type: 'summons',
                characterName: 'TestCaster',
                summonName: 'Bestial Spirit',
                summonedCreatures: ['Bestial Spirit (Air)'],
            }));
            expect(result.type).toBe('popup');
        });

        it('scales HP by the slot level used but keeps base AC (SP-114)', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = makeAction({ metaCtx: { slotLevel: 4 } });

            await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Bestial Spirit (Air)');

            const added = combatSummary.creatures.find(c => c.name === 'Bestial Spirit (Air)');
            expect(added.ac).toBe(11);
            expect(added.maxHp).toBe(20 + 5 * (4 - 2));
        });

        it('does not scale AC/HP when automation.scale is false', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = makeAction({
                name: 'Animate Objects',
                automation: { typeLabel: 'Animated Object', scale: false, variants: [{ name: 'Animated Object (Medium)', monsterIndex: 'animated-object-medium' }] },
            });

            await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');

            const added = combatSummary.creatures.find(c => c.name === 'Animated Object (Medium)');
            expect(added.ac).toBe(15);
            expect(added.maxHp).toBe(10);
        });

        it('summons animated object with correct monster index from 2024 spells.json', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = makeAction({
                name: 'Animate Objects',
                automation: { typeLabel: 'Animated Object', scale: false, variants: [{ name: 'Animated Object (Medium)', monsterIndex: 'animated-object-medium' }] },
            });

            const result = await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');

            const added = combatSummary.creatures.find(c => c.name === 'Animated Object (Medium)');
            expect(added).toBeDefined();
            expect(added.summonedBy).toBe('TestCaster');
            expect(added.summonSource).toBe('spell');
            expect(added.ac).toBe(15);
            expect(added.maxHp).toBe(10);
            expect(added.speed.walk).toBe('30 ft.');

            const effect = getRuntimeValue('campaign', 'targetEffects').find(te => te.target === 'Animated Object (Medium)');
            expect(effect).toMatchObject({
                effect: 'summoned',
                source: 'TestCaster',
                summonSource: 'spell',
                duration: 'concentration',
            });

            expect(addConcentration).toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });

        it('resolves spell attack, WIS modifier, spell level and save DC placeholders', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = makeAction({ metaCtx: { slotLevel: 3 } });

            await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Bestial Spirit (Land)');

            const added = combatSummary.creatures.find(c => c.name === 'Bestial Spirit (Land)');
            expect(added.actions[0].description).toContain('+6');
            expect(added.actions[0].description).toContain('1d8+2+3');
            expect(added.actions[0].attack_bonus).toBe(6);
            expect(added.actions[1].save_dc).toBe(13);
        });

        describe('SP-114 Summon Aberration concentration + duration', () => {
            const aberrantVariants = [
                { name: 'Aberrant Spirit (Beholderkin)', monsterIndex: 'aberrant-spirit-beholderkin' },
                { name: 'Aberrant Spirit (Mind Flayer)', monsterIndex: 'aberrant-spirit-mind-flayer' },
                { name: 'Aberrant Spirit (Slaad)', monsterIndex: 'aberrant-spirit-slaad' },
            ];

            function makeAberrantAction(overrides = {}) {
                return {
                    name: 'Summon Aberration',
                    automation: {
                        type: 'summon_spirit',
                        typeLabel: 'Aberrant Spirit',
                        baseLevel: 4,
                        hpPerLevelAbove: 5,
                        variants: aberrantVariants,
                        ...overrides.automation,
                    },
                    spell: { level: 4, duration: 'Concentration, up to 1 hour', concentration: true },
                    ...overrides,
                };
            }

            const createThrallWarlock = {
                ...mockPlayerStats,
                class: {
                    class_levels: [{
                        level: 14,
                        features: [{
                            name: 'Create Thrall',
                            automation: [
                                { type: 'create_thrall', spell: 'Summon Aberration' },
                                { type: 'passive_rule', effect: 'create_thrall_temp_hp' },
                            ],
                        }],
                    }],
                },
            };

            it('keeps canonical concentration for a caster WITHOUT the Create Thrall feature', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAberrantAction(), mockPlayerStats, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');

                const added = combatSummary.creatures.find(c => c.name === 'Aberrant Spirit (Mind Flayer)');
                expect(added).toBeDefined();
                expect(added.ac).toBe(11);
                expect(added.maxHp).toBe(40);
                expect(added.actions.map(a => a.name)).toEqual(['Psychic Slam']);
                expect(setTempHpOnKey).not.toHaveBeenCalled();

                const effect = getRuntimeValue('campaign', 'targetEffects').find(te => te.target === 'Aberrant Spirit (Mind Flayer)');
                expect(effect).toMatchObject({ effect: 'summoned', duration: 'concentration' });
                expect(addConcentration).toHaveBeenCalledWith(combatSummary, 'TestCaster', 'Summon Aberration', 13);
            });

            it('registers a 1-hour (600-round) concentration expiry clock on summon', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAberrantAction(), mockPlayerStats, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');

                expect(addExpiration).toHaveBeenCalledWith('TestCaster', 'TestCaster', [
                    { type: 'remove_summoned_creatures', spell: 'Summon Aberration' },
                ], mockCampaignName, 600);
            });

            it('keeps Create Thrall verified behavior for a feature holder: no concentration, temp HP, Psychic Strike', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAberrantAction(), createThrallWarlock, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');

                const added = combatSummary.creatures.find(c => c.name === 'Aberrant Spirit (Mind Flayer)');
                expect(added.actions.map(a => a.name)).toContain('Psychic Strike');
                expect(setTempHpOnKey).toHaveBeenCalledWith('Aberrant Spirit (Mind Flayer)', 'tempHp', expect.any(Number), mockCampaignName);

                const effect = getRuntimeValue('campaign', 'targetEffects').find(te => te.target === 'Aberrant Spirit (Mind Flayer)');
                expect(effect).toMatchObject({ effect: 'summoned', duration: '1_minute' });
                expect(addConcentration).not.toHaveBeenCalled();
                expect(addExpiration).not.toHaveBeenCalled();
            });
        });

        describe('CLA-252 Phantasmal Creatures free cast', () => {
            const phantasmalPlayerStats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{
                        type: 'phantasmal_creatures',
                        name: 'Phantasmal Creatures',
                        freeCastSpells: ['Summon Beast', 'Summon Fey'],
                        usesMax: 1,
                        recharge: 'long_rest',
                        halvesHp: true,
                    }],
                },
            };

            const freeCastAction = () => {
                const action = makeAction({ metaCtx: { slotLevel: 2 } });
                action.spell = { level: 2, school: 'Illusion', _phantasmalCreatures: true, _phantasmalHalvesHp: true };
                return action;
            };

            it('halves the summoned spirit HP on the free-cast spectral version', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(freeCastAction(), phantasmalPlayerStats, mockCampaignName, 'Bestial Spirit (Land)');

                const added = combatSummary.creatures.find(c => c.name === 'Bestial Spirit (Land)');
                expect(added.maxHp).toBe(15);
                expect(added.currentHp).toBe(15);
                expect(added.phantasmal).toBe(true);
                expect(added.spectral).toBe(true);
            });

            it('keeps full HP on a normal slotted cast even with the passive present', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAction({ metaCtx: { slotLevel: 2 } }), phantasmalPlayerStats, mockCampaignName, 'Bestial Spirit (Land)');

                const added = combatSummary.creatures.find(c => c.name === 'Bestial Spirit (Land)');
                expect(added.maxHp).toBe(30);
                expect(added.phantasmal).toBeUndefined();
            });

            it('logs the free cast with the trait citation and HP instead of a slot-level mislabel', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);

                await confirmSummonSpirit(freeCastAction(), phantasmalPlayerStats, mockCampaignName, 'Bestial Spirit (Land)');

                expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
                    type: 'summons',
                    description: expect.stringContaining('Phantasmal Creatures free cast (spectral, half HP)'),
                }));
                const logged = addEntry.mock.calls.find(c => c[1]?.type === 'summons');
                expect(logged[1].description).not.toContain('slot level');
                expect(logged[1].description).toContain('15/15 HP');
            });
        });

        describe('SP-120 Summon Fey form chooser (locked to disk data)', () => {
            const summonFeySpell = summonFeySpells.find(s => s.index === 'summon-fey');
            const summonFeyVariants = summonFeySpell.automation.variants;

            it('encodes three Trickster/Warrior/Guide variants with distinct monsterIndex entries', () => {
                expect(summonFeyVariants.map(v => v.name)).toEqual([
                    'Fey Spirit (Trickster)',
                    'Fey Spirit (Warrior)',
                    'Fey Spirit (Guide)',
                ]);
                summonFeyVariants.forEach(v => {
                    expect(summonFeyMonsters.find(m => m.index === v.monsterIndex)?.name).toBe(v.name);
                });
            });

            it('offers the summonSpirit chooser modal instead of auto-summoning', async () => {
                const action = {
                    name: 'Summon Fey',
                    automation: summonFeySpell.automation,
                    spell: { level: 4, duration: summonFeySpell.duration, concentration: true },
                };

                const result = await handle(action, mockPlayerStats, mockCampaignName);

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('summonSpirit');
            });

            summonFeyVariants.forEach(variant => {
                it(`summons ${variant.name} with base AC 12, scaled HP, concentration and a slot-level log`, async () => {
                    loadMonsters.mockResolvedValue(summonFeyMonsters);
                    const combatSummary = getCombatSummary(mockCampaignName);
                    const action = {
                        name: 'Summon Fey',
                        automation: summonFeySpell.automation,
                        spell: { level: 4, duration: summonFeySpell.duration, concentration: true },
                    };

                    await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, variant.name);

                    const added = combatSummary.creatures.find(c => c.name === variant.name);
                    expect(added).toBeDefined();
                    expect(added.ac).toBe(12);
                    expect(added.maxHp).toBe(30);
                    expect(added.summonedBy).toBe('TestCaster');
                    expect(added.monsterIndex).toBe(variant.monsterIndex);

                    const effect = getRuntimeValue('campaign', 'targetEffects').find(te => te.target === variant.name);
                    expect(effect).toMatchObject({ effect: 'summoned', source: 'TestCaster', duration: 'concentration' });
                    expect(addConcentration).toHaveBeenCalledWith(combatSummary, 'TestCaster', 'Summon Fey', 13);

                    const logged = addEntry.mock.calls.filter(c => c[1]?.type === 'summons');
                    expect(logged).toHaveLength(1);
                    expect(logged[0][1].description).toContain('slot level 4');
                    expect(logged[0][1].description).toContain(variant.name);
                    expect(logged[0][1].description).toContain('30/30 HP');
                });
            });

            it('scales HP above base level while keeping base AC', async () => {
                loadMonsters.mockResolvedValue(summonFeyMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);
                const action = {
                    name: 'Summon Fey',
                    automation: summonFeySpell.automation,
                    spell: { level: 5, duration: summonFeySpell.duration, concentration: true },
                };

                await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Fey Spirit (Trickster)');

                const added = combatSummary.creatures.find(c => c.name === 'Fey Spirit (Trickster)');
                expect(added.ac).toBe(12);
                expect(added.maxHp).toBe(40);
            });
        });

        it('returns a popup for an unknown variant', async () => {
            const result = await confirmSummonSpirit(makeAction(), mockPlayerStats, mockCampaignName, 'Unknown');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No summon variant selected.');
        });
    });
});
