// @maintained-by-ai 2026-11-28
/**
 * Hook-seam lane: which class features actually DISPATCH through the real
 * buildPipelineForAction() wiring of resolveAttackDamage (real steps, mocked
 * services). Feature internals are byte-locked by co-located step tests and
 * are NOT re-pinned here — only that the feature fires end-to-end at the
 * seam and never strands the primary weapon damage:
 *   - assassinate.test.js owns the CLA-016 gates + bonus/log bytes (the
 *     zero-sneak-dice gate is skipped here as pure duplication).
 *   - superiorHuntersPrey(.test|.integration).test.js owns the modal copy
 *     bytes, the exact log, and onSkip; the seam keeps candidate routing,
 *     the awaited-spread regression bytes, and the primary-hit landing.
 *   - eldritchStrikes.test.js owns the verbatim te payload, log bytes, and
 *     same-round refusal (CLA-109); the seam keeps dispatch + latch shape.
 *   - stalkersFlurry.test.js owns each resolved-option lane payload; the
 *     seam keeps one resolved lane plus the pause-before-damage wiring.
 * stealthAttackCost.js and rendMind.js have NO step test, so they are
 * covered more fully here.
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
        // Zero-sneak-dice gate (CLA-016 threading) is byte-owned by
        // steps/features/assassinate.test.js "returns null when sneak attack
        // applied no dice this attack" — not re-run through the seam.
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

    describe("Superior Hunter's Prey (chooser + awaited spread damage at the seam)", () => {
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

        // One full seam flow. Modal copy (title/confirmLabel/featureDescription),
        // exact log bytes, and the onSkip branch are byte-owned by
        // superiorHuntersPrey.test.js / .integration.test.js — not re-pinned here.
        it('opens the chooser for the unmarked target, then selection applies awaited 1d6 spread, stamps the latch, and the primary hit already landed', async () => {
            getCombatContext.mockResolvedValue(hunterMarkContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            loadCombatSummary.mockResolvedValue({ some: 'data' });

            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeSuperiorHunterStats() });
            await resolveAttackDamage(makeAttack());
            await tick();

            const modal = openModal();
            expect(modal).toBeDefined();
            // candidate routing at the seam: the marked Goblin is not re-offered
            expect(modal.targets).toEqual([{ name: 'Orc', type: 'npc', maxHp: 30, currentHp: 30 }]);
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            // primary marked hit lands while the chooser is open
            // (Hunter's Mark 1d6 folded in)
            expect(mockRollDamage).toHaveBeenCalledWith({
                name: 'Rapier',
                formula: '1d8+5 [piercing] + 1d6 [force]',
                total: 14,
                rolls: [5, 4],
                modifier: 5,
                context: expect.any(Object),
            });

            await modal.onTargetSelected('Orc');

            expect(rollExpression).toHaveBeenCalledWith('1d6');
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                { some: 'data' }, 'Orc', 4, ['Force'],
                { campaignName: 'test-campaign', characters: [], ignoreResistance: false, attackerName: 'TestRogue' },
            );
            // Regression pin: the chain must AWAIT the async applyDamageToTarget
            // — before the fix the ledger/popup streamed finalDamage: undefined.
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                rollType: 'damage',
                name: "Superior Hunter's Prey",
                formula: '1d6 [Superior Hunters Prey]',
                total: 4,
                damageType: 'Force',
                targetName: 'Orc',
                finalDamage: 10,
            }));
            // exactly one latch write, value = current round (offer alone burns nothing)
            expect(callsForKey('_Superior_Hunters_Prey_UsedRound')).toEqual([
                ['TestRogue', '_Superior_Hunters_Prey_UsedRound', 1, 'test-campaign'],
            ]);
            expect(mockSetModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
            // exact resolved popup bytes from the faithful async applyDamage mock
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
        function makeEldritchStrikeStats() {
            return createMockPlayerStats({
                automation: {
                    actions: [{
                        type: 'attack_rider',
                        trigger: 'weapon_attack_hit',
                        name: 'Eldritch Strike',
                        oncePerTurn: true,
                        options: [{ name: 'Impose Disadvantage', effect: 'impose_disadvantage' }],
                    }],
                    passives: [],
                },
            });
        }

        beforeEach(() => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestRogue', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
        });

        // Verbatim te payload, log bytes, same-round refusal (CLA-109) and the
        // oncePerTurn:false append lane are byte-owned by eldritchStrikes.test.js.
        // The seam proves only that the rider DISPATCHES through the real
        // pipeline with the seam-supplied target, and never strands the hit.
        it('dispatches the rider targetEffect to the campaign store with the once-per-turn latch, and the hit still lands', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeEldritchStrikeStats() });
            await resolveAttackDamage(makeAttack());
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
                expect.objectContaining({
                    target: 'Goblin',
                    source: 'Eldritch Strike',
                    option: 'Impose Disadvantage',
                    effect: 'impose_disadvantage',
                }),
            ], 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', '_Eldritch_Strike_usedRound', 1, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalledTimes(1);
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

        // Per-lane payloads (Mass Fear resolve payload, pendingSuddenStrikeTarget
        // bytes) are byte-owned by stalkersFlurry.test.js. One resolved lane at
        // the seam proves option routing dispatches its write, stamps the latch,
        // and never strands the primary weapon damage.
        it('resolved option dispatches its write, stamps once-per-turn, and lands primary damage', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'resumeRef') return {};
                if (key === "_Stalker's_Flurry_option") return 'Sudden Strike';
                return null;
            });

            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: makeStalkersFlurryStats() });
            await resolveAttackDamage(makeAttack());
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', "_Stalker's_Flurry_usedRound", 1, 'test-campaign');
            expect(setRuntimeValue.mock.calls.filter((c) => c[1] === 'pendingSuddenStrike' && c[2] === true)).toHaveLength(1);
            // the other lane stays closed: no Fear condition write
            expect(callsForKey('activeConditions')).toHaveLength(0);
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
