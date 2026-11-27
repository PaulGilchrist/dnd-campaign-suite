// @maintained-by-ai 2026-11-27 — main lane for reactionBonusHandler.js: handleBendFate
// gates + modal payload derivation (describeBendFateEvent), applyBendFateChoice →
// applyD20Modifier internals (outcome shifts, condition add/remove writes, ordered
// commit census set→roll→damage→spend→log, frozen-Date.now log rows, campaignName
// threading), handleAcBonus (Finesse gate incl. REAL parseMagicItemName fix#201 legs,
// toggleBuff/addExpiration/log census, heal-rollback branches) and the shared
// mount-gate family handleLeapAside/handleVeer (exact read censuses incl. Veer's
// deliberate mount-conditions NON-read). Test-trim audit 2026-11-27: orphan mocks
// purged (targetResolver, rangeValidation — never imported by the handler), ALL
// defaults re-installed after resetAllMocks in beforeEach, .mockReturnValueOnce
// chains (one leaked a null into the next branch and mis-routed a case) replaced by
// per-case harnesses, mid-test vi.clearAllMocks re-harnesses split into it.each
// families, full-shape popup/log toEqual throughout, gate-ORDER zero-read pins,
// rejecting-addEntry survivor leg added.
// Sibling lanes: inspiring movement lives in reactionBonusHandler.inspiringMovement.test.js
// (canonical for handle() default-fallthrough/applyInspiringMovement/resolveInspiringMovementUses/
// appendAgileStrikes); Unbreakable Majesty lives in reactionBonusHandler.unbreakableMajesty.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle, applyBendFateChoice } from './reactionBonusHandler.js';

// ── Mocks (census-verified against the handler's import graph) ───

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
    getCurrentSorceryPoints: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findAttackRollAgainstTarget: vi.fn(),
}));

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

// Unmocked on purpose (REAL): ../../index.js (executeHandler — never reached from
// this lane's effects), durationParser, infoPopup (builder is the contract under
// test), attackWeaponUtils.parseMagicItemName (fix#201 pins use the real parser).

// ── Re-import after mocking ────────────────────────────────────

import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCurrentSorceryPoints, spendSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { findAttackRollAgainstTarget } from '../../common/damageRollback.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';
const HERO_NAME = 'TestHero';
const FROZEN_NOW = 1700000000000;
const REAL_NOW = Date.now;

function makeAction(overrides = {}) {
    // Merge nested automation; never let a trailing overrides spread replace it wholesale.
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Test Reaction',
        description: 'A reaction bonus.',
        ...rest,
        automation: {
            type: 'reaction_bonus',
            ...automationOverrides,
        },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: HERO_NAME,
        proficiency: 3,
        abilities: [
            { name: 'Charisma', bonus: 2 },
        ],
        conditions: [],
        speed: 30,
        inventory: {
            equipped: overrides.equipped || [],
        },
        equipment: overrides.equipment || [],
        ...overrides,
    };
}

/** Route 'campaign'/'lastAttack' reads to a fixture; everything else reads null. */
function mockLastAttack(overrides = {}) {
    const lastAttack = {
        rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: 'Orc',
        ...overrides,
    };
    getRuntimeValue.mockImplementation((scope, key) =>
        key === 'lastAttack' ? lastAttack : null);
    return lastAttack;
}

const infoPopupShape = (name, description, automation) => ({
    type: 'popup',
    payload: { type: 'automation_info', name, description, automation },
});

// ── Tests ──────────────────────────────────────────────────────

