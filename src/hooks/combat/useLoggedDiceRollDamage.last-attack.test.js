// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

// Minimal mocks — only what the main function and its direct handler chain need.
vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    isMagicMissileImmune: vi.fn(),
    hasPotentCantrip: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

// All other dependencies are mocked with no-op functions so imports resolve.
vi.mock('../../services/dice/diceRoller.js', () => ({
    formatDamageFormula: vi.fn((f) => f),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { getName: vi.fn((n) => n || 'Unknown'), guid: vi.fn(() => 'test-guid') },
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(() => Promise.resolve({ disadvantage: false })),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(() => []),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        restoreBalance: false,
        autoRerollForSaves: false,
        autoRerollBonus: null,
        autoRerollCondition: null,
        saveAdvantageCount: 0,
        saveAdvantageAbilities: [],
    })),
}));

vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('./handlers/handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('./handlers/handleMagicMissileImmunity.js', () => ({
    isMagicMissileImmune: vi.fn(),
}));

describe('useLoggedDiceRollDamage — lastAttack persistence', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default: plain damage handler path (no save, no miss, no aoe, no sanctuary)
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        getRuntimeValue.mockImplementation((_key, _subKey, _camp) => null);

        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    // -----------------------------------------------------------------------
    // Behavior: plain damage — lastAttack is written with correct merged data
    // -----------------------------------------------------------------------
    it('writes lastAttack with full context on plain damage', async () => {
        const fn = createFn();

        await fn('Fire Bolt', '1d10', 5, [5], 0, {
            attackerName: 'TestFighter',
            targetName: 'Goblin',
            damageType: 'fire',
            attackName: 'Fire Bolt',
        });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'lastAttack',
            expect.objectContaining({
                attackerName: 'TestFighter',
                targetName: 'Goblin',
                attackName: 'Fire Bolt',
                rawDamage: 5,
                primaryDamage: 5,
                primaryDamageType: 'fire',
                damageTypes: ['fire'],
                damageApplied: true,
            }),
            'test-campaign'
        );
    });

    // -----------------------------------------------------------------------
    // Behavior: merge — lastAttack merges with existing campaign data
    // -----------------------------------------------------------------------
    it('merges lastAttack with existing campaign data', async () => {
        const existingLastAttack = {
            attackerName: 'TestFighter',
            rollType: 'attack',
        };
        getRuntimeValue.mockImplementation((key, subKey) => {
            if (key === 'campaign' && subKey === 'lastAttack') return existingLastAttack;
            if (key === 'campaign') return [];
            return null;
        });

        const fn = createFn();
        await fn('Fire Bolt', '1d10', 5, [5], 0, {
            attackerName: 'TestFighter',
            targetName: 'Goblin',
            damageType: 'fire',
            attackName: 'Fire Bolt',
        });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'lastAttack',
            expect.objectContaining({
                attackerName: 'TestFighter',
                targetName: 'Goblin',
                attackName: 'Fire Bolt',
                rolls: expect.any(Array),
                rawDamage: 5,
                primaryDamage: 5,
                primaryDamageType: 'fire',
                damageTypes: expect.any(Array),
                damageApplied: true,
            }),
            'test-campaign'
        );
    });

    // -----------------------------------------------------------------------
    // Behavior: auto-miss — lastAttack reflects zero damage
    // -----------------------------------------------------------------------
    it('writes lastAttack with damageApplied=false on auto-miss', async () => {
        const fn = createFn();

        await fn('Fire Bolt', '1d10', 0, [], 0, {
            attackerName: 'TestFighter',
            targetName: 'Goblin',
            damageType: 'fire',
            isAutoMiss: true,
        });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'lastAttack',
            expect.objectContaining({
                attackerName: 'TestFighter',
                targetName: 'Goblin',
                rollType: 'auto-miss',
                rawDamage: 0,
                primaryDamage: 0,
                damageApplied: false,
            }),
            'test-campaign'
        );
    });

    // -----------------------------------------------------------------------
    // Behavior: sanctuary block — lastAttack is NOT written
    // -----------------------------------------------------------------------
    it('does not write lastAttack when sanctuary blocks the attack', async () => {
        // Mock a sanctuary effect so the attacker must save
        getRuntimeValue.mockImplementation((key, subKey) => {
            if (key === 'campaign' && subKey === 'targetEffects') {
                return [
                    {
                        effect: 'sanctuary',
                        target: 'Goblin',
                        source: 'Healer',
                        saveDc: 13,
                    },
                ];
            }
            if (key === 'campaign' && subKey === 'pendingSavePrompts') {
                return {};
            }
            if (key === 'campaign') {
                return {};
            }
            return null;
        });

        // Capture promptId from sendSavePrompt mock calls
        const { sendSavePrompt } = await import('../../services/combat/conditions/savePromptService.js');

        const fn = createFn();
        const fnPromise = fn('Fire Bolt', '1d10', 5, [5], 0, {
            targetName: 'Goblin',
            damageType: 'fire',
            saveDc: 13,
            saveType: 'DEX',
        });

        // Wait for sendSavePrompt to be called, then dispatch failure
        await new Promise((r) => setTimeout(r, 200));
        const promptId = sendSavePrompt.mock.calls[0]?.[1]?.promptId;
        if (promptId) {
            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId, success: false, roll: 8, bonus: 0, rawRolls: [8] },
            }));
        }

        await fnPromise;

        // Sanctuary blocked — the function returns early, no lastAttack write.
        const lastAttackCalls = setRuntimeValue.mock.calls.filter(
            (call) => call[0] === 'campaign' && call[1] === 'lastAttack'
        );
        expect(lastAttackCalls).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Behavior: magic missile immunity — popup shows 0 damage, no lastAttack
    // -----------------------------------------------------------------------
    it('shows 0 damage popup when target is immune to magic missile', async () => {
        const { isMagicMissileImmune } = await import('./loggedDiceRollUtils.js');
        isMagicMissileImmune.mockReturnValue(true);

        const fn = createFn();
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 }],
        });

        await fn('Magic Missile', '1d4+1', 5, [4, 1], 0, {
            attackerName: 'TestFighter',
            targetName: 'Goblin',
            damageType: 'force',
        });

        // Immune path shows popup with 0 finalDamage but does NOT write lastAttack
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'damage',
                name: 'Magic Missile',
                targetName: 'Goblin',
                finalDamage: 0,
                damageReduced: true,
                note: 'Shield: Immune to Magic Missile',
            })
        );

        const lastAttackCalls = setRuntimeValue.mock.calls.filter(
            (call) => call[0] === 'campaign' && call[1] === 'lastAttack'
        );
        expect(lastAttackCalls).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Behavior: no target in combat summary — lastAttack still written
    // -----------------------------------------------------------------------
    it('writes lastAttack even when target is not in combat summary', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'OtherCreature', type: 'npc', currentHp: 10, maxHp: 10 }],
        });

        const fn = createFn();
        await fn('Fire Bolt', '1d10', 5, [5], 0, {
            attackerName: 'TestFighter',
            targetName: 'NonExistent',
            damageType: 'fire',
            attackName: 'Fire Bolt',
        });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'lastAttack',
            expect.objectContaining({
                attackerName: 'TestFighter',
                targetName: 'NonExistent',
                damageApplied: true,
            }),
            'test-campaign'
        );
    });

    // -----------------------------------------------------------------------
    // Behavior: critical hit — lastAttack reflects doubled rolls
    // -----------------------------------------------------------------------
    it('writes lastAttack with doubled rolls on critical hit', async () => {
        const fn = createFn();

        await fn('Fire Bolt', '1d10', 15, [5, 5], 0, {
            attackerName: 'TestFighter',
            targetName: 'Goblin',
            damageType: 'fire',
            attackName: 'Fire Bolt',
            isAutoCrit: true,
        });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'lastAttack',
            expect.objectContaining({
                attackerName: 'TestFighter',
                targetName: 'Goblin',
                rolls: expect.arrayContaining([5, 5]),
                rawDamage: expect.any(Number),
                damageApplied: true,
            }),
            'test-campaign'
        );
    });

    // -----------------------------------------------------------------------
    // Behavior: missing context — lastAttack not written (no damageType)
    // -----------------------------------------------------------------------
    it('does not write lastAttack when context is missing damageType', async () => {
        const fn = createFn();

        await fn('Fire Bolt', '1d10', 5, [5], 0, {
            targetName: 'Goblin',
            // no damageType
        });

        // The main function only writes lastAttack when popupData.rolls &&
        // popupData.damageType are both truthy. Without damageType, it should
        // not call setRuntimeValue for lastAttack.
        const lastAttackCalls = setRuntimeValue.mock.calls.filter(
            (call) => call[0] === 'campaign' && call[1] === 'lastAttack'
        );
        expect(lastAttackCalls).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Behavior: null target name — lastAttack written with null target
    // -----------------------------------------------------------------------
    it('writes lastAttack with undefined targetName when context has no target', async () => {
        const fn = createFn();

        await fn('Fire Bolt', '1d10', 5, [5], 0, {
            attackerName: 'TestFighter',
            damageType: 'fire',
        });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'lastAttack',
            expect.objectContaining({
                attackerName: 'TestFighter',
            }),
            'test-campaign'
        );
    });
});
