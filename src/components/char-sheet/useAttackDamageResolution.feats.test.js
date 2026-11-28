// @maintained-by-ai 2026-11-28
/**
 * Feats lane (#298-#303 family): which FEAT passives actually DISPATCH at the
 * hook seam of resolveAttackDamage — real buildPipelineForAction() wiring, mocked
 * services. Step internals are owned by co-located step tests and this lane does
 * NOT re-litigate them: shieldBash.test.js owns every gate branch
 * (attacker/weaponType/shield/range/oncePerTurn), crusher.test.js owns the
 * latch cycle and enhanced-critical non-crit silence, tavernBrawlerPush.test.js
 * owns the unarmed condition and exact latch-then-te tuples. What stays here is
 * the seam's unique value: positive dispatch per feat family, save-prompt
 * consumer args (DC branch: automation buildSaveDc vs STR+PB fallback), the
 * enhanced-critical crit gate for Slasher (slasher.js has no step test), the
 * Piercer formula token (piercer.js has no step test), and damage committing at
 * Done while rider modals hold only their rider (FT-074 lane, post
 * bug-sheet-attack-shield-bash-rider-drops-weapon-damage).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

// Mock audit: every entry below is imported by the transitively-loaded pipeline
// (steps/index → feature steps + attackRiderHandler) or guards real side effects
// (applyDamage network, savePromptSSE, log disk). Nothing else is stubbed.
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
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
    parseMagicItemName: vi.fn(),
}));

// Save seam mocked so no window-event timing is needed at this lane
// (savePrompt.js plumbing is owned by its own tests).
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 14),
    createSaveListener: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getAbilityLongName: vi.fn(),
        getName: vi.fn((name) => name),
        guid: vi.fn(() => 'test-prompt-id-12345'),
    },
    DEBUG_FORCE_CRIT: false,
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, evaluateAutoExpression, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { parseMagicItemName } from '../../services/rules/core/attackCalc.js';
import { buildSaveDc, createSaveListener } from '../../services/automation/common/savePrompt.js';
import { addEntry } from '../../services/ui/logService.js';
import utils from '../../services/ui/utils.js';

// Deterministic mock dice keyed by exact expression — every pinned total below
// derives from this table; unknown expressions log a drift-guard error.
const MOCK_DICE = {
    '1d8+5': { total: 11, rolls: [6], modifier: 5 },
    '1d8': { total: 6, rolls: [6], modifier: 0 },
    '1d4': { total: 3, rolls: [3], modifier: 0 },
};
const MOCK_DICE_DOUBLED = {
    '1d8': { total: 12, rolls: [6, 6], modifier: 0 },
    '1d8+5': { total: 17, rolls: [6, 6], modifier: 5 },
};

const mockCampaignName = 'test-campaign';
const attackerName = 'TestFighter';

const mockRollDamage = vi.fn();
const mockSetPopupHtml = vi.fn();
const mockBuildCtx = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
const mockBuildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));

const modalState = {};
const mockSetModalState = vi.fn((updates) => {
    if (typeof updates === 'function') {
        return updates(modalState);
    }
    Object.assign(modalState, updates);
});

function makeStats(passives = [], overrides = {}) {
    return {
        name: attackerName,
        level: 20,
        abilities: [
            { name: 'Strength', bonus: 5 },
            { name: 'Dexterity', bonus: 2 },
        ],
        proficiency: 6,
        class: { name: 'Fighter', class_levels: [{ level: 20, rage_damage: 2 }] },
        automation: { actions: [], passives },
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', equipment_category: 'Shield' }],
        ...overrides,
    };
}

function makeAttack(overrides = {}) {
    return {
        name: 'Longsword',
        damage: '1d8+5',
        damageType: 'Slashing',
        weaponType: 'melee',
        properties: [],
        ...overrides,
    };
}

function createCombatContext() {
    return {
        creatures: [
            { name: attackerName, type: 'player' },
            { name: 'Goblin', type: 'npc' },
        ],
    };
}

// Campaign runtime backed by a Map so latch round-trips are real reads/writes.
function useKeyValueStore(seed = {}) {
    const store = new Map(Object.entries(seed));
    getRuntimeValue.mockImplementation((name, key) => store.get(`${name}:${key}`) ?? null);
    setRuntimeValue.mockImplementation((name, key, value) => {
        if (value === null || value === undefined) store.delete(`${name}:${key}`);
        else store.set(`${name}:${key}`, value);
        return Promise.resolve();
    });
    return store;
}

function UseAttackDamageResolution(overrides = {}) {
    return useAttackDamageResolution({
        playerStats: makeStats(),
        campaignName: mockCampaignName,
        mapName: null,
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
        rollDamage: mockRollDamage,
        buildCtx: mockBuildCtx,
        buildCtxSync: mockBuildCtxSync,
        modalState,
        setModalState: mockSetModalState,
        pendingDamageRef: { current: null },
        ...overrides,
    });
}

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

const callsForKey = (key) => setRuntimeValue.mock.calls.filter((c) => c[1] === key);
const writtenEffects = () => callsForKey('targetEffects').flatMap((c) => c[2]);

const playerMeleeHit = {
    hit: true,
    attackerName: attackerName,
    weaponType: 'melee',
    targetName: 'Goblin',
};

describe('useAttackDamageResolution - feats', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        rollExpression.mockImplementation((expr) => {
            const result = MOCK_DICE[expr];
            if (!result) console.error(`[feats-test] unexpected roll expression: ${expr}`);
            return result || { total: 5, rolls: [5], modifier: 0 };
        });
        rollExpressionDoubled.mockImplementation((expr) => {
            const result = MOCK_DICE_DOUBLED[expr];
            if (!result) console.error(`[feats-test] unexpected doubled roll expression: ${expr}`);
            return result || { total: 10, rolls: [5, 5], modifier: 0 };
        });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
        evaluateAutoExpression.mockReturnValue(5);
        getCombatContext.mockResolvedValue(createCombatContext());
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
        getCurrentCombatRound.mockReturnValue(1);
        parseMagicItemName.mockImplementation((name) => ({ baseName: name }));
        buildSaveDc.mockReturnValue(14);
        createSaveListener.mockReturnValue({
            promptId: 'test-prompt-id-12345',
            promise: Promise.resolve({ success: false, roll: 5, total: 8, saveBonus: 3 }),
        });
        addEntry.mockResolvedValue(undefined);
        utils.getAbilityLongName.mockImplementation((a) => a);
        utils.getName.mockImplementation((name) => name);
        utils.guid.mockReturnValue('test-prompt-id-12345');
        mockBuildCtx.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockBuildCtxSync.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        Object.keys(modalState).forEach((key) => delete modalState[key]);
    });

    afterEach(() => {
        Object.keys(modalState).forEach((key) => delete modalState[key]);
    });

    describe('Shield Master', () => {
        // Both authored feat shapes (5e trigger rider / 2024 push_or_prone rider)
        // must reach the STR save and surface the choice modal after a failed save.
        // Gate refusals (attacker/shield/range/latch) are byte-owned by
        // shieldBash.test.js — only the consumer args differ at this seam.
        it.each([
            {
                branch: '5e trigger shape uses 8+STR+PB fallback DC',
                passive: {
                    type: 'attack_rider',
                    trigger: 'melee_hit_with_shield_equipped',
                    name: 'Shield Bash',
                    options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                },
                expectedSaveDc: 19,
            },
            {
                branch: '2024 push_or_prone shape resolves DC via its automation spec',
                passive: {
                    type: 'attack_rider',
                    effect: 'push_or_prone',
                    oncePerTurn: true,
                    name: 'Shield Bash',
                    automation: { saveType: 'STR', saveDc: 'ability', saveAbility: 'STR' },
                },
                expectedSaveDc: 14,
            },
        ])('sends the STR save and opens the choice modal on a failed save — $branch', async ({ passive, expectedSaveDc }) => {
            getRuntimeValue.mockImplementation((_name, key) =>
                key === 'lastAttack' ? { ...playerMeleeHit } : null
            );
            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: makeStats([passive]),
            });

            await resolveAttackDamage(makeAttack(), { hit: true });
            await tick();

            expect(createSaveListener).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    targetName: 'Goblin',
                    saveType: 'STR',
                    saveDc: expectedSaveDc,
                    dcSuccess: false,
                    sourceName: 'Shield Bash',
                })
            );
            expect(modalState.shieldBashModal).toEqual(
                expect.objectContaining({ targetName: 'Goblin', saveDc: expectedSaveDc })
            );
            // bug-sheet-attack-shield-bash-rider-drops-weapon-damage: the
            // triggering hit's weapon damage commits synchronously at Done —
            // the open chooser may only hold the push/prone rider, never the
            // base damage (exactly one rollDamage, no parked backlog).
            expect(mockRollDamage).toHaveBeenCalledTimes(1);
        });
    });

    describe('Enhanced critical (Crusher/Slasher)', () => {
        // slasher.js has no step test, so the non-crit silence leg stays here;
        // Crusher's non-crit/gate silences are owned by crusher.test.js.
        it.each([
            {
                branch: 'bludgeoning crit rides advantage onto the target',
                passiveName: 'Crusher Enhanced Critical',
                trigger: 'critical_hit_bludgeoning',
                attack: { name: 'Warhammer', damageType: 'Bludgeoning' },
                isCrit: true,
                expectedEffect: 'crusher_enhanced_critical',
            },
            {
                branch: 'slashing crit rides disadvantage onto the target',
                passiveName: 'Slasher Enhanced Critical',
                trigger: 'critical_hit_slashing',
                attack: {},
                isCrit: true,
                expectedEffect: 'slasher_enhanced_critical',
            },
            {
                branch: 'no enhanced-critical effect without a crit (Slasher gate)',
                passiveName: 'Slasher Enhanced Critical',
                trigger: 'critical_hit_slashing',
                attack: {},
                isCrit: false,
                expectedEffect: null,
            },
        ])('$branch', async ({ passiveName, trigger, attack, isCrit, expectedEffect }) => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: makeStats([{
                    type: 'conditional_advantage',
                    trigger,
                    name: passiveName,
                }]),
                popupHtml: { isCrit },
            });

            await resolveAttackDamage(makeAttack(attack), { hit: true });
            await tick();

            const effects = writtenEffects().filter((e) => e.source === passiveName);
            if (expectedEffect) {
                expect(effects).toEqual([{
                    target: 'Goblin',
                    source: passiveName,
                    effect: expectedEffect,
                    duration: 'until_start_of_next_turn',
                }]);
            } else {
                expect(effects).toHaveLength(0);
            }
            // Positive leg: the feat gate never blocks the weapon damage itself.
            expect(mockRollDamage).toHaveBeenCalledTimes(1);
        });
    });

    describe('Crusher', () => {
        // Seam round-trip: the push payload and the latch write both flow through
        // the real runtime-store reads/writes. Same-round refusal is owned by
        // crusher.test.js's mocked-round latch cycle.
        it('bludgeoning hit lands the push once and stamps the round latch', async () => {
            const store = useKeyValueStore();
            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: makeStats([{
                    type: 'attack_rider',
                    trigger: 'bludgeoning_damage_hit',
                    oncePerTurn: true,
                    name: 'Crusher',
                    options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                }]),
            });

            await resolveAttackDamage(makeAttack({ name: 'Warhammer', damageType: 'Bludgeoning' }), { hit: true });
            await tick();

            expect(writtenEffects().filter((e) => e.source === 'Crusher')).toEqual([
                {
                    target: 'Goblin',
                    source: 'Crusher',
                    option: 'Push 5 ft',
                    effect: 'push',
                    value: 5,
                    sizeLimit: null,
                    noOpportunityAttacks: false,
                    duration: 'until_start_of_next_turn',
                },
            ]);
            expect(callsForKey('_Crusher_usedRound')).toEqual([
                [attackerName, '_Crusher_usedRound', 1, mockCampaignName],
            ]);
            // Round-trip proof: the latch value is readable back from the store.
            expect(store.get(`${attackerName}:_Crusher_usedRound`)).toBe(1);
            expect(mockRollDamage).toHaveBeenCalledTimes(1);
        });
    });

    describe('Piercer', () => {
        it.each([
            {
                branch: 'crit rides a bonus weapon die onto the formula',
                popupHtml: { isCrit: true },
                ctxOverrides: {},
                expectBonus: true,
            },
            {
                branch: 'non-crit formula stays plain',
                popupHtml: { isCrit: false },
                ctxOverrides: { hit: true },
                expectBonus: false,
            },
        ])('$branch', async ({ popupHtml, ctxOverrides, expectBonus }) => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: makeStats([{
                    type: 'damage_bonus',
                    trigger: 'critical_hit_piercing',
                    diceType: 'weapon_die',
                    name: 'Piercer Critical',
                }]),
                popupHtml,
            });

            await resolveAttackDamage(makeAttack({ name: 'Rapier', damageType: 'Piercing' }), ctxOverrides);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledTimes(1);
            const formula = mockRollDamage.mock.calls[0][0].formula;
            // Bonus die VALUE is Math.random() inside the step — pin the token only.
            if (expectBonus) {
                expect(formula).toContain('plus 1d8 [Enhanced Critical]');
            } else {
                expect(formula).not.toContain('[Enhanced Critical]');
            }
        });
    });

    describe('Tavern Brawler', () => {
        // Unarmed/armed condition gate is owned by tavernBrawlerPush.test.js;
        // here the seam proves the effect-keyed passive dispatches and the
        // push marker survives real wiring.
        it('unarmed strike lands the MA-0079 push marker through the seam', async () => {
            useKeyValueStore();
            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: makeStats([{ effect: 'tavern_brawler_push' }]),
            });

            await resolveAttackDamage(
                makeAttack({ name: 'Unarmed Strike', damage: '1d4', damageType: 'Bludgeoning', weaponType: 'unarmed' }),
                { hit: true }
            );
            await tick();

            expect(writtenEffects().filter((e) => e.source === attackerName && e.effect === 'push')).toEqual([
                { target: 'Goblin', source: attackerName, effect: 'push', value: 5, duration: 'instant' },
            ]);
            // #1062 fix#363: seam pins PRESENCE-once only — the exact latch-value
            // tuple and the latch-then-te ordering are byte-owned at the push
            // lane, tavernBrawlerPush.test.js (pair-split table #1061).
            expect(callsForKey('_Tavern_Brawler_Push_UsedRound')).toHaveLength(1);
            expect(mockRollDamage).toHaveBeenCalledTimes(1);
        });
    });

    describe('Charger', () => {
        it('pauses with the Charge Attack modal, then folds the chosen 1d8 into the resumed roll', async () => {
            const store = useKeyValueStore({
                'campaign:lastAttack': { ...playerMeleeHit },
            });
            const stats = makeStats([{
                type: 'attack_rider',
                trigger: 'melee_hit_after_10ft_charge',
                chooseOne: true,
                oncePerTurn: true,
                name: 'Charge Attack',
                options: [
                    { name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d8' },
                    { name: 'Push 10 ft', effect: 'push', value: 10, sizeLimit: 'one_size_larger' },
                ],
            }]);
            const { resolveAttackDamage, resumeAttackPipeline } = UseAttackDamageResolution({ playerStats: stats });

            await resolveAttackDamage(makeAttack(), { hit: true });
            await tick();

            expect(modalState.attackRiderModal).toEqual(
                expect.objectContaining({ targetName: 'Goblin' })
            );
            expect(modalState.attackRiderModal.action.name).toBe('Charge Attack');
            // No choice yet: nothing pushed, nothing latched, damage stalled.
            expect(writtenEffects()).toHaveLength(0);
            expect(mockRollDamage).not.toHaveBeenCalled();

            const { applyRiderOption } = await import('../../services/automation/handlers/combat/attackRiderHandler.js');
            await applyRiderOption(modalState.attackRiderModal.action, stats, mockCampaignName, 'Goblin', ['Damage Bonus']);

            expect(store.get('campaign:targetEffects')).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        source: attackerName,
                        effect: 'damage_bonus',
                        damageExpression: '1d8',
                    }),
                ])
            );
            // FT-074 latch owner recipe: { round, activeCreature } stamped by markOncePerTurn.
            expect(store.get(`${attackerName}:_Charge_Attack_usedRound`)).toEqual({
                round: 1,
                activeCreature: attackerName,
            });

            await resumeAttackPipeline();
            await tick();

            expect(mockRollDamage).toHaveBeenCalledTimes(1);
            expect(mockRollDamage.mock.calls[0][0].formula).toContain(' + 1d8 [Charge Attack]');
        });
    });
});
