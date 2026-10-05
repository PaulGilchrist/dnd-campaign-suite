// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { handle, confirmSummonSpirit, resolveMonsterActions, resolveMonsterReactions, resolveCreateThrallRiderHit } from './summonSpiritHandler.js';
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
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
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

vi.mock('../../../encounters/encounterToInitiative.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getMonsterSaveBonuses: vi.fn().mockImplementation((monster) => {
            const map = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
            for (const [abbr] of Object.entries(map)) {
                if (monster.saving_throws?.[abbr]?.modifier != null) {
                    map[abbr] = monster.saving_throws[abbr].modifier;
                }
            }
            return map;
        }),
    };
});

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
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
        // SP-005: store-backed targetEffects so a fresh [...] write (no longer
        // mutated in place) is observable via getRuntimeValue across multi-cast.
        const store = { targetEffects: [] };
        getRuntimeValue.mockImplementation((_entity, key) => (key in store ? store[key] : null));
        setRuntimeValue.mockImplementation((_entity, key, value) => { store[key] = value; });
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
            armor_class: 11, armor_class_scales_with_slot: true, hit_points: 20, damage_resistances: [], damage_immunities: [], immunities: [],
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
            armor_class: 11, armor_class_scales_with_slot: true, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
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
            armor_class: 11, armor_class_scales_with_slot: true, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
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

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Air)'));
            expect(added).toBeDefined();
            expect(added.initiative).toBe('14.9');
            expect(added.summonedBy).toBe('TestCaster');
            expect(added.summonSource).toBe('spell');
            expect(added.maxHp).toBe(20);
            // SP-015: bestial-spirit-* blocks spell "AC equals 11 + the spell's
            // level" and opt in via armor_class_scales_with_slot → 11 + slot 2.
            expect(added.ac).toBe(13);

            const effect = getRuntimeValue('campaign', 'targetEffects').find(te => te.target?.startsWith('Bestial Spirit (Air)'));
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
                summonedCreatures: ['Bestial Spirit (Air) 1'],
            }));
            expect(result.type).toBe('popup');
        });

        it('scales HP and AC by the slot level used for armor_class_scales_with_slot blocks (SP-015)', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = makeAction({ metaCtx: { slotLevel: 4 } });

            await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Bestial Spirit (Air)');

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Air)'));
            expect(added.ac).toBe(11 + 4);
            expect(added.maxHp).toBe(20 + 5 * (4 - 2));
        });

        it('SP-015: lv3 Land upcast spawns AC 14 and HP 35 with a slot-level 3 log', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = makeAction({ metaCtx: { slotLevel: 3 } });

            await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Bestial Spirit (Land)');

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Land)'));
            expect(added.ac).toBe(14);
            expect(added.maxHp).toBe(35);
            expect(added.currentHp).toBe(35);
            const logged = addEntry.mock.calls.find(c => c[1]?.type === 'summons');
            expect(logged[1].description).toContain('slot level 3');
            expect(logged[1].description).toContain('35/35 HP');
        });

        it('SP-015: unflagged summon blocks stay byte-identical — AC never gains the slot level (SP-114)', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = makeAction({
                name: 'Animate Objects',
                automation: { typeLabel: 'Animated Object', scale: false, variants: [{ name: 'Animated Object (Medium)', monsterIndex: 'animated-object-medium' }] },
            });

            await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');
            const ao = combatSummary.creatures.find(c => c.name?.startsWith('Animated Object (Medium)'));
            expect(ao.ac).toBe(15);

            const aberrant = makeAction({
                name: 'Summon Aberration',
                automation: { typeLabel: 'Aberrant Spirit', baseLevel: 4, hpPerLevelAbove: 5, variants: [{ name: 'Aberrant Spirit (Mind Flayer)', monsterIndex: 'aberrant-spirit-mind-flayer' }] },
                metaCtx: { slotLevel: 5 },
            });
            await confirmSummonSpirit(aberrant, mockPlayerStats, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');
            const mf = combatSummary.creatures.find(c => c.name?.startsWith('Aberrant Spirit (Mind Flayer)'));
            expect(mf.ac).toBe(11);
            expect(mf.maxHp).toBe(40 + 5 * (5 - 4));
        });

        it('does not scale AC/HP when automation.scale is false', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const action = makeAction({
                name: 'Animate Objects',
                automation: { typeLabel: 'Animated Object', scale: false, variants: [{ name: 'Animated Object (Medium)', monsterIndex: 'animated-object-medium' }] },
            });

            await confirmSummonSpirit(action, mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Animated Object (Medium)'));
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

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Animated Object (Medium)'));
            expect(added).toBeDefined();
            expect(added.summonedBy).toBe('TestCaster');
            expect(added.summonSource).toBe('spell');
            expect(added.ac).toBe(15);
            expect(added.maxHp).toBe(10);
            expect(added.speed.walk).toBe('30 ft.');

            const effect = getRuntimeValue('campaign', 'targetEffects').find(te => te.target?.startsWith('Animated Object (Medium)'));
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

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Land)'));
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

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Aberrant Spirit (Mind Flayer)'));
                expect(added).toBeDefined();
                expect(added.ac).toBe(11);
                expect(added.maxHp).toBe(40);
                expect(added.actions.map(a => a.name)).toEqual(['Psychic Slam']);
                expect(setTempHpOnKey).not.toHaveBeenCalled();

                const effect = getRuntimeValue('campaign', 'targetEffects').find(te => te.target?.startsWith('Aberrant Spirit (Mind Flayer)'));
                expect(effect).toMatchObject({ effect: 'summoned', duration: 'concentration' });
                expect(addConcentration).toHaveBeenCalledWith(combatSummary, 'TestCaster', 'Summon Aberration', 13);
            });

            it('registers a 1-hour (600-round) concentration expiry clock on summon', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAberrantAction(), mockPlayerStats, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');

                expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'TestCaster', effects: [
                    { type: 'remove_summoned_creatures', spell: 'Summon Aberration' },
                ], campaignName: mockCampaignName, rounds: 600 });
            });

            it('keeps Create Thrall verified behavior for a feature holder: no concentration, temp HP, Psychic Strike', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAberrantAction(), createThrallWarlock, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Aberrant Spirit (Mind Flayer)'));
                expect(added.actions.map(a => a.name)).toContain('Psychic Strike');
                expect(setTempHpOnKey).toHaveBeenCalledWith('Aberrant Spirit (Mind Flayer) 1', 'tempHp', expect.any(Number), mockCampaignName);

                const effect = getRuntimeValue('campaign', 'targetEffects').find(te => te.target?.startsWith('Aberrant Spirit (Mind Flayer)'));
                expect(effect).toMatchObject({ effect: 'summoned', duration: '1_minute' });
                expect(addConcentration).not.toHaveBeenCalled();
                // CLA-066: the no-Concentration thrall carries a hard 1-minute
                // expiry clock (rounds:10, CLA-334 recipe) — the old pin of
                // "no clock at all" was a defect (summon never expired).
                expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'TestCaster', effects: [
                    { type: 'remove_summoned_creatures', spell: 'Summon Aberration' },
                ], campaignName: mockCampaignName, rounds: 10 });
            });

            it('CLA-066 automation-collected shape (subclass name-only): gate true via automation.specialActions', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                // 2024 runtime shape: playerStats.class.subclass is { name } only
                // (majors flattened by the collector into automation.specialActions).
                const automationShapeWarlock = {
                    ...mockPlayerStats,
                    level: 14,
                    abilities: [...mockPlayerStats.abilities, { name: 'Charisma', bonus: 3 }],
                    class: { subclass: { name: 'Great Old One Patron' } },
                    automation: {
                        specialActions: [{ type: 'create_thrall', name: 'Create Thrall', spell: 'Summon Aberration' }],
                        passives: [
                            { type: 'create_thrall_temp_hp', name: 'Create Thrall' },
                            { type: 'attack_rider', trigger: 'companion_aberration_hit', damageExpression: '1d6', damageType: 'Psychic', oncePerTurn: true },
                        ],
                    },
                };

                await confirmSummonSpirit(makeAberrantAction({ spell: { level: 4, duration: 'Concentration, up to 1 hour', concentration: true } }), automationShapeWarlock, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Aberrant Spirit (Mind Flayer)'));
                expect(added).toBeDefined();
                // modifications apply: rider row + rider transport on attack rows
                expect(added.actions.map(a => a.name)).toEqual(['Psychic Slam', 'Psychic Strike']);
                expect(added.actions[0].thrall_hex_rider).toBe(true);
                expect(added.actions[0].thrall_hex_bonus).toEqual({ expression: '1d6', damageType: 'Psychic' });
                // createThrall flag conditional on the gate (not unconditional stamp)
                expect(added.createThrall).toBe(true);
                // no caster concentration, 1-minute clock
                expect(addConcentration).not.toHaveBeenCalled();
                expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({ rounds: 10 }));
                // THP = warlock level + CHA modifier = 14 + 3 = 17
                expect(setTempHpOnKey).toHaveBeenCalledWith('Aberrant Spirit (Mind Flayer) 1', 'tempHp', 17, mockCampaignName);
            });

            it('CLA-066 non-thrall caster: createThrall flag stays false, no rider transport', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAberrantAction(), mockPlayerStats, mockCampaignName, 'Aberrant Spirit (Mind Flayer)');

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Aberrant Spirit (Mind Flayer)'));
                expect(added.createThrall).toBe(false);
                expect(added.actions.map(a => a.name)).toEqual(['Psychic Slam']);
                expect(added.actions[0].thrall_hex_rider).toBeUndefined();
            });

            it('CLA-066 resolveCreateThrallRiderHit: rider fires once per turn on hexed target, second hit same round refused', async () => {
                const store = {};
                getRuntimeValue.mockImplementation((entity, key) => {
                    if (entity === 'campaign' && key === 'targetEffects') return store.targetEffects;
                    return store[`${entity}.${key}`];
                });
                setRuntimeValue.mockImplementation((entity, key, value) => { store[`${entity}.${key}`] = value; });
                store.targetEffects = [{ target: 'Goblin 1', effect: 'hex_ability_check_disadvantage', source: 'HexWarlock' }];
                getCombatSummary.mockReturnValue({ creatures: [] });

                const rollDamage = vi.fn().mockResolvedValue({});
                const { rollExpression } = await import('../../../dice/diceRoller.js');
                rollExpression.mockReset().mockReturnValue({ total: 4, rolls: [4] });

                const autoDamage = {
                    name: 'Psychic Slam',
                    targetName: 'Goblin 1',
                    thrallHexRider: true,
                    thrallHexBonus: { expression: '1d6', damageType: 'Psychic' },
                };

                const first = await resolveCreateThrallRiderHit({ campaignName: mockCampaignName, monsterName: 'Aberrant Spirit (Mind Flayer) 1', autoDamage, rollDamage });
                expect(first).toEqual({ total: 4, rolls: [4] });
                expect(rollDamage).toHaveBeenCalledTimes(1);
                expect(rollDamage.mock.calls[0][0]).toMatchObject({ formula: '1d6', total: 4, context: { damageType: 'Psychic', targetName: 'Goblin 1' } });

                // second hit same round — once-per-turn latch refuses, no second roll
                const second = await resolveCreateThrallRiderHit({ campaignName: mockCampaignName, monsterName: 'Aberrant Spirit (Mind Flayer) 1', autoDamage, rollDamage });
                expect(second).toBeNull();
                expect(rollDamage).toHaveBeenCalledTimes(1);
                expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({ automationType: 'create_thrall_refused' }));
                expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({ automationType: 'create_thrall_hex_bonus' }));
            });

            it('CLA-066 resolveCreateThrallRiderHit: un-hexed target pays zero rider', async () => {
                const store = { targetEffects: [] };
                getRuntimeValue.mockImplementation((entity, key) => {
                    if (entity === 'campaign' && key === 'targetEffects') return store.targetEffects;
                    return store[`${entity}.${key}`];
                });
                setRuntimeValue.mockImplementation((entity, key, value) => { store[`${entity}.${key}`] = value; });
                getCombatSummary.mockReturnValue({ creatures: [] });

                const rollDamage = vi.fn();
                const autoDamage = {
                    name: 'Psychic Slam',
                    targetName: 'Skeleton 1',
                    thrallHexRider: true,
                    thrallHexBonus: { expression: '1d6', damageType: 'Psychic' },
                };
                const result = await resolveCreateThrallRiderHit({ campaignName: mockCampaignName, monsterName: 'Aberrant Spirit (Mind Flayer) 1', autoDamage, rollDamage });
                expect(result).toBeNull();
                expect(rollDamage).not.toHaveBeenCalled();
            });

            it('CLA-066 resolveCreateThrallRiderHit: byte-inert without rider marker', async () => {
                const rollDamage = vi.fn();
                const result = await resolveCreateThrallRiderHit({ campaignName: mockCampaignName, monsterName: 'Goblin 1', autoDamage: { name: 'Bite', targetName: 'Goblin 2' }, rollDamage });
                expect(result).toBeNull();
                expect(rollDamage).not.toHaveBeenCalled();
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

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Land)'));
                expect(added.maxHp).toBe(15);
                expect(added.currentHp).toBe(15);
                expect(added.phantasmal).toBe(true);
                expect(added.spectral).toBe(true);
            });

            it('keeps full HP on a normal slotted cast even with the passive present', async () => {
                loadMonsters.mockResolvedValue(mockMonsters);
                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmSummonSpirit(makeAction({ metaCtx: { slotLevel: 2 } }), phantasmalPlayerStats, mockCampaignName, 'Bestial Spirit (Land)');

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Bestial Spirit (Land)'));
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

                    const added = combatSummary.creatures.find(c => c.name?.startsWith(variant.name));
                    expect(added).toBeDefined();
                    expect(added.ac).toBe(12);
                    expect(added.maxHp).toBe(30);
                    expect(added.summonedBy).toBe('TestCaster');
                    expect(added.monsterIndex).toBe(variant.monsterIndex);

                    const effect = getRuntimeValue('campaign', 'targetEffects').find(te => te.target?.startsWith(variant.name));
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

                const added = combatSummary.creatures.find(c => c.name?.startsWith('Fey Spirit (Trickster)'));
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

    describe('SP-005 zero-slot refusal + multi-cast uniqueness', () => {
        const aoAction = (metaCtx) => ({
            name: 'Animate Objects',
            automation: { type: 'summon_spirit', typeLabel: 'Animated Object', scale: false, variants: [{ name: 'Animated Object (Medium)', monsterIndex: 'animated-object-medium' }] },
            spell: { level: 5, duration: 'Concentration, up to 1 minute', concentration: true },
            metaCtx,
        });

        it('refuses a paid slot cast that failed to pay — popup + summon_refused, zero spawn, zero summons log', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);

            const result = await confirmSummonSpirit(aoAction({ slotConsumed: false }), mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('refused');
            expect(combatSummary.creatures.some(c => c.name?.startsWith('Animated Object'))).toBe(false);
            expect(addConcentration).not.toHaveBeenCalled();
            const summonsLogs = addEntry.mock.calls.filter(c => c[1]?.type === 'summons');
            expect(summonsLogs).toHaveLength(0);
            const refusalLogs = addEntry.mock.calls.filter(c => c[1]?.automationType === 'summon_refused');
            expect(refusalLogs).toHaveLength(1);
        });

        it('allows a paid slot cast (slotConsumed true) — spawns normally (PASS-safe)', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmSummonSpirit(aoAction({ slotConsumed: true }), mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');

            expect(combatSummary.creatures.some(c => c.name === 'Animated Object (Medium) 1')).toBe(true);
            expect(getRuntimeValue('campaign', 'targetEffects').some(te => te.target === 'Animated Object (Medium) 1')).toBe(true);
        });

        it('two same-variant casts get unique names + one te marker each (no collision, no te loss)', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmSummonSpirit(aoAction({ slotConsumed: true }), mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');
            await confirmSummonSpirit(aoAction({ slotConsumed: true }), mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');

            const names = combatSummary.creatures.filter(c => c.name?.startsWith('Animated Object (Medium)')).map(c => c.name);
            expect(names).toEqual(['Animated Object (Medium) 1', 'Animated Object (Medium) 2']);
            expect(new Set(names).size).toBe(2);

            const te = getRuntimeValue('campaign', 'targetEffects').filter(te => te.effect === 'summoned' && te.target?.startsWith('Animated Object (Medium)'));
            expect(te.map(t => t.target)).toEqual(['Animated Object (Medium) 1', 'Animated Object (Medium) 2']);
        });

        it('leaves a free cast (freeCastUsed) unrefused even when slotConsumed false', async () => {
            loadMonsters.mockResolvedValue(mockMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmSummonSpirit(aoAction({ slotConsumed: false, freeCastUsed: true }), mockPlayerStats, mockCampaignName, 'Animated Object (Medium)');

            expect(combatSummary.creatures.some(c => c.name?.startsWith('Animated Object'))).toBe(true);
        });
    });

    describe('MA-0465 "spell level" damage-token fold', () => {
        const avenger = summonFeyMonsters.find(m => m.index === 'celestial-spirit-avenger');
        const lv17Mods = { slotLevel: 5, spellAttackMod: 9, spellSaveDc: 17, wisModifier: 3, spellcastingModifier: 3 };

        it('folds "spell level" in damage_dice_primary to the slot level (disk row)', () => {
            expect(avenger.actions[0].damage_dice_primary).toBe('2d6+2+spell level');
            const [action] = resolveMonsterActions(avenger, lv17Mods);
            expect(action.damage_dice_primary).toBe('2d6+2+5');
            expect(action.description).toContain('2d6+2+5');
        });

        it('folds "spell level" at an upcast slot level', () => {
            const [action] = resolveMonsterActions(avenger, { ...lv17Mods, slotLevel: 6 });
            expect(action.damage_dice_primary).toBe('2d6+2+6');
        });

        it('MA-0466: folds "spell level" on Defender Radiant Mace disk row to the slot level', () => {
            const defender = summonFeyMonsters.find(m => m.index === 'celestial-spirit-defender');
            expect(defender.actions[0].damage_dice_primary).toBe('1d10+3+spell level');
            const [action] = resolveMonsterActions(defender, lv17Mods);
            expect(action.damage_dice_primary).toBe('1d10+3+5');
            expect(action.description).toContain('1d10+3+5');
            expect(action.attack_bonus).toBe(9);
        });

        it('folds "spell level" in damage_dice_secondary too', () => {
            const monster = { actions: [{
                name: 'Twin Strike',
                description: 'Hit: 2d6+2+spell level Radiant plus 1d6+spell level Fire damage.',
                attack_bonus: 9,
                damage_dice_primary: '2d6+spell level',
                damage_dice_secondary: '1d6+spell level',
            }] };
            const [action] = resolveMonsterActions(monster, lv17Mods);
            expect(action.damage_dice_primary).toBe('2d6+5');
            expect(action.damage_dice_secondary).toBe('1d6+5');
        });

        it('leaves token-free damage rows byte-unchanged', () => {
            const monster = { actions: [{
                name: 'Slam',
                description: 'Melee Weapon Attack: reach 5 ft. Hit: 1d8+2 bludgeoning damage.',
                attack_bonus: 5,
                damage_dice_primary: '1d8+2',
                damage_dice_secondary: null,
            }] };
            const [action] = resolveMonsterActions(monster, lv17Mods);
            expect(action.damage_dice_primary).toBe('1d8+2');
            expect(action.description).toBe('Melee Weapon Attack: reach 5 ft. Hit: 1d8+2 bludgeoning damage.');
        });

        it('still folds null attack_bonus to the caster spell attack modifier (+9 lv17 WIS+3 PB+6)', () => {
            const [action] = resolveMonsterActions(avenger, lv17Mods);
            expect(avenger.actions[0].attack_bonus).toBeNull();
            expect(action.attack_bonus).toBe(9);
        });

        it('end-to-end: summoned Avenger combatant carries rolled damage formula', async () => {
            loadMonsters.mockResolvedValue(summonFeyMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const lv17Cleric = {
                ...mockPlayerStats,
                level: 17,
                proficiency: 6,
                spellAbilities: { toHit: 9, saveDc: 17, modifier: 3 },
            };
            const action = {
                name: 'Summon Celestial',
                automation: {
                    type: 'summon_spirit',
                    typeLabel: 'Celestial Spirit',
                    baseLevel: 5,
                    hpPerLevelAbove: 10,
                    variants: [{ name: 'Celestial Spirit (Avenger)', monsterIndex: 'celestial-spirit-avenger' }],
                },
                spell: { level: 5, duration: 'Concentration, up to 1 hour', concentration: true },
            };

            await confirmSummonSpirit(action, lv17Cleric, mockCampaignName, 'Celestial Spirit (Avenger)');

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Celestial Spirit (Avenger)'));
            expect(added.actions[0].damage_dice_primary).toBe('2d6+2+5');
            expect(added.actions[0].attack_bonus).toBe(9);
        });
    });

    describe('MA-0467 reaction dice fold (Healing Touch)', () => {
        const defender = summonFeyMonsters.find(m => m.index === 'celestial-spirit-defender');
        const lv17Mods = { slotLevel: 5, spellAttackMod: 9, spellSaveDc: 17, wisModifier: 3, spellcastingModifier: 3 };

        it('folds Defender reactions[0] slot5 disk row "2d8+spell level" → "2d8+5"', () => {
            expect(defender.reactions[0].name).toBe('Healing Touch');
            expect(defender.reactions[0].damage_dice_primary).toBe('2d8+spell level');
            const [reaction] = resolveMonsterReactions(defender, lv17Mods);
            expect(reaction.damage_dice_primary).toBe('2d8+5');
            expect(reaction.description).toContain('2d8+5');
        });

        it('folds at upcast slot levels too', () => {
            const [reaction] = resolveMonsterReactions(defender, { ...lv17Mods, slotLevel: 7 });
            expect(reaction.damage_dice_primary).toBe('2d8+7');
        });

        it('never backfills attack_bonus/save_dc on reaction rows (no false auto-hit affordance); automation + At Will sentinel ride byte-shape', () => {
            const [reaction] = resolveMonsterReactions(defender, lv17Mods);
            expect(reaction.attack_bonus).toBeNull();
            expect(reaction.automation).toEqual(defender.reactions[0].automation);
            expect(reaction.usage).toBe('At Will');
            expect(reaction.uses).toBe(999);
            expect(reaction.maxUses).toBe(999);
        });

        it('empty/missing reactions fold to [] without crashing', () => {
            expect(resolveMonsterReactions({}, lv17Mods)).toEqual([]);
            expect(resolveMonsterReactions({ reactions: [] }, lv17Mods)).toEqual([]);
        });

        it('end-to-end: summoned Defender combatant carries the folded live heal reaction', async () => {
            loadMonsters.mockResolvedValue(summonFeyMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const lv17Cleric = {
                ...mockPlayerStats,
                level: 17,
                proficiency: 6,
                spellAbilities: { toHit: 9, saveDc: 17, modifier: 3 },
            };
            const action = {
                name: 'Summon Celestial',
                automation: {
                    type: 'summon_spirit',
                    typeLabel: 'Celestial Spirit',
                    baseLevel: 5,
                    hpPerLevelAbove: 10,
                    variants: [{ name: 'Celestial Spirit (Defender)', monsterIndex: 'celestial-spirit-defender' }],
                },
                spell: { level: 5, duration: 'Concentration, up to 1 hour', concentration: true },
            };

            await confirmSummonSpirit(action, lv17Cleric, mockCampaignName, 'Celestial Spirit (Defender)');

            const added = combatSummary.creatures.find(c => c.name?.startsWith('Celestial Spirit (Defender)'));
            expect(added.reactions).toHaveLength(1);
            expect(added.reactions[0].name).toBe('Healing Touch');
            expect(added.reactions[0].damage_dice_primary).toBe('2d8+5');
            expect(added.reactions[0].automation).toMatchObject({ type: 'reaction', trigger: 'touch', effect: 'heal' });
        });
    });

    describe('MA-0516 Berserk Lashing fold (Construct Spirit (Clay))', () => {
        const clay = summonFeyMonsters.find(m => m.index === 'construct-spirit-clay');
        const lv20Mods = { slotLevel: 5, spellAttackMod: 11, spellSaveDc: 19, wisModifier: 0, spellcastingModifier: 5 };

        it('disk reactions[0] carries the gated attack automation + At Will sentinel (MA-0341 byte-shape)', () => {
            expect(clay.reactions[0].name).toBe('Berserk Lashing');
            expect(clay.reactions[0].automation).toMatchObject({ type: 'reaction', trigger: 'damage_taken', effect: 'attack', attack: 'Slam' });
            expect(clay.reactions[0].usage).toBe('At Will');
            expect(clay.reactions[0].attack_bonus).toBeNull();
        });

        it('fold carries automation byte-shape AND the Slam action row folds attack_bonus + dice for the lashing route', () => {
            const [reaction] = resolveMonsterReactions(clay, lv20Mods);
            expect(reaction.automation).toEqual(clay.reactions[0].automation);
            expect(reaction.attack_bonus).toBeNull();
            const [slam] = resolveMonsterActions(clay, lv20Mods);
            expect(slam.attack_bonus).toBe(11);
            expect(slam.damage_dice_primary).toBe('1d8+4+5');
        });

        it('end-to-end: summoned Clay combatant carries the gated lashing reaction + folded Slam', async () => {
            loadMonsters.mockResolvedValue(summonFeyMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const lv20Wizard = {
                ...mockPlayerStats,
                level: 20,
                proficiency: 6,
                spellAbilities: { toHit: 11, saveDc: 19, modifier: 5 },
            };
            const action = {
                name: 'Summon Construct',
                automation: {
                    type: 'summon_spirit',
                    typeLabel: 'Construct Spirit',
                    baseLevel: 4,
                    hpPerLevelAbove: 5,
                    variants: [{ name: 'Construct Spirit (Clay)', monsterIndex: 'construct-spirit-clay' }],
                },
                spell: { level: 4, duration: 'Concentration, up to 1 hour', concentration: true },
            };
            await confirmSummonSpirit(action, lv20Wizard, mockCampaignName, 'Construct Spirit (Clay)');
            const added = combatSummary.creatures.find(c => c.name?.startsWith('Construct Spirit (Clay)'));
            expect(added.reactions[0].automation).toMatchObject({ effect: 'attack', attack: 'Slam' });
            expect(added.actions[0].attack_bonus).toBe(11);
            expect(added.actions[0].damage_dice_primary).toBe('1d8+4+4');
        });
    });

    describe('SP-038 Draconic Spirit AC ladder (armor_class_scales_with_slot)', () => {
        const draconicSpell = summonFeySpells.find(s => s.index === 'draconic-spirit');
        const draconic = summonFeyMonsters.find(m => m.index === 'draconic-spirit');

        it('spells.json RAW says "AC 14 + the spell\'s level" and routes to the draconic-spirit block', () => {
            expect(draconicSpell.description.join(' ')).toContain('AC 14 + the spell\'s level');
            expect(draconicSpell.automation).toMatchObject({ type: 'summon_spirit', baseLevel: 5, hpPerLevelAbove: 10 });
            expect(draconicSpell.automation.variants).toEqual([{ name: 'Draconic Spirit', monsterIndex: 'draconic-spirit' }]);
        });

        it('monsters.json draconic-spirit block carries the AC ladder opt-in (SP-015 byte-twin of bestial-spirit-*)', () => {
            expect(draconic.armor_class).toBe(14);
            expect(draconic.armor_class_scales_with_slot).toBe(true);
        });

        it('lv5 cast spawns AC 19 / HP 50 and lv6 upcast spawns AC 20 / HP 60', async () => {
            loadMonsters.mockResolvedValue(summonFeyMonsters);
            const combatSummary = getCombatSummary(mockCampaignName);
            const lv20Wizard = {
                ...mockPlayerStats,
                level: 20,
                proficiency: 6,
                spellAbilities: { toHit: 11, saveDc: 19, modifier: 5 },
            };
            const action = {
                name: 'Draconic Spirit',
                automation: draconicSpell.automation,
                spell: { ...draconicSpell },
                metaCtx: { slotLevel: 5 },
            };
            await handle(action, lv20Wizard, mockCampaignName);
            const lv5 = combatSummary.creatures.find(c => c.name?.startsWith('Draconic Spirit'));
            expect(lv5.ac).toBe(19);  // armor_class 14 + slot 5
            expect(lv5.maxHp).toBe(50);

            const lv6CombatSummary = getCombatSummary(mockCampaignName);
            await handle({ ...action, metaCtx: { slotLevel: 6 } }, lv20Wizard, mockCampaignName);
            const lv6 = lv6CombatSummary.creatures.filter(c => c.name?.startsWith('Draconic Spirit')).at(-1);
            expect(lv6.ac).toBe(20);  // armor_class 14 + slot 6
            expect(lv6.maxHp).toBe(60); // 50 + 10×(6−5)
        });
    });
});
