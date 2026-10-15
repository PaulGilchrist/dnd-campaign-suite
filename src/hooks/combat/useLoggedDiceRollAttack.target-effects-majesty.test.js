// @maintained-by-ai: 2026-10-14
// createLogAndShow — Unbreakable Majesty ATTACK-SIDE trigger lane (hitResolution.
// runUnbreakableMajesty): guard checks, one-shot attacker mark, save-DC and
// prompt dispatch, activation/revocation logs, and the indefinite no-timers wait
// for the player's save (2024 Oath of the Crown, public/data/2024/classes.json:
// "whenever any creature hits you with an attack roll ... the attacker must
// succeed on a Charisma saving throw ... or the attack misses instead" — the
// rule is attack-type agnostic, so no per-weapon DC branches exist here).
// Twin seam (useLoggedDiceRollAttack.target-effects-majesty-save.test.js): how
// the save OUTCOME drives targetEffects revoke/consume via a stateful fake store.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'majesty-guid-001'),
    },
    DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    findCreatureByName: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
    clearHuntersMarkConcentration: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(),
    markAttackerTriggeredMajesty: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getBaitAndSwitchAcBonus: vi.fn(() => 0),
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    getSlowAcPenalty: vi.fn(() => 0),
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(() => 0),
    getShieldOfFaithAcBonus: vi.fn(() => 0),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

import { rollD20 } from '../../services/dice/diceRoller.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    isUnbreakableMajestyActive,
    getUnbreakableMajestySaveDc,
    hasAttackerTriggeredMajesty,
    markAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';
import {
    dispatchUnbreakableMajestySave,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';

const MAJESTY_PROMPT_ID = 'majesty-majesty-guid-001'; // `majesty-${utils.guid()}`

describe('createLogAndShow - Unbreakable Majesty attack-side trigger', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Mage', computedStats: { armorClass: 10 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks keeps implementations — re-pin so no stateful return
        // value leaks from a previous test (twin-file pattern).
        rollD20.mockReset().mockReturnValue(12); // 12 + 5 = 17 vs ac 10 → hit, non-crit
        getTargetFromAttacker.mockReset().mockReturnValue({ name: 'Mage', ac: 10 });
        getRuntimeValue.mockReset().mockReturnValue(null);
        loadCombatSummary.mockReset().mockResolvedValue({ creatures: [{ name: 'Mage', type: 'npc', ac: 10 }] });
        getShieldAcBonus.mockReset().mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReset().mockReturnValue(0);
        isUnbreakableMajestyActive.mockReset().mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReset().mockReturnValue(false);
        getUnbreakableMajestySaveDc.mockReset().mockReturnValue(15);
        markAttackerTriggeredMajesty.mockReset();
        dispatchUnbreakableMajestySave.mockReset();
    });

    function armMajesty(saveDc = 15) {
        isUnbreakableMajestyActive.mockReturnValue(true);
        getUnbreakableMajestySaveDc.mockReturnValue(saveDc);
    }

    function majestyLogCalls() {
        return deps.logEntry.mock.calls.filter(
            (call) => call[0]?.type === 'ability_use' && call[0]?.abilityName === 'Unbreakable Majesty',
        );
    }

    // no-timers T2: the majesty save prompt waits INDEFINITELY (no 30s
    // fail-open). Answer it exactly as the player would — dispatch save-result
    // for the majesty promptId until the roll settles (bounded poll; never a
    // game clock).
    async function rollAnsweringMajestySave(name = 'Longsword', bonus = 5, success = true) {
        const run = createLogAndShow(deps)(name, bonus, 'attack', { targetName: 'Mage' });
        let settled = false;
        run.then(() => { settled = true; });
        for (let i = 0; i < 40 && !settled; i++) {
            await new Promise((r) => setTimeout(r, 5));
            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: MAJESTY_PROMPT_ID, success },
            }));
        }
        await run;
    }

    it('marks the attacker once and dispatches the CHA save prompt when a hit lands on a majesty defender', async () => {
        armMajesty();

        await rollAnsweringMajestySave();

        expect(isUnbreakableMajestyActive).toHaveBeenCalledWith('Mage', 'test-campaign');
        expect(hasAttackerTriggeredMajesty).toHaveBeenCalledWith('Mage', 'TestFighter', 'test-campaign');
        // ONE-SHOT mark: recorded once per hit so the same attacker cannot
        // re-trigger majesty again this round.
        expect(markAttackerTriggeredMajesty).toHaveBeenCalledTimes(1);
        expect(markAttackerTriggeredMajesty).toHaveBeenCalledWith('Mage', 'TestFighter', 'test-campaign');
        expect(dispatchUnbreakableMajestySave).toHaveBeenCalledWith(
            'test-campaign', 'Mage', 'TestFighter', 15, MAJESTY_PROMPT_ID,
        );
    });

    it('logs the majesty activation with the CHA save type and DC when the prompt is dispatched', async () => {
        armMajesty();

        await rollAnsweringMajestySave();

        const activation = majestyLogCalls();
        expect(activation.length).toBeGreaterThanOrEqual(1);
        expect(activation[0][0].description).toContain('Unbreakable Majesty');
        expect(activation[0][0].description).toContain('CHA save');
        expect(activation[0][0].description).toContain('DC 15');
    });

    it('never auto-resolves by the clock — waits for the player, then honors their failed save', async () => {
        armMajesty(19);

        const run = createLogAndShow(deps)('Mace', 5, 'attack', { targetName: 'Mage' });
        let settled = false;
        run.then(() => { settled = true; });
        await new Promise((r) => setTimeout(r, 80));
        // Still PENDING after real time has passed — no timeout log, no silent
        // resolution (the old 30s fail-open window is retired).
        expect(settled).toBe(false);

        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId: MAJESTY_PROMPT_ID, success: false },
        }));
        await run;

        expect(deps.logEntry.mock.calls.filter(
            (call) => /timeout/i.test(call[0]?.description || ''),
        )).toHaveLength(0);
        const missLogs = majestyLogCalls().filter(
            (call) => /attack misses due to Unbreakable Majesty/i.test(call[0]?.description || ''),
        );
        expect(missLogs).toHaveLength(1);
    });

    it.each`
        scenario                              | majestyActive | alreadyTriggered
        ${'majesty is not active on the defender'} | ${false}      | ${false}
        ${'the attacker already triggered majesty this round'} | ${true}       | ${true}
    `('does not trigger when $scenario', async ({ majestyActive, alreadyTriggered }) => {
        isUnbreakableMajestyActive.mockReturnValue(majestyActive);
        hasAttackerTriggeredMajesty.mockReturnValue(alreadyTriggered);

        await rollAnsweringMajestySave();

        expect(markAttackerTriggeredMajesty).not.toHaveBeenCalled();
        expect(dispatchUnbreakableMajestySave).not.toHaveBeenCalled();
    });

    it('does not trigger majesty when the attack misses before the check', async () => {
        armMajesty();
        rollD20.mockReturnValue(3); // 3 + 5 = 8 vs ac 10 → miss; majesty never arms

        await rollAnsweringMajestySave();

        expect(markAttackerTriggeredMajesty).not.toHaveBeenCalled();
        expect(dispatchUnbreakableMajestySave).not.toHaveBeenCalled();
    });
});
