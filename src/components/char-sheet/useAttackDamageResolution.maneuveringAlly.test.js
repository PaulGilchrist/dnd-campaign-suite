// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { executeAttackRiderManeuver, applyManeuveringAllyGrant } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const mockPlayerStats = { name: 'GoliathFireGiant', level: 5, proficiency: 3, automation: {} };
const mockCampaignName = 'test-campaign';
const ENEMY = 'Animated Rug of Smothering 1';

const maneuvering = {
    name: 'Maneuvering Attack',
    effect: 'ally_movement',
    damageBonus: true,
    dieExpression: 'superiority_die',
};
const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', weaponType: 'melee' };

const GRANT_DESC = `Maneuvering Attack: HeroesFeastBard can move up to half their Speed (15 ft) using their Reaction without provoking Opportunity Attacks from ${ENEMY}.`;
const PICKER_DESC = `Choose a willing creature within 30 feet who can see or hear you. That creature can use its Reaction to move up to half its Speed without provoking Opportunity Attacks from ${ENEMY}.`;

const hitContext = (targetName = ENEMY) => ({ isMiss: false, hit: true, targetName });
const riderPopup = (dieValue, description, name = 'Maneuvering Attack') => ({
    type: 'popup',
    dieValue,
    payload: { type: 'automation_info', name, description },
});

function UseAttackDamageResolution() {
    const setPopupHtml = vi.fn();
    const modalState = {};
    const setModalState = vi.fn((updates) => Object.assign(modalState, updates));
    const resume = vi.fn(async (_ctx, ref) => { if (ref) ref.current = null; });
    const stashCtx = { hit: true };
    const resumeRef = { current: { pipelineStash: { pipeline: { resume }, ctx: stashCtx }, _pausedStep: 'attackRiderManeuvers' } };
    const api = useAttackDamageResolution({
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        popupHtml: null,
        setPopupHtml,
        rollDamage: vi.fn(),
        buildCtx: vi.fn(),
        buildCtxSync: vi.fn(),
        setModalState,
        _modalState: modalState,
        setPendingDamage: vi.fn(),
        resumeRef,
    });
    return { api, setPopupHtml, setModalState, modalState, resumeRef, resume, stashCtx };
}

describe('MN-011 Maneuvering Attack ally grant', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'GoliathFireGiant', type: 'player', currentHp: 49, maxHp: 49 },
                { name: 'HeroesFeastBard', type: 'player', currentHp: 30, maxHp: 30 },
                { name: ENEMY, type: 'npc', currentHp: 21, maxHp: 27 },
            ],
        });
        applyManeuveringAllyGrant.mockResolvedValue({ halfSpeed: 15, description: GRANT_DESC });
    });

    it('opens an ally picker with exact rider-service args instead of prose-only popup', async () => {
        executeAttackRiderManeuver.mockResolvedValue(riderPopup(6, 'Rolled d8 for 6.'));
        const { api, modalState, setPopupHtml } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse(maneuvering, attack, hitContext());

        expect(executeAttackRiderManeuver).toHaveBeenCalledWith(
            { automation: { type: 'combat_superiority', saveDc: 'ability', saveAbility: ['STR', 'DEX'] } },
            mockPlayerStats,
            mockCampaignName,
            'Maneuvering Attack',
            { weaponType: 'melee', isUnarmedStrike: false, targetName: ENEMY },
        );
        const picker = modalState.secondaryTargetModal;
        expect(picker.title).toBe('Maneuvering Attack — Choose Ally');
        expect(picker.confirmLabel).toBe('Grant Movement');
        expect(picker.description).toBe(PICKER_DESC);
        // self and enemies excluded; ally HP carried through for the picker UI
        expect(picker.targets).toEqual([{ name: 'HeroesFeastBard', currentHp: 30, maxHp: 30, type: 'player' }]);
        expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('confirming the picker closes it, writes the grant via the service verbatim, and pops the grant description', async () => {
        executeAttackRiderManeuver.mockResolvedValue(riderPopup(6, 'Rolled d8 for 6.'));
        const { api, modalState, setPopupHtml } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse(maneuvering, attack, hitContext());
        await modalState.secondaryTargetModal.onTargetSelected('HeroesFeastBard');

        expect(applyManeuveringAllyGrant).toHaveBeenCalledWith('HeroesFeastBard', 'GoliathFireGiant', ENEMY, mockCampaignName);
        expect(modalState.secondaryTargetModal).toBeNull();
        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        expect(setPopupHtml).toHaveBeenCalledWith({ type: 'automation_info', name: 'Maneuvering Attack', description: GRANT_DESC });
    });

    it('skipping the picker closes it, never writes the grant, and pops an honest no-grant tail', async () => {
        executeAttackRiderManeuver.mockResolvedValue(riderPopup(2, 'Rolled d8 for 2.'));
        const { api, modalState, setPopupHtml } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse(maneuvering, attack, hitContext());
        modalState.secondaryTargetModal.onSkip();

        expect(applyManeuveringAllyGrant).not.toHaveBeenCalled();
        expect(modalState.secondaryTargetModal).toBeNull();
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ description: 'Rolled d8 for 2. No ally received the movement grant.' }));
    });

    it('resumes the paused pipeline with the stashed ctx while the picker stays open, so base+die damage is never stranded', async () => {
        executeAttackRiderManeuver.mockResolvedValue(riderPopup(6, 'Rolled d8 for 6.'));
        const { api, modalState, resume, resumeRef, stashCtx } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse(maneuvering, attack, hitContext());

        expect(resume).toHaveBeenCalledTimes(1);
        expect(resume).toHaveBeenCalledWith(stashCtx, resumeRef);
        expect(resumeRef.current).toBeNull();
        // ally selection remains pending — the grant resolves independently of damage
        expect(modalState.secondaryTargetModal).toBeTruthy();
    });

    it.each([
        {
            branch: 'a non-ally_movement rider never consults combat context or opens the picker',
            maneuver: { name: 'Goading Attack', damageBonus: true },
            payload: riderPopup(5, 'Goading.', 'Goading Attack'),
            noAllies: false,
            expectedPopup: { type: 'automation_info', name: 'Goading Attack', description: 'Goading.' },
        },
        {
            branch: 'ally_movement with no willing allies pops an honest no-grant message',
            maneuver: maneuvering,
            payload: riderPopup(4, 'Rolled d8 for 4.'),
            noAllies: true,
            expectedPopup: { type: 'automation_info', name: 'Maneuvering Attack', description: 'Rolled d8 for 4. No willing allies are within range to receive the movement grant.' },
        },
    ])('$branch', async ({ maneuver, payload, noAllies, expectedPopup }) => {
        if (noAllies) {
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'GoliathFireGiant', type: 'player' }] });
        }
        executeAttackRiderManeuver.mockResolvedValue(payload);
        const { api, modalState, setPopupHtml } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse(maneuver, attack, hitContext('Goblin'));

        expect(modalState.secondaryTargetModal).toBeFalsy();
        expect(setPopupHtml).toHaveBeenCalledWith(expectedPopup);
        if (noAllies) {
            expect(getCombatContext).toHaveBeenCalledWith(mockCampaignName);
        } else {
            expect(getCombatContext).not.toHaveBeenCalled();
        }
    });
});
