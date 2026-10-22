// @maintained-by-ai
/**
 * Hook-seam lane: which class features actually DISPATCH through the real
 * buildPipelineForAction() wiring of resolveAttackDamage (real steps, mocked
 * services). Feature internals are owned by co-located step tests
 * (steps/features/assassinate.test.js, superiorHuntersPrey.test.js,
 * eldritchStrikes.test.js, stalkersFlurry.test.js); stealthAttackCost.js
 * and rendMind.js have NO step test, so they are covered more fully here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

vi.mock('../../services/dice/diceRoller.js', async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, rollExpression: vi.fn(), rollExpressionDoubled: vi.fn() };
});

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

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, evaluateAutoExpression, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../services/ui/logService.js';
import { createSaveListener } from '../../services/automation/common/savePrompt.js';

// Deterministic mock dice keyed by exact expression (no RNG anywhere in
// this lane). Every pinned formula/total/rolls below derives from this table.
const MOCK_DICE = {
    '1d8+5 [piercing]': { total: 10, rolls: [5], modifier: 5 },
    '1d6+5 [psychic]': { total: 8, rolls: [3], modifier: 5 },
    '9d6': { total: 30, rolls: Array(9).fill(3), modifier: 0 },
    '2d6': { total: 7, rolls: [3, 4], modifier: 0 },
    '1d6': { total: 4, rolls: [4], modifier: 0 },
};

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
            // fresh level objects per fixture — steps mutate them in place
            class_levels: (overrides.class?.class_levels || defaultMockPlayerStats.class.class_levels).map((cl) => ({ ...cl })),
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
    return useAttackDamageResolution({
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
    });
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

const psychicBlade = {
    name: 'Psychic Blade',
    damage: '1d6+5',
    damageType: 'Psychic',
    weaponType: 'melee',
    properties: [],
};

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

const callsForKey = (key) => setRuntimeValue.mock.calls.filter((c) => c[1] === key);

describe('useAttackDamageResolution - class features', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockImplementation((expr) => {
            const result = MOCK_DICE[expr];
            if (!result) console.error(`[classFeatures-test] unexpected roll expression: ${expr}`);
            return result || { total: 5, rolls: [5], modifier: 0 };
        });
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockImplementation((_name, key) => (key === 'resumeRef' ? {} : null));
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
        evaluateAutoExpression.mockReturnValue(5);
        addEntry.mockResolvedValue(undefined);
        getCombatContext.mockResolvedValue(null);
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue(null);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 50 });
        createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false }) });
        mockBuildCtx.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockBuildCtxSync.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockPendingDamageRef.current = null;
    });

    afterEach(() => {
        Object.keys(modalState).forEach((k) => delete modalState[k]);
    });

    describe('Assassinate (first_round_sneak_attack_hit)', () => {
        const assasStats = () => createMockPlayerStats({
            automation: {
                actions: [{ type: 'damage_bonus', trigger: 'first_round_sneak_attack_hit', damageExpression: '2d6', damageType: 'Sneak Attack' }],
                passives: [],
            },
        });

        it('adds 2d6 to the sneak-hit rollDamage payload once per round (CLA-016 latch)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: false, type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            mockBuildCtxSync.mockReturnValue(Promise.resolve({ targetName: 'Goblin', sneakAttackDice: 9 }));
            const store = {};
            getRuntimeValue.mockImplementation((_name, key) => (key === 'resumeRef' ? {} : store[key] ?? null));
            setRuntimeValue.mockImplementation((_name, key, value) => { store[key] = value; });
            const sneak2d6Calls = () => rollExpression.mock.calls.filter((c) => c[0] === '2d6').length;

            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: assasStats() });

            await resolveAttackDamage(makeAttack());
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith({
                name: 'Rapier',
                formula: '1d8+5 [piercing] + 9d6 [Sneak Attack] + 2d6 [Sneak Attack]',
                total: 47,
                rolls: [5, ...Array(9).fill(3), 3, 4],
                modifier: 5,
                context: expect.objectContaining({ targetName: 'Goblin' }),
            });
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Assassinate',
                targetName: 'Goblin',
                description: 'Assassinate: +7 [Sneak Attack] extra damage to Goblin (first-round sneak attack hit)',
            }));
            expect(store['_assassinate_usedRound']).toBe(1);

            // second attack in the same round: latch blocks the bonus,
            // sneak dice still flow (positive leg proves detector works)
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(sneak2d6Calls()).toBe(1);
            expect(mockRollDamage).toHaveBeenLastCalledWith({
                name: 'Rapier',
                formula: '1d8+5 [piercing] + 9d6 [Sneak Attack]',
                total: 40,
                rolls: [5, ...Array(9).fill(3)],
                modifier: 5,
                context: expect.objectContaining({ targetName: 'Goblin' }),
            });
            expect(store['_assassinate_usedRound']).toBe(1);
        });

        it('grants no bonus when sneak attack applied no dice this attack (CLA-016 threading)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', hasActed: false, type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            mockBuildCtxSync.mockReturnValue(Promise.resolve({ targetName: 'Goblin', sneakAttackDice: 0 }));

            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: assasStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(rollExpression).not.toHaveBeenCalledWith('2d6');
            expect(callsForKey('_assassinate_usedRound')).toHaveLength(0);
            expect(mockRollDamage).toHaveBeenCalledWith({
                name: 'Rapier',
                formula: '1d8+5 [piercing]',
                total: 10,
                rolls: [5],
                modifier: 5,
                context: expect.any(Object),
            });
        });
    });

    describe('Stealth Attack (Supreme Sneak cost deduction)', () => {
        // stealthAttackCost.js has no co-located step test — the seam pins
        // both the in-place sneak-dice deduction and the cost reset write.
        it.each([
            { desc: 'deducts cost from sneak dice and resets cost to 0', cost: 2, sneakDice: 9, expectedDice: 7, expectedResets: [['TestRogue', 'stealthAttackCost', 0, 'test-campaign']] },
            { desc: 'leaves everything untouched when sneak dice cannot cover the cost', cost: 5, sneakDice: 2, expectedDice: 2, expectedResets: [] },
        ])('Stealth Attack: $desc', async ({ cost, sneakDice, expectedDice, expectedResets }) => {
            const stats = createMockPlayerStats({
                level: 1,
                class: { name: 'Rogue', class_levels: [{ level: 1, sneak_attack_num_d6: sneakDice }] },
            });
            getRuntimeValue.mockImplementation((_name, key) => (key === 'stealthAttackCost' ? cost : null));

            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            await resolveAttackDamage(makeAttack());
            await tick();

            expect(stats.class.class_levels[0].sneak_attack_num_d6).toBe(expectedDice);
            expect(callsForKey('stealthAttackCost')).toEqual(expectedResets);
        });
    });

    describe('Rend Mind (Soulknife level 17 — no step test, seam is sole coverage)', () => {
        function makeRendMindStats() {
            return createMockPlayerStats({
                automation: {
                    actions: [],
                    passives: [{
                        type: 'attack_rider',
                        trigger: 'psychic_blade_sneak_attack_hit',
                        saveType: 'WIS',
                        name: 'Rend Mind',
                        condition: 'stunned',
                        duration: '1_minute',
                        repeatingSave: true,
                    }],
                },
            });
        }

        beforeEach(() => {
            mockBuildCtxSync.mockResolvedValue({ targetName: 'Goblin', sneakAttackDice: 9 });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
        });

        it('fires a DC 19 WIS save on first sneak hit; failed save writes stunned and logs', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(psychicBlade);
            await tick();
            // DC = 8 + DEX 5 + PB 6 (honest fixture math)
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'WIS',
                saveDc: 19,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_RendMind_Used', true, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['stunned'], 'test-campaign');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                abilityName: 'Rend Mind',
                targetName: 'Goblin',
                description: 'Rend Mind triggered on Goblin — failed WIS save (DC 19) — Stunned condition applied',
            }));
            // the hit itself still lands — rider never strands weapon damage
            expect(mockRollDamage).toHaveBeenCalledWith({
                name: 'Psychic Blade',
                formula: '1d6+5 [psychic] + 9d6 [Sneak Attack]',
                total: 38,
                rolls: [3, ...Array(9).fill(3)],
                modifier: 5,
                context: expect.objectContaining({ targetName: 'Goblin' }),
            });
        });

        it('writes no condition but still latches and logs on a successful save', async () => {
            createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: true }) });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(psychicBlade);
            await tick();
            expect(callsForKey('activeConditions')).toHaveLength(0);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_RendMind_Used', true, 'test-campaign');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: 'Rend Mind triggered on Goblin — succeeded WIS save (DC 19)',
            }));
        });

        it.each([
            { desc: 'latch is already set (re-arms only via long rest, CLA-293)', latched: true, targetName: 'Goblin' },
            { desc: 'no target in context', latched: false, targetName: null },
        ])('does not prompt when $desc', async ({ latched, targetName }) => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'resumeRef') return {};
                if (key === '_RendMind_Used') return latched ? true : null;
                return null;
            });
            mockBuildCtxSync.mockResolvedValue({ targetName });

            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeRendMindStats() });
            await resolveAttackDamage(psychicBlade);
            await tick();
            expect(createSaveListener).not.toHaveBeenCalled();
            expect(callsForKey('_RendMind_Used')).toHaveLength(0);
            expect(callsForKey('activeConditions')).toHaveLength(0);
        });
    });

    describe("Superior Hunter's Prey (chooser modal + spread damage at the seam)", () => {
        function makeSuperiorHunterStats() {
            return createMockPlayerStats({
                automation: { actions: [], passives: [{ type: 'superior_hunter_prey' }] },
            });
        }

        function hunterMarkContext() {
            return {
                creatures: [
                    { name: 'TestRogue', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Goblin' } },
                    { name: 'Goblin', type: 'npc', maxHp: 20 },
                    { name: 'Orc', type: 'npc', maxHp: 30 },
                ],
            };
        }

        const openModal = () => mockSetModalState.mock.calls.map((c) => c[0]?.secondaryTargetModal).find(Boolean);

        it('opens the chooser for the unmarked target and its skip closes it without damage', async () => {
            getCombatContext.mockResolvedValue(hunterMarkContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();

            const modal = openModal();
            expect(modal).toBeDefined();
            expect(modal.title).toBe("Superior Hunter's Prey — Choose Second Target");
            expect(modal.confirmLabel).toBe('Deal Damage');
            expect(modal.featureDescription).toBe("Deal 1d6 Force damage to a creature within 30 feet of the Hunter's Mark target. Once per turn.");
            expect(modal.targets).toEqual([{ name: 'Orc', type: 'npc', maxHp: 30, currentHp: 30 }]);
            expect(callsForKey('_Superior_Hunters_Prey_UsedRound')).toHaveLength(0);

            modal.onSkip();
            expect(mockSetModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            // primary marked hit still lands (Hunter's Mark 1d6 folded in)
            expect(mockRollDamage).toHaveBeenCalledWith({
                name: 'Rapier',
                formula: '1d8+5 [piercing] + 1d6 [force]',
                total: 14,
                rolls: [5, 4],
                modifier: 5,
                context: expect.any(Object),
            });
        });

        it('selecting a target applies exact 1d6 Force spread and stamps the once-per-turn latch', async () => {
            getCombatContext.mockResolvedValue(hunterMarkContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            loadCombatSummary.mockResolvedValue({ some: 'data' });

            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(applyDamageToTarget).not.toHaveBeenCalled();

            await openModal().onTargetSelected('Orc');

            expect(rollExpression).toHaveBeenCalledWith('1d6');
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                { some: 'data' }, 'Orc', 4, ['Force'],
                { campaignName: 'test-campaign', characters: [], ignoreResistance: false, attackerName: 'TestRogue' },
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                rollType: 'damage',
                name: "Superior Hunter's Prey",
                formula: '1d6 [Superior Hunters Prey]',
                rolls: [4],
                total: 4,
                damageType: 'Force',
                targetName: 'Orc',
                // FIXED (was honest pin finalDamage: undefined — the step did
                // NOT await the async applyDamageToTarget, so the ledger logged
                // undefined; source :72 now awaits, real mock bytes flow through)
                finalDamage: 10,
            }));
            expect(callsForKey('_Superior_Hunters_Prey_UsedRound')).toEqual([
                ['TestRogue', '_Superior_Hunters_Prey_UsedRound', 1, 'test-campaign'],
            ]);
            expect(mockSetModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
            // FIXED popup spread bytes (were spreadFinalDamage/spreadTarget-
            // CurrentHp: undefined through the un-awaited Promise): exact
            // resolved values from the faithful async applyDamage mock.
            const spreadPopup = mockSetPopupHtml.mock.calls
                .map(([updater]) => (typeof updater === 'function' ? updater({ keep: 1 }) : updater))
                .find((out) => out && 'spreadTargetName' in out);
            expect(spreadPopup).toEqual({
                keep: 1,
                spreadTargetName: 'Orc',
                spreadFinalDamage: 10,
                spreadTargetCurrentHp: 50,
                spreadTargetMaxHp: 30,
            });
        });
    });

    describe('Eldritch Strike (weapon_attack_hit attack_rider without damageExpression)', () => {
        function makeEldritchStrikeStats(oncePerTurn) {
            return createMockPlayerStats({
                automation: {
                    actions: [{
                        type: 'attack_rider',
                        trigger: 'weapon_attack_hit',
                        name: 'Eldritch Strike',
                        oncePerTurn,
                        options: [{ name: 'Impose Disadvantage', effect: 'impose_disadvantage' }],
                    }],
                    passives: [],
                },
            });
        }

        const EXPECTED_TE = {
            target: 'Goblin',
            source: 'Eldritch Strike',
            option: 'Impose Disadvantage',
            effect: 'impose_disadvantage',
            value: null,
            noOpportunityAttacks: false,
            duration: 'until_start_of_next_turn',
        };

        beforeEach(() => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
        });

        it('writes one exact targetEffect and stamps usedRound once per round', async () => {
            const store = {};
            getRuntimeValue.mockImplementation((_name, key) => store[key] ?? null);
            setRuntimeValue.mockImplementation((_name, key, value) => { store[key] = value; });

            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeEldritchStrikeStats(true) });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(store['targetEffects']).toEqual([EXPECTED_TE]);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_Eldritch_Strike_usedRound', 1, 'test-campaign');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                abilityName: 'Eldritch Strike',
                targetName: 'Goblin',
                description: "TestRogue used Eldritch Strike on Goblin, imposing Disadvantage on the target's next saving throw.",
            }));

            // second hit in the same round: no duplicate effect, no duplicate log
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(store['targetEffects'].filter((te) => te.effect === 'impose_disadvantage')).toHaveLength(1);
            expect(addEntry.mock.calls.filter((c) => c[1]?.abilityName === 'Eldritch Strike')).toHaveLength(1);
            expect(callsForKey('_Eldritch_Strike_usedRound')).toHaveLength(1);
            expect(mockRollDamage).toHaveBeenCalledTimes(2);
        });

        it('applies the effect without a usedRound latch when oncePerTurn is absent', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeEldritchStrikeStats(false) });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [EXPECTED_TE], 'test-campaign');
            expect(callsForKey('_Eldritch_Strike_usedRound')).toHaveLength(0);
        });
    });

    describe("Stalker's Flurry (chooseOne attack_rider passive)", () => {
        function makeStalkersFlurryStats() {
            return createMockPlayerStats({
                automation: {
                    actions: [],
                    passives: [{
                        type: 'attack_rider',
                        trigger: 'weapon_attack_hit',
                        name: "Stalker's Flurry",
                        chooseOne: true,
                        oncePerTurn: true,
                        options: [
                            { name: 'Sudden Strike', effect: 'sudden_strike' },
                            { name: 'Mass Fear', effect: 'mass_fear', saveType: 'WIS', condition: 'frightened' },
                        ],
                    }],
                },
            });
        }

        beforeEach(() => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Bugbear', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Bugbear' });
        });

        it.each([
            { option: 'Sudden Strike', expectedPending: 1, expectedFrightened: [] },
            { option: 'Mass Fear', expectedPending: 0, expectedFrightened: [['Bugbear', 'activeConditions', ['frightened'], 'test-campaign']] },
        ])('resolved option $option dispatches its write and stamps once-per-turn', async ({ option, expectedPending, expectedFrightened }) => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'resumeRef') return {};
                if (key === "_Stalker's_Flurry_option") return option;
                return null;
            });

            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeStalkersFlurryStats() });
            await resolveAttackDamage(makeAttack());
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', "_Stalker's_Flurry_usedRound", 1, 'test-campaign');
            expect(setRuntimeValue.mock.calls.filter((c) => c[1] === 'pendingSuddenStrike' && c[2] === true)).toHaveLength(expectedPending);
            expect(setRuntimeValue.mock.calls.filter((c) => c[1] === 'activeConditions')).toEqual(expectedFrightened);
            // resolved choice never strands the primary weapon damage
            expect(mockRollDamage).toHaveBeenCalledWith({
                name: 'Rapier',
                formula: '1d8+5 [piercing]',
                total: 10,
                rolls: [5],
                modifier: 5,
                context: expect.any(Object),
            });
        });

        it('opens the attackRider chooser and pauses BEFORE damage when no option is saved', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeStalkersFlurryStats() });
            await resolveAttackDamage(makeAttack());
            await tick();
            expect(mockSetModalState).toHaveBeenCalledWith(
                expect.objectContaining({
                    attackRiderModal: expect.objectContaining({
                        action: expect.objectContaining({ name: "Stalker's Flurry" }),
                        targetName: 'Bugbear',
                        campaignName: 'test-campaign',
                    }),
                }),
            );
            expect(mockRollDamage).not.toHaveBeenCalled();
            expect(callsForKey("_Stalker's_Flurry_usedRound")).toHaveLength(0);
        });
    });
});
