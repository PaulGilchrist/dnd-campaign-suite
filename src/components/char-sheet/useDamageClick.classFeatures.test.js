import { describe, it, expect, vi, beforeEach } from 'vitest';
import useDamageClick from './useDamageClick.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn(),
    evaluateAutoExpression: vi.fn(),
    hasTwoWeaponFighting: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../services/ui/logService.js';

const mockPlayerStats = {
    name: 'TestRogue',
    level: 17,
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 5 },
        { name: 'Wisdom', bonus: 2 },
    ],
    proficiency: 6,
    class: { name: 'Rogue', class_levels: [{ level: 17, sneak_attack_num_d6: 9 }] },
    automation: { actions: [], passives: [] },
};

const mockCampaignName = 'test-campaign';
const defaultRollResult = { total: 5, rolls: [5], modifier: 0 };

describe('useDamageClick - class features', () => {
    const mockSetPopupHtml = vi.fn();
    const mockRollDamage = vi.fn();
    const mockBuildCtx = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
    const mockBuildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
    const mockSetDamageTypeChoice = vi.fn();
    const mockSetDivineFuryChoice = vi.fn();
    const mockSetWeaponMasteryModal = vi.fn();
    const mockSetAttackRiderModal = vi.fn();
    const mockPendingDamageRef = { current: null };

    function UseDamageClick(overrides = {}) {
        const deps = {
            playerStats: mockPlayerStats,
            campaignName: mockCampaignName,
            mapName: null,
            popupHtml: null,
            setPopupHtml: mockSetPopupHtml,
            rollDamage: mockRollDamage,
            buildCtx: mockBuildCtx,
            buildCtxSync: mockBuildCtxSync,
            setDamageTypeChoice: mockSetDamageTypeChoice,
            setDivineFuryChoice: mockSetDivineFuryChoice,
            setWeaponMasteryModal: mockSetWeaponMasteryModal,
            setAttackRiderModal: mockSetAttackRiderModal,
            pendingDamageRef: mockPendingDamageRef,
            ...overrides,
        };
        return useDamageClick(deps);
    }

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue(defaultRollResult);
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
        addEntry.mockResolvedValue(undefined);
        getCombatContext.mockResolvedValue(null);
        getTargetFromAttacker.mockReturnValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        loadCombatSummary.mockResolvedValue(null);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 50 });
        mockBuildCtx.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockBuildCtxSync.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockSetPopupHtml.mockReset();
        mockPendingDamageRef.current = null;
    });

    async function tick() {
        await new Promise(r => setTimeout(r, 0));
    }

    describe('Assassinate', () => {
        it('applies first_round_sneak_attack_hit damage on round 1 before acting', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: false, type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getCurrentCombatRound.mockReturnValue(1);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'first_round_sneak_attack_hit', damageExpression: '2d6', damageType: 'Sneak Attack' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                expect.stringContaining('2d6[Sneak Attack]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not apply Assassinate if already acted this round', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: true, type: 'player' },
                ],
            });
            getCurrentCombatRound.mockReturnValue(1);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'first_round_sneak_attack_hit', damageExpression: '2d6', damageType: 'Sneak Attack' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                '1d8+5',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not apply Assassinate if not round 1', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: false, type: 'player' },
                ],
            });
            getCurrentCombatRound.mockReturnValue(2);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'first_round_sneak_attack_hit', damageExpression: '2d6', damageType: 'Sneak Attack' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                '1d8+5',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });
    });

    describe('Stealth Attack cost deduction', () => {
        it('reduces sneak attack dice by stealthAttackCost', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'stealthAttackCost') return 2;
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: false, type: 'player' },
                ],
            });
            getCurrentCombatRound.mockReturnValue(1);
            const stats = {
                ...mockPlayerStats,
                level: 1,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'first_round_sneak_attack_hit', damageExpression: '2d6', damageType: 'Sneak Attack' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(stats.class.class_levels[0].sneak_attack_num_d6).toBe(7);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', 'stealthAttackCost', 0, 'test-campaign');
        });
    });

    describe('Death Strike', () => {
        it('applies Death Strike effect on round 1 before acting', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: false, type: 'player' },
                    { name: 'Goblin King', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin King' });
            getCurrentCombatRound.mockReturnValue(1);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'first_round_sneak_attack_hit', damageExpression: '2d6', damageType: 'Sneak Attack' },
                        { type: 'attack_rider', trigger: 'first_round_sneak_attack_hit', saveType: 'CON', name: 'Death Strike', damageDoubled: true },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    effect: 'death_strike',
                    target: 'Goblin King',
                    source: 'Death Strike',
                    saveType: 'CON',
                }),
            ]), 'test-campaign');
        });
    });

    describe('Rend Mind', () => {
        it('applies Rend Mind effect when not already used', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: false, type: 'player' },
                    { name: 'Mind Flayer', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Mind Flayer' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'attack_rider', trigger: 'psychic_blade_sneak_attack_hit', saveType: 'WIS', name: 'Rend Mind', condition: 'stunned', duration: '1_minute', repeatingSave: true },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Mind Flayer',
                    source: 'Rend Mind',
                    condition: 'stunned',
                }),
            ]), 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_RendMind_Used', true, 'test-campaign');
        });

        it('resets Rend Mind if last long rest differs from current when already used', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_RendMind_Used') return true;
                if (key === '_LastLongRest') return 1;
                if (key === '_CurrentLongRest') return 2;
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: false, type: 'player' },
                    { name: 'Mind Flayer', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Mind Flayer' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'attack_rider', trigger: 'psychic_blade_sneak_attack_hit', saveType: 'WIS', name: 'Rend Mind', condition: 'stunned' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_RendMind_Used', false, 'test-campaign');
        });

        it('skips Rend Mind if already used this long rest', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_RendMind_Used') return true;
                if (key === '_LastLongRest') return 2;
                if (key === '_CurrentLongRest') return 2;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'attack_rider', trigger: 'psychic_blade_sneak_attack_hit', saveType: 'WIS', name: 'Rend Mind' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.anything(), 'test-campaign');
        });
    });

    describe('Colossus Slayer', () => {
        it('adds 1d8 extra damage to creature below max HP', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Ogre', type: 'npc', currentHp: 20, maxHp: 60 },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Ogre', currentHp: 20, maxHp: 60 });
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('1d8');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_Hunters_Prey_Colossus_UsedRound', 1, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                expect.stringContaining('+ 1d8[extra]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not add Colossus Slayer if target is at max HP', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Ogre', type: 'npc', currentHp: 60, maxHp: 60 },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Ogre', currentHp: 60, maxHp: 60 });
            const { handleDamageClick } = UseDamageClick();
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                '1d8+5',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });
    });

    describe('Superior Hunter\'s Prey', () => {
        it('spreads hunter mark damage to another creature within 30ft', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player', concentration: { spell: "Hunter's Mark" } },
                    { name: 'Goblin', type: 'npc' },
                    { name: 'Orc', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            loadCombatSummary.mockResolvedValue({ some: 'data' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [{ type: 'superior_hunter_prey' }],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('1d6');
            expect(loadCombatSummary).toHaveBeenCalledWith('test-campaign');
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                { some: 'data' }, 'Orc', 5, ['Force'], 'test-campaign', null, false, 'TestRogue'
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                rollType: 'damage',
                formula: '1d6[Superior Hunters Prey]',
                targetName: 'Orc',
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_Superior_Hunters_Prey_UsedRound', 1, 'test-campaign');
            expect(mockSetPopupHtml).toHaveBeenCalled();
        });
    });

    describe('Eldritch Strike', () => {
        it('applies attack_rider effect for weapon_attack_hit without damageExpression', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'attack_rider', trigger: 'weapon_attack_hit',
                            name: 'Eldritch Strike',
                            options: [{ name: 'Impose Disadvantage', effect: 'impose_disadvantage' }],
                        },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    source: 'Eldritch Strike',
                    option: 'Impose Disadvantage',
                    effect: 'impose_disadvantage',
                }),
            ]), 'test-campaign');
        });

        it('tracks oncePerTurn for Eldritch Strike when it executes', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Eldritch_Strike_usedRound') return null;
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'attack_rider', trigger: 'weapon_attack_hit',
                            name: 'Eldritch Strike', oncePerTurn: true,
                            options: [{ name: 'Impose Disadvantage', effect: 'impose_disadvantage' }],
                        },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_Eldritch_Strike_usedRound', 1, 'test-campaign');
        });

        it('skips Eldritch Strike when oncePerTurn and already used', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Eldritch_Strike_usedRound') return 1;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'attack_rider', trigger: 'weapon_attack_hit',
                            name: 'Eldritch Strike', oncePerTurn: true,
                            options: [{ name: 'Impose Disadvantage', effect: 'impose_disadvantage' }],
                        },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.anything(), 'test-campaign');
        });
    });

    describe("Stalker's Flurry", () => {
        it('applies saved Stalker Flurry option (sudden_strike)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Stalker's_Flurry_option") return 'Sudden Strike';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Bugbear', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Bugbear' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'weapon_attack_hit',
                            name: "Stalker's Flurry", chooseOne: true, oncePerTurn: true,
                            options: [
                                { name: 'Sudden Strike', effect: 'sudden_strike' },
                                { name: 'Mass Fear', effect: 'mass_fear', saveType: 'WIS', condition: 'frightened' },
                            ],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', 'pendingSuddenStrike', true, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', "_Stalker's_Flurry_usedRound", 1, 'test-campaign');
        });

        it('applies saved Stalker Flurry option (mass_fear)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Stalker's_Flurry_option") return 'Mass Fear';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Bugbear', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Bugbear' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'weapon_attack_hit',
                            name: "Stalker's Flurry", chooseOne: true, oncePerTurn: true,
                            options: [
                                { name: 'Sudden Strike', effect: 'sudden_strike' },
                                { name: 'Mass Fear', effect: 'mass_fear', saveType: 'WIS', condition: 'frightened' },
                            ],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Bugbear',
                    source: "Stalker's Flurry",
                    effect: 'mass_fear',
                }),
            ]), 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', "_Stalker's_Flurry_usedRound", 1, 'test-campaign');
        });

        it('shows modal when no saved option for Stalker Flurry', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Bugbear', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Bugbear' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'weapon_attack_hit',
                            name: "Stalker's Flurry", chooseOne: true, oncePerTurn: true,
                            options: [
                                { name: 'Sudden Strike', effect: 'sudden_strike' },
                                { name: 'Mass Fear', effect: 'mass_fear' },
                            ],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockSetAttackRiderModal).toHaveBeenCalledWith(expect.objectContaining({
                action: expect.objectContaining({ name: "Stalker's Flurry" }),
                targetName: 'Bugbear',
            }));
            expect(mockRollDamage).not.toHaveBeenCalled();
        });
    });
});
