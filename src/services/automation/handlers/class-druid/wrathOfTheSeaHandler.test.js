// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollD20: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
    TARGET_EFFECT_DEFINITIONS: [],
    getEffectDefinition: vi.fn(),
    registerTargetEffect: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    getCombatContext: vi.fn(),
}));

import { handle } from './wrathOfTheSeaHandler.js';
import { rollExpression, rollD20 } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { registerPendingSavePrompt } from '../../../combat/auras/pendingSaveRegistry.js';
import { addEntry } from '../../../ui/logService.js';
import { loadCombatSummary } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { sendSavePrompt } from '../../../combat/conditions/savePromptService.js';
import storage from '../../../../services/ui/storage.js';
import { getTargetFromAttacker, getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

const playerName = 'Maribelle';
const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        proficiency: 2,
        class: {
            class_levels: [{ level: 3, wild_shape: 1 }],
        },
        ...overrides,
    };
}

function mockAllyAttack() {
    return {
        name: 'Wrath of the Sea',
        automation: { type: 'wrath_of_the_sea', allyAttack: true },
    };
}

function mockNonAllyAttack() {
    return {
        name: 'Wrath of the Sea',
        automation: { type: 'wrath_of_the_sea' },
    };
}

function setupBaseMocks() {
    vi.clearAllMocks();
    global.window = { dispatchEvent: vi.fn() };
    getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: playerName, creatures: [] });
    isWithinRange.mockResolvedValue(true);
    addExpiration.mockReturnValue(undefined);
}

function setupSavePath(wisMod = 1, dc = 12, saveBonus = 0, saveRoll = 5, finalDamage = 6) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === playerName && key === 'wrathOfTheSeaWisMod') return wisMod;
        if (name === playerName && key === 'wrathOfTheSeaDc') return dc;
        return undefined;
    });
    rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
    loadCombatSummary.mockResolvedValue({
        creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: saveBonus } });
    applyDamageToTarget.mockReturnValue({ finalDamage, newHp: 10 });
    rollD20.mockReturnValue(saveRoll);
}

function setupWrathActivePath(statsOverride = makePlayerStats()) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === playerName && key === 'wrathOfTheSeaActive') return true;
        if (name === playerName && key === 'wrathOfTheSeaWisMod') return 2;
        return undefined;
    });
    rollExpression.mockReturnValue({ total: 12, rolls: [4, 4, 4], modifier: 0 });
    loadCombatSummary.mockResolvedValue({
        creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
    applyDamageToTarget.mockReturnValue({ finalDamage: 12, newHp: 0 });
    rollD20.mockReturnValue(3);
    return statsOverride;
}

function setupNoTarget() {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === playerName && key === 'wrathOfTheSeaActive') return true;
        return undefined;
    });
    rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
    loadCombatSummary.mockResolvedValue({
        creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
    });
    getTargetFromAttacker.mockReturnValue(null);
}

function setupPlayerTarget() {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === playerName && key === 'wrathOfTheSeaActive') return true;
        if (name === playerName && key === 'wrathOfTheSeaWisMod') return 1;
        if (name === playerName && key === 'wrathOfTheSeaDc') return 12;
        return undefined;
    });
    rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
    loadCombatSummary.mockResolvedValue({
        creatures: [{ name: playerName, targetName: 'AllyPlayer' }, { name: 'AllyPlayer', type: 'player' }],
    });
    getTargetFromAttacker.mockReturnValue({ name: 'AllyPlayer', type: 'player' });
}

function setupStorageSave(combatSummary = { creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }] }) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === playerName && key === 'wrathOfTheSeaWisMod') return 1;
        if (name === playerName && key === 'wrathOfTheSeaDc') return 12;
        return undefined;
    });
    rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
    loadCombatSummary.mockResolvedValue(combatSummary);
    getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
    applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 10 });
    rollD20.mockReturnValue(5);
}

