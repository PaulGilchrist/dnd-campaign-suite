// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
  getSlowAcPenalty: () => 0,
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
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

describe('createLogAndShow - Unbreakable Majesty Save Flow', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Mage', computedStats: { armorClass: 10 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    const origSetTimeout = globalThis.setTimeout;
    const origAddEventListener = window.addEventListener.bind(window);
    const origRemoveEventListener = window.removeEventListener.bind(window);

    beforeEach(() => {
        vi.clearAllMocks();
        window.addEventListener = origAddEventListener;
        window.removeEventListener = origRemoveEventListener;
        globalThis.setTimeout = origSetTimeout;
        rollD20.mockReturnValue(20);
        getTargetFromAttacker.mockReturnValue({ name: 'Mage', ac: 10 });
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        getRuntimeValue.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Mage', type: 'npc', ac: 10 }] });
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    // no-timers T2: the majesty save prompt now waits INDEFINITELY (no 30s
    // fail-open). Tests answer the prompt exactly as the player would —
    // dispatching save-result for the majesty promptId until the flow settles.
    async function runAnsweringMajestySave(weapon, bonus, ctx, success = true) {
        globalThis.setTimeout = (cb) => { cb(); return 0; }; // benign deferrals only
        try {
            const fn = createFn();
            let settled = false;
            const run = fn(weapon, bonus, 'attack', ctx).then((r) => { settled = true; return r; });
            for (let i = 0; i < 40 && !settled; i++) {
                await new Promise((r) => origSetTimeout(r, 5));
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId: 'majesty-majesty-guid-001', success },
                }));
            }
            return await run;
        } finally {
            globalThis.setTimeout = origSetTimeout;
        }
    }

    describe('majesty triggers when attack hits defender with active majesty', () => {
        it('checks majesty state, marks attacker, and dispatches save when hit and target has majesty active', async () => {
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(15);

            await runAnsweringMajestySave('Longsword', 5, { targetName: 'Mage' });

            expect(isUnbreakableMajestyActive).toHaveBeenCalledWith('Mage', 'test-campaign');
            expect(hasAttackerTriggeredMajesty).toHaveBeenCalledWith('Mage', 'TestFighter', 'test-campaign');
            expect(markAttackerTriggeredMajesty).toHaveBeenCalledWith('Mage', 'TestFighter', 'test-campaign');
            expect(dispatchUnbreakableMajestySave).toHaveBeenCalledWith(
                'test-campaign',
                'Mage',
                'TestFighter',
                15,
                'majesty-majesty-guid-001',
            );
        });

        it('logs majesty activation description when the save prompt is dispatched', async () => {
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(15);

            await runAnsweringMajestySave('Longsword', 5, { targetName: 'Mage' });

            const majestyLogEntries = deps.logEntry.mock.calls.filter(
                (call) => call[0]?.type === 'ability_use' && call[0]?.abilityName === 'Unbreakable Majesty',
            );
            expect(majestyLogEntries.length).toBeGreaterThanOrEqual(1);
            expect(majestyLogEntries[0][0].description).toContain('Unbreakable Majesty');
            expect(majestyLogEntries[0][0].description).toContain('CHA save');
            expect(majestyLogEntries[0][0].description).toContain('DC 15');
        });

        it('marks attacker as triggered to prevent re-triggering in the same round', async () => {
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(15);
            const markSpy = vi.fn();
            vi.mocked(markAttackerTriggeredMajesty).mockImplementation(markSpy);

            await runAnsweringMajestySave('Longsword', 5, { targetName: 'Mage' });

            expect(markSpy).toHaveBeenCalledWith('Mage', 'TestFighter', 'test-campaign');
        });
    });

        it('never auto-resolves by the clock — waits for the player, then honors their failed save', async () => {
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(19);

            // no-timers T2: the old 30s fail-open window is gone. The flow
            // must still be PENDING after real time has passed (no timeout log,
            // no silent resolution) and complete only when the player saves.
            globalThis.setTimeout = (cb) => { cb(); return 0; };
            const fn = createFn();
            globalThis.setTimeout = origSetTimeout;
            let settled = false;
            const run = fn('Mace', 5, 'attack', { targetName: 'Mage' }).then((r) => { settled = true; return r; });
            await new Promise((r) => origSetTimeout(r, 80));
            expect(settled).toBe(false);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'majesty-majesty-guid-001', success: false },
            }));
            await run;

            const timeoutLogs = deps.logEntry.mock.calls.filter(
                (call) => /timeout/i.test(call[0]?.description || ''),
            );
            expect(timeoutLogs.length).toBe(0);
            const missLogs = deps.logEntry.mock.calls.filter(
                (call) => call[0]?.abilityName === 'Unbreakable Majesty' && /attack misses due to Unbreakable Majesty/i.test(call[0]?.description || ''),
            );
            expect(missLogs.length).toBe(1);
        });

    describe('majesty does not trigger', () => {
        it('does not trigger majesty when majesty is not active on the target', async () => {
            isUnbreakableMajestyActive.mockReturnValue(false);

            await runAnsweringMajestySave('Longsword', 5, { targetName: 'Mage' });

            expect(isUnbreakableMajestyActive).toHaveBeenCalledWith('Mage', 'test-campaign');
            expect(hasAttackerTriggeredMajesty).not.toHaveBeenCalled();
            expect(markAttackerTriggeredMajesty).not.toHaveBeenCalled();
            expect(dispatchUnbreakableMajestySave).not.toHaveBeenCalled();
        });

        it('does not trigger majesty when attacker already triggered this round', async () => {
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(true);

            await runAnsweringMajestySave('Longsword', 5, { targetName: 'Mage' });

            expect(hasAttackerTriggeredMajesty).toHaveBeenCalledWith('Mage', 'TestFighter', 'test-campaign');
            expect(markAttackerTriggeredMajesty).not.toHaveBeenCalled();
            expect(dispatchUnbreakableMajestySave).not.toHaveBeenCalled();
        });

        it('does not trigger majesty when attack misses before majesty check', async () => {
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(15);
            rollD20.mockReturnValue(3);

            await runAnsweringMajestySave('Longsword', 5, { targetName: 'Mage' });

            expect(dispatchUnbreakableMajestySave).not.toHaveBeenCalled();
            expect(markAttackerTriggeredMajesty).not.toHaveBeenCalled();
        });
    });

    describe('majesty with different save DC values', () => {
        it('dispatches the correct DC from majesty configuration', async () => {
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(20);

            await runAnsweringMajestySave('Longsword', 5, { targetName: 'Mage' });

            expect(dispatchUnbreakableMajestySave).toHaveBeenCalledWith(
                'test-campaign',
                'Mage',
                'TestFighter',
                20,
                'majesty-majesty-guid-001',
            );
        });

        it('uses DC 0 when majesty save DC is not set', async () => {
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(0);

            await runAnsweringMajestySave('Longsword', 5, { targetName: 'Mage' });

            expect(dispatchUnbreakableMajestySave).toHaveBeenCalledWith(
                'test-campaign',
                'Mage',
                'TestFighter',
                0,
                'majesty-majesty-guid-001',
            );
        });
    });

    describe('majesty with different attack types', () => {
        it('triggers majesty on spell attacks', async () => {
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(15);

            await runAnsweringMajestySave('Eldritch Blast', 5, { targetName: 'Mage' });

            expect(dispatchUnbreakableMajestySave).toHaveBeenCalled();
            expect(markAttackerTriggeredMajesty).toHaveBeenCalled();
        });

        it('triggers majesty on melee weapon attacks', async () => {
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(15);

            await runAnsweringMajestySave('Greatsword', 8, { targetName: 'Mage' });

            expect(dispatchUnbreakableMajestySave).toHaveBeenCalled();
            expect(markAttackerTriggeredMajesty).toHaveBeenCalled();
        });
    });
});
