// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { handle, confirmPrimalCompanionSummon, handleCommand, handleRestore, handleBonusActionCommand, applyBonusActionCommand, resolveBestialFuryStrikeGate, resolveBestialFuryMarkStrike, resolveBestialFuryBonus, BESTIAL_FURY_STRIKES_KEY, BESTIAL_FURY_MARK_LATCH_KEY } from './primalCompanionHandler.js';

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

vi.mock('../../../encounters/encounterToInitiative.js', () => ({
    getMonsterSaveBonuses: vi.fn().mockImplementation((monster) => {
        const map = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
        const bonuses = {};
        for (const [abbr] of Object.entries(map)) {
            if (monster.saving_throws?.[abbr]?.modifier != null) {
                bonuses[abbr] = monster.saving_throws[abbr].modifier;
            } else {
                bonuses[abbr] = 0;
            }
        }
        return bonuses;
    }),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

describe('primalCompanionHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockPlayerStats = {
        name: 'TestRanger',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        spellAbilities: { toHit: 6, saveDc: 13, modifier: 3 },
    };
    const mockCampaignName = 'test-campaign';

    function makeAction(overrides = {}) {
        return {
            name: 'Primal Companion',
            automation: {
                type: 'primal_companion_summon',
                companionTypes: mockCompanionTypes,
                ...overrides.automation,
            },
            ...overrides,
        };
    }

    const mockMonsters = [
        {
            index: 'primal-companion-beast-of-the-sky', name: 'Primal Companion (Beast of the Sky)', type: 'beast',
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
            index: 'primal-companion-beast-of-the-land', name: 'Primal Companion (Beast of the Land)', type: 'beast',
            armor_class: 11, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 4 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: -3 }, wis: { modifier: 2 }, cha: { modifier: -3 } },
            actions: [
                {
                    name: "Beast's Strike",
                    description: 'Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d8+2+WIS modifier Bludgeoning/Piercing/Slashing damage.',
                    attack_bonus: null,
                    reach: '5 ft.',
                    damage_dice_primary: '1d8+2+WIS modifier',
                    damage_type_primary: 'bludgeoning/piercing/slashing',
                },
                {
                    name: "Beast's Strike — Charge",
                    description: 'The beast charges forward 20 ft. The target must succeed on a DC 20 Strength saving throw or be knocked prone.',
                    save_dc: 20,
                    save_type: 'Str',
                },
            ],
        },
        {
            index: 'primal-companion-beast-of-the-sea', name: 'Primal Companion (Beast of the Sea)', type: 'beast',
            armor_class: 11, hit_points: 30, damage_resistances: [], damage_immunities: [], immunities: [],
            saving_throws: { str: { modifier: 4 }, dex: { modifier: 0 }, con: { modifier: 3 }, int: { modifier: -3 }, wis: { modifier: 2 }, cha: { modifier: -3 } },
            actions: [
                {
                    name: "Beast's Strike",
                    description: 'Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d6+2+WIS modifier Bludgeoning or Piercing damage (your choice), and the target has the Grappled condition (escape DC = 8 + Proficiency Bonus + WIS modifier).',
                    attack_bonus: null,
                    reach: '5 ft.',
                    damage_dice_primary: '1d6+2+WIS modifier',
                    damage_type_primary: 'bludgeoning/piercing',
                    hit_conditions: ['grappled'],
                },
                {
                    name: "Beast's Strike — Grapple",
                    description: 'The beast lunges to grapple the target. The target must succeed on a DC 20 Wisdom saving throw or become grappled.',
                    save_dc: 20,
                    save_type: 'Wis',
                },
            ],
        },
    ];

    const mockCompanionTypes = [
        { name: 'Beast of the Land', size: 'Medium', hpBase: 5, hpPerLevel: 5, speed: '40 ft', specialSpeed: 'climb 40 ft', attacks: [{ name: "Beast's Strike", damageDice: '1d8', damageFlat: '2 + WIS modifier', damageType: 'Bludgeoning/Piercing/Slashing' }] },
        { name: 'Beast of the Sea', size: 'Medium', hpBase: 5, hpPerLevel: 5, speed: '5 ft', specialSpeed: 'swim 60 ft', attacks: [{ name: "Beast's Strike", damageDice: '1d6', damageFlat: '2 + WIS modifier', damageType: 'Bludgeoning/Piercing', onHit: 'grappled' }] },
        { name: 'Beast of the Sky', size: 'Small', hpBase: 4, hpPerLevel: 4, speed: '10 ft', specialSpeed: 'fly 60 ft', attacks: [{ name: "Beast's Strike", damageDice: '1d4', damageFlat: '3 + WIS modifier', damageType: 'Slashing' }] },
    ];

    describe('handle (summon)', () => {
        it('returns modal when no companion is summoned', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({
                automation: {
                    type: 'primal_companion_summon',
                    action: 'bonus_action',
                    casting_time: '1 bonus action',
                    companionTypes: [],
                },
            });

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('primalCompanionSummon');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(mockPlayerStats);
            expect(result.payload.campaignName).toBe(mockCampaignName);
        });

        it('returns popup with companion info when companion is already summoned', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Primal Companion (Beast of the Land)' }] });

            const action = makeAction();

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.automationType).toBe('primal_companion_summon');
            expect(result.payload.description).toContain('Beast of the Land');
            expect(result.payload.automation).toBe(action.automation);
        });

        it('returns summon modal when companion type stored but not in combat', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestRanger' }] });

            const action = makeAction();

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('primalCompanionSummon');
        });
    });

    describe('confirmPrimalCompanionSummon', () => {
        beforeEach(() => {
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') return [];
                return null;
            });
        });

        it('returns error when no type selected', async () => {
            const action = makeAction();

            const result = await confirmPrimalCompanionSummon(action, mockPlayerStats, mockCampaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.description).toBe('No companion type selected.');
            expect(result.payload.automation).toBe(action.automation);
        });

        it('returns error when unknown type selected', async () => {
            const action = makeAction();

            const result = await confirmPrimalCompanionSummon(action, mockPlayerStats, mockCampaignName, 'Unknown Type');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.description).toContain('Unknown companion type');
        });

        it('returns error when combat summary is unavailable', async () => {
            getCombatSummary.mockReturnValue(null);
            const action = makeAction();

            const result = await confirmPrimalCompanionSummon(action, mockPlayerStats, mockCampaignName, 'Beast of the Land');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.description).toBe('Failed to load combat summary.');
        });

        it('returns error when monster data not found', async () => {
            getCombatSummary.mockReturnValue({ creatures: [] });
            loadMonsters.mockResolvedValue([]);
            const action = makeAction();

            const result = await confirmPrimalCompanionSummon(action, mockPlayerStats, mockCampaignName, 'Beast of the Land');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.description).toContain('Failed to load');
        });

        it('creates creature and returns success popup when type is valid', async () => {
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestRanger', initiative: '15', initiativeBonus: 2 }] });
            loadMonsters.mockResolvedValue(mockMonsters);

            const action = makeAction();

            const result = await confirmPrimalCompanionSummon(action, mockPlayerStats, mockCampaignName, 'Beast of the Land');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.automationType).toBe('primal_companion_summon');
            expect(result.payload.description).toContain('Beast of the Land');
            expect(result.payload.description).toContain('right after you');

            expect(setRuntimeValue).toHaveBeenCalledWith('TestRanger', 'primalCompanionType', 'Beast of the Land', mockCampaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRanger', 'primalCompanionAlive', true, mockCampaignName);
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), mockCampaignName);
            expect(addEntry).toHaveBeenCalled();
            expect(result.logEntries).toHaveLength(1);
            expect(result.logEntries[0].type).toBe('summons');

            const summonedCreature = storage.set.mock.calls[0][1].creatures.find(c => c.name === 'Primal Companion (Beast of the Land)');
            expect(summonedCreature).toBeDefined();
            expect(summonedCreature.ac).toBe(16);
            expect(summonedCreature.maxHp).toBe(30);
            expect(summonedCreature.currentHp).toBe(30);
            expect(summonedCreature.size).toBe('Medium');
            expect(summonedCreature.speed.walk).toBe('40 ft');
            expect(summonedCreature.speed.climb).toBe('climb 40 ft');
            expect(summonedCreature.saveBonuses.str).toBe(7);
            expect(summonedCreature.saveBonuses.dex).toBe(3);
            expect(summonedCreature.saveBonuses.con).toBe(6);
            expect(summonedCreature.saveBonuses.wis).toBe(5);
            expect(summonedCreature.actions[0].name).toBe("Beast's Strike");
            expect(summonedCreature.actions[0].attack_bonus).toBe(6);
            expect(summonedCreature.actions[0].damage_dice_primary).toBe('1d8+2+3');
            expect(summonedCreature.actions[0].damage_type_primary).toBe('bludgeoning/piercing/slashing');
            // MA-1344 byte-inert: rows without authored hit_conditions never gain escape_dc.
            expect(summonedCreature.actions[0].hit_conditions).toBeUndefined();
            expect(summonedCreature.actions[0].escape_dc).toBeUndefined();
            expect(summonedCreature.actions[0].description).toContain('1d8+2+3');
            expect(summonedCreature.actions[0].description).toContain('+6');
            expect(summonedCreature.actions.length).toBe(3);
            expect(summonedCreature.actions[1].name).toBe("Beast's Strike — Charge");
            expect(summonedCreature.actions[1].save_dc).toBe(13);
            expect(summonedCreature.actions[1].save_type).toBe('Str');
        });

        it('creates Beast of the Sea with correct stats', async () => {
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestRanger', initiative: '12', initiativeBonus: 1 }] });
            loadMonsters.mockResolvedValue(mockMonsters);

            const action = makeAction();

            const result = await confirmPrimalCompanionSummon(action, mockPlayerStats, mockCampaignName, 'Beast of the Sea');

            expect(result.type).toBe('popup');

            const summonedCreature = storage.set.mock.calls[0][1].creatures.find(c => c.name === 'Primal Companion (Beast of the Sea)');
            expect(summonedCreature).toBeDefined();
            expect(summonedCreature.ac).toBe(16);
            expect(summonedCreature.maxHp).toBe(30);
            expect(summonedCreature.size).toBe('Medium');
            expect(summonedCreature.speed.swim).toBe('swim 60 ft');
            expect(summonedCreature.actions[0].name).toBe("Beast's Strike");
            expect(summonedCreature.actions[0].damage_dice_primary).toBe('1d6+2+3');
            expect(summonedCreature.actions[0].damage_type_primary).toBe('bludgeoning/piercing');
            // MA-1344: hit_conditions passthrough + caster-folded escape DC (8 + PB 3 + WIS 3).
            expect(summonedCreature.actions[0].hit_conditions).toEqual(['grappled']);
            expect(summonedCreature.actions[0].escape_dc).toBe(14);
            expect(summonedCreature.actions[0].description).toContain('escape DC = 8 + Proficiency Bonus + 3');
            expect(summonedCreature.actions.length).toBe(3);
            expect(summonedCreature.actions[1].name).toBe("Beast's Strike — Grapple");
            expect(summonedCreature.actions[1].save_dc).toBe(13);
            expect(summonedCreature.actions[1].save_type).toBe('Wis');
            expect(summonedCreature.actions[1].escape_dc).toBeUndefined();
        });

        it('creates Beast of the Sky with correct stats', async () => {
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestRanger', initiative: '18', initiativeBonus: 0 }] });
            loadMonsters.mockResolvedValue(mockMonsters);

            const action = makeAction();

            const result = await confirmPrimalCompanionSummon(action, mockPlayerStats, mockCampaignName, 'Beast of the Sky');

            expect(result.type).toBe('popup');

            const summonedCreature = storage.set.mock.calls[0][1].creatures.find(c => c.name === 'Primal Companion (Beast of the Sky)');
            expect(summonedCreature).toBeDefined();
            expect(summonedCreature.ac).toBe(16);
            expect(summonedCreature.maxHp).toBe(24);
            expect(summonedCreature.size).toBe('Small');
            expect(summonedCreature.speed.fly).toBe('fly 60 ft');
            expect(summonedCreature.actions[0].name).toBe("Beast's Strike");
            expect(summonedCreature.actions[0].damage_dice_primary).toBe('1d8+2+3');
            expect(summonedCreature.actions[0].damage_type_primary).toBe('piercing');
            expect(summonedCreature.actions[0].hit_conditions).toBeUndefined();
            expect(summonedCreature.actions[0].escape_dc).toBeUndefined();
            expect(summonedCreature.actions.length).toBe(2);
        });
    });

    describe('handleCommand', () => {
        it('returns popup with companion and command info when companion exists', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sky');

            const action = makeAction({
                automation: { type: 'primal_companion_command', commandType: 'beasts_strike' },
            });

            const result = await handleCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.automationType).toBe('primal_companion_command');
            expect(result.payload.description).toContain('Beast of the Sky');
            expect(result.payload.description).toContain("Beast's Strike");
            expect(result.payload.automation).toBe(action.automation);
        });

        it('includes Bestial Fury note when player has the feature', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const playerStatsWithFeature = {
                name: 'TestRanger',
                class: {
                    class_levels: [
                        { features: [{ name: 'Extra Attack' }, { name: 'Bestial Fury' }] },
                    ],
                },
            };

            const result = await handleCommand(action, playerStatsWithFeature, mockCampaignName);

            expect(result.payload.description).toContain("Bestial Fury: beast attacks twice!");
        });

        it('includes Bestial Fury note from subclass levels', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sea');

            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const playerStatsWithSubclassFeature = {
                name: 'TestRanger',
                class: {
                    class_levels: [{ features: [{ name: 'Extra Attack' }] }],
                    subclass: {
                        class_levels: [{ features: [{ name: 'Bestial Fury' }] }],
                    },
                },
            };

            const result = await handleCommand(action, playerStatsWithSubclassFeature, mockCampaignName);

            expect(result.payload.description).toContain("Bestial Fury: beast attacks twice!");
        });

        it('omits Bestial Fury note when player lacks the feature', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const playerStatsNoFeature = {
                name: 'TestRanger',
                class: {
                    class_levels: [{ features: [{ name: 'Extra Attack' }] }],
                },
            };

            const result = await handleCommand(action, playerStatsNoFeature, mockCampaignName);

            expect(result.payload.description).not.toContain('Bestial Fury');
            expect(result.payload.description).toContain("Beast's Strike");
        });

        it('returns error when no companion is summoned', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const result = await handleCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.description).toBe('No primal companion summoned.');
            expect(result.payload.automation).toBe(action.automation);
        });
    });

    describe('handleRestore', () => {
        it('restores companion and returns success popup', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({
                automation: { type: 'primal_companion_restore', spellSlotCost: true },
            });

            const result = await handleRestore(action, mockPlayerStats, mockCampaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRanger',
                'primalCompanionAlive',
                true,
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.automationType).toBe('primal_companion_restore');
            expect(result.payload.description).toContain('Beast of the Land');
            expect(result.payload.description).toContain('restored with full HP');
            expect(result.payload.automation).toBe(action.automation);
        });

        it('returns error when no companion to restore', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { type: 'primal_companion_restore' } });

            const result = await handleRestore(action, mockPlayerStats, mockCampaignName);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.description).toBe('No primal companion to restore.');
            expect(result.payload.automation).toBe(action.automation);
        });
    });

    describe('handleBonusActionCommand', () => {
        it('returns modal with companion info when companion exists', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: true },
            });

            const result = await handleBonusActionCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('primalCompanionBonusActionCommand');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(mockPlayerStats);
            expect(result.payload.campaignName).toBe(mockCampaignName);
            expect(result.payload.companionType).toBe('Beast of the Land');
        });

        it('returns error popup when no companion is summoned', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command' },
            });

            const result = await handleBonusActionCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Exceptional Training');
            expect(result.payload.description).toBe('No primal companion to command.');
            expect(result.payload.automation).toBe(action.automation);
        });
    });

    describe('applyBonusActionCommand', () => {
        it('returns success popup with selected action when companion exists', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: true },
            });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Dash', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Exceptional Training');
            expect(result.payload.automationType).toBe('primal_companion_bonus_action_command');
            expect(result.payload.description).toContain('Beast of the Land');
            expect(result.payload.description).toContain('Dash');
            expect(result.payload.description).not.toContain('Force');
            expect(result.payload.automation).toBe(action.automation);
        });

        it('includes Force damage note when useForceDamage is true and option is available', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sea');

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: true },
            });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Dodge', true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Force damage');
            expect(result.payload.description).toContain('instead of its normal damage type');
        });

        it('omits Force damage note when useForceDamage is true but option is not available', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sky');

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: false },
            });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Help', true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('Force damage');
        });

        it('returns error when no companion is summoned', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command' },
            });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Dash', false);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Exceptional Training');
            expect(result.payload.description).toBe('No primal companion to command.');
            expect(result.payload.automation).toBe(action.automation);
        });

        it('returns error when invalid action selected', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sky');

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command' },
            });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'InvalidAction', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Exceptional Training');
            expect(result.payload.description).toBe('No action selected.');
            expect(result.payload.automation).toBe(action.automation);
        });

    });

    // CLA-036 — Bestial Fury: double-strike economy + Hunter's Mark extra-Force rider.
    describe('CLA-036 Bestial Fury lanes', () => {
        const furyPlayerStats = {
            name: 'TestRanger',
            level: 11,
            proficiency: 3,
            abilities: [{ name: 'Wisdom', bonus: 3 }],
            spellAbilities: { toHit: 9, saveDc: 16 },
            class: {
                name: 'Ranger',
                major: {
                    name: 'Beast Master',
                    features: [{
                        name: 'Bestial Fury',
                        automation: [
                            { type: 'primal_companion_double_strike', casting_time: 'passive' },
                            { type: 'primal_companion_double_strike_damage', trigger: 'companion_beasts_strike_hit', damageExpression: '1d6', damageType: 'Force', oncePerTurn: true },
                        ],
                    }],
                },
            },
        };
        let runtimeStore;
        let currentRound;

        beforeEach(() => {
            runtimeStore = {};
            currentRound = 1;
            getCombatSummary.mockReset();
            getCurrentCombatRound.mockImplementation(() => currentRound);
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') return [];
                const bag = runtimeStore[scope] || {};
                return bag[key] ?? null;
            });
            setRuntimeValue.mockImplementation(async (scope, key, value) => {
                runtimeStore[scope] = runtimeStore[scope] || {};
                runtimeStore[scope][key] = value;
            });
            addEntry.mockResolvedValue({});
        });

        const furyStrikeAction = () => ({
            name: "Beast's Strike",
            attack_bonus: 9,
            damage_dice_primary: '1d8+2+3',
            damage_type_primary: 'Force',
            bestial_fury_double_strike: true,
            bestial_fury_bonus: { expression: '1d6', damageType: 'Force' },
        });

        describe('resolveBestialFuryBonus', () => {
            it('reads the app-data 1d6 Force automation expression', () => {
                expect(resolveBestialFuryBonus(furyPlayerStats)).toEqual({ expression: '1d6', damageType: 'Force' });
            });

            it('falls back to 1d6 Force without the feature', () => {
                expect(resolveBestialFuryBonus({ name: 'X' })).toEqual({ expression: '1d6', damageType: 'Force' });
            });
        });

        describe('summon stamps', () => {
            it('Fury summon arms the strike gate + rider transport with provenance', async () => {
                getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestRanger', initiative: '12' }] });
                loadMonsters.mockResolvedValue(mockMonsters);

                await confirmPrimalCompanionSummon(makeAction(), furyPlayerStats, mockCampaignName, 'Beast of the Land');

                const cs = storage.set.mock.calls[0][1];
                const companion = cs.creatures.find(c => c.name === 'Primal Companion (Beast of the Land)');
                expect(companion.summonedBy).toBe('TestRanger');
                expect(companion.bestialFury).toBe(true);
                const strike = companion.actions.find(a => a.name === "Beast's Strike");
                expect(strike.bestial_fury_double_strike).toBe(true);
                expect(strike.bestial_fury_bonus).toEqual({ expression: '1d6', damageType: 'Force' });
                // Save-row twin stays byte-inert (Charge never passes the attack-chip gate).
                const charge = companion.actions.find(a => a.name === "Beast's Strike — Charge");
                expect(charge.bestial_fury_double_strike).toBeUndefined();
                expect(charge.bestial_fury_bonus).toBeUndefined();
            });

            it('non-Fury summon stays byte-inert (no stamps)', async () => {
                getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestRanger', initiative: '12' }] });
                loadMonsters.mockResolvedValue(mockMonsters);

                await confirmPrimalCompanionSummon(makeAction(), mockPlayerStats, mockCampaignName, 'Beast of the Land');

                const cs = storage.set.mock.calls[0][1];
                const companion = cs.creatures.find(c => c.name === 'Primal Companion (Beast of the Land)');
                expect(companion.bestialFury).toBe(false);
                expect(companion.actions[0].bestial_fury_double_strike).toBeUndefined();
                expect(companion.actions[0].bestial_fury_bonus).toBeUndefined();
            });
        });

        describe('handleCommand arming', () => {
            it('Fury command arms the 2-strike counter + logs the grant', async () => {
                getRuntimeValue.mockImplementation((scope, key) => {
                    if (key === 'primalCompanionType') return 'Beast of the Land';
                    const bag = runtimeStore[scope] || {};
                    return bag[key] ?? null;
                });
                const action = makeAction({ automation: { type: 'primal_companion_command' } });

                const result = await handleCommand(action, furyPlayerStats, mockCampaignName);

                expect(result.payload.description).toContain('Bestial Fury: beast attacks twice!');
                expect(setRuntimeValue).toHaveBeenCalledWith('Primal Companion (Beast of the Land)', BESTIAL_FURY_STRIKES_KEY, { round: 1, used: 0 }, mockCampaignName);
                const grant = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'bestial_fury_command');
                expect(grant).toBeDefined();
                expect(grant.characterName).toBe('TestRanger');
            });

            it('non-Fury command writes no counter and logs no grant', async () => {
                getRuntimeValue.mockImplementation((scope, key) => {
                    if (key === 'primalCompanionType') return 'Beast of the Land';
                    const bag = runtimeStore[scope] || {};
                    return bag[key] ?? null;
                });
                const action = makeAction({ automation: { type: 'primal_companion_command' } });

                await handleCommand(action, mockPlayerStats, mockCampaignName);

                expect(setRuntimeValue).not.toHaveBeenCalledWith('Primal Companion (Beast of the Land)', BESTIAL_FURY_STRIKES_KEY, expect.anything(), mockCampaignName);
                expect(addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'bestial_fury_command')).toBeUndefined();
            });
        });

        describe('resolveBestialFuryStrikeGate (double-strike economy)', () => {
            const companion = 'Primal Companion (Beast of the Land)';

            it('is byte-inert for unstamped rows (zero write, zero log)', () => {
                const refused = resolveBestialFuryStrikeGate({
                    campaignName: mockCampaignName, monsterName: 'Bandit 1', action: { name: 'Scimitar', attack_bonus: 4 }, setPopupHtml: vi.fn(),
                });
                expect(refused).toBe(false);
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
            });

            it('allows exactly two strikes per command then refuses the third (zero roll)', () => {
                const setPopupHtml = vi.fn();
                const press = () => resolveBestialFuryStrikeGate({
                    campaignName: mockCampaignName, monsterName: companion, action: furyStrikeAction(), setPopupHtml,
                });

                expect(press()).toBe(false);
                expect(runtimeStore[companion][BESTIAL_FURY_STRIKES_KEY]).toEqual({ round: 1, used: 1 });
                expect(press()).toBe(false);
                expect(runtimeStore[companion][BESTIAL_FURY_STRIKES_KEY]).toEqual({ round: 1, used: 2 });

                expect(press()).toBe(true);
                expect(runtimeStore[companion][BESTIAL_FURY_STRIKES_KEY]).toEqual({ round: 1, used: 2 });
                expect(setPopupHtml).toHaveBeenCalled();
                const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'bestial_fury_refused');
                expect(refusal).toBeDefined();
                expect(refusal.characterName).toBe(companion);
            });

            it('command re-issue resets the counter mid-round for two fresh strikes', async () => {
                const press = () => resolveBestialFuryStrikeGate({
                    campaignName: mockCampaignName, monsterName: companion, action: furyStrikeAction(), setPopupHtml: vi.fn(),
                });
                press(); press();
                expect(press()).toBe(true);

                runtimeStore[companion][BESTIAL_FURY_STRIKES_KEY] = { round: 1, used: 0 };
                expect(press()).toBe(false);
                expect(runtimeStore[companion][BESTIAL_FURY_STRIKES_KEY]).toEqual({ round: 1, used: 1 });
            });

            it('round-wrap re-arms the counter (stale stamp reads fresh)', () => {
                runtimeStore[companion] = { [BESTIAL_FURY_STRIKES_KEY]: { round: 1, used: 2 } };
                currentRound = 2;
                const refused = resolveBestialFuryStrikeGate({
                    campaignName: mockCampaignName, monsterName: companion, action: furyStrikeAction(), setPopupHtml: vi.fn(),
                });
                expect(refused).toBe(false);
                expect(runtimeStore[companion][BESTIAL_FURY_STRIKES_KEY]).toEqual({ round: 2, used: 1 });
            });
        });

        describe('resolveBestialFuryMarkStrike (Hunter\'s Mark rider)', () => {
            const companion = 'Primal Companion (Beast of the Land)';
            let rollDamage;

            function seedBoard(target) {
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: companion, type: 'npc', summonedBy: 'TestRanger', bestialFury: true },
                        { name: 'TestRanger', type: 'player', concentration: target ? { spell: "Hunter's Mark", dc: 17, target } : null },
                        { name: 'Bandit 1', type: 'npc' },
                    ],
                });
            }

            const autoHit = (targetName = 'Bandit 1') => ({
                name: "Beast's Strike",
                formula: '1d8+2+3',
                total: 7,
                attackerName: companion,
                targetName,
                bestialFuryRider: true,
                bestialFuryBonus: { expression: '1d6', damageType: 'Force' },
            });

            beforeEach(() => {
                rollDamage = vi.fn().mockResolvedValue({});
            });

            it('is byte-inert when the auto-damage carries no Fury marker', async () => {
                seedBoard('Bandit 1');
                const res = await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: 'Bandit 1', autoDamage: { name: 'Scimitar', targetName: 'ElderPaladin' }, rollDamage });
                expect(res).toBeNull();
                expect(addEntry).not.toHaveBeenCalled();
                expect(rollDamage).not.toHaveBeenCalled();
            });

            it('first HIT under Hunter\'s Mark folds a separate 1d6 Force leg, logs trigger + grant, latches the round', async () => {
                seedBoard('Bandit 1');

                const res = await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: companion, autoDamage: autoHit(), rollDamage });

                const logs = addEntry.mock.calls.map(c => c[1]);
                const trigger = logs.find(e => e.automationType === 'companion_beasts_strike_hit');
                expect(trigger).toBeDefined();
                expect(trigger.characterName).toBe(companion);
                expect(res).not.toBeNull();
                expect(rollDamage).toHaveBeenCalledTimes(1);
                const leg = rollDamage.mock.calls[0][0];
                expect(leg.formula).toBe('1d6');
                expect(leg.context.damageType).toBe('Force');
                expect(leg.context.attackerName).toBe(companion);
                expect(leg.context.targetName).toBe('Bandit 1');
                expect(leg.name).toContain('Bestial Fury');
                expect(runtimeStore[companion][BESTIAL_FURY_MARK_LATCH_KEY]).toBe(1);
                expect(logs.find(e => e.automationType === 'bestial_fury_mark_bonus')).toBeDefined();
            });

            it('second HIT same turn: trigger still logs, rider gated off once per turn (no extra die)', async () => {
                seedBoard('Bandit 1');
                runtimeStore[companion] = { [BESTIAL_FURY_MARK_LATCH_KEY]: 1 };

                const res = await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: companion, autoDamage: autoHit(), rollDamage });

                expect(res).toBeNull();
                expect(rollDamage).not.toHaveBeenCalled();
                const logs = addEntry.mock.calls.map(c => c[1]);
                expect(logs.find(e => e.automationType === 'companion_beasts_strike_hit')).toBeDefined();
                expect(logs.find(e => e.automationType === 'bestial_fury_refused')).toBeDefined();
            });

            it('HIT on an unmarked target folds nothing (trigger logged, no refusal needed)', async () => {
                seedBoard('Bandit 1');
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: companion, summonedBy: 'TestRanger' },
                        { name: 'TestRanger', concentration: { spell: "Hunter's Mark", dc: 17, target: 'Bandit 1' } },
                        { name: 'Bandit 2', type: 'npc' },
                    ],
                });

                const res = await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: companion, autoDamage: autoHit('Bandit 2'), rollDamage });

                expect(res).toBeNull();
                expect(rollDamage).not.toHaveBeenCalled();
                const logs = addEntry.mock.calls.map(c => c[1]);
                expect(logs.find(e => e.automationType === 'companion_beasts_strike_hit')).toBeDefined();
                expect(logs.find(e => e.automationType === 'bestial_fury_mark_bonus')).toBeUndefined();
            });

            it('no Hunter\'s Mark concentration at all: trigger logged, zero fold', async () => {
                seedBoard(null);

                const res = await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: companion, autoDamage: autoHit(), rollDamage });

                expect(res).toBeNull();
                expect(rollDamage).not.toHaveBeenCalled();
                expect(addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'companion_beasts_strike_hit')).toBeDefined();
            });

            it('next round re-folds (stale latch)', async () => {
                seedBoard('Bandit 1');
                runtimeStore[companion] = { [BESTIAL_FURY_MARK_LATCH_KEY]: 1 };
                currentRound = 2;

                const res = await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: companion, autoDamage: autoHit(), rollDamage });

                expect(res).not.toBeNull();
                expect(rollDamage).toHaveBeenCalledTimes(1);
                expect(runtimeStore[companion][BESTIAL_FURY_MARK_LATCH_KEY]).toBe(2);
            });

            it('rolls the transported bonus expression (custom die respected)', async () => {
                seedBoard('Bandit 1');
                const auto = autoHit();
                auto.bestialFuryBonus = { expression: '2d6', damageType: 'Force' };

                await resolveBestialFuryMarkStrike({ campaignName: mockCampaignName, monsterName: companion, autoDamage: auto, rollDamage });

                expect(rollDamage.mock.calls[0][0].formula).toBe('2d6');
            });
        });
    });
});
