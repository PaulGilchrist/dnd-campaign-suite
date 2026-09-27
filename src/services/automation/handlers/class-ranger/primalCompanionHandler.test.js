// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { handle, confirmPrimalCompanionSummon, handleCommand, handleRestore, handleBonusActionCommand, applyBonusActionCommand } from './primalCompanionHandler.js';

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
import { getCombatSummary } from '../../../encounters/combatData.js';
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
});
