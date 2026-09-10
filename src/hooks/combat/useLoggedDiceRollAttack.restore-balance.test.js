import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
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

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
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

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(),
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
  getSlowAcPenalty: () => 0,
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/handlers/spells/forcecageHandler.js', () => ({
    isForcecageBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/mazeHandler.js', () => ({
    isMazeBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/banishmentHandler.js', () => ({
    isBanishmentBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/imprisonmentHandler.js', () => ({
    isImprisonmentBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/prismaticSprayHandler.js', () => ({
    isPrismaticSprayBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/sanctuaryHandler.js', () => ({
    endSanctuary: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/automation/common/damageRollback.js', () => ({
    addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/compelledDuelHandler.js', () => ({
    checkCompelledDuelAttackExpiry: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getManeuversForRules: vi.fn(),
}));

vi.mock('../../services/combat/restoreBalanceState.js', () => ({
    consumeArmedRestoreBalance: vi.fn(async () => null),
    isRestoreBalanceArmed: vi.fn(() => false),
    armRestoreBalance: vi.fn(async () => {}),
    RESTORE_BALANCE_ARMED_KEY: 'restoreBalanceArmed',
    RESTORE_BALANCE_RANGE_FT: 60,
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import { consumeArmedRestoreBalance } from '../../services/combat/restoreBalanceState.js';
import { getManeuversForRules } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const defaultDeps = {
    characterName: 'TestFighter',
    campaignName: 'test-campaign',
    characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    autoDamageSourceRef: { current: null },
};

function createFn() {
    return createLogAndShow({ ...defaultDeps });
}

beforeEach(() => {
    vi.clearAllMocks();
    rollD20.mockReturnValue(15);
    rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
    loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
    getRuntimeValue.mockReturnValue(null);
    consumeArmedRestoreBalance.mockResolvedValue(null);
    getManeuversForRules.mockResolvedValue([]);
});

describe('Restore Balance seam in logAndShow (CLA-295)', () => {
    it('cancels advantage to normal when an armed holder consumes the roll', async () => {
        consumeArmedRestoreBalance.mockResolvedValue('AberrantSorcerer');

        await createFn()('Longsword', 5, 'attack', { targetName: 'Goblin', forcedMode: 'advantage' });

        expect(consumeArmedRestoreBalance).toHaveBeenCalledWith(
            'test-campaign', expect.anything(), 'TestFighter', 'Longsword', 'attack',
        );
        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'normal',
        }));
        expect(defaultDeps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            forcedMode: 'normal',
        }));
    });

    it('cancels disadvantage to normal when an armed holder consumes the roll', async () => {
        consumeArmedRestoreBalance.mockResolvedValue('AberrantSorcerer');

        await createFn()('Longsword', 5, 'attack', { targetName: 'Goblin', forcedMode: 'disadvantage' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'normal',
        }));
    });

    it('keeps advantage when no holder is armed', async () => {
        consumeArmedRestoreBalance.mockResolvedValue(null);

        await createFn()('Longsword', 5, 'attack', { targetName: 'Goblin', forcedMode: 'advantage' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'advantage',
        }));
    });

    it('never consults Restore Balance for normal-mode rolls', async () => {
        await createFn()('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(consumeArmedRestoreBalance).not.toHaveBeenCalled();
        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'normal',
        }));
    });

    it('does not cancel the roll when consume misses (out of range/unseen)', async () => {
        consumeArmedRestoreBalance.mockResolvedValue(null);

        const context = { targetName: 'Goblin', forcedMode: 'advantage' };
        await createFn()('Longsword', 5, 'attack', context);

        expect(defaultDeps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            forcedMode: 'advantage',
        }));
    });
});
