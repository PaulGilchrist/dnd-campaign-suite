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

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getAttackRiderOptions: vi.fn(),
    getAttackRiderOptionsByContext: vi.fn(),
    executeAttackRiderManeuver: vi.fn(),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { getAttackRiderOptions, getAttackRiderOptionsByContext } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const defaultRollResult = { total: 5, rolls: [5], modifier: 0 };
const defaultCtx = { targetName: 'Goblin', sneakAttackDice: 0 };

const mockPlayerStats = {
    name: 'TestFighter',
    level: 5,
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
    ],
    proficiency: 3,
    class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
};

const mockCampaignName = 'test-campaign';

const mockSetPopupHtml = vi.fn();
const mockRollDamage = vi.fn();
const mockBuildCtx = vi.fn(() => Promise.resolve(defaultCtx));
const mockBuildCtxSync = vi.fn(() => Promise.resolve(defaultCtx));
const mockSetDamageTypeChoice = vi.fn();
const mockSetDivineFuryChoice = vi.fn();
const mockSetWeaponMasteryModal = vi.fn();
const mockSetAttackRiderModal = vi.fn();
const mockSetAttackRiderManeuverPrompt = vi.fn();
const mockSetSweepingAttackTargetModal = vi.fn();
const mockPendingDamageRef = { current: null };

function UseAttackDamageResolution(overrides = {}) {
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
        setAttackRiderManeuverPrompt: mockSetAttackRiderManeuverPrompt,
        setSweepingAttackTargetModal: mockSetSweepingAttackTargetModal,
        pendingDamageRef: mockPendingDamageRef,
        ...overrides,
    };
    return useAttackDamageResolution(deps);
}

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

