import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasion) => {
        if (evasion && !success) return Math.floor(raw / 2);
        return success ? Math.floor(raw / 2) : raw;
    }),
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

vi.mock('./useLoggedDiceRollUtils.js', () => ({
    hasSoulstitchProtection: vi.fn(),
}));

import { addExpiration } from '../../services/rules/effects/expirations.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { computeDamageAfterEvasion, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { hasSoulstitchProtection } from './useLoggedDiceRollUtils.js';
import utils from '../../services/ui/utils.js';
import storage from '../../services/ui/storage.js';
import { setupEventListeners } from './useLoggedDiceRollEventHandlers.js';

describe('setupEventListeners (useLoggedDiceRollEventHandlers)', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        logEntry: vi.fn(),
        charactersRef: { current: [] },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        delete window.__pendingResultHandlersInstalled;
        delete window.__pendingSaves;
        getCombatSummary.mockReturnValue(null);
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        hasSoulstitchProtection.mockReturnValue(false);
        computeDamageAfterEvasion.mockReturnValue(10);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        addExpiration.mockReturnValue(undefined);
        storage.set.mockReturnValue(Promise.resolve());
        hasIgnoreResistance.mockReturnValue(false);
        playerIsImmuneToCondition.mockReturnValue(false);
        utils.getName.mockImplementation((n) => n);
    });

    function setup() {
        setupEventListeners(deps);
    }

    describe('save-result event', () => {
        it('handles save-result event with pending save', () => {
            setup();
            const promptId = 'test-prompt-1';
            window.__pendingSaves = {
                [promptId]: {
                    promptId,
                    targetName: 'Goblin',
                    rawDamage: 15,
                    saveDc: 15,
                    saveType: 'DEX',
                    dcSuccess: 'half',
                    damageType: 'fire',
                    attackerName: 'TestWizard',
                    name: 'Fireball',
                    formula: '8d6',
                    rolls: [3, 4, 5, 2, 3, 3],
                    modifier: 0,
                    campaignName: 'test-campaign',
                    setPopupHtml: vi.fn(),
                },
            };

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: {
                    promptId,
                    targetName: 'Goblin',
                    success: false,
                    roll: 8,
                    total: 11,
                    saveBonus: 3,
                },
            }));

            expect(applyDamageToTarget).toHaveBeenCalled();
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                name: 'Fireball',
            }));
        });

        it('does nothing when no pending save for promptId', () => {
            setup();
            window.__pendingSaves = {};
            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'nonexistent' },
            }));
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('handles soulstitch protection', () => {
            setup();
            hasSoulstitchProtection.mockReturnValue(true);
            const promptId = 'test-prompt-2';
            window.__pendingSaves = {
                [promptId]: {
                    promptId,
                    targetName: 'Ally',
                    rawDamage: 15,
                    saveDc: 15,
                    saveType: 'DEX',
                    dcSuccess: 'half',
                    damageType: 'fire',
                    attackerName: 'TestWizard',
                    name: 'Fireball',
                    formula: '8d6',
                    rolls: [3, 4, 5, 2, 3, 3],
                    modifier: 0,
                    campaignName: 'test-campaign',
                    setPopupHtml: vi.fn(),
                },
            };

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: {
                    promptId,
                    targetName: 'Ally',
                    success: true,
                    roll: 18,
                    total: 21,
                    saveBonus: 3,
                },
            }));

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                saveResult: 'soulstitch_auto_success',
                soulstitchProtected: true,
            }));
        });

        it('handles evasion', () => {
            setup();
            deps.charactersRef.current = [
                { name: 'Ally', computedStats: { evasionEffects: [{ saveType: 'DEX', shareable: true, shareRange: 5 }] } },
            ];
            const promptId = 'test-prompt-3';
            window.__pendingSaves = {
                [promptId]: {
                    promptId,
                    targetName: 'Ally',
                    rawDamage: 15,
                    saveDc: 15,
                    saveType: 'DEX',
                    dcSuccess: 'half',
                    damageType: 'fire',
                    attackerName: 'TestWizard',
                    name: 'Fireball',
                    formula: '8d6',
                    rolls: [3, 4, 5, 2, 3, 3],
                    modifier: 0,
                    campaignName: 'test-campaign',
                    setPopupHtml: vi.fn(),
                },
            };

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: {
                    promptId,
                    targetName: 'Ally',
                    success: false,
                    roll: 5,
                    total: 8,
                    saveBonus: 3,
                },
            }));

            expect(computeDamageAfterEvasion).toHaveBeenCalled();
        });

        it('sets popupHtml after processing', () => {
            setup();
            const setPopupHtml = vi.fn();
            const promptId = 'test-prompt-7';
            window.__pendingSaves = {
                [promptId]: {
                    promptId,
                    targetName: 'Goblin',
                    rawDamage: 15,
                    saveDc: 15,
                    saveType: 'DEX',
                    dcSuccess: 'half',
                    damageType: 'fire',
                    attackerName: 'TestWizard',
                    name: 'Fireball',
                    formula: '8d6',
                    rolls: [3, 4, 5, 2, 3, 3],
                    modifier: 0,
                    campaignName: 'test-campaign',
                    setPopupHtml,
                },
            };

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: {
                    promptId,
                    targetName: 'Goblin',
                    success: false,
                    roll: 8,
                    total: 11,
                    saveBonus: 3,
                },
            }));

            expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                name: 'Fireball',
            }));
        });

        it('removes pending save from window.__pendingSaves', () => {
            setup();
            const promptId = 'test-prompt-8';
            window.__pendingSaves = {
                [promptId]: {
                    promptId,
                    targetName: 'Goblin',
                    rawDamage: 15,
                    saveDc: 15,
                    saveType: 'DEX',
                    dcSuccess: 'half',
                    damageType: 'fire',
                    attackerName: 'TestWizard',
                    name: 'Fireball',
                    formula: '8d6',
                    rolls: [3, 4, 5, 2, 3, 3],
                    modifier: 0,
                    campaignName: 'test-campaign',
                    setPopupHtml: vi.fn(),
                },
            };

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: {
                    promptId,
                    targetName: 'Goblin',
                    success: false,
                    roll: 8,
                    total: 11,
                    saveBonus: 3,
                },
            }));

            expect(window.__pendingSaves[promptId]).toBeUndefined();
        });
    });

    describe('death-save-result event', () => {
        it('logs death save entry', () => {
            setup();
            window.dispatchEvent(new CustomEvent('death-save-result', {
                detail: {
                    targetName: 'InjuredAlly',
                    roll: 15,
                    isNat20: false,
                    isNat1: false,
                    success: true,
                },
            }));

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'death_save',
                characterName: 'InjuredAlly',
                roll: 15,
                success: true,
            }));
        });

        it('handles natural 20 death save', () => {
            setup();
            window.dispatchEvent(new CustomEvent('death-save-result', {
                detail: {
                    targetName: 'InjuredAlly',
                    roll: 20,
                    isNat20: true,
                    isNat1: false,
                    success: true,
                },
            }));

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                isNatural20: true,
            }));
        });

        it('handles natural 1 death save', () => {
            setup();
            window.dispatchEvent(new CustomEvent('death-save-result', {
                detail: {
                    targetName: 'InjuredAlly',
                    roll: 1,
                    isNat20: false,
                    isNat1: true,
                    success: false,
                },
            }));

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                isNatural1: true,
            }));
        });
    });

    describe('concentration-result event', () => {
        it('logs concentration save entry', () => {
            setup();
            window.dispatchEvent(new CustomEvent('concentration-result', {
                detail: {
                    targetName: 'TestWizard',
                    roll: 15,
                    total: 18,
                    saveBonus: 3,
                    bonusDetail: '+3',
                    spellName: 'Fireball',
                    dc: 15,
                    success: true,
                },
            }));

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'roll',
                rollType: 'concentration-save',
                name: 'Constitution',
                condition: 'Concentration: Fireball',
            }));
        });

        it('clears concentration on combat summary when failed', () => {
            setup();
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestWizard', concentration: 'Fireball' }],
            });
            storage.set.mockReturnValue(undefined);

            window.dispatchEvent(new CustomEvent('concentration-result', {
                detail: {
                    targetName: 'TestWizard',
                    roll: 5,
                    total: 8,
                    saveBonus: 3,
                    bonusDetail: '+3',
                    spellName: 'Fireball',
                    dc: 15,
                    success: false,
                },
            }));

            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
        });

        it('dispatches combat-summary-updated event on concentration break', () => {
            setup();
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestWizard', concentration: 'Fireball' }],
            });
            storage.set.mockReturnValue(undefined);

            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
            window.dispatchEvent(new CustomEvent('concentration-result', {
                detail: {
                    targetName: 'TestWizard',
                    roll: 5,
                    total: 8,
                    saveBonus: 3,
                    bonusDetail: '+3',
                    spellName: 'Fireball',
                    dc: 15,
                    success: false,
                },
            }));

            expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'combat-summary-updated',
            }));
            dispatchEventSpy.mockRestore();
        });
    });

    describe('one-time setup', () => {
        it('only installs handlers once via window flag', () => {
            setup();
            setup();
            setup();
            // The flag should prevent re-installation
            expect(window.__pendingResultHandlersInstalled).toBe(true);
        });
    });
});
