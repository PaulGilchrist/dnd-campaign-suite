// @improved-by-ai
// @cleaned-by-ai
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
    applyManeuveringAllyGrant: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { getAttackRiderOptions, getAttackRiderOptionsByContext, executeAttackRiderManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

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
const mockPendingDamageRef = { current: null };
const mockSetPendingDamage = vi.fn();
const modalState = {};
const mockSetModalState = vi.fn((updates) => {
    if (typeof updates === 'function') {
        return updates(modalState);
    }
    Object.assign(modalState, updates);
});

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
        modalState,
        setModalState: mockSetModalState,
        pendingDamage: mockPendingDamageRef.current,
        setPendingDamage: mockSetPendingDamage,
        resumeRef: mockPendingDamageRef,
        ...overrides,
    };
    return useAttackDamageResolution(deps);
}

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

function resetModalState() {
    Object.keys(modalState).forEach((key) => delete modalState[key]);
}

describe('useAttackDamageResolution - attack rider maneuvers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue(defaultRollResult);
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 6 });
        getRuntimeValue.mockReturnValue(null);
        getRuntimeValue.mockImplementation((key, prop) => prop === 'resumeRef' ? {} : null);
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
        resetModalState();
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

            expect(mockSetModalState).toHaveBeenCalledWith({
                attackRiderManeuverPrompt: {
                    maneuvers: [{ name: 'Precision Attack', effect: 'attack_roll_bonus' }],
                    attack,
                    popupHtml: { hit: false, isCrit: false, targetName: 'Goblin' },
                    isMiss: true,
                },
            });
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it('does not prompt when attack hits — falls through to damage roll', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetModalState).not.toHaveBeenCalledWith(expect.objectContaining({ attackRiderManeuverPrompt: expect.anything() }));
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

            expect(mockSetModalState).not.toHaveBeenCalledWith(expect.objectContaining({ attackRiderManeuverPrompt: expect.anything() }));
            expect(mockRollDamage).toHaveBeenCalled();
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

            expect(mockSetModalState).toHaveBeenCalledWith({
                attackRiderManeuverPrompt: {
                    maneuvers: [{ name: 'Gouging Attack', effect: 'damage_bonus' }],
                    attack,
                    popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
                },
            });
            expect(mockRollDamage).not.toHaveBeenCalled();
        });
    });

    // ── handleAttackRiderManeuverUse ──────────────────────────────────

    describe('handleAttackRiderManeuverUse', () => {
        it('returns formula/total/rolls unchanged for non-miss maneuvers', async () => {
            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const maneuver = { name: 'Gouging Attack' };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: false };

            const result = await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(result).toEqual({
                formula: '1d8+3',
                total: 8,
                rolls: [5, 3],
            });
            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
            expect(mockSetPopupHtml).not.toHaveBeenCalled();
        });

        it('clears prompt and returns miss result when precision attack turns a miss into a hit', async () => {
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
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(result.isMissResult).toBe(true);
            expect(result.hit).toBe(true);
            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
            expect(mockSetPopupHtml).toHaveBeenCalled();
        });

        it('returns miss result with hit=false when precision attack still misses', async () => {
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
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(result.isMissResult).toBe(true);
            expect(result.hit).toBe(false);
        });

        it('adds damage bonus when maneuver has damageBonus and result type is popup', async () => {
            executeAttackRiderManeuver.mockResolvedValue({
                type: 'popup',
                dieValue: 4,
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
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(result.formula).toContain('+ 4');
            expect(result.total).toBe(12);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'attackRiderDieValue', 4, 'test-campaign');
        });

        it('MN-009: does not crash when prompt passes only 3 args (undefined roll context)', async () => {
            executeAttackRiderManeuver.mockResolvedValue({
                type: 'popup',
                dieValue: 6,
                payload: { type: 'automation_info', name: 'Goading Attack', description: 'Goading Attack: Rolled d8 for 6. Added 6 to the damage roll.' },
                logEntries: [{ type: 'ability_use', characterName: 'TestFighter', abilityName: 'Goading Attack', description: 'Goading Attack: Rolled d8 for 6. Added 6 to the damage roll.' }],
            });

            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const maneuver = { name: 'Goading Attack', damageBonus: true, dieExpression: 'superiority_die' };
            const attack = { name: 'Shortsword', damage: '1d6+3', damageType: 'piercing' };
            const popupHtmlData = { isMiss: false, hit: true, targetName: 'Goblin' };

            const result = await handleAttackRiderManeuverUse(maneuver, attack, popupHtmlData);

            expect(result).toEqual({ formula: null, total: 0, rolls: [] });
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'attackRiderDieValue', 6, 'test-campaign');
            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
        });

        it('MN-009: logs ability_use logEntries returned by the rider service', async () => {
            const { addEntry } = await import('../../services/ui/logService.js');
            executeAttackRiderManeuver.mockResolvedValue({
                type: 'popup',
                dieValue: 5,
                payload: { type: 'automation_info', name: 'Goading Attack', description: 'Added 5 to the damage roll.' },
                logEntries: [{ type: 'ability_use', characterName: 'TestFighter', abilityName: 'Goading Attack', description: 'Goading Attack: Rolled d8 for 5. Added 5 to the damage roll.' }],
            });

            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const maneuver = { name: 'Goading Attack', damageBonus: true };
            const attack = { damageType: 'piercing' };

            await handleAttackRiderManeuverUse(maneuver, attack, { isMiss: false });

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Goading Attack',
                description: expect.stringContaining('Added 5 to the damage roll.'),
            }));
        });

        it('MN-009: resumes the paused attack pipeline after the rider resolves so base+die damage lands', async () => {
            const resume = vi.fn(async (_ctx, ref) => { ref.current = null; });
            const stashCtx = { attack: { name: 'Shortsword', damage: '1d6+3', damageType: 'piercing' }, hit: true, popupHtml: { hit: true }, campaignName: 'test-campaign' };
            const resumeRef = { current: { pipelineStash: { pipeline: { resume }, ctx: stashCtx }, _pausedStep: 'attackRiderManeuvers' } };
            executeAttackRiderManeuver.mockResolvedValue({
                type: 'popup',
                dieValue: 6,
                payload: { type: 'automation_info', name: 'Goading Attack', description: 'Goading Attack.' },
            });

            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({ resumeRef });
            const maneuver = { name: 'Goading Attack', damageBonus: true };
            const attack = { damageType: 'piercing' };

            await handleAttackRiderManeuverUse(maneuver, attack, { isMiss: false, hit: true, targetName: 'Goblin' });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'attackRiderDieValue', 6, 'test-campaign');
            expect(resume).toHaveBeenCalledWith(stashCtx, resumeRef);
        });

        it('MN-009: skip resumes the paused pipeline so base damage lands', () => {
            const resume = vi.fn(async (_ctx, ref) => { ref.current = null; });
            const stashCtx = { hit: true };
            const resumeRef = { current: { pipelineStash: { pipeline: { resume }, ctx: stashCtx }, _pausedStep: 'attackRiderManeuvers' } };

            const { handleAttackRiderManeuverSkip } = UseAttackDamageResolution({ resumeRef });
            handleAttackRiderManeuverSkip();

            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
            expect(resume).toHaveBeenCalled();
        });

        it('MN-009: skip does NOT resume when the attack missed (no damage on miss)', () => {
            const resume = vi.fn();
            const stashCtx = { hit: false };
            const resumeRef = { current: { pipelineStash: { pipeline: { resume }, ctx: stashCtx }, _pausedStep: 'attackRiderManeuvers' } };

            const { handleAttackRiderManeuverSkip } = UseAttackDamageResolution({ resumeRef });
            handleAttackRiderManeuverSkip();

            expect(resume).not.toHaveBeenCalled();
        });

        it('opens sweeping attack target modal when maneuver returns that type', async () => {
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
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(mockSetModalState).toHaveBeenCalledWith({ sweepingAttackTargetModal: { title: 'Select Target' } });
        });

        it('sets popupHtml when maneuver result type is popup', async () => {
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
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(mockSetPopupHtml).toHaveBeenCalledWith({ hit: true, isCrit: false });
        });

        it('preserves isNatural20 when precision attack adds to a natural 20 roll', async () => {
            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({
                popupHtml: { rolls: [20], bonus: 2, targetAc: 25, isCrit: false },
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
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(result.isMissResult).toBe(true);
            expect(result.hit).toBe(true);
            const popupCall = mockSetPopupHtml.mock.calls[0][0];
            expect(popupCall.isNatural20).toBe(true);
        });

        it('handles precision attack when popupHtml.rolls is missing', async () => {
            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({
                popupHtml: { bonus: 2, targetAc: 5, isCrit: false },
            });
            const maneuver = {
                name: 'Precision Attack',
                effect: 'attack_roll_bonus',
                dieExpression: '1d6',
            };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: true, hit: false };
            rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

            const result = await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(result.isMissResult).toBe(true);
            expect(result.hit).toBe(true);
        });

        it('returns unchanged values when maneuver is undefined', async () => {
            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: false };

            const result = await handleAttackRiderManeuverUse(
                undefined, attack, popupHtmlData,
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(result).toEqual({
                formula: '1d8+3',
                total: 8,
                rolls: [5, 3],
            });
            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
        });

        it('returns unchanged values when maneuver result is undefined', async () => {
            executeAttackRiderManeuver.mockResolvedValue(undefined);

            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const maneuver = { name: 'Unknown Maneuver' };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: false };

            const result = await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(result).toEqual({
                formula: '1d8+3',
                total: 8,
                rolls: [5, 3],
            });
            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
        });

        it('opens attackRiderOptions modal when maneuver returns that type', async () => {
            executeAttackRiderManeuver.mockResolvedValue({
                type: 'modal',
                modalName: 'attackRiderOptions',
                payload: { options: ['Option A', 'Option B'] },
            });

            const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();
            const maneuver = { name: 'Brutal Strike' };
            const attack = { damageType: 'slashing' };
            const popupHtmlData = { isMiss: false };

            const result = await handleAttackRiderManeuverUse(
                maneuver, attack, popupHtmlData,
                { formula: '1d8+3', total: 8, rolls: [5, 3] },
            );

            expect(result.pendingOptions).toBe(true);
            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderOptionsModal: { options: ['Option A', 'Option B'] } });
        });
    });

    // ── Cunning Strike ────────────────────────────────────────────────

    describe('Cunning Strike', () => {
        it('prompts for Cunning Strike when hit, sneak attack > 0, and not used this round', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return { hit: true, targetName: 'Goblin' };
                if (key === '_CunningStrike_usedRound') return null;
                if (key === '_cunningStrikeSkippedRound') return null;
                return null;
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

            expect(mockSetModalState).toHaveBeenCalledWith({
                attackRiderModal: {
                    action: { name: 'Cunning Strike', type: 'attack_rider' },
                    playerStats: stats,
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                },
            });
            expect(mockPendingDamageRef.current).toEqual(
                expect.objectContaining({
                    _cunningStrike: true,
                    attack,
                    popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
                })
            );
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it.each([
            { scenario: 'already used this round', lastAttack: { hit: true, targetName: 'Goblin' }, cunningStrikeUsed: 1, sneakAttackDice: 2 },
            { scenario: 'no sneak attack dice', lastAttack: { hit: true, targetName: 'Goblin' }, cunningStrikeUsed: null, sneakAttackDice: 0 },
            { scenario: 'attack missed', lastAttack: { hit: false, targetName: 'Goblin' }, cunningStrikeUsed: null, sneakAttackDice: 2 },
            { scenario: 'no lastAttack in combat summary', lastAttack: null, cunningStrikeUsed: null, sneakAttackDice: 2 },
        ])('skips Cunning Strike prompt when $scenario', async ({ lastAttack, cunningStrikeUsed, sneakAttackDice }) => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return lastAttack;
                if (key === '_CunningStrike_usedRound') return cunningStrikeUsed;
                if (key === '_cunningStrikeSkippedRound') return null;
                return null;
            });

            const stats = {
                ...mockPlayerStats,
                name: 'TestRogue',
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [{ name: 'Cunning Strike', type: 'attack_rider' }],
                },
            };
            const ctx = { targetName: 'Goblin', sneakAttackDice };
            mockBuildCtx.mockReturnValue(Promise.resolve(ctx));
            mockBuildCtxSync.mockReturnValue(Promise.resolve(ctx));

            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { hit: !!lastAttack?.hit, isCrit: false, targetName: 'Goblin' },
            });

            await resolveAttackDamage({ name: 'Rapier', damage: '1d8+3', damageType: 'piercing', weaponType: 'melee', properties: [] });
            await tick();

            expect(mockSetModalState).not.toHaveBeenCalledWith(expect.objectContaining({ attackRiderModal: expect.anything() }));
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('prefers Devious Strikes over Improved Cunning Strike over Cunning Strike', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return { hit: true, targetName: 'Goblin' };
                if (key === '_CunningStrike_usedRound') return null;
                if (key === '_cunningStrikeSkippedRound') return null;
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

            expect(mockSetModalState).toHaveBeenCalledWith({
                attackRiderModal: {
                    action: { name: 'Devious Strikes', type: 'attack_rider' },
                    playerStats: stats,
                    campaignName: 'test-campaign',
                    targetName: 'Goblin',
                },
            });
        });

        it('does not prompt when no cunning strike passive is present', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return { hit: true, targetName: 'Goblin' };
                if (key === '_CunningStrike_usedRound') return null;
                if (key === '_cunningStrikeSkippedRound') return null;
                return null;
            });

            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: mockPlayerStats,
                popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            });

            await resolveAttackDamage({ name: 'Rapier', damage: '1d8+3', damageType: 'piercing', weaponType: 'melee', properties: [] });
            await tick();
            expect(mockSetModalState).not.toHaveBeenCalledWith(expect.objectContaining({ attackRiderModal: expect.anything() }));
            expect(mockRollDamage).toHaveBeenCalled();
        });
    });
});