describe('useAttackDamageResolution - attack rider maneuvers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue(defaultRollResult);
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 6 });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        getAttackRiderOptions.mockResolvedValue([]);
        getAttackRiderOptionsByContext.mockResolvedValue([]);
        getCombatContext.mockResolvedValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        loadCombatSummary.mockResolvedValue(null);
        mockBuildCtx.mockReturnValue(Promise.resolve(defaultCtx));
        mockBuildCtxSync.mockReturnValue(Promise.resolve(defaultCtx));
        mockPendingDamageRef.current = null;
    });

    // ── Precision Attack (miss) ───────────────────────────────────────

    describe('Precision Attack (miss)', () => {
        it('prompts for maneuver when attack misses and maneuvers are available', async () => {
            getAttackRiderOptionsByContext.mockResolvedValue([
                { name: 'Precision Attack', effect: 'attack_roll_bonus' },
            ]);
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: false, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderManeuverPrompt).toHaveBeenCalledWith({
                maneuvers: [{ name: 'Precision Attack', effect: 'attack_roll_bonus' }],
                attack,
                popupHtml: { hit: false, isCrit: false, targetName: 'Goblin' },
                isMiss: true,
            });
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it('does not prompt when attack hits', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderManeuverPrompt).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('does not prompt when isCrit is true', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: true, isCrit: true, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderManeuverPrompt).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('does not prompt when no maneuvers are available for miss', async () => {
            getAttackRiderOptionsByContext.mockResolvedValue([]);
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: false, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderManeuverPrompt).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('does not prompt when setAttackRiderManeuverPrompt is undefined', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: false, isCrit: false },
                setAttackRiderManeuverPrompt: undefined,
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('passes weaponType and isUnarmedStrike to getAttackRiderOptionsByContext', async () => {
            getAttackRiderOptionsByContext.mockResolvedValue([]);
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: false, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Unarmed Strike', damage: '1d4', damageType: 'bludgeoning',
                weaponType: 'unarmed', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(getAttackRiderOptionsByContext).toHaveBeenCalledWith(
                mockPlayerStats,
                'test-campaign',
                expect.objectContaining({
                    weaponType: 'unarmed',
                    isUnarmedStrike: true,
                    targetName: 'Goblin',
                }),
                'miss',
            );
        });
    });

    // ── Superior Strike on hit ────────────────────────────────────────

    describe('Superior Strike on hit', () => {
        it('prompts for maneuver when attack hits and maneuvers are available', async () => {
            getAttackRiderOptions.mockResolvedValue([
                { name: 'Gouging Attack', effect: 'damage_bonus' },
            ]);
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderManeuverPrompt).toHaveBeenCalledWith({
                maneuvers: [{ name: 'Gouging Attack', effect: 'damage_bonus' }],
                attack,
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it('does not prompt when attack misses', async () => {
            getAttackRiderOptions.mockResolvedValue([
                { name: 'Gouging Attack', effect: 'damage_bonus' },
            ]);
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: false, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderManeuverPrompt).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('does not prompt when no maneuvers are available on hit', async () => {
            getAttackRiderOptions.mockResolvedValue([]);
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderManeuverPrompt).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('does not prompt when setAttackRiderManeuverPrompt is undefined', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
                setAttackRiderManeuverPrompt: undefined,
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
        });
    });

    // ── handleAttackRiderManeuverUse ──────────────────────────────────

    describe('handleAttackRiderManeuverUse', () => {
        it('returns { formula, total, rolls } for non-miss maneuvers', async () => {
            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const maneuver = { name: 'Gouging Attack' };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: false };

            const result = await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                '1d8+3', 8, [5, 3],
            );

            expect(result).toEqual({
                formula: '1d8+3',
                total: 8,
                rolls: [5, 3],
            });
            expect(mockSetAttackRiderManeuverPrompt).toHaveBeenCalledWith(null);
            expect(mockSetPopupHtml).not.toHaveBeenCalled();
        });

        it('returns { formula, total, rolls, isMissResult } for miss maneuvers with attack_roll_bonus effect', async () => {
            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({
                popupHtml: { rolls: [12], bonus: 3, targetAc: 15, isCrit: false },
            });
            const maneuver = {
                name: 'Precision Attack',
                effect: 'attack_roll_bonus',
                dieExpression: '1d6',
            };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: true, hit: false };
            rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

            const result = await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                '1d8+3', 8, [5, 3],
            );

            expect(result.isMissResult).toBe(true);
            expect(result.hit).toBe(true);
            expect(result.description).toContain('Precision Attack');
            expect(result.description).toContain('The attack now hits!');
            expect(mockSetAttackRiderManeuverPrompt).toHaveBeenCalledWith(null);
            expect(mockSetPopupHtml).toHaveBeenCalled();
        });

        it('handles miss that still misses after precision attack', async () => {
            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({
                popupHtml: { rolls: [8], bonus: 2, targetAc: 20, isCrit: false },
            });
            const maneuver = {
                name: 'Precision Attack',
                effect: 'attack_roll_bonus',
                dieExpression: '1d6',
            };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: true, hit: false };
            rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });

            const result = await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                '1d8+3', 8, [5, 3],
            );

            expect(result.isMissResult).toBe(true);
            expect(result.hit).toBe(false);
            expect(result.description).toContain('The attack still misses');
        });

        it('handles natural 20 in precision attack', async () => {
            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({
                popupHtml: { rolls: [20], bonus: 3, targetAc: 15, isCrit: true },
            });
            const maneuver = {
                name: 'Precision Attack',
                effect: 'attack_roll_bonus',
                dieExpression: '1d6',
            };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: false, hit: true };

            const result = await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                '1d8+3', 8, [5, 3],
            );

            expect(result.isMissResult).toBe(undefined);
            expect(mockSetAttackRiderManeuverPrompt).toHaveBeenCalledWith(null);
        });

        it('adds damage bonus when maneuver has damageBonus and result type is popup', async () => {
            const { executeAttackRiderManeuver } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
            executeAttackRiderManeuver.mockResolvedValue({
                type: 'popup',
                payload: { hit: true },
            });
            rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const maneuver = {
                name: 'Gouging Attack',
                damageBonus: true,
                dieExpression: '1d6',
            };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: false };

            const result = await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                '1d8+3', 8, [5, 3],
            );

            expect(result.formula).toContain('+ 4');
            expect(result.total).toBeGreaterThan(8);
        });

        it('opens sweeping attack target modal when maneuver returns that type', async () => {
            const { executeAttackRiderManeuver } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
            executeAttackRiderManeuver.mockResolvedValue({
                type: 'modal',
                modalName: 'sweepingAttackTarget',
                payload: { title: 'Select Target' },
            });

            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const maneuver = { name: 'Sweeping Attack' };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: false };

            await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                '1d8+3', 8, [5, 3],
            );

            expect(mockSetSweepingAttackTargetModal).toHaveBeenCalledWith({ title: 'Select Target' });
        });

        it('sets popupHtml when maneuver result type is popup', async () => {
            const { executeAttackRiderManeuver } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
            executeAttackRiderManeuver.mockResolvedValue({
                type: 'popup',
                payload: { hit: true, isCrit: false },
            });

            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const maneuver = { name: 'Test Maneuver' };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: false };

            await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                '1d8+3', 8, [5, 3],
            );

            expect(mockSetPopupHtml).toHaveBeenCalledWith({ hit: true, isCrit: false });
        });

        it('handles maneuver string instead of object', async () => {
            const { executeAttackRiderManeuver } = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
            executeAttackRiderManeuver.mockResolvedValue({});

            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const maneuver = 'Gouging Attack';
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: false };

            await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                '1d8+3', 8, [5, 3],
            );

            expect(executeAttackRiderManeuver).toHaveBeenCalledWith(
                expect.any(Object),
                mockPlayerStats,
                'test-campaign',
                'Gouging Attack',
                expect.any(Object),
            );
        });
    });

    // ── handleAttackRiderManeuverSkip ─────────────────────────────────

    describe('handleAttackRiderManeuverSkip', () => {
        it('clears the maneuver prompt', async () => {
            const { handleAttackRiderManeuverSkip } = UseAttackDamageResolution();
            handleAttackRiderManeuverSkip();

            expect(mockSetAttackRiderManeuverPrompt).toHaveBeenCalledWith(null);
        });
    });

    // ── Cunning Strike ────────────────────────────────────────────────

    describe('Cunning Strike', () => {
        it('prompts for Cunning Strike when hit, sneak attack > 0, and not used this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_CunningStrike_usedRound') return null;
                if (key === '_cunningStrikeSkippedRound') return null;
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                lastAttack: { hit: true, targetName: 'Goblin' },
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            const stats = {
                ...mockPlayerStats,
                name: 'TestRogue',
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [
                        { name: 'Cunning Strike', type: 'attack_rider' },
                    ],
                },
            };
            const ctx = { targetName: 'Goblin', sneakAttackDice: 2 };
            mockBuildCtx.mockReturnValue(Promise.resolve(ctx));
            mockBuildCtxSync.mockReturnValue(Promise.resolve(ctx));

            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Rapier', damage: '1d8+3', damageType: 'piercing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderModal).toHaveBeenCalledWith({
                action: { name: 'Cunning Strike', type: 'attack_rider' },
                playerStats: stats,
                campaignName: 'test-campaign',
                targetName: 'Goblin',
            });
            expect(mockPendingDamageRef.current).toEqual({
                _cunningStrike: true,
                attack,
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it('skips Cunning Strike when already used this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_CunningStrike_usedRound') return 1;
                if (key === '_cunningStrikeSkippedRound') return null;
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                lastAttack: { hit: true, targetName: 'Goblin' },
            });

            const stats = {
                ...mockPlayerStats,
                name: 'TestRogue',
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [
                        { name: 'Cunning Strike', type: 'attack_rider' },
                    ],
                },
            };
            const ctx = { targetName: 'Goblin', sneakAttackDice: 2 };
            mockBuildCtx.mockReturnValue(Promise.resolve(ctx));
            mockBuildCtxSync.mockReturnValue(Promise.resolve(ctx));

            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Rapier', damage: '1d8+3', damageType: 'piercing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderModal).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('skips Cunning Strike when skipped this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_CunningStrike_usedRound') return null;
                if (key === '_cunningStrikeSkippedRound') return 1;
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                lastAttack: { hit: true, targetName: 'Goblin' },
            });

            const stats = {
                ...mockPlayerStats,
                name: 'TestRogue',
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [
                        { name: 'Cunning Strike', type: 'attack_rider' },
                    ],
                },
            };
            const ctx = { targetName: 'Goblin', sneakAttackDice: 2 };
            mockBuildCtx.mockReturnValue(Promise.resolve(ctx));
            mockBuildCtxSync.mockReturnValue(Promise.resolve(ctx));

            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Rapier', damage: '1d8+3', damageType: 'piercing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                '_cunningStrikeSkippedRound',
                null,
                'test-campaign',
            );
            expect(mockSetAttackRiderModal).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('prefers Devious Strikes over Improved Cunning Strike over Cunning Strike', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_CunningStrike_usedRound') return null;
                if (key === '_cunningStrikeSkippedRound') return null;
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                lastAttack: { hit: true, targetName: 'Goblin' },
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
                name: 'TestRogue',
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [
                        { name: 'Cunning Strike', type: 'attack_rider' },
                        { name: 'Improved Cunning Strike', type: 'attack_rider' },
                        { name: 'Devious Strikes', type: 'attack_rider' },
                    ],
                },
            };
            const ctx = { targetName: 'Goblin', sneakAttackDice: 2 };
            mockBuildCtx.mockReturnValue(Promise.resolve(ctx));
            mockBuildCtxSync.mockReturnValue(Promise.resolve(ctx));

            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Rapier', damage: '1d8+3', damageType: 'piercing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderModal).toHaveBeenCalledWith({
                action: { name: 'Devious Strikes', type: 'attack_rider' },
                playerStats: stats,
                campaignName: 'test-campaign',
                targetName: 'Goblin',
            });
        });

        it('does not prompt for Cunning Strike when sneak attack dice are 0', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_CunningStrike_usedRound') return null;
                if (key === '_cunningStrikeSkippedRound') return null;
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                lastAttack: { hit: true, targetName: 'Goblin' },
            });

            const stats = {
                ...mockPlayerStats,
                name: 'TestRogue',
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [
                        { name: 'Cunning Strike', type: 'attack_rider' },
                    ],
                },
            };
            const ctx = { targetName: 'Goblin', sneakAttackDice: 0 };
            mockBuildCtx.mockReturnValue(Promise.resolve(ctx));
            mockBuildCtxSync.mockReturnValue(Promise.resolve(ctx));

            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Rapier', damage: '1d8+3', damageType: 'piercing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderModal).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('does not prompt for Cunning Strike when attack missed', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_CunningStrike_usedRound') return null;
                if (key === '_cunningStrikeSkippedRound') return null;
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                lastAttack: { hit: false, targetName: 'Goblin' },
            });

            const stats = {
                ...mockPlayerStats,
                name: 'TestRogue',
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [
                        { name: 'Cunning Strike', type: 'attack_rider' },
                    ],
                },
            };
            const ctx = { targetName: 'Goblin', sneakAttackDice: 2 };
            mockBuildCtx.mockReturnValue(Promise.resolve(ctx));
            mockBuildCtxSync.mockReturnValue(Promise.resolve(ctx));

            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { hit: false, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Rapier', damage: '1d8+3', damageType: 'piercing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderModal).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('does not prompt for Cunning Strike when no cunning strike passive exists', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_CunningStrike_usedRound') return null;
                if (key === '_cunningStrikeSkippedRound') return null;
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                lastAttack: { hit: true, targetName: 'Goblin' },
            });

            const ctx = { targetName: 'Goblin', sneakAttackDice: 2 };
            mockBuildCtx.mockReturnValue(Promise.resolve(ctx));
            mockBuildCtxSync.mockReturnValue(Promise.resolve(ctx));

            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: mockPlayerStats,
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Rapier', damage: '1d8+3', damageType: 'piercing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderModal).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('does not prompt for Cunning Strike when lastAttack is undefined', async () => {
            loadCombatSummary.mockResolvedValue({});

            const stats = {
                ...mockPlayerStats,
                name: 'TestRogue',
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [
                        { name: 'Cunning Strike', type: 'attack_rider' },
                    ],
                },
            };
            const ctx = { targetName: 'Goblin', sneakAttackDice: 2 };
            mockBuildCtx.mockReturnValue(Promise.resolve(ctx));
            mockBuildCtxSync.mockReturnValue(Promise.resolve(ctx));

            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Rapier', damage: '1d8+3', damageType: 'piercing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetAttackRiderModal).not.toHaveBeenCalled();
            expect(mockRollDamage).toHaveBeenCalled();
        });
    });
});
