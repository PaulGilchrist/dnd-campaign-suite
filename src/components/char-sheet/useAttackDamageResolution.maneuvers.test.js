// @maintained-by-ai
// Attack-rider maneuver dispatch lane (Fighter superiority): the hook-side seam
// between resolveAttackDamage's pause, handleAttackRiderManeuverUse/Skip, and the
// rider service — dispatch result shapes, die→damage folding, ledger flush, popup
// passthrough, and pipeline resume/strand semantics.
//
// Lane ownership (do not duplicate here):
// - attackRiderManeuvers step prompt gating (hit/miss/crit/no-maneuvers) →
//   steps/attackRollDamageSteps.test.js
// - Precision miss die consumption + spend-log flush → useAttackDamageResolution.mn014.test.js
// - MN-015 save-DC forwarding + size-gate refusal → .mn015SaveDc.test.js
// - MN-011 Maneuvering Attack ally picker + plain popup passthrough → .maneuveringAlly.test.js
// - Cunning Strike step gates/suppression → steps/attackRollRiders.test.js
// - Cunning Strike resume-after-choice → .cunningStrikeResume.test.js
// - Pipeline completes without pause → rollDamage → .pausedStates.test.js
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
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { hasTwoWeaponFighting, evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { addEntry } from '../../services/ui/logService.js';
import { getAttackRiderOptions, getAttackRiderOptionsByContext, executeAttackRiderManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const CHAR = 'TestFighter';
const CAMPAIGN = 'test-campaign';

const ATTACK = {
    name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
    weaponType: 'melee', properties: [],
};

const mockPlayerStats = {
    name: CHAR,
    level: 5,
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
    ],
    proficiency: 3,
    automation: { actions: [], passives: [] },
};

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

// Fresh deps per mount — no cross-test bleed of popup/modal/pause state.
function UseAttackDamageResolution(overrides = {}) {
    const setPopupHtml = vi.fn();
    const rollDamage = vi.fn();
    const defaultCtx = { targetName: 'Goblin', sneakAttackDice: 0 };
    const buildCtx = vi.fn(() => Promise.resolve(defaultCtx));
    const buildCtxSync = vi.fn(() => Promise.resolve(defaultCtx));
    const modalState = {};
    const setModalState = vi.fn((updates) => Object.assign(modalState, updates));
    const resumeRef = { current: null };
    const api = useAttackDamageResolution({
        playerStats: mockPlayerStats,
        campaignName: CAMPAIGN,
        mapName: null,
        popupHtml: null,
        setPopupHtml,
        rollDamage,
        buildCtx,
        buildCtxSync,
        modalState,
        setModalState,
        setPendingDamage: vi.fn(),
        resumeRef,
        ...overrides,
    });
    return { api, setPopupHtml, rollDamage, buildCtx, buildCtxSync, modalState, setModalState, resumeRef };
}

// A pipeline paused at attackRiderManeuvers with a live stash whose resume is spyable.
function pausedAtManeuvers(hit) {
    const resume = vi.fn(async (_ctx, ref) => { if (ref) ref.current = null; });
    const stashCtx = { hit };
    const resumeRef = {
        current: { pipelineStash: { pipeline: { resume }, ctx: stashCtx }, _pausedStep: 'attackRiderManeuvers' },
    };
    return { resume, stashCtx, resumeRef };
}

describe('useAttackDamageResolution — attack rider maneuver dispatch', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        evaluateAutoExpression.mockReturnValue(0);
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        getAttackRiderOptions.mockResolvedValue([]);
        getAttackRiderOptionsByContext.mockResolvedValue([]);
        executeAttackRiderManeuver.mockResolvedValue(undefined);
        getCurrentCombatRound.mockReturnValue(1);
        getCombatContext.mockResolvedValue(null);
    });

    // ── resolveAttackDamage → maneuver prompt seam (real pipeline) ────────

    it.each([
        {
            branch: 'a miss offers miss-only maneuvers with isMiss:true',
            popupHtml: { hit: false, isCrit: false, targetName: 'Goblin' },
            maneuvers: [{ name: 'Precision Attack', effect: 'attack_roll_bonus' }],
            isHit: false,
        },
        {
            branch: 'a hit offers hit riders with no isMiss flag',
            popupHtml: { hit: true, isCrit: false, targetName: 'Goblin' },
            maneuvers: [{ name: 'Gouging Attack', effect: 'damage_bonus' }],
            isHit: true,
        },
    ])('resolveAttackDamage pauses with $branch and holds damage back', async ({ popupHtml, maneuvers, isHit }) => {
        if (isHit) {
            getAttackRiderOptions.mockResolvedValue(maneuvers);
        } else {
            getAttackRiderOptionsByContext.mockResolvedValue(maneuvers);
        }
        const { api, setModalState, rollDamage } = UseAttackDamageResolution({ popupHtml });

        await api.resolveAttackDamage(ATTACK);
        await tick();

        if (isHit) {
            expect(getAttackRiderOptionsByContext).not.toHaveBeenCalled();
            expect(setModalState).toHaveBeenCalledWith({
                attackRiderManeuverPrompt: { maneuvers, attack: ATTACK, popupHtml },
            });
        } else {
            expect(getAttackRiderOptions).not.toHaveBeenCalled();
            expect(setModalState).toHaveBeenCalledWith({
                attackRiderManeuverPrompt: { maneuvers, attack: ATTACK, popupHtml, isMiss: true },
            });
        }
        expect(rollDamage).not.toHaveBeenCalled();
    });

    // ── Precision Attack (miss dispatch) — consumed-die math lives in mn014 ─

    it.each([
        {
            branch: 'conversion to a natural-20 crit hit',
            // run2#307 fix pin: the popup payload for THIS action rides the popupHtmlData
            // ARG (what the prompt modal passes back), never the popupHtml prop — the prop
            // is mounted null here to prove the gate no longer consults it.
            popupData: { isMiss: true, hit: false, rolls: [20], bonus: 2, targetAc: 25, isCrit: false },
            dieValue: 4,
            expectedPopup: { isMiss: true, hit: true, rolls: [20], bonus: 2, targetAc: 25, isCrit: true, total: 26, isNatural20: true, superiorityDieAdded: 4, originalTotal: 22, originalD20: 20 },
            expectedDescription: 'Precision Attack: Added 4 to the attack roll (20 + 2 + 4 = 26). The attack now hits!',
            shouldResume: true,
        },
        {
            branch: 'still-miss leaves damage stranded for the skip lane',
            popupData: { isMiss: true, hit: false, rolls: [8], bonus: 2, targetAc: 20, isCrit: false },
            dieValue: 4,
            expectedPopup: { isMiss: true, hit: false, rolls: [8], bonus: 2, targetAc: 20, isCrit: false, total: 14, isNatural20: false, superiorityDieAdded: 4, originalTotal: 10, originalD20: 8 },
            expectedDescription: 'Precision Attack: Added 4 to the attack roll (8 + 2 + 4 = 14). The attack still misses.',
            shouldResume: false,
        },
    ])('Precision Attack dispatch closes the prompt, pops the recalculated popup, and logs on $branch', async ({ popupData, dieValue, expectedPopup, expectedDescription, shouldResume }) => {
        executeAttackRiderManeuver.mockResolvedValue({ type: 'popup', dieValue, logEntries: [] });
        const { resume, stashCtx, resumeRef } = pausedAtManeuvers(false);
        const { api, setModalState, setPopupHtml } = UseAttackDamageResolution({ resumeRef });
        const maneuver = { name: 'Precision Attack', effect: 'attack_roll_bonus', dieExpression: '1d6' };

        const result = await api.handleAttackRiderManeuverUse(
            maneuver, ATTACK, popupData,
            { formula: '1d8+3', total: 8, rolls: [5, 3] },
        );

        expect(result).toEqual({
            formula: '1d8+3', total: 8, rolls: [5, 3],
            isMissResult: true, hit: expectedPopup.hit, description: expectedDescription,
        });
        expect(setPopupHtml).toHaveBeenCalledWith(expectedPopup);
        expect(setModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'ability_use',
            characterName: CHAR,
            name: 'Precision Attack',
            description: expectedDescription,
        });
        // Hit conversion rewires the stash before resuming; a still-miss must not resume.
        if (shouldResume) {
            expect(stashCtx.hit).toBe(true);
            expect(resume).toHaveBeenCalledWith(stashCtx, resumeRef);
        } else {
            expect(stashCtx.hit).toBe(false);
            expect(resume).not.toHaveBeenCalled();
        }
    });

    // ── Popup rider dispatch on hit (goading/brutal family) ───────────────

    const goadingPopup = () => ({
        type: 'popup',
        dieValue: 6,
        payload: { type: 'automation_info', name: 'Goading Attack', description: 'Goading Attack: Rolled d8 for 6. Added 6 to the damage roll.' },
        logEntries: [{ type: 'ability_use', characterName: CHAR, abilityName: 'Goading Attack', description: 'Goading Attack: Rolled d8 for 6. Added 6 to the damage roll.' }],
    });

    it.each([
        {
            branch: 'full roll context rides the die onto the formula',
            current: { formula: '1d8+3', total: 8, rolls: [5, 3] },
            expectedResult: { formula: '1d8+3 + 6 [slashing]', total: 14, rolls: [5, 3, 6] },
        },
        {
            branch: 'MN-009 three-arg prompt (no roll context) still spends the die without crashing',
            current: undefined,
            expectedResult: { formula: null, total: 0, rolls: [] },
        },
    ])('popup rider dispatch $branch: ledger flushes, popup shows, pipeline resumes', async ({ current, expectedResult }) => {
        const result = goadingPopup();
        executeAttackRiderManeuver.mockResolvedValue(result);
        const { resume, stashCtx, resumeRef } = pausedAtManeuvers(true);
        const { api, setModalState, setPopupHtml } = UseAttackDamageResolution({ resumeRef });
        const maneuver = { name: 'Goading Attack', damageBonus: true, dieExpression: 'superiority_die' };

        const call = current === undefined
            ? api.handleAttackRiderManeuverUse(maneuver, ATTACK, { isMiss: false, hit: true, targetName: 'Goblin' })
            : api.handleAttackRiderManeuverUse(maneuver, ATTACK, { isMiss: false, hit: true, targetName: 'Goblin' }, current);
        const resolved = await call;

        expect(resolved).toEqual(expectedResult);
        expect(setRuntimeValue).toHaveBeenCalledWith(CHAR, 'attackRiderDieValue', 6, CAMPAIGN);
        expect(setModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, result.logEntries[0]);
        expect(setPopupHtml).toHaveBeenCalledWith(result.payload);
        expect(resume).toHaveBeenCalledTimes(1);
        expect(resume).toHaveBeenCalledWith(stashCtx, resumeRef);
    });

    // ── Modal-returning rider dispatch ──────────────────────────────────────

    it.each([
        {
            branch: 'sweepingAttackTarget opens the chooser and resumes damage immediately',
            serviceResult: { type: 'modal', modalName: 'sweepingAttackTarget', payload: { title: 'Select Target' } },
            expectedResult: { formula: '1d8+3', total: 8, rolls: [5, 3], chooserOpened: true },
            expectedModalState: { sweepingAttackTargetModal: { title: 'Select Target' } },
            shouldResume: true,
        },
        {
            branch: 'attackRiderOptions opens the option chooser and keeps damage stashed',
            serviceResult: { type: 'modal', modalName: 'attackRiderOptions', payload: { options: ['Option A', 'Option B'] } },
            expectedResult: { formula: '1d8+3', total: 8, rolls: [5, 3], pendingOptions: true },
            expectedModalState: { attackRiderOptionsModal: { options: ['Option A', 'Option B'] } },
            shouldResume: false,
        },
    ])('modal rider dispatch $branch', async ({ serviceResult, expectedResult, expectedModalState, shouldResume }) => {
        executeAttackRiderManeuver.mockResolvedValue(serviceResult);
        const { resume, stashCtx, resumeRef } = pausedAtManeuvers(true);
        const { api, setModalState, setPopupHtml } = UseAttackDamageResolution({ resumeRef });
        const maneuver = { name: serviceResult.modalName === 'attackRiderOptions' ? 'Brutal Strike' : 'Sweeping Attack' };

        const result = await api.handleAttackRiderManeuverUse(
            maneuver, ATTACK, { isMiss: false, hit: true, targetName: 'Goblin' },
            { formula: '1d8+3', total: 8, rolls: [5, 3] },
        );

        expect(result).toEqual(expectedResult);
        expect(setModalState).toHaveBeenCalledWith(expectedModalState);
        expect(setPopupHtml).not.toHaveBeenCalled();
        if (shouldResume) {
            expect(resume).toHaveBeenCalledWith(stashCtx, resumeRef);
        } else {
            expect(resume).not.toHaveBeenCalled();
        }
    });

    // ── Passthrough: unresolvable riders must still land base damage ───────

    it.each([
        { branch: 'maneuver is undefined', maneuver: undefined },
        { branch: 'rider service returns no result', maneuver: { name: 'Unbound Maneuver' } },
    ])('dispatch $branch passes damage through unchanged, closes the prompt, and resumes', async ({ maneuver }) => {
        const { resume, stashCtx, resumeRef } = pausedAtManeuvers(true);
        const { api, setModalState, setPopupHtml } = UseAttackDamageResolution({ resumeRef });

        const result = await api.handleAttackRiderManeuverUse(
            maneuver, ATTACK, { isMiss: false },
            { formula: '1d8+3', total: 8, rolls: [5, 3] },
        );

        expect(result).toEqual({ formula: '1d8+3', total: 8, rolls: [5, 3] });
        expect(setModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
        expect(setRuntimeValue).not.toHaveBeenCalledWith(CHAR, 'attackRiderDieValue', expect.anything(), CAMPAIGN);
        expect(setPopupHtml).not.toHaveBeenCalled();
        expect(resume).toHaveBeenCalledWith(stashCtx, resumeRef);
    });

    // ── Skip lane ─────────────────────────────────────────────────────────────

    it.each([
        { branch: 'hit resumes so base damage lands', hit: true, shouldResume: true },
        { branch: 'miss never resumes (no damage on a miss)', hit: false, shouldResume: false },
    ])('handleAttackRiderManeuverSkip closes the prompt and $branch', ({ hit, shouldResume }) => {
        const { resume, stashCtx, resumeRef } = pausedAtManeuvers(hit);
        const { api, setModalState } = UseAttackDamageResolution({ resumeRef });

        api.handleAttackRiderManeuverSkip();

        expect(setModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
        if (shouldResume) {
            expect(resume).toHaveBeenCalledWith(stashCtx, resumeRef);
        } else {
            expect(resume).not.toHaveBeenCalled();
        }
    });

    // ── Cunning Strike variant selection (step owns the gates) ──────────────

    it('selects the highest Cunning Strike variant, opens attackRiderModal with exact args, and holds all damage back', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'lastAttack') return { hit: true, targetName: 'Goblin' };
            return null;
        });
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'TestFighter', type: 'player' },
                { name: 'Goblin', type: 'npc' },
            ],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

        const csPassives = [
            { name: 'Cunning Strike', type: 'attack_rider' },
            { name: 'Improved Cunning Strike', type: 'attack_rider' },
            { name: 'Devious Strikes', type: 'attack_rider' },
        ];
        const stats = { ...mockPlayerStats, name: 'TestRogue', automation: { actions: [], passives: csPassives } };
        const ctx = { targetName: 'Goblin', sneakAttackDice: 2 };
        const popupHtml = { hit: true, isCrit: false, targetName: 'Goblin' };
        const { api, setModalState, rollDamage, resumeRef } = UseAttackDamageResolution({
            playerStats: stats,
            popupHtml,
            buildCtx: vi.fn(() => Promise.resolve(ctx)),
            buildCtxSync: vi.fn(() => Promise.resolve(ctx)),
        });

        await api.resolveAttackDamage(ATTACK);
        await tick();

        expect(setModalState).toHaveBeenCalledWith({
            attackRiderModal: {
                action: { name: 'Devious Strikes', type: 'attack_rider' },
                playerStats: stats,
                campaignName: CAMPAIGN,
                targetName: 'Goblin',
            },
        });
        expect(rollDamage).not.toHaveBeenCalled();
        expect(resumeRef.current).toEqual(expect.objectContaining({
            _cunningStrike: true,
            attack: ATTACK,
            popupHtml,
        }));
    });

    // ── run2#307 fix #1348 — two-carrier gate: popupHtmlData ARG is law ─────
    // The precision-miss gate and die-math must read popupHtmlData (this action's
    // popup payload, passed back verbatim by AttackRiderManeuverPrompt from the
    // attackRollRiders pause). The popupHtml prop is useDiceRollPopup's global UI
    // state — null when no popup is open, stale when another popup replaced it.

    const PRECISION = { name: 'Precision Attack', effect: 'attack_roll_bonus', dieExpression: '1d8' };

    it('fires the precision-miss branch on a miss popupHtmlData with a NULL popupHtml prop — exact spend ledger, no die→damage fold', async () => {
        // Pre-fix this fell through to applyRiderManeuverPostResolution: executor had
        // already spent the die, but no conversion, no Precision Attack ledger entry.
        const logEntries = [
            { description: 'Rolled d8 for 6' },
            { description: 'Expend 1 Superiority Die' },
        ];
        executeAttackRiderManeuver.mockResolvedValue({ type: 'popup', dieValue: 6, logEntries });
        const { resume, stashCtx, resumeRef } = pausedAtManeuvers(false);
        // popupHtml prop stays null (harness default) — the gate must not consult it.
        const { api, setModalState, setPopupHtml } = UseAttackDamageResolution({ resumeRef });

        const result = await api.handleAttackRiderManeuverUse(
            PRECISION, ATTACK,
            { rolls: [10], bonus: 5, targetAc: 20, isCrit: false, hit: false, isMiss: true },
            { formula: '1d8+3', total: 8, rolls: [5, 3] },
        );

        expect(result.isMissResult).toBe(true);
        expect(result.hit).toBe(true); // 10 + 5 + 6 = 21 >= 20
        expect(result.description).toBe('Precision Attack: Added 6 to the attack roll (10 + 5 + 6 = 21). The attack now hits!');
        // Resource-spend ledger exact: executor spends flush first, then the ability_use recalculation.
        expect(addEntry.mock.calls.map(c => c[1].description)).toEqual([
            'Rolled d8 for 6',
            'Expend 1 Superiority Die',
            'Precision Attack: Added 6 to the attack roll (10 + 5 + 6 = 21). The attack now hits!',
        ]);
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            total: 21, hit: true, superiorityDieAdded: 6, originalTotal: 15, originalD20: 10,
        }));
        expect(setModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
        // Precision boosts the attack roll, never the pending damage formula.
        expect(setRuntimeValue).not.toHaveBeenCalledWith(CHAR, 'attackRiderDieValue', expect.anything(), CAMPAIGN);
        // Conversion rewired the stash before resuming.
        expect(stashCtx.hit).toBe(true);
        expect(resume).toHaveBeenCalledWith(stashCtx, resumeRef);
    });

    it('converts the popupHtmlData dice when the popupHtml prop is a STALE different popup', async () => {
        executeAttackRiderManeuver.mockResolvedValue({ type: 'popup', dieValue: 3, logEntries: [] });
        const { resumeRef } = pausedAtManeuvers(false);
        // Global UI popup is stale: different dice from an earlier roll.
        const { api, setPopupHtml } = UseAttackDamageResolution({
            popupHtml: { rolls: [1], bonus: 0, targetAc: 99, isCrit: false, hit: false, isMiss: true },
            resumeRef,
        });

        const result = await api.handleAttackRiderManeuverUse(
            PRECISION, ATTACK,
            { rolls: [15], bonus: 2, targetAc: 18, isCrit: false, hit: false, isMiss: true },
            { formula: '1d8+3', total: 8, rolls: [5, 3] },
        );

        expect(result.description).toBe('Precision Attack: Added 3 to the attack roll (15 + 2 + 3 = 20). The attack now hits!');
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            rolls: [15], bonus: 2, targetAc: 18, total: 20, originalD20: 15,
        }));
    });

    it.each([
        { branch: 'hit popupHtmlData', popupData: { rolls: [17], bonus: 5, targetAc: 20, isCrit: false, hit: true, isMiss: false } },
        { branch: 'null popupHtmlData', popupData: null },
    ])('routes $branch to post-resolution even when the popupHtml prop holds a miss popup — no precision conversion', async ({ popupData }) => {
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            dieValue: 4,
            payload: { type: 'automation_info', name: 'Precision Attack', description: 'Maneuver applied.' },
            logEntries: [],
        });
        const { resume, stashCtx, resumeRef } = pausedAtManeuvers(true);
        const { api, setPopupHtml } = UseAttackDamageResolution({
            popupHtml: { rolls: [4], bonus: 2, targetAc: 20, isCrit: false, hit: false, isMiss: true },
            resumeRef,
        });

        const result = await api.handleAttackRiderManeuverUse(PRECISION, ATTACK, popupData, { formula: '1d8+3', total: 8, rolls: [5, 3] });

        expect(result).toEqual({ formula: '1d8+3', total: 8, rolls: [5, 3] });
        // Post-resolution dispatch pops the service payload — never a recalculated attack popup.
        expect(setPopupHtml).toHaveBeenCalledWith({ type: 'automation_info', name: 'Precision Attack', description: 'Maneuver applied.' });
        const precisionEntry = addEntry.mock.calls.map(c => c[1]).find(e => e.name === 'Precision Attack' && e.type === 'ability_use');
        expect(precisionEntry?.description ?? '').not.toMatch(/Added .* to the attack roll/);
        expect(resume).toHaveBeenCalledWith(stashCtx, resumeRef);
    });
});
