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
    setRuntimeObject: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(() => ({
        run: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getAttackRiderOptions: vi.fn(),
    getAttackRiderOptionsByContext: vi.fn(),
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { executeAttackRiderManeuver, applyManeuveringAllyGrant } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const mockPlayerStats = { name: 'GoliathFireGiant', level: 5, proficiency: 3, automation: {} };
const mockCampaignName = 'test-campaign';

const maneuvering = {
    name: 'Maneuvering Attack',
    effect: 'ally_movement',
    damageBonus: true,
    dieExpression: 'superiority_die',
};
const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', weaponType: 'melee' };

function UseAttackDamageResolution() {
    const setPopupHtml = vi.fn();
    const modalState = {};
    const setModalState = vi.fn((updates) => Object.assign(modalState, updates));
    const resume = vi.fn(async (_ctx, ref) => { if (ref) ref.current = null; });
    const resumeRef = { current: { pipelineStash: { pipeline: { resume }, ctx: { hit: true } }, _pausedStep: 'attackRiderManeuvers' } };
    const api = useAttackDamageResolution({
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        mapName: null,
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
    return { api, setPopupHtml, setModalState, modalState, resumeRef, resume };
}

describe('MN-011 Maneuvering Attack ally grant', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'GoliathFireGiant', type: 'player', currentHp: 49, maxHp: 49 },
                { name: 'HeroesFeastBard', type: 'player', currentHp: 30, maxHp: 30 },
                { name: 'Animated Rug of Smothering 1', type: 'npc', currentHp: 21, maxHp: 27 },
            ],
        });
        applyManeuveringAllyGrant.mockResolvedValue({ halfSpeed: 15, description: 'Maneuvering Attack: HeroesFeastBard can move up to half their Speed (15 ft) using their Reaction without provoking Opportunity Attacks from Animated Rug of Smothering 1.' });
    });

    it('opens an ally picker after Use Maneuver instead of only showing prose', async () => {
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            dieValue: 6,
            payload: { type: 'automation_info', name: 'Maneuvering Attack', description: 'Rolled d8 for 6. Added 6 to the damage roll.' },
        });
        const { api, setModalState, modalState, setPopupHtml } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse(maneuvering, attack, { isMiss: false, hit: true, targetName: 'Animated Rug of Smothering 1' });

        const picker = modalState.secondaryTargetModal;
        expect(setModalState).toHaveBeenCalledWith(expect.objectContaining({ secondaryTargetModal: expect.any(Object) }));
        expect(picker.title).toBe('Maneuvering Attack — Choose Ally');
        expect(picker.targets.map(t => t.name)).toEqual(['HeroesFeastBard']);
        expect(picker.description).toContain('without provoking Opportunity Attacks from Animated Rug of Smothering 1');
        expect(setPopupHtml).not.toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('An ally can use its Reaction') }));
    });

    it('confirming the picker writes the grant via the service and shows the named grant popup', async () => {
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            dieValue: 6,
            payload: { type: 'automation_info', name: 'Maneuvering Attack', description: 'Rolled d8 for 6.' },
        });
        const { api, modalState, setPopupHtml } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse(maneuvering, attack, { isMiss: false, hit: true, targetName: 'Animated Rug of Smothering 1' });
        await modalState.secondaryTargetModal.onTargetSelected('HeroesFeastBard');

        expect(applyManeuveringAllyGrant).toHaveBeenCalledWith('HeroesFeastBard', 'GoliathFireGiant', 'Animated Rug of Smothering 1', 'test-campaign');
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            type: 'automation_info',
            name: 'Maneuvering Attack',
            description: expect.stringContaining('HeroesFeastBard can move up to half their Speed'),
        }));
    });

    it('skipping the picker closes the modal and never writes the grant', async () => {
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            dieValue: 2,
            payload: { type: 'automation_info', name: 'Maneuvering Attack', description: 'Rolled d8 for 2.' },
        });
        const { api, modalState, setPopupHtml } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse(maneuvering, attack, { isMiss: false, hit: true, targetName: 'Animated Rug of Smothering 1' });
        modalState.secondaryTargetModal.onSkip();

        expect(applyManeuveringAllyGrant).not.toHaveBeenCalled();
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('No ally received the movement grant') }));
    });

    it('resumes the paused pipeline so base+die damage still lands with the picker open', async () => {
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            dieValue: 6,
            payload: { type: 'automation_info', name: 'Maneuvering Attack', description: 'Rolled d8 for 6.' },
        });
        const { api, resumeRef, resume } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse(maneuvering, attack, { isMiss: false, hit: true, targetName: 'Animated Rug of Smothering 1' });

        expect(resume).toHaveBeenCalled();
        expect(resumeRef.current).toBeNull();
    });

    it('shows a no-allies popup when no willing allies are in the encounter', async () => {
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'GoliathFireGiant', type: 'player' }] });
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            dieValue: 4,
            payload: { type: 'automation_info', name: 'Maneuvering Attack', description: 'Rolled d8 for 4.' },
        });
        const { api, modalState, setPopupHtml } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse(maneuvering, attack, { isMiss: false, hit: true, targetName: 'Goblin' });

        expect(modalState.secondaryTargetModal).toBeFalsy();
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('No willing allies are within range') }));
    });

    it('does not open the ally picker for non-ally_movement damage riders', async () => {
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            dieValue: 5,
            payload: { type: 'automation_info', name: 'Goading Attack', description: 'Goading.' },
        });
        const { api, modalState, setPopupHtml } = UseAttackDamageResolution();

        await api.handleAttackRiderManeuverUse({ name: 'Goading Attack', damageBonus: true }, attack, { isMiss: false, hit: true, targetName: 'Goblin' });

        expect(modalState.secondaryTargetModal).toBeFalsy();
        expect(setPopupHtml).toHaveBeenCalledWith({ type: 'automation_info', name: 'Goading Attack', description: 'Goading.' });
    });
});
