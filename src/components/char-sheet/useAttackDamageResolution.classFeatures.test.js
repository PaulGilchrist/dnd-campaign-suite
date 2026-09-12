// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 14),
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
const mockPendingDamageRef = { current: null };
const modalState = {};
const mockSetModalState = vi.fn((updates) => {
    if (typeof updates === 'function') {
        return updates(modalState);
    }
    Object.assign(modalState, updates);
});

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
        modalState,
        setModalState: mockSetModalState,
        pendingDamage: mockPendingDamageRef.current,
        resumeRef: mockPendingDamageRef,
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
        getRuntimeValue.mockImplementation((_name, key) => (key === 'resumeRef' ? {} : null));
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

    afterEach(() => {
        Object.keys(modalState).forEach((k) => delete modalState[k]);
        mockSetModalState.mockClear();
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

        it('skips Assassinate when player has already acted', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestRogue', hasActed: true, type: 'player' }],
            });
            getCurrentCombatRound.mockReturnValue(1);
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeAssassinateStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('2d6');
        });

        it('skips Assassinate when combat context is unavailable', async () => {
            getCombatContext.mockResolvedValue(null);
            getCurrentCombatRound.mockReturnValue(1);
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
            const stealthCostCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'stealthAttackCost'
            );
            expect(stealthCostCalls).toHaveLength(1);
            expect(stealthCostCalls[0]).toEqual([
                'TestRogue', 'stealthAttackCost', 0, 'test-campaign',
            ]);
        });

        it('does not deduct when sneak attack dice cannot cover the cost', async () => {
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
            const stealthCostCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'stealthAttackCost'
            );
            expect(stealthCostCalls).toHaveLength(0);
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
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
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
                'Goblin', 'activeConditions', expect.arrayContaining(['stunned']), 'test-campaign',
            );
            expect(addEntry).toHaveBeenCalled();
        });

        it('does not apply stunned condition on save success', async () => {
            const successPromise = Promise.resolve({ success: true });
            createSaveListener.mockReturnValue({ promise: successPromise });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[0] === 'Goblin' && c[1] === 'activeConditions'
            );
            expect(conditionCalls).toHaveLength(0);
        });

        it('skips Rend Mind when already latched used', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_RendMind_Used') return true;
                return null;
            });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('re-arms after long rest nulls the latch (CLA-293)', async () => {
            // Long rest nulls _RendMind_Used via LONG_REST_RESOURCES batch write
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_RendMind_Used') return null;
                return null;
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'WIS',
                saveDc: 19,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_RendMind_Used', true, 'test-campaign');
        });

        it('skips Rend Mind when no target in context', async () => {
            mockBuildCtxSync.mockResolvedValue({ targetName: null });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(makeAttack({ name: 'Psychic Blade', damage: '1d6+5', damageType: 'Psychic' }));
            await tick();
            expect(createSaveListener).not.toHaveBeenCalled();
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

        it('shows SecondaryTargetModal with valid targets when Hunter Mark is active', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Goblin' } },
                    { name: 'Goblin', type: 'npc', maxHp: 20 },
                    { name: 'Orc', type: 'npc', maxHp: 30 },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(mockSetModalState).toHaveBeenCalledWith(expect.objectContaining({
                secondaryTargetModal: expect.objectContaining({
                    title: "Superior Hunter's Prey — Choose Second Target",
                    confirmLabel: 'Deal Damage',
                }),
            }));
            const modalCall = mockSetModalState.mock.calls.find(c => c[0]?.secondaryTargetModal);
            expect(modalCall[0].secondaryTargetModal.targets.map(t => t.name)).toEqual(['Orc']);
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('applies 1d6 Force damage when target is selected via modal', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Goblin' } },
                    { name: 'Goblin', type: 'npc', maxHp: 20 },
                    { name: 'Orc', type: 'npc', maxHp: 30 },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            loadCombatSummary.mockResolvedValue({ some: 'data' });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            const modalCall = mockSetModalState.mock.calls.find(c => c[0]?.secondaryTargetModal);
            const onTargetSelected = modalCall[0].secondaryTargetModal.onTargetSelected;
            await onTargetSelected('Orc');
            expect(rollExpression).toHaveBeenCalledWith('1d6');
            expect(loadCombatSummary).toHaveBeenCalledWith('test-campaign');
            expect(applyDamageToTarget).toHaveBeenCalledWith({ some: 'data' }, 'Orc', 5, ['Force'], 'test-campaign', [], { ignoreResistance: false, attackerName: 'TestRogue' },);
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
            expect(mockSetModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
        });

        it('dismisses modal without applying damage when skipped', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Goblin' } },
                    { name: 'Goblin', type: 'npc', maxHp: 20 },
                    { name: 'Orc', type: 'npc', maxHp: 30 },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            const modalCall = mockSetModalState.mock.calls.find(c => c[0]?.secondaryTargetModal);
            modalCall[0].secondaryTargetModal.onSkip();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(mockSetModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
        });

        it('does not spread damage when Hunter Mark is not active', async () => {
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
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('does not spread damage when already used this round', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
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
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('does not spread damage when only primary target exists', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Goblin' } },
                    { name: 'Goblin', type: 'npc', maxHp: 20 },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(mockSetModalState).not.toHaveBeenCalledWith(
                expect.objectContaining({ secondaryTargetModal: expect.anything() })
            );
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
                'campaign', 'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin', source: 'Eldritch Strike',
                        option: 'Impose Disadvantage', effect: 'impose_disadvantage',
                        duration: 'until_start_of_next_turn',
                    }),
                ]),
                'test-campaign',
            );
        });

        it.each([
            { desc: 'tracks oncePerTurn usage', oncePerTurn: true, usedRound: null, checkTracking: true, checkEffects: true },
            { desc: 'skips when oncePerTurn and already used', oncePerTurn: true, usedRound: 1, checkTracking: false, checkEffects: false },
            { desc: 'no oncePerTurn tracking without flag', oncePerTurn: false, usedRound: null, checkTracking: false, checkEffects: true },
        ])('Eldritch Strike: $desc', async ({ oncePerTurn, usedRound, checkTracking, checkEffects }) => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Eldritch_Strike_usedRound') return usedRound;
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeEldritchStrikeStats({ oncePerTurn }) });
            await resolveAttackDamage(makeAttack());
            await tick();

            const usedRoundCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === '_Eldritch_Strike_usedRound'
            );
            if (checkTracking) {
                expect(usedRoundCalls).toHaveLength(1);
                expect(usedRoundCalls[0]).toEqual([
                    'TestRogue', '_Eldritch_Strike_usedRound', 1, 'test-campaign',
                ]);
            } else {
                expect(usedRoundCalls).toHaveLength(0);
            }

            const effectsCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            if (checkEffects) {
                expect(effectsCalls).toHaveLength(1);
                expect(effectsCalls[0][2]).toContainEqual(
                    expect.objectContaining({ effect: 'impose_disadvantage' })
                );
            } else {
                expect(effectsCalls).toHaveLength(0);
            }
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
                if (key === 'activeConditions') return [];
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
                "_Stalker's_Flurry_usedRound",
                1,
                'test-campaign',
            );
            const calls = setRuntimeValue.mock.calls;
            const conditionCall = calls.find(
                (c) => c[1] === 'activeConditions' && c[0] === 'Bugbear'
            );
            expect(conditionCall).toBeDefined();
            expect(conditionCall[2]).toContain('frightened');
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
            expect(mockSetModalState).toHaveBeenCalledWith(
                expect.objectContaining({
                    attackRiderModal: expect.objectContaining({
                        action: expect.objectContaining({ name: "Stalker's Flurry" }),
                        targetName: 'Bugbear',
                    }),
                }),
            );
            expect(mockRollDamage).not.toHaveBeenCalled();
        });
    });
});
