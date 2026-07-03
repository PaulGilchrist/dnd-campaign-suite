// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

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

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, evaluateAutoExpression, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../services/ui/logService.js';
import { createSaveListener } from '../../services/automation/common/savePrompt.js';

const defaultRollResult = { total: 5, rolls: [5], modifier: 0 };

const defaultMockPlayerStats = {
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

function createMockPlayerStats(overrides = {}) {
    return {
        ...defaultMockPlayerStats,
        ...overrides,
        abilities: [...defaultMockPlayerStats.abilities, ...(overrides.abilities || [])],
        class: {
            ...defaultMockPlayerStats.class,
            class_levels: overrides.class?.class_levels || defaultMockPlayerStats.class.class_levels,
        },
        automation: {
            ...defaultMockPlayerStats.automation,
            ...overrides.automation,
            actions: overrides.automation?.actions || defaultMockPlayerStats.automation.actions,
            passives: overrides.automation?.passives || defaultMockPlayerStats.automation.passives,
        },
    };
}

const mockSetPopupHtml = vi.fn();
const mockRollDamage = vi.fn();
const mockBuildCtx = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
const mockBuildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
const mockSetDamageTypeChoice = vi.fn();
const mockSetDivineFuryChoice = vi.fn();
const mockSetWeaponMasteryModal = vi.fn();
const mockSetAttackRiderModal = vi.fn();
const mockPendingDamageRef = { current: null };

function UseAttackDamageResolution(overrides = {}) {
    const deps = {
        playerStats: createMockPlayerStats(overrides.playerStats),
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
        return useAttackDamageResolution(deps);
}

function makeAttack(overrides = {}) {
    return {
        name: 'Rapier',
        damage: '1d8+5',
        damageType: 'Piercing',
        weaponType: 'melee',
        properties: [],
        ...overrides,
    };
}

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

describe('useAttackDamageResolution - class features', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue(defaultRollResult);
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
        evaluateAutoExpression.mockReturnValue(5);
        addEntry.mockResolvedValue(undefined);
        getCombatContext.mockResolvedValue(null);
        getTargetFromAttacker.mockReturnValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        loadCombatSummary.mockResolvedValue(null);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 50 });
        createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false }) });
        mockBuildCtx.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockBuildCtxSync.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockPendingDamageRef.current = null;
    });

    describe('Assassinate (first_round_sneak_attack_hit)', () => {
        function makeAssassinateStats() {
            return createMockPlayerStats({
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus',
                            trigger: 'first_round_sneak_attack_hit',
                            damageExpression: '2d6',
                            damageType: 'Sneak Attack',
                        },
                    ],
                    passives: [],
                },
            });
        }

        it('adds Assassinate damage when round 1 and player has not acted', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: false, type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getCurrentCombatRound.mockReturnValue(1);
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeAssassinateStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('2d6');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                expect.stringContaining('2d6 [Sneak Attack]'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('skips Assassinate when player has already acted this round', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: true, type: 'player' },
                ],
            });
            getCurrentCombatRound.mockReturnValue(1);
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeAssassinateStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('2d6');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                '1d8+5',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('skips Assassinate when combat is past round 1', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: false, type: 'player' },
                ],
            });
            getCurrentCombatRound.mockReturnValue(2);
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeAssassinateStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('2d6');
        });

        it('skips Assassinate when no combat context exists', async () => {
            getCombatContext.mockResolvedValue(null);
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeAssassinateStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('2d6');
        });
    });

    describe('Stealth Attack (Supreme Sneak cost deduction)', () => {
        function makeStealthAttackStats() {
            return createMockPlayerStats({
                level: 1,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus',
                            trigger: 'first_round_sneak_attack_hit',
                            damageExpression: '2d6',
                            damageType: 'Sneak Attack',
                        },
                    ],
                    passives: [],
                },
            });
        }

        it('deducts stealthAttackCost from sneak attack dice and resets cost to 0', async () => {
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeStealthAttackStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', 'stealthAttackCost', 0, 'test-campaign');
        });

        it('does not deduct when sneak attack dice are 0', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'stealthAttackCost') return 2;
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestRogue', hasActed: false, type: 'player' }],
            });
            getCurrentCombatRound.mockReturnValue(1);
            const stats = createMockPlayerStats({
                level: 1,
                class: { name: 'Rogue', class_levels: [{ level: 1, sneak_attack_num_d6: 0 }] },
                automation: { actions: [], passives: [] },
            });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestRogue',
                'stealthAttackCost',
                0,
                'test-campaign',
            );
        });

        it('does not deduct when cost exceeds available dice', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'stealthAttackCost') return 5;
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestRogue', hasActed: false, type: 'player' }],
            });
            getCurrentCombatRound.mockReturnValue(1);
            const stats = createMockPlayerStats({
                level: 1,
                class: { name: 'Rogue', class_levels: [{ level: 1, sneak_attack_num_d6: 2 }] },
                automation: { actions: [], passives: [] },
            });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestRogue',
                'stealthAttackCost',
                0,
                'test-campaign',
            );
        });
    });

    describe('Rend Mind (Soulknife level 17)', () => {
        beforeEach(() => {
            mockBuildCtxSync.mockResolvedValue({ targetName: 'Goblin', sneakAttackDice: 9 });
        });

        function makeRendMindStats(overrides = {}) {
            return createMockPlayerStats({
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider',
                            trigger: 'psychic_blade_sneak_attack_hit',
                            saveType: 'WIS',
                            name: 'Rend Mind',
                            condition: 'stunned',
                            duration: '1_minute',
                            repeatingSave: true,
                            ...overrides,
                        },
                    ],
                },
            });
        }

        it('triggers WIS save via createSaveListener on first use', async () => {
            getRuntimeValue.mockReturnValue(null);
            createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false }) });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_RendMind_Used', true, 'test-campaign');
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'WIS',
                saveDc: 19,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin', 'activeConditions', ['stunned'], 'test-campaign',
            );
            expect(addEntry).toHaveBeenCalled();
        });

        it('applies stunned condition on save failure via activeConditions', async () => {
            getRuntimeValue.mockReturnValue(null);
            const failurePromise = Promise.resolve({ success: false });
            createSaveListener.mockReturnValue({ promise: failurePromise });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin', 'activeConditions', ['stunned'], 'test-campaign',
            );
        });

        it('does not apply stunned condition on save success', async () => {
            getRuntimeValue.mockReturnValue(null);
            const successPromise = Promise.resolve({ success: true });
            createSaveListener.mockReturnValue({ promise: successPromise });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin', 'activeConditions', expect.anything(), 'test-campaign',
            );
        });

        it('does not duplicate stunned condition if already applied', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeConditions') return ['stunned'];
                return null;
            });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin', 'activeConditions', expect.anything(), 'test-campaign',
            );
        });

        it('resets Rend Mind flag when long rest has changed', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_RendMind_Used') return true;
                if (key === '_LastLongRest') return 1;
                if (key === '_CurrentLongRest') return 2;
                return null;
            });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_RendMind_Used', false, 'test-campaign');
            expect(createSaveListener).toHaveBeenCalled();
        });

        it('skips Rend Mind when already used this long rest', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_RendMind_Used') return true;
                if (key === '_LastLongRest') return 2;
                if (key === '_CurrentLongRest') return 2;
                return null;
            });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('skips Rend Mind when no target in context', async () => {
            getRuntimeValue.mockReturnValue(null);
            mockBuildCtxSync.mockResolvedValue({ targetName: null });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('skips Rend Mind when attack is not a Psychic Blade', async () => {
            getRuntimeValue.mockReturnValue(null);
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Dagger', damage: '1d4+5', damageType: 'Piercing' }));
            await tick();
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('skips Rend Mind when no sneak attack dice applied', async () => {
            getRuntimeValue.mockReturnValue(null);
            mockBuildCtxSync.mockResolvedValue({ targetName: 'Goblin', sneakAttackDice: 0 });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(createSaveListener).not.toHaveBeenCalled();
        });
    });

    describe("Colossus Slayer (Hunter's Prey)", () => {
        it('adds 1d8 extra damage when target is below max HP', async () => {
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
            const { resolveAttackDamage } = UseAttackDamageResolution();
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('1d8');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                expect.stringContaining('+ 1d8 [extra]'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                '_Hunters_Prey_Colossus_UsedRound',
                1,
                'test-campaign',
            );
        });

        it('does not add damage when target is at max HP', async () => {
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
            const { resolveAttackDamage } = UseAttackDamageResolution();
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('1d8');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                '1d8+5',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not add damage when Colossus Slayer is not the chosen Hunter\'s Prey', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Other';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Ogre', type: 'npc', currentHp: 20, maxHp: 60 },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Ogre', currentHp: 20, maxHp: 60 });
            const { resolveAttackDamage } = UseAttackDamageResolution();
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('1d8');
        });

        it('does not add damage when Colossus Slayer already used this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Hunters_Prey_Colossus_UsedRound') return 1;
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
            const { resolveAttackDamage } = UseAttackDamageResolution();
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('1d8');
        });

        it('does not add damage when target has no HP data', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Ogre', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Ogre' });
            const { resolveAttackDamage } = UseAttackDamageResolution();
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('1d8');
        });
    });

    describe("Superior Hunter's Prey (spread Hunter's Mark damage)", () => {
        function makeSuperiorHunterStats() {
            return createMockPlayerStats({
                automation: {
                    actions: [],
                    passives: [{ type: 'superior_hunter_prey' }],
                },
            });
        }

        it('rolls 1d6 Force damage and applies to a different creature within 30ft', async () => {
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('1d6');
            expect(loadCombatSummary).toHaveBeenCalledWith('test-campaign');
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                { some: 'data' },
                'Orc',
                5,
                ['Force'],
                'test-campaign',
                null,
                false,
                'TestRogue',
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                rollType: 'damage',
                formula: '1d6 [Superior Hunters Prey]',
                targetName: 'Orc',
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                '_Superior_Hunters_Prey_UsedRound',
                1,
                'test-campaign',
            );
            expect(mockSetPopupHtml).toHaveBeenCalled();
        });

        it('does not spread damage when Hunter\'s Mark is not active', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                    { name: 'Orc', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('1d6');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('does not spread damage when no other creatures are available', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player', concentration: { spell: "Hunter's Mark" } },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('does not spread damage when already used this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Superior_Hunters_Prey_UsedRound') return 1;
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('1d6');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });
    });

    describe('Eldritch Strike (weapon_attack_hit attack_rider without damageExpression)', () => {
        function makeEldritchStrikeStats(overrides = {}) {
            return createMockPlayerStats({
                automation: {
                    actions: [
                        {
                            type: 'attack_rider',
                            trigger: 'weapon_attack_hit',
                            name: 'Eldritch Strike',
                            oncePerTurn: overrides.oncePerTurn ?? false,
                            options: [{ name: 'Impose Disadvantage', effect: 'impose_disadvantage' }],
                        },
                    ],
                    passives: [],
                },
            });
        }

        it('applies target effect for weapon_attack_hit without damageExpression', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeEldritchStrikeStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'Eldritch Strike',
                        option: 'Impose Disadvantage',
                        effect: 'impose_disadvantage',
                        duration: 'until_start_of_next_turn',
                    }),
                ]),
                'test-campaign',
            );
        });

        it('tracks oncePerTurn usage when rider has oncePerTurn flag', async () => {
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeEldritchStrikeStats({ oncePerTurn: true }) });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                '_Eldritch_Strike_usedRound',
                1,
                'test-campaign',
            );
        });

        it('skips when oncePerTurn and already used this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Eldritch_Strike_usedRound') return 1;
                return null;
            });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeEldritchStrikeStats({ oncePerTurn: true }) });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.anything(),
                'test-campaign',
            );
        });

        it('skips when rider has no options', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = createMockPlayerStats({
                automation: {
                    actions: [
                        {
                            type: 'attack_rider',
                            trigger: 'weapon_attack_hit',
                            name: 'Eldritch Strike',
                            options: [],
                        },
                    ],
                    passives: [],
                },
            });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.anything(),
                'test-campaign',
            );
        });
    });

    describe("Stalker's Flurry (chooseOne attack_rider passive)", () => {
        function makeStalkersFlurryStats() {
            return createMockPlayerStats({
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider',
                            trigger: 'weapon_attack_hit',
                            name: "Stalker's Flurry",
                            chooseOne: true,
                            oncePerTurn: true,
                            options: [
                                { name: 'Sudden Strike', effect: 'sudden_strike' },
                                {
                                    name: 'Mass Fear',
                                    effect: 'mass_fear',
                                    saveType: 'WIS',
                                    condition: 'frightened',
                                },
                            ],
                        },
                    ],
                },
            });
        }

        it('applies sudden_strike option when saved', async () => {
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeStalkersFlurryStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'pendingSuddenStrike',
                true,
                'test-campaign',
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                "_Stalker's_Flurry_usedRound",
                1,
                'test-campaign',
            );
        });

        it('applies mass_fear option when saved with save parameters', async () => {
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeStalkersFlurryStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Bugbear',
                        source: "Stalker's Flurry",
                        effect: 'mass_fear',
                        saveType: 'WIS',
                        condition: 'frightened',
                    }),
                ]),
                'test-campaign',
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                "_Stalker's_Flurry_usedRound",
                1,
                'test-campaign',
            );
        });

        it('shows modal when no saved option', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Bugbear', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Bugbear' });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeStalkersFlurryStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(mockSetAttackRiderModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: expect.objectContaining({ name: "Stalker's Flurry" }),
                    targetName: 'Bugbear',
                }),
            );
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it('skips when already used this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Stalker's_Flurry_usedRound") return 1;
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeStalkersFlurryStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(mockSetAttackRiderModal).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestRogue',
                'pendingSuddenStrike',
                true,
                'test-campaign',
            );
        });

        it('skips when no target found', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Stalker's_Flurry_option") return 'Sudden Strike';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                ],
            });
            getTargetFromAttacker.mockReturnValue(null);
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeStalkersFlurryStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(mockSetAttackRiderModal).not.toHaveBeenCalled();
        });
    });
});
