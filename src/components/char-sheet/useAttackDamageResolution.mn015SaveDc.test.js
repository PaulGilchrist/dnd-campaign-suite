// @maintained-by-ai
// MN-015 lane — handleAttackRiderManeuverUse save-DC forwarding + size-gate refusal.
// Owns the exact executeAttackRiderManeuver consumer args: the combat_superiority
// action payload is forwarded verbatim (numeric DC passthrough vs 'ability' token
// fallback — prop-distinct, never a silent DC-10/empty-automation shape) and a
// refused rider never folds its die onto damage or spends anything.
// Lane ownership (do not duplicate here): dispatch/popup/resume/prompt-close →
// useAttackDamageResolution.maneuvers.test.js; ally picker → .maneuveringAlly.test.js;
// precision-miss die math → .mn014.test.js; rider prompt gating → steps/attackRollDamageSteps.test.js.
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

vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

// Factory exports the full handler surface consumed by the steps import graph,
// even where this lane only asserts executeAttackRiderManeuver.
vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getAttackRiderOptions: vi.fn(),
    getAttackRiderOptionsByContext: vi.fn(),
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { executeAttackRiderManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const CHAR = 'TestFighter';
const CAMPAIGN = 'test-campaign';
const TARGET = 'Gibbering Mouther 1';
const ATTACK = { name: 'Dagger', damage: '1d4+2', damageType: 'piercing', weaponType: 'melee' };
const HIT_CONTEXT = { isMiss: false, hit: true, targetName: TARGET };
const CURRENT = { formula: '1d4+2', total: 7, rolls: [5, 2] };
const PUSHING = { name: 'Pushing Attack', damageBonus: true, dieExpression: 'superiority_die' };
const RIDER_OK = { type: 'popup', payload: { type: 'automation_info', name: 'Pushing Attack', description: 'ok' } };

// Fresh fixtures per mount — no cross-test bleed of popup/modal/pause state.
function makeStats(specialActions = []) {
    return {
        name: CHAR,
        level: 5,
        abilities: [
            { name: 'Strength', bonus: 3 },
            { name: 'Dexterity', bonus: 2 },
        ],
        proficiency: 3,
        automation: { actions: [], passives: [], specialActions },
    };
}

function UseAttackDamageResolution(overrides = {}) {
    const setPopupHtml = overrides.setPopupHtml ?? vi.fn();
    const setModalState = overrides.setModalState ?? vi.fn();
    const api = useAttackDamageResolution({
        playerStats: makeStats(),
        campaignName: CAMPAIGN,
        mapName: null,
        popupHtml: null,
        setPopupHtml,
        rollDamage: vi.fn(),
        buildCtx: vi.fn(() => Promise.resolve({})),
        buildCtxSync: vi.fn(() => Promise.resolve({})),
        setModalState,
        setPendingDamage: vi.fn(),
        setTacticalMasterModal: vi.fn(),
        resumeRef: { current: null },
        ...overrides,
    });
    return { api, setPopupHtml, setModalState };
}

describe('MN-015 handleAttackRiderManeuverUse — save DC forwarding + size-gate refusal', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        executeAttackRiderManeuver.mockResolvedValue(RIDER_OK);
    });

    // Prop-distinct rows: computed numeric DC 14/STR vs the 'ability'/['STR','DEX']
    // token fallback — a dropped forward (empty automation → DC-10 fallback downstream)
    // or a misread field fails on the exact byte-exact action arg.
    it.each([
        {
            branch: 'numeric DC passthrough from combat_superiority special-action info',
            specialActions: [{ type: 'combat_superiority', name: 'Combat Superiority', saveDc: 14, saveAbility: 'STR' }],
            expectedAction: { automation: { type: 'combat_superiority', saveDc: 14, saveAbility: 'STR' } },
        },
        {
            branch: "'ability' token + STR/DEX default when no combat_superiority info is present",
            specialActions: [],
            expectedAction: { automation: { type: 'combat_superiority', saveDc: 'ability', saveAbility: ['STR', 'DEX'] } },
        },
    ])('forwards $expectedAction.automation verbatim to executeAttackRiderManeuver — $branch', async ({ specialActions, expectedAction }) => {
        const playerStats = makeStats(specialActions);
        const { api } = UseAttackDamageResolution({ playerStats });

        await api.handleAttackRiderManeuverUse(PUSHING, ATTACK, HIT_CONTEXT, CURRENT);

        expect(executeAttackRiderManeuver).toHaveBeenCalledWith(
            expectedAction,
            playerStats,
            CAMPAIGN,
            'Pushing Attack',
            { weaponType: 'melee', isUnarmedStrike: false, targetName: TARGET },
        );
    });

    it('a size-gate refusal adds no die to damage, spends nothing, logs the refusal, and still shows the popup', async () => {
        const REFUSAL = 'Pushing Attack: Target is Huge (too large — only Large or smaller affected).';
        // dieValue is present so a regressed !result.refused guard WOULD fold 6
        // onto the formula and write attackRiderDieValue — the assertions below bite.
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            refused: true,
            dieValue: 6,
            payload: { type: 'automation_info', name: 'Pushing Attack', description: REFUSAL },
            logEntries: [{ type: 'ability_use', characterName: CHAR, abilityName: 'Pushing Attack', description: REFUSAL }],
        });
        const { api, setPopupHtml } = UseAttackDamageResolution();

        const result = await api.handleAttackRiderManeuverUse(
            PUSHING,
            ATTACK,
            { isMiss: false, hit: true, targetName: 'Hill Giant 1' },
            CURRENT,
        );

        expect(result).toEqual(CURRENT);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'ability_use',
            characterName: CHAR,
            abilityName: 'Pushing Attack',
            description: REFUSAL,
        });
        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        expect(setPopupHtml).toHaveBeenCalledWith({ type: 'automation_info', name: 'Pushing Attack', description: REFUSAL });
    });
});