describe('reactionBonusHandler main lane', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        Date.now = REAL_NOW;
        // Re-install EVERY lane default (resetAllMocks wipes factory defaults too).
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockResolvedValue(undefined);
        addEntry.mockResolvedValue(undefined);
        addExpiration.mockResolvedValue(undefined);
        rollExpression.mockReturnValue({ total: 3, rolls: [3] });
        getCurrentSorceryPoints.mockReturnValue(3);
        getClassFeatures.mockReturnValue(null);
        getCombatContext.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue(null);
        applyHealingToTarget.mockReturnValue(null);
        toggleBuff.mockReturnValue({ wasActive: false });
        findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: null, attackerName: null });
    });

    afterEach(() => {
        Date.now = REAL_NOW;
        vi.restoreAllMocks();
    });

    // ── handleBendFate (gates + modal) ─────────────────────────

    describe('handleBendFate', () => {
        const bendFateAction = () => makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
        const AUTO = { type: 'reaction_bonus', effect: 'bonus_or_penalty_choice' };

        it.each([
            {
                title: 'no Sorcery Points',
                setup: () => { getCurrentSorceryPoints.mockReturnValue(0); },
                description: 'Test Reaction: No Sorcery Points available. Requires 1 Sorcery Point.',
                // Gate-ORDER pin: the SP gate runs before the lastAttack channel read.
                expectReads: [],
                expectRolls: 0,
            },
            {
                title: 'no recent d20 test',
                setup: () => {},
                description: 'Test Reaction: No recent D20 test found. Bend Luck can only be used shortly after a creature rolls a d20.',
                // campaignName threading pin on the gate channel.
                expectReads: [['campaign', 'lastAttack', CAMPAIGN]],
                expectRolls: 0,
            },
            {
                title: 'target is the player',
                setup: () => { mockLastAttack({ targetName: HERO_NAME }); },
                description: 'Test Reaction can only be used on another creature, not yourself.',
                expectReads: [['campaign', 'lastAttack', CAMPAIGN]],
                expectRolls: 0,
            },
            {
                title: 'd4 roll fails',
                setup: () => { mockLastAttack({}); rollExpression.mockReturnValue(null); },
                description: 'Test Reaction: Roll failed.',
                expectReads: [['campaign', 'lastAttack', CAMPAIGN]],
                expectRolls: 1,
            },
        ])('handleBendFate refusal — $title', async (c) => {
            c.setup();
            const result = await handle(bendFateAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result).toEqual(infoPopupShape('Test Reaction', c.description, AUTO));
            // Zero-spend census shared by every refusal family.
            expect(getRuntimeValue.mock.calls).toEqual(c.expectReads);
            expect(rollExpression.mock.calls.length).toBe(c.expectRolls);
            expect(spendSorceryPoints.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });

        it.each([
            {
                title: 'tracked specialAction pool wins',
                stats: makePlayerStats({ automation: { specialActions: [{ name: 'Sorcery Points', uses: 7 }] } }),
                featureMax: null,
                expectedMax: 7,
                expectClassFeatures: 0,
            },
            {
                title: 'class features fill in when no tracked pool',
                stats: makePlayerStats(),
                featureMax: { maxSorceryPoints: 5 },
                expectedMax: 5,
                expectClassFeatures: 1,
            },
        ])('handleBendFate max-SP resolution — $title', async (c) => {
            getClassFeatures.mockReturnValue(c.featureMax);
            getCurrentSorceryPoints.mockReturnValue(c.expectedMax);
            mockLastAttack({});

            const result = await handle(bendFateAction(), c.stats, CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(getCurrentSorceryPoints).toHaveBeenCalledWith(HERO_NAME, c.expectedMax);
            expect(getClassFeatures.mock.calls.length).toBe(c.expectClassFeatures);
        });

        it.each([
            {
                title: 'attack vs known AC → Hit',
                lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: 'Orc', targetAc: 16 },
                expected: { isAttack: true, isSave: false, isCheck: false, eventLabel: 'Attack by Goblin', hitStatus: 'Hit', saveStatus: null },
            },
            {
                title: 'attack below AC → Miss',
                lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 5, bonus: 2, targetName: 'Orc', targetAc: 16 },
                expected: { isAttack: true, isSave: false, isCheck: false, eventLabel: 'Attack by Goblin', hitStatus: 'Miss', saveStatus: null },
            },
            {
                title: 'save vs DC → Success',
                lastAttack: { rollType: 'save', attackerName: 'Goblin', d20: 10, bonus: 3, targetName: 'Orc', saveType: 'dexterity', saveDc: 13 },
                expected: { isAttack: false, isSave: true, isCheck: false, eventLabel: 'DEXTERITY by Goblin', hitStatus: null, saveStatus: 'Success' },
            },
            {
                title: 'save below DC → Failure',
                lastAttack: { rollType: 'save', attackerName: 'Goblin', d20: 5, bonus: 2, targetName: 'Orc', saveType: 'wisdom', saveDc: 13 },
                expected: { isAttack: false, isSave: true, isCheck: false, eventLabel: 'WISDOM by Goblin', hitStatus: null, saveStatus: 'Failure' },
            },
            {
                title: 'attack rollType carrying saveDc+saveResult is also a save',
                lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 10, bonus: 3, targetName: 'Orc', saveType: 'dexterity', saveDc: 13, saveResult: 'failure' },
                expected: { isAttack: true, isSave: true, isCheck: false, eventLabel: 'Attack by Goblin', hitStatus: null, saveStatus: 'Success' },
            },
            {
                title: 'check rollType',
                lastAttack: { rollType: 'check', attackerName: 'Goblin', d20: 18, bonus: 4, targetName: 'Orc', checkName: 'Stealth' },
                expected: { isAttack: false, isSave: false, isCheck: true, eventLabel: 'Stealth by Goblin', hitStatus: null, saveStatus: null },
            },
            {
                title: 'skill rollType shares the check path',
                lastAttack: { rollType: 'skill', attackerName: 'Goblin', d20: 18, bonus: 4, targetName: 'Orc', checkName: 'Stealth' },
                expected: { isAttack: false, isSave: false, isCheck: true, eventLabel: 'Stealth by Goblin', hitStatus: null, saveStatus: null },
            },
            {
                title: 'missing d20 still yields a modal with fallback totals',
                lastAttack: { rollType: 'attack', attackerName: 'Goblin', bonus: 5, targetName: 'Orc' },
                expected: { isAttack: true, isSave: false, isCheck: false, eventLabel: 'Attack by Goblin', hitStatus: null, saveStatus: null },
            },
        ])('handleBendFate modal payload — $title', async (c) => {
            getRuntimeValue.mockImplementation((scope, key) =>
                key === 'lastAttack' ? c.lastAttack : null);
            const action = bendFateAction();
            const stats = makePlayerStats();

            const result = await handle(action, stats, CAMPAIGN, MAP);

            // Full-shape modal envelope: no derived field left unpinned.
            expect(result).toEqual({
                type: 'modal',
                modalName: 'bendFateChoice',
                payload: {
                    action,
                    playerStats: stats,
                    campaignName: CAMPAIGN,
                    d4Roll: { total: 3, rolls: [3] },
                    lastAttack: c.lastAttack,
                    attackerName: 'Goblin',
                    ...c.expected,
                },
            });
        });
    });

    // ── applyBendFateChoice → applyD20Modifier ─────────────────

    describe('applyBendFateChoice', () => {
        const baseLastAttack = {
            d20: 12, bonus: 5, targetName: 'Goblin', rollType: 'attack', attackerName: 'Goblin',
        };

        const invokeChoice = (overrides = {}) => applyBendFateChoice({
            action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
            playerStats: makePlayerStats(),
            campaignName: CAMPAIGN,
            d4Roll: 3,
            lastAttack: { ...baseLastAttack },
            mode: 'bonus',
            ...overrides,
        });

        it('miss→hit commit census: set→roll→damage→spend→log order, frozen timestamps', async () => {
            Date.now = () => FROZEN_NOW;
            const playerStats = makePlayerStats();
            const lastAttack = {
                ...baseLastAttack, targetAc: 16, hit: false,
                damageFormula: '2d6+3', damageType: 'slashing',
            };
            const cs = { lastAttack, creatures: [{ name: 'Goblin' }] };
            getCombatContext.mockReturnValue(cs);

            const order = [];
            setRuntimeValue.mockImplementation(() => { order.push('setRuntimeValue'); return Promise.resolve(); });
            rollExpression.mockImplementation(() => { order.push('rollExpression'); return { total: 10 }; });
            applyDamageToTarget.mockImplementation(() => { order.push('applyDamageToTarget'); return { finalDamage: 10 }; });
            spendSorceryPoints.mockImplementation(() => { order.push('spendSorceryPoints'); });
            addEntry.mockImplementation(() => { order.push('addEntry'); return Promise.resolve(); });

            const result = await applyBendFateChoice({
                action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                playerStats,
                campaignName: CAMPAIGN,
                // object form pins the {total} extraction; the number form is exercised
                // by the check-roll-type test below.
                d4Roll: { total: 3, rolls: [3] },
                lastAttack,
                mode: 'bonus',
            });

            expect(order).toEqual(['setRuntimeValue', 'rollExpression', 'applyDamageToTarget', 'spendSorceryPoints', 'addEntry']);
            expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);

            // Exact single lastAttack write with full bendFate stamp.
            expect(setRuntimeValue.mock.calls).toEqual([[
                'campaign', 'lastAttack',
                {
                    ...lastAttack,
                    total: 20, hit: true,
                    bendFateApplied: true, bendFateModifier: 3, bendFateD4: 3, bendFateMode: 'bonus',
                    timestamp: FROZEN_NOW,
                },
                CAMPAIGN,
            ]]);
            // d4 roll is never re-rolled; the formula roll applies to the target.
            expect(rollExpression.mock.calls).toEqual([['2d6+3']]);
            expect(applyDamageToTarget.mock.calls).toEqual([[
                cs, 'Goblin', 10, ['slashing'],
                { campaignName: CAMPAIGN, characters: [playerStats], ignoreResistance: false, attackerName: 'Goblin' },
            ]]);
            expect(spendSorceryPoints.mock.calls).toEqual([[HERO_NAME, 1, CAMPAIGN, 0]]);
            // NOTE: trailing '..' is the handler's real bytes — outcomeNote already
            // ends in '.' and the log template appends another.
            expect(addEntry.mock.calls).toEqual([[CAMPAIGN, {
                type: 'ability_use',
                characterName: HERO_NAME,
                abilityName: 'Bend Luck',
                description: "TestHero used Bend Luck on Goblin. Dice: 3. Applied as bonus. Goblin's roll: d20(12) + 5 = 17 → 20. Outcome: The attack now hits! Rolled 10 damage..",
                timestamp: FROZEN_NOW,
            }]]);
            expect(result).toEqual(infoPopupShape('Bend Luck',
                'Target: Goblin<br/>Rolled <b>3</b><br/>Applied as <b>bonus</b>: <b>+3</b><br/><br/>Attack: d20(12) + 5+3 = <strong>20</strong> vs AC 16 → HIT → The attack now hits! Rolled 10 damage.',
                { type: 'reaction_bonus' }));
        });

        it('survives a rejecting addEntry (log outage does not break the reaction)', async () => {
            getCombatContext.mockReturnValue({ lastAttack: { ...baseLastAttack, targetAc: 16, hit: false } });
            const err = new Error('log offline');
            addEntry.mockRejectedValue(err);
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await invokeChoice();

            expect(result.type).toBe('popup');
            expect(errSpy).toHaveBeenCalledWith('[Bend Luck] Error:', err);
        });

        it('hit→miss penalty reversal rolls back damage via healing', async () => {
            const lastAttack = { ...baseLastAttack, targetAc: 16, hit: true, primaryDamage: 8, rawDamage: 8 };
            const cs = { lastAttack, creatures: [{ name: 'Goblin' }] };
            getCombatContext.mockReturnValue(cs);
            applyHealingToTarget.mockReturnValue({ actualHeal: 8, oldHp: 15, newHp: 23 });

            const result = await invokeChoice({ lastAttack, mode: 'penalty' });

            expect(applyHealingToTarget.mock.calls).toEqual([[cs, 'Goblin', 8, CAMPAIGN]]);
            expect(result.payload.description).toBe(
                'Target: Goblin<br/>Rolled <b>3</b><br/>Applied as <b>penalty</b>: <b>-3</b><br/><br/>Attack: d20(12) + 5-3 = <strong>14</strong> vs AC 16 → MISS → The attack now misses! Undid 8 damage.');
        });

        it('hit→miss with zero recorded damage still declares a miss without healing', async () => {
            const lastAttack = { ...baseLastAttack, targetAc: 16, hit: true };
            getCombatContext.mockReturnValue({ lastAttack });

            const result = await invokeChoice({ lastAttack, mode: 'penalty' });

            expect(applyHealingToTarget.mock.calls).toEqual([]);
            expect(result.payload.description).toContain('The attack now misses!');
            expect(result.payload.description).not.toContain('Undid');
        });

        it.each([
            {
                title: 'no damageFormula on the original attack',
                lastAttack: { ...baseLastAttack, targetAc: 20, hit: false },
                setup: () => {},
                expectDamageCalls: 0,
            },
            {
                title: 'formula roll returns null',
                lastAttack: { ...baseLastAttack, targetAc: 20, hit: false, damageFormula: '2d6+3' },
                setup: () => { rollExpression.mockReturnValue(null); },
                expectDamageCalls: 0,
            },
            {
                title: 'applyDamageToTarget returns null',
                lastAttack: { ...baseLastAttack, targetAc: 20, hit: false, damageFormula: '2d6+3', damageType: 'slashing' },
                setup: () => { rollExpression.mockReturnValue({ total: 10 }); },
                expectDamageCalls: 1,
            },
        ])('miss→hit still reverses when damage cannot be applied — $title', async (c) => {
            getCombatContext.mockReturnValue({ lastAttack: c.lastAttack });
            c.setup();

            const result = await invokeChoice({ lastAttack: c.lastAttack });

            expect(applyDamageToTarget.mock.calls.length).toBe(c.expectDamageCalls);
            expect(result.payload.description).toContain('The attack now hits!');
            expect(result.payload.description).not.toMatch(/hits! Rolled/);
        });

        it('save failure→success strips each save condition from the target (exact write order)', async () => {
            const lastAttack = {
                d20: 8, bonus: 3, targetName: 'Goblin', rollType: 'save', attackerName: 'Goblin',
                saveType: 'wisdom', saveDc: 13, saveConditions: ['charmed', 'incapacitated'],
            };
            getCombatContext.mockReturnValue({ lastAttack });
            getRuntimeValue.mockImplementation((scope, key) =>
                key === 'activeConditions' ? ['charmed', 'incapacitated'] : null);

            const result = await invokeChoice({ lastAttack });

            expect(setRuntimeValue.mock.calls).toEqual([
                ['campaign', 'lastAttack', expect.objectContaining({
                    total: 14, saveResult: 'success', bendFateApplied: true, bendFateMode: 'bonus',
                }), CAMPAIGN],
                // Read is constant across iterations, so each filter only drops its own key.
                ['Goblin', 'activeConditions', ['incapacitated'], CAMPAIGN],
                ['Goblin', 'activeConditions', ['charmed'], CAMPAIGN],
            ]);
            // Read census: conditions read carries NO campaignName arg (2-arg call).
            expect(getRuntimeValue.mock.calls).toEqual([
                ['Goblin', 'activeConditions'],
                ['Goblin', 'activeConditions'],
            ]);
            expect(result.payload.description).toBe(
                'Target: Goblin<br/>Rolled <b>3</b><br/>Applied as <b>bonus</b>: <b>+3</b><br/><br/>WISDOM: d20(8) + 3+3 = <strong>14</strong> vs DC 13 → Success → The save now succeeds!<br/><i>Conditions removed: charmed, incapacitated</i>');
        });

        it('save success→failure appends each save condition (exact write order)', async () => {
            const lastAttack = {
                d20: 10, bonus: 3, targetName: 'Goblin', rollType: 'save', attackerName: 'Goblin',
                saveType: 'wisdom', saveDc: 13, saveConditions: ['charmed', 'frightened'],
            };
            getCombatContext.mockReturnValue({ lastAttack });
            getRuntimeValue.mockImplementation((scope, key) =>
                key === 'activeConditions' ? ['frightened'] : null);

            const result = await invokeChoice({ lastAttack, mode: 'penalty' });

            expect(setRuntimeValue.mock.calls).toEqual([
                ['campaign', 'lastAttack', expect.objectContaining({
                    total: 10, saveResult: 'failure', bendFateApplied: true, bendFateMode: 'penalty',
                }), CAMPAIGN],
                ['Goblin', 'activeConditions', ['frightened', 'charmed'], CAMPAIGN],
                ['Goblin', 'activeConditions', ['frightened'], CAMPAIGN],
            ]);
            expect(result.payload.description).toContain('The save now fails!');
            expect(result.payload.description).toContain('Conditions applied: charmed, frightened');
        });

        it('save flip with no authored saveConditions writes only the lastAttack update', async () => {
            const lastAttack = {
                d20: 8, bonus: 3, targetName: 'Goblin', rollType: 'save', attackerName: 'Goblin',
                saveType: 'wisdom', saveDc: 13,
            };
            getCombatContext.mockReturnValue({ lastAttack });

            const result = await invokeChoice({ lastAttack });

            expect(setRuntimeValue.mock.calls.length).toBe(1);
            expect(getRuntimeValue.mock.calls).toEqual([]);
            expect(result.payload.description).toContain('The save now succeeds!');
            expect(result.payload.description).not.toContain('Conditions');
        });

        it.each([
            {
                title: 'bonus still hits',
                lastAttack: { ...baseLastAttack, targetAc: 14, hit: true },
                mode: 'bonus',
                expected: 'The attack still hits.',
            },
            {
                title: 'penalty still misses',
                lastAttack: { ...baseLastAttack, targetAc: 25, hit: false },
                mode: 'penalty',
                expected: 'The attack still misses.',
            },
            {
                title: 'unknown AC and unknown hit flag report no change',
                lastAttack: { ...baseLastAttack },
                mode: 'bonus',
                expected: 'No change in outcome.',
            },
            {
                title: 'save still succeeds (bonus side)',
                lastAttack: { d20: 10, bonus: 5, targetName: 'Goblin', rollType: 'save', saveType: 'wisdom', saveDc: 12, saveConditions: ['charmed'] },
                mode: 'penalty',
                expected: 'The save still succeeds.',
            },
            {
                title: 'save still fails (penalty side)',
                lastAttack: { d20: 5, bonus: 2, targetName: 'Goblin', rollType: 'save', saveType: 'wisdom', saveDc: 13, saveConditions: ['charmed'] },
                mode: 'bonus',
                expected: 'The save still fails.',
            },
        ])('no outcome shift — $title: lastAttack still committed, zero damage ops', async (c) => {
            getCombatContext.mockReturnValue({ lastAttack: c.lastAttack });

            const result = await invokeChoice({ lastAttack: c.lastAttack, mode: c.mode });

            expect(result.payload.description).toContain(c.expected);
            expect(setRuntimeValue.mock.calls.length).toBe(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack',
                expect.objectContaining({ bendFateApplied: true }), CAMPAIGN);
            expect(applyDamageToTarget.mock.calls).toEqual([]);
            expect(applyHealingToTarget.mock.calls).toEqual([]);
        });

        it('check roll-type shifts the total regardless of combat context', async () => {
            const lastAttack = {
                d20: 15, bonus: 4, targetName: 'Goblin', rollType: 'check',
                attackerName: 'Goblin', checkName: 'Stealth',
            };

            // d4Roll number form + combat-context-free check branch.
            const result = await invokeChoice({
                lastAttack, d4Roll: 3,
            });

            expect(setRuntimeValue.mock.calls).toEqual([[
                'campaign', 'lastAttack',
                expect.objectContaining({ total: 22, bendFateD4: 3, bendFateMode: 'bonus' }),
                CAMPAIGN,
            ]]);
            expect(spendSorceryPoints).toHaveBeenCalledWith(HERO_NAME, 1, CAMPAIGN, 0);
            expect(result.payload.description).toBe(
                'Target: Goblin<br/>Rolled <b>3</b><br/>Applied as <b>bonus</b>: <b>+3</b><br/><br/>Stealth: d20(15) + 4+3 = <strong>22</strong> New total: 22.');
        });

        it('null combat context: popup describes the shift but nothing is committed', async () => {
            const lastAttack = { ...baseLastAttack, targetAc: 20, hit: false };

            const result = await invokeChoice({ lastAttack });

            expect(result).toEqual(infoPopupShape('Bend Luck',
                'Target: Goblin<br/>Rolled <b>3</b><br/>Applied as <b>bonus</b>: <b>+3</b><br/><br/>Attack: d20(12) + 5+3 = <strong>20</strong> vs AC 20 → HIT',
                { type: 'reaction_bonus' }));
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(applyDamageToTarget.mock.calls).toEqual([]);
            expect(applyHealingToTarget.mock.calls).toEqual([]);
        });

        it('hit flag with unknown AC: penalty-less bonus still declares a miss (quirk pin)', async () => {
            // Source quirk pinned honestly: newHit===null (AC unknown) falls into the
            // oldHit&&!newHit branch, so a BONUS reports "now misses" with no damage known.
            const lastAttack = { ...baseLastAttack, hit: true };
            getCombatContext.mockReturnValue({ lastAttack });

            const result = await invokeChoice({ lastAttack });

            expect(result.payload.description).toBe(
                'Target: Goblin<br/>Rolled <b>3</b><br/>Applied as <b>bonus</b>: <b>+3</b><br/><br/>Attack: d20(12) + 5+3 = <strong>20</strong> vs AC — → MISS → The attack now misses! (Original was a hit)');
            expect(applyHealingToTarget.mock.calls).toEqual([]);
        });
    });

    // ── handleAcBonus (Defensive Duelist) ──────────────────────

    describe('handleAcBonus', () => {
        const finesseWeapon = { name: 'Shortsword', equipment_category: 'Weapon', properties: ['Finesse', 'Light'] };
        const nonFinesseWeapon = { name: 'Longsword', equipment_category: 'Weapon', properties: [] };
        const AC_AUTO = { type: 'reaction_bonus', effect: 'ac_bonus' };
        const mockAttackEvent = { d20: 14, bonus: 5, targetAc: 15, rawDamage: 8, attackerName: 'Goblin' };
        const wieldStats = (equipped, equipment) =>
            makePlayerStats({ equipped, equipment: equipment ?? [finesseWeapon] });

        it.each([
            {
                title: 'nothing equipped',
                stats: makePlayerStats(),
                expected: 'You must be wielding a Finesse weapon to use Test Reaction.',
                expectLookup: 0,
            },
            {
                title: 'equipped weapon lacks the Finesse property',
                stats: makePlayerStats({ equipped: ['Longsword'], equipment: [nonFinesseWeapon] }),
                expected: 'You must be wielding a Finesse weapon to use Test Reaction.',
                expectLookup: 0,
            },
            {
                title: 'equipment catalogue missing',
                stats: makePlayerStats({ equipped: ['Shortsword'], equipment: undefined }),
                expected: 'You must be wielding a Finesse weapon to use Test Reaction.',
                expectLookup: 0,
            },
            {
                title: 'inventory has no equipped array',
                stats: makePlayerStats({ inventory: {} }),
                expected: 'You must be wielding a Finesse weapon to use Test Reaction.',
                expectLookup: 0,
            },
            {
                title: 'only non-string equipped entries',
                stats: makePlayerStats({ equipped: [null, undefined] }),
                expected: 'You must be wielding a Finesse weapon to use Test Reaction.',
                expectLookup: 0,
            },
            {
                title: 'enhancement prefix stripped for catalogue lookup (+3 Shortsword)',
                stats: wieldStats(['+3 Shortsword']),
                expected: 'No recent attack targeting TestHero to react to.',
                expectLookup: 1,
            },
            {
                title: 'digit-less "+" keeps the name (fix#201 — old slice(3) produced "hortsword")',
                stats: wieldStats(['+ Shortsword']),
                expected: 'No recent attack targeting TestHero to react to.',
                expectLookup: 1,
            },
            {
                title: 'non-string entries skipped, valid entry still found',
                stats: wieldStats([null, undefined, 'Shortsword']),
                expected: 'No recent attack targeting TestHero to react to.',
                expectLookup: 1,
            },
        ])('handleAcBonus refusal — $title', async (c) => {
            const result = await handle(makeAction({ automation: { effect: 'ac_bonus' } }), c.stats, CAMPAIGN, MAP);

            expect(result).toEqual(infoPopupShape('Test Reaction', c.expected, AC_AUTO));
            // Gate-ORDER zero-call censuses: buff never toggled, log never written.
            expect(toggleBuff.mock.calls).toEqual([]);
            expect(addExpiration.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
            expect(findAttackRollAgainstTarget.mock.calls.length).toBe(c.expectLookup);
        });

        it('activation commit census: lookup→toggleBuff→addExpiration→log, popup shares log description', async () => {
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: mockAttackEvent, attackerName: 'Goblin' });
            const order = [];
            toggleBuff.mockImplementation(() => { order.push('toggleBuff'); return { wasActive: false }; });
            addExpiration.mockImplementation(() => { order.push('addExpiration'); return Promise.resolve(); });
            addEntry.mockImplementation(() => { order.push('addEntry'); return Promise.resolve(); });

            const result = await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats({ equipped: ['Shortsword'], equipment: [finesseWeapon] }),
                CAMPAIGN, MAP
            );

            expect(findAttackRollAgainstTarget.mock.calls).toEqual([[HERO_NAME, CAMPAIGN]]);
            expect(order).toEqual(['toggleBuff', 'addExpiration', 'addEntry']);
            expect(toggleBuff.mock.calls).toEqual([[
                HERO_NAME, 'Test Reaction',
                { type: 'reaction_bonus', effect: 'defensive_duelist', acBonus: 3 },
                CAMPAIGN,
            ]]);
            expect(addExpiration.mock.calls).toEqual([[{
                attackerName: HERO_NAME, targetName: HERO_NAME,
                effects: [{ type: 'remove_active_buff', buffName: 'Test Reaction' }],
                campaignName: CAMPAIGN, rounds: undefined, expireOnCreatureName: HERO_NAME,
            }]]);
            const expectedDescription = 'Test Reaction activated — +3 AC until start of your next turn. The attack still hits. (Roll 19 >= AC 18)';
            expect(addEntry.mock.calls).toEqual([[CAMPAIGN, {
                type: 'ability_use',
                characterName: HERO_NAME,
                abilityName: 'Test Reaction',
                description: expectedDescription,
            }]]);
            expect(result).toEqual(infoPopupShape('Test Reaction', expectedDescription, AC_AUTO));
            // "Still hits" path must not fetch the combat context at all.
            expect(getCombatContext.mock.calls).toEqual([]);
        });

        it('already-active toggle refuses without expiring or logging', async () => {
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: mockAttackEvent, attackerName: 'Goblin' });
            toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats({ equipped: ['Shortsword'], equipment: [finesseWeapon] }),
                CAMPAIGN, MAP
            );

            expect(result).toEqual(infoPopupShape('Test Reaction', 'Test Reaction is already active.', AC_AUTO));
            expect(addExpiration.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });

        it.each([
            {
                title: 'damage rolled back via healing',
                attackEvent: { ...mockAttackEvent, rawDamage: 8, targetAc: 17 },
                setup: () => {
                    getCombatContext.mockReturnValue({ creatures: [{ name: HERO_NAME }] });
                    applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 10, newHp: 15 });
                },
                expectedDescription: 'Test Reaction activated — +3 AC until start of your next turn. The attack misses! (Roll 19 < AC 20) — 5 HP healed.',
                expectContext: 1,
                expectHeal: 1,
            },
            {
                title: 'zero raw damage skips the context fetch entirely',
                attackEvent: { ...mockAttackEvent, rawDamage: 0, targetAc: 17 },
                setup: () => {},
                expectedDescription: 'Test Reaction activated — +3 AC until start of your next turn. The attack misses! (Roll 19 < AC 20)',
                expectContext: 0,
                expectHeal: 0,
            },
            {
                title: 'null combat context misses without healing',
                attackEvent: { ...mockAttackEvent, rawDamage: 8, targetAc: 17 },
                setup: () => { getCombatContext.mockReturnValue(null); },
                expectedDescription: 'Test Reaction activated — +3 AC until start of your next turn. The attack misses! (Roll 19 < AC 20)',
                expectContext: 1,
                expectHeal: 0,
            },
            {
                title: 'null heal result misses without healing',
                attackEvent: { ...mockAttackEvent, rawDamage: 8, targetAc: 17 },
                setup: () => {
                    getCombatContext.mockReturnValue({ creatures: [] });
                    applyHealingToTarget.mockReturnValue(null);
                },
                expectedDescription: 'Test Reaction activated — +3 AC until start of your next turn. The attack misses! (Roll 19 < AC 20)',
                expectContext: 1,
                expectHeal: 1,
            },
        ])('handleAcBonus miss reversal — $title', async (c) => {
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: c.attackEvent, attackerName: 'Goblin' });
            c.setup();

            const result = await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats({ equipped: ['Shortsword'], equipment: [finesseWeapon] }),
                CAMPAIGN, MAP
            );

            expect(result.payload.description).toBe(c.expectedDescription);
            expect(getCombatContext.mock.calls.length).toBe(c.expectContext);
            expect(applyHealingToTarget.mock.calls.length).toBe(c.expectHeal);
        });

        it('heal rollback targets the player with campaignName threading', async () => {
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: { ...mockAttackEvent, targetAc: 17 }, attackerName: 'Goblin' });
            const cs = { creatures: [] };
            getCombatContext.mockReturnValue(cs);
            applyHealingToTarget.mockReturnValue({ actualHeal: 8, oldHp: 2, newHp: 10 });

            await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats({ equipped: ['Shortsword'], equipment: [finesseWeapon] }),
                CAMPAIGN, MAP
            );

            expect(applyHealingToTarget.mock.calls).toEqual([[cs, HERO_NAME, 8, CAMPAIGN]]);
        });

        it.each([
            {
                title: 'undefined proficiency defaults to +0 AC',
                stats: makePlayerStats({ proficiency: undefined, equipped: ['Shortsword'], equipment: [finesseWeapon] }),
                expectIn: '+0 AC',
                expectAcBonus: 0,
            },
            {
                title: 'null targetAc renders the current "AC null" tail',
                stats: makePlayerStats({ equipped: ['Shortsword'], equipment: [finesseWeapon] }),
                expectIn: 'The attack still hits. (Roll 19 >= AC null)',
                expectAcBonus: 3,
                attackEvent: { ...mockAttackEvent, targetAc: null },
            },
        ])('handleAcBonus edge inputs — $title', async (c) => {
            findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: c.attackEvent || mockAttackEvent,
                attackerName: 'Goblin',
            });
            const result = await handle(makeAction({ automation: { effect: 'ac_bonus' } }), c.stats, CAMPAIGN, MAP);

            expect(result.payload.description).toContain(c.expectIn);
            expect(toggleBuff).toHaveBeenCalledWith(HERO_NAME, 'Test Reaction',
                expect.objectContaining({ effect: 'defensive_duelist', acBonus: c.expectAcBonus }), CAMPAIGN);
        });
    });

    // ── handleLeapAside / handleVeer (shared mount gates) ──────
    // Both gate on mountName → player-incapacitated; only Leap Aside also
    // checks the mount's own conditions (the Veer activation census pins its
    // deliberate NON-read).

    const LEAP = { effect: 'zero_on_success_half_on_fail_for_mount', defaultName: 'Leap Aside', activeKey: 'leapAsideActive' };
    const VEER = { effect: 'redirect_attack_to_self', defaultName: 'Veer', activeKey: 'veerActive' };

    const mountAction = (feature, name) => {
        const action = makeAction({ automation: { effect: feature.effect } });
        if (name) action.name = name; else delete action.name;
        return action;
    };

    describe('mount-reaction gates', () => {
        it.each([
            {
                title: 'Leap Aside refuses when unmounted',
                feature: LEAP,
                setup: () => {},
                playerConditions: [],
                expected: 'Test Reaction requires you to be mounted. No mount is currently active.',
                // Gate-ORDER pin: refusal happens after the mountName read only.
                expectedReads: [[HERO_NAME, 'mountName', CAMPAIGN]],
            },
            {
                title: 'Veer refuses when unmounted',
                feature: VEER,
                setup: () => {},
                playerConditions: [],
                expected: 'Test Reaction requires you to be mounted. No mount is currently active.',
                expectedReads: [[HERO_NAME, 'mountName', CAMPAIGN]],
            },
            {
                title: 'Leap Aside refuses a player incapacitated (object format)',
                feature: LEAP,
                setup: () => { getRuntimeValue.mockImplementation((s, k) => k === 'mountName' ? 'Warhorse' : null); },
                playerConditions: [{ key: 'incapacitated' }],
                expected: 'Test Reaction requires you to not be Incapacitated.',
                // Mount-conditions channel never read once the player gate trips.
                expectedReads: [[HERO_NAME, 'mountName', CAMPAIGN]],
            },
            {
                title: 'Leap Aside refuses a player incapacitated (string format)',
                feature: LEAP,
                setup: () => { getRuntimeValue.mockImplementation((s, k) => k === 'mountName' ? 'Warhorse' : null); },
                playerConditions: ['incapacitated'],
                expected: 'Test Reaction requires you to not be Incapacitated.',
                expectedReads: [[HERO_NAME, 'mountName', CAMPAIGN]],
            },
            {
                title: 'Veer refuses a player incapacitated (object format)',
                feature: VEER,
                setup: () => { getRuntimeValue.mockImplementation((s, k) => k === 'mountName' ? 'Warhorse' : null); },
                playerConditions: [{ key: 'incapacitated' }],
                expected: 'Test Reaction requires you to not be Incapacitated.',
                expectedReads: [[HERO_NAME, 'mountName', CAMPAIGN]],
            },
            {
                title: 'Veer refuses a player incapacitated (string format)',
                feature: VEER,
                setup: () => { getRuntimeValue.mockImplementation((s, k) => k === 'mountName' ? 'Warhorse' : null); },
                playerConditions: ['incapacitated'],
                expected: 'Test Reaction requires you to not be Incapacitated.',
                expectedReads: [[HERO_NAME, 'mountName', CAMPAIGN]],
            },
            {
                title: 'Leap Aside refuses an incapacitated mount',
                feature: LEAP,
                setup: () => {
                    getRuntimeValue.mockImplementation((s, k) => {
                        if (k === 'mountName') return 'Warhorse';
                        if (k === 'conditions') return [{ key: 'incapacitated' }];
                        return null;
                    });
                },
                playerConditions: [],
                expected: 'Test Reaction requires your mount to not be Incapacitated.',
                expectedReads: [
                    [HERO_NAME, 'mountName', CAMPAIGN],
                    ['Warhorse', 'conditions', CAMPAIGN],
                ],
            },
        ])('$title', async (c) => {
            c.setup();
            const result = await handle(mountAction(c.feature, 'Test Reaction'), makePlayerStats({ conditions: c.playerConditions }), CAMPAIGN, MAP);

            expect(result).toEqual(infoPopupShape('Test Reaction', c.expected,
                { type: 'reaction_bonus', effect: c.feature.effect }));
            expect(getRuntimeValue.mock.calls).toEqual(c.expectedReads);
            // Zero-commit + zero-log census on every refusal.
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
        });
    });

    describe('mount-reaction activation', () => {
        it.each([
            {
                title: 'Leap Aside activates with clean mount conditions []',
                feature: LEAP,
                mountConditions: [],
                expectedPopup: 'Test Reaction activated for Warhorse. The mount takes no damage on a successful Dexterity saving throw, and only half damage on a failed save.',
                expectedSetArgs: [HERO_NAME, 'leapAsideActive', true, CAMPAIGN],
                expectedReads: [
                    [HERO_NAME, 'mountName', CAMPAIGN],
                    ['Warhorse', 'conditions', CAMPAIGN],
                ],
                // Log prose hardcodes "Leap Aside" while abilityName mirrors the
                // feature name — pinned as the handler's real bytes.
                expectedLogDescription: 'TestHero activated Leap Aside for Warhorse. Mount takes no damage on Dex save success, half on fail.',
            },
            {
                title: 'Leap Aside activates when mount conditions read null',
                feature: LEAP,
                mountConditions: null,
                expectedPopup: 'Test Reaction activated for Warhorse. The mount takes no damage on a successful Dexterity saving throw, and only half damage on a failed save.',
                expectedSetArgs: [HERO_NAME, 'leapAsideActive', true, CAMPAIGN],
                expectedReads: [
                    [HERO_NAME, 'mountName', CAMPAIGN],
                    ['Warhorse', 'conditions', CAMPAIGN],
                ],
                expectedLogDescription: 'TestHero activated Leap Aside for Warhorse. Mount takes no damage on Dex save success, half on fail.',
            },
            {
                title: 'Veer activates and never reads mount conditions',
                feature: VEER,
                mountConditions: [{ key: 'incapacitated' }],
                expectedPopup: 'Test Reaction activated for Warhorse. When an attack hits your mount, you can use your Reaction to force the attack to hit you instead.',
                expectedSetArgs: [HERO_NAME, 'veerActive', true, CAMPAIGN],
                // times(1)-style detector: the mount-conditions channel stays unread.
                expectedReads: [[HERO_NAME, 'mountName', CAMPAIGN]],
                expectedLogDescription: 'TestHero activated Veer for Warhorse. Attacks hitting the mount can be redirected to you.',
            },
        ])('$title', async (c) => {
            Date.now = () => FROZEN_NOW;
            getRuntimeValue.mockImplementation((scope, key) => {
                if (key === 'mountName') return 'Warhorse';
                if (key === 'conditions') return c.mountConditions;
                return null;
            });

            const result = await handle(mountAction(c.feature, 'Test Reaction'), makePlayerStats(), CAMPAIGN, MAP);

            expect(result).toEqual(infoPopupShape('Test Reaction', c.expectedPopup,
                { type: 'reaction_bonus', effect: c.feature.effect }));
            expect(getRuntimeValue.mock.calls).toEqual(c.expectedReads);
            expect(setRuntimeValue.mock.calls).toEqual([c.expectedSetArgs]);
            expect(addEntry.mock.calls).toEqual([[CAMPAIGN, {
                type: 'ability_use',
                characterName: HERO_NAME,
                abilityName: 'Test Reaction',
                description: c.expectedLogDescription,
                timestamp: FROZEN_NOW,
            }]]);
        });

        it.each([
            { title: 'Leap Aside keeps a custom name', feature: LEAP, fallback: 'Leap Aside' },
            { title: 'Veer keeps a custom name', feature: VEER, fallback: 'Veer' },
            { title: 'Leap Aside falls back when unnamed', feature: LEAP, fallback: 'Leap Aside', unnamed: true },
            { title: 'Veer falls back when unnamed', feature: VEER, fallback: 'Veer', unnamed: true },
        ])('feature naming — $title', async (c) => {
            getRuntimeValue.mockImplementation((scope, key) =>
                key === 'mountName' ? 'Warhorse' : key === 'conditions' ? [] : null);

            const result = await handle(mountAction(c.feature, c.unnamed ? null : 'Custom Name'), makePlayerStats(), CAMPAIGN, MAP);

            const expectedName = c.unnamed ? c.fallback : 'Custom Name';
            expect(result.payload.name).toBe(expectedName);
            expect(result.payload.description).toContain(expectedName);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: HERO_NAME,
                abilityName: expectedName,
            }));
        });
    });
});