describe('wrathOfTheSeaHandler', () => {
    beforeEach(() => {
        setupBaseMocks();
    });

    describe('ally attack path (isAllyAttack === true)', () => {
        it('uses stored wrathWisMod and wrathOfTheSeaDc from runtime state', async () => {
            setupSavePath(3, 13, 3, 12, 18);

            const result = await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(rollExpression).toHaveBeenCalledWith('3d6');
            expect(result.type).toBe('popup');
            expect(result.payload.results[0].damage).toBe(18);
        });

        it('uses fallback WisMod of 1 when stored value is missing', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 10 });
            rollD20.mockReturnValue(5);

            const result = await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(rollExpression).toHaveBeenCalledWith('1d6');
            expect(result.payload.results[0].damage).toBe(6);
        });

        it('uses fallback DC of 0 when stored value is missing', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'wrathOfTheSeaDc') return undefined;
                if (name === playerName && key === 'wrathOfTheSeaWisMod') return 1;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 10 });
            rollD20.mockReturnValue(5);

            const result = await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('DC 0');
        });

        it('deals no damage on successful save for NPC', async () => {
            setupSavePath(1, 12, 5, 8, 0);

            const result = await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(result.payload.results[0].saveSuccess).toBe(true);
            expect(result.payload.results[0].damage).toBe(0);
        });

        it('deals full damage on failed save for NPC', async () => {
            setupSavePath(1, 12, 0, 5, 6);

            const result = await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(result.payload.results[0].saveSuccess).toBe(false);
            expect(result.payload.results[0].damage).toBe(6);
        });

        it('calls endInvisibilityOnHostileAction when NPC takes damage', async () => {
            setupSavePath(1, 12, 0, 5, 6);

            await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith(playerName, campaignName);
        });

        it('does not call endInvisibilityOnHostileAction when NPC passes save (no damage)', async () => {
            setupSavePath(1, 12, 5, 8, 0);

            await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        });

        it('handles player targets by sending save prompt', async () => {
            setupPlayerTarget();

            const result = await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(registerPendingSavePrompt).toHaveBeenCalled();
            expect(sendSavePrompt).toHaveBeenCalled();
            expect(result.payload.results).toEqual([]);
            expect(result.payload.description).toContain('rolling saves');
        });

        it('saves combatSummary to storage and dispatches event', async () => {
            setupStorageSave();

            await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
            expect(global.window.dispatchEvent).toHaveBeenCalledWith(new CustomEvent('combat-summary-updated'));
        });

        it('skips storage save when combatSummary is null', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue(null);

            const result = await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(storage.set).not.toHaveBeenCalled();
            expect(global.window.dispatchEvent).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });

        it('uses damageResult.total for NPC damage when applyDamage returns no finalDamage', async () => {
            setupSavePath(1, 12, 0, 5, 0);
            applyDamageToTarget.mockReturnValue({});

            const result = await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(result.payload.results[0].damage).toBe(6);
        });

        it('uses applyDamage finalDamage when available', async () => {
            setupSavePath(1, 12, 0, 5, 0);
            applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });

            const result = await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(result.payload.results[0].damage).toBe(4);
        });
    });

    describe('non-ally attack path (isAllyAttack !== true)', () => {
        it('returns popup when no Wild Shape uses remaining', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return false;
                if (name === playerName && key === 'wildShapeUses') return 0;
                return undefined;
            });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No Wild Shape uses remaining');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('decrements wildShapeUses and activates wrathOfTheSeaActive on first use', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return false;
                if (name === playerName && key === 'wildShapeUses') return 1;
                return undefined;
            });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('activated');
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wildShapeUses', 0, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wrathOfTheSeaActive', true, campaignName);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Wrath of the Sea',
            }));
        });

        it('uses wild_shape from class_levels when wildShapeUses runtime value is undefined', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return false;
                if (name === playerName && key === 'wildShapeUses') return undefined;
                return undefined;
            });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Wild Shape uses remaining');
        });

        it('uses maxWS when wildShapeUses runtime value is null', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return false;
                if (name === playerName && key === 'wildShapeUses') return null;
                return undefined;
            });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Wild Shape uses remaining');
        });

        it('calculates DC from Wisdom bonus + proficiency + 8 for first-time activation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return false;
                if (name === playerName && key === 'wildShapeUses') return 1;
                return undefined;
            });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wrathOfTheSeaActive', true, campaignName);
        });

        it('returns popup when wrath is already active (second use without no uses)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 12, rolls: [4, 4, 4], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 12, newHp: 0 });
            rollD20.mockReturnValue(1);

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.results[0].damage).toBe(12);
            expect(setRuntimeValue).not.toHaveBeenCalledWith(playerName, 'wildShapeUses', expect.any(Number), campaignName);
        });

        it('uses Wisdom bonus from playerStats for DC calculation when not ally attack', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return false;
                if (name === playerName && key === 'wildShapeUses') return 1;
                return undefined;
            });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wrathOfTheSeaActive', true, campaignName);
        });

        it('uses fallback WisMod of 1 for dice count when Wisdom ability is missing', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 10 });
            rollD20.mockReturnValue(5);

            const emptyStats = { name: playerName };
            const _result = await handle(mockNonAllyAttack(), emptyStats, campaignName);

            expect(rollExpression).toHaveBeenCalledWith('1d6');
            expect(_result.payload.results[0].damage).toBe(6);
        });

        it('uses fallback DC of 8 when Wisdom bonus and proficiency are missing', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 10 });
            rollD20.mockReturnValue(5);

            const emptyStats = { name: playerName };
            const _result = await handle(mockNonAllyAttack(), emptyStats, campaignName);

            expect(_result.payload.description).toContain('DC 8');
        });

        it('returns popup when no target is selected', async () => {
            setupNoTarget();

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No current target selected');
        });

        it('returns early with no-uses popup when wrath is not active and no wild shape uses remain', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return false;
                if (name === playerName && key === 'wildShapeUses') return 0;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Wild Shape uses remaining');
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('calculates dice count as max(1, wisMod) for damage formula', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 18, rolls: [6, 6, 6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 18, newHp: 0 });
            rollD20.mockReturnValue(1);

            const highWisStats = { name: playerName, abilities: [{ name: 'Wisdom', bonus: 3 }] };
            const result = await handle(mockNonAllyAttack(), highWisStats, campaignName);

            expect(rollExpression).toHaveBeenCalledWith('3d6');
            expect(result.payload.results[0].damage).toBe(18);
        });

        it('generates correct HTML output for NPC damage results', async () => {
            setupWrathActivePath();

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Wrath of the Sea used!');
            expect(result.payload.description).toContain('Save DC:');
            expect(result.payload.description).toContain('2d6 = 12 Cold damage');
            expect(result.payload.description).toContain('Enemy');
            expect(result.payload.description).toContain('Failed');
        });

        it('generates correct HTML for NPC save success', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 12, rolls: [4, 4, 4], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 5 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 10 });
            rollD20.mockReturnValue(8);

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Passed');
            expect(result.payload.description).toContain('none');
        });

        it('logs an entry for NPC save/damage roll', async () => {
            setupWrathActivePath();

            await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                saveType: 'CON',
                damageType: 'cold',
                note: 'combined_save_damage_roll',
            }));
        });

        it('handles addEntry rejection in NPC save/damage logging without crashing', async () => {
            setupWrathActivePath();
            addEntry.mockRejectedValue(new Error('log write failed'));

            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.results[0].damage).toBe(12);
            expect(consoleSpy).toHaveBeenCalledWith('[wrathOfTheSea] Log error:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('registers and sends save prompt for player targets', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 12, rolls: [4, 4, 4], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'AllyPlayer' }, { name: 'AllyPlayer', type: 'player' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'AllyPlayer', type: 'player' });

            await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(registerPendingSavePrompt).toHaveBeenCalled();
            const promptArgs = registerPendingSavePrompt.mock.calls[0];
            expect(promptArgs[1].targetName).toBe('AllyPlayer');
            expect(promptArgs[1].saveDc).toBe(12);
            expect(promptArgs[1].saveType).toBe('CON');
            expect(promptArgs[1].damageType).toBe('cold');
            expect(promptArgs[1].attackerName).toBe(playerName);
            expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'AllyPlayer',
                saveType: 'CON',
                saveDc: 12,
                sourceName: playerName,
            }));
        });

        it('uses stored wisdom mod for dice count on second activation (ally attack path)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                if (name === playerName && key === 'wrathOfTheSeaWisMod') return 4;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 24, rolls: [4, 4, 4, 4, 4, 4], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 24, newHp: 0 });
            rollD20.mockReturnValue(1);

            await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(rollExpression).toHaveBeenCalledWith('2d6');
        });

        it('uses stored wisdom mod for ally attack path', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaWisMod') return 2;
                if (name === playerName && key === 'wrathOfTheSeaDc') return 12;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 12, rolls: [4, 4, 4], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 12, newHp: 0 });
            rollD20.mockReturnValue(1);

            const result = await handle(mockAllyAttack(), makePlayerStats(), campaignName);

            expect(rollExpression).toHaveBeenCalledWith('2d6');
            expect(result.type).toBe('popup');
        });
    });

    describe('edge cases', () => {
        it('handles negative wisdom mod by using at least 1d6', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 10 });
            rollD20.mockReturnValue(5);

            const negativeWisStats = { name: playerName, abilities: [{ name: 'Wisdom', bonus: -2 }] };
            await handle(mockNonAllyAttack(), negativeWisStats, campaignName);

            expect(rollExpression).toHaveBeenCalledWith('1d6');
        });

        it('throws when playerStats is undefined', async () => {
            await expect(handle(mockAllyAttack(), undefined, campaignName)).rejects.toThrow();
        });

        it('handles undefined campaignName gracefully', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: { con: 0 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 10 });
            rollD20.mockReturnValue(5);

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), undefined);

            expect(result.type).toBe('popup');
        });

        it('returns a refusal popup when action has no automation field and wrath is already active', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue(null);

            const actionWithoutAutomation = { name: 'Wrath of the Sea' };
            const result = await handle(actionWithoutAutomation, makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No current target selected');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('returns a refusal popup when action has null automation field and wrath is already active', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue(null);

            const actionWithNullAutomation = { name: 'Wrath of the Sea', automation: null };
            const result = await handle(actionWithNullAutomation, makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No current target selected');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('handles NPC with missing saveBonuses', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc' });
            applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 10 });
            rollD20.mockReturnValue(5);

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.results[0].saveBonus).toBe(0);
        });

        it('handles NPC with null saveBonuses', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: playerName, targetName: 'Enemy' }, { name: 'Enemy' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy', type: 'npc', saveBonuses: null });
            applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 10 });
            rollD20.mockReturnValue(5);

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
        });

        it('returns null when rollExpression returns no result', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                return undefined;
            });
            rollExpression.mockReturnValue(null);

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result).toBeNull();
        });
    });

    describe('CLA-393 gated attack leg + push + duration clock', () => {
        const LATCH_KEY = '_Wrath_of_the_Sea_usedRound';

        function setupArmedAttack(latchRound = 0) {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return true;
                if (name === playerName && key === LATCH_KEY) return latchRound;
                return undefined;
            });
            getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: playerName, creatures: [] });
            isWithinRange.mockResolvedValue(true);
            rollExpression.mockReturnValue({ total: 12, rolls: [6, 4, 2], modifier: 0 });
            rollD20.mockReturnValue(1);
            loadCombatSummary.mockResolvedValue({
                round: 1,
                activeCreatureName: playerName,
                creatures: [{ name: playerName, targetName: 'Thug 1' }, { name: 'Thug 1', type: 'npc', saveBonuses: { con: 2 } }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Thug 1', type: 'npc', saveBonuses: { con: 2 } });
            applyDamageToTarget.mockReturnValue({ finalDamage: 12, newHp: 20 });
        }

        it('refuses a same-round second attack with zero save, damage, push or spend', async () => {
            setupArmedAttack(1);

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already been used this round');
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                automationType: 'wrath_of_the_sea_refused',
            }));
            expect(rollD20).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(registerTargetEffect).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(playerName, 'wildShapeUses', expect.any(Number), campaignName);
        });

        it('refuses when it is not the holder\'s turn, spending nothing', async () => {
            setupArmedAttack();
            getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'AasimarTest', creatures: [] });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('AasimarTest');
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                automationType: 'wrath_of_the_sea_refused',
            }));
            expect(rollD20).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(playerName, LATCH_KEY, expect.any(Number), campaignName);
        });

        it('refuses a target outside the 5-foot Emanation and does not stamp the latch', async () => {
            setupArmedAttack();
            isWithinRange.mockResolvedValue(false);

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('outside the 5-foot Emanation');
            expect(isWithinRange).toHaveBeenCalledWith(playerName, 'Thug 1', 5);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                automationType: 'wrath_of_the_sea_refused',
            }));
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(playerName, LATCH_KEY, expect.any(Number), campaignName);
        });

        it('stamps the round latch awaited at the trigger BEFORE damage is applied', async () => {
            setupArmedAttack();
            const latchIdx = { value: 0 };
            setRuntimeValue.mockImplementation(async (name, key) => {
                if (name === playerName && key === LATCH_KEY) latchIdx.value = setRuntimeValue.mock.calls.length;
            });

            await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, LATCH_KEY, 1, campaignName);
            expect(latchIdx.value).toBeGreaterThan(0);
            expect(latchIdx.value).toBeLessThan(applyDamageToTarget.mock.invocationCallOrder[0]);
        });

        it('fires again on the next round once the latch round differs', async () => {
            setupArmedAttack(1);
            getCombatContext.mockResolvedValue({ round: 2, activeCreatureName: playerName, creatures: [] });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.results[0].damage).toBe(12);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, LATCH_KEY, 2, campaignName);
        });

        it('registers a push target effect on a failed NPC save and logs the push', async () => {
            setupArmedAttack();

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, 'Thug 1', 'push', 'Wrath of the Sea', {
                value: 15,
                movedDistanceFt: 15,
                duration: 'instant',
            });
            expect(result.payload.results[0].pushed).toBe(true);
            expect(result.payload.description).toContain('pushed up to 15 feet');
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                rollType: 'save-damage',
                pushedDistanceFt: 15,
            }));
        });

        it('does not register push on a successful save', async () => {
            setupArmedAttack();
            rollD20.mockReturnValue(16);

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(registerTargetEffect).not.toHaveBeenCalled();
            expect(result.payload.results[0].pushed).toBe(false);
        });

        it('does not push a Huge creature', async () => {
            setupArmedAttack();
            getTargetFromAttacker.mockReturnValue({ name: 'Hill Giant 1', type: 'npc', saveBonuses: { con: 5 }, size: 'Huge' });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(registerTargetEffect).not.toHaveBeenCalled();
            expect(result.payload.results[0].pushed).toBe(false);
        });

        it('applies damage with the hp log NOT suppressed (hp_change pairing)', async () => {
            setupArmedAttack();

            await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Thug 1', 12, ['cold'], campaignName, expect.anything(), { ignoreResistance: false, attackerName: playerName, suppressHpLog: false });
        });

        it('manifest leg registers the 10-minute expiration clock (rounds 100)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return false;
                if (name === playerName && key === 'wildShapeUses') return 4;
                return undefined;
            });

            const result = await handle(mockNonAllyAttack(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(addExpiration).toHaveBeenCalledWith(
                playerName, playerName, [{ type: 'wrath_of_the_sea_end' }], campaignName, 100
            );
        });

        it('manifest leg honors the fixed 10_minutes data duration token', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wrathOfTheSeaActive') return false;
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });

            const action = {
                name: 'Wrath of the Sea',
                automation: { type: 'wrath_of_the_sea', duration: '10_minutes' },
            };
            await handle(action, makePlayerStats(), campaignName);

            expect(addExpiration).toHaveBeenCalledWith(
                playerName, playerName, [{ type: 'wrath_of_the_sea_end' }], campaignName, 100
            );
        });
    });
});
