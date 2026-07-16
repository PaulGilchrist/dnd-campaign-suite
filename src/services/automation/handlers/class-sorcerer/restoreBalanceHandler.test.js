// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './restoreBalanceHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn((r) => {
        if (typeof r === 'number') return r;
        const m = String(r).match(/(\d+)_?ft/);
        return m ? parseInt(m[1], 10) : null;
    }),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn((abilities, ability) => {
        const ab = abilities?.find((a) => a.name === ability);
        return ab?.bonus ?? 0;
    }),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { addEntry } = await import('../../../ui/logService.js');
const { rangeToFeet, getDistanceFeet } = await import(
    '../../../rules/combat/rangeValidation.js'
);
const { isWithinRange } = await import('../../../rules/combat/rangeCheck.js');
const { resolveTarget, resolveMapPositions } = await import(
    '../../common/targetResolver.js'
);
const { getCombatContext } = await import(
    '../../../rules/combat/damageUtils.js'
);
const { getAbilityModifier } = await import(
    '../../../shared/abilityLookup.js'
);

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        level: 10,
        proficiency: 4,
        abilities: [{ name: 'Charisma', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Restore Balance',
        automation: { type: 'restore_balance', range: '60_ft', ...automation },
    };
}

function makeFreshAttackRoll(overrides = {}) {
    return {
        d20: 15,
        bonus: 5,
        targetAc: 16,
        hit: true,
        attackerName: 'TargetAlly',
        rollType: 'attack',
        timestamp: Date.now(),
        ...overrides,
    };
}

function makeFreshCheckRoll(overrides = {}) {
    return {
        d20: 12,
        bonus: 4,
        checkName: 'Stealth',
        attackerName: 'TargetAlly',
        rollType: 'check',
        timestamp: Date.now(),
        ...overrides,
    };
}

function makeFreshSaveRoll(overrides = {}) {
    return {
        d20: 18,
        bonus: 3,
        saveType: 'DEX',
        attackerName: 'TargetAlly',
        rollType: 'save',
        timestamp: Date.now(),
        ...overrides,
    };
}

function setupTargetResolved(targetName = 'TargetAlly') {
    resolveTarget.mockResolvedValue({ target: { name: targetName } });
    isWithinRange.mockResolvedValue(true);
}

function setupInRange() {
    resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 5, gridY: 5 },
    });
    getDistanceFeet.mockReturnValue(50);
}

function setupOutofRange() {
    resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 100, gridY: 100 },
    });
    getDistanceFeet.mockReturnValue(999);
    isWithinRange.mockResolvedValue(false);
}

function setupUses(remaining) {
    getRuntimeValue.mockReturnValue(remaining);
}

function setupCombatContext(lastAttack) {
    getCombatContext.mockResolvedValue({ lastAttack });
}

describe('restoreBalanceHandler.handle', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('target resolution', () => {
        it('returns popup when no target is resolved', async () => {
            resolveTarget.mockResolvedValue(null);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                mapName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain(
                'requires selecting a creature in combat',
            );
        });

        it('returns popup when targetInfo has no target property', async () => {
            resolveTarget.mockResolvedValue({});

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                mapName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain(
                'requires selecting a creature in combat',
            );
        });
    });

    describe('range validation', () => {
        it('skips range check when mapName is null', async () => {
            setupTargetResolved();
            setupUses(1);
            setupCombatContext(makeFreshAttackRoll());

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(resolveMapPositions).not.toHaveBeenCalled();
        });

        it('skips range check when map positions are unavailable', async () => {
            setupTargetResolved();
            rangeToFeet.mockReturnValue(60);
            resolveMapPositions.mockResolvedValue(null);
            setupUses(1);
            setupCombatContext(makeFreshAttackRoll());

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                mapName,
            );

            expect(result.type).toBe('popup');
            expect(getDistanceFeet).not.toHaveBeenCalled();
        });

        it('returns popup when target is out of range', async () => {
            setupTargetResolved('FarTarget');
            rangeToFeet.mockReturnValue(60);
            setupOutofRange();
            setupUses(1);
            setupCombatContext(
                makeFreshAttackRoll({ attackerName: 'FarTarget' }),
            );

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                mapName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('out of range');
            expect(result.payload.description).toContain('FarTarget');
        });

        it('proceeds when target is within range', async () => {
            setupTargetResolved();
            rangeToFeet.mockReturnValue(60);
            setupInRange();
            setupUses(1);
            setupCombatContext(makeFreshAttackRoll());

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                mapName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Attack roll');
        });
    });

    describe('uses check', () => {
        it('returns popup when no uses remaining', async () => {
            setupTargetResolved();
            setupUses(0);
            setupCombatContext(makeFreshAttackRoll());

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain(
                'no uses remaining',
            );
            expect(result.payload.description).toContain(
                'Recharges on a Long Rest',
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses max(1, chaMod) as default uses when runtime value is null', async () => {
            setupTargetResolved();
            getRuntimeValue.mockReturnValue(null);
            setupCombatContext(makeFreshAttackRoll());

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(getAbilityModifier).toHaveBeenCalledWith(
                expect.any(Array),
                'CHA',
            );
        });

        it('uses max(1, chaMod) for usesMax when CHA modifier is negative', async () => {
            setupTargetResolved();
            getAbilityModifier.mockReturnValue(-1);
            getRuntimeValue.mockReturnValue(null);
            setupCombatContext(makeFreshAttackRoll());

            await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(getRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'restorebalanceUses',
            );
        });
    });

    describe('roll freshness validation', () => {
        it('returns popup when no recent d20 roll exists', async () => {
            setupTargetResolved();
            setupUses(1);
            setupCombatContext(null);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain(
                'No recent d20 roll found',
            );
            expect(result.payload.description).toContain('TargetAlly');
        });

        it('returns popup when roll attacker does not match target', async () => {
            setupTargetResolved('TargetAlly');
            setupUses(1);
            setupCombatContext({
                ...makeFreshAttackRoll(),
                attackerName: 'DifferentCreature',
            });

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain(
                'No recent d20 roll found',
            );
            expect(result.payload.description).toContain('TargetAlly');
        });

        it('displays attack roll results with HIT/MISS', async () => {
            setupTargetResolved();
            setupUses(1);
            setupCombatContext(makeFreshAttackRoll());

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.description).toContain('Attack roll');
            expect(result.payload.description).toContain('d20(15)');
            expect(result.payload.description).toContain('HIT');
        });

        it('shows MISS for failed attack roll', async () => {
            setupTargetResolved();
            setupUses(1);
            setupCombatContext(
                makeFreshAttackRoll({ d20: 1, bonus: 5, hit: false }),
            );

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.description).toContain('MISS');
        });

        it('displays ability check results', async () => {
            setupTargetResolved();
            setupUses(1);
            setupCombatContext(makeFreshCheckRoll());

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.description).toContain('Stealth');
            expect(result.payload.description).toContain('d20(12)');
        });

        it('displays saving throw results', async () => {
            setupTargetResolved();
            setupUses(1);
            setupCombatContext(makeFreshSaveRoll());

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.description).toContain('DEX');
        });

        it('shows "Save" label when saveType is missing', async () => {
            setupTargetResolved();
            setupUses(1);
            setupCombatContext(
                makeFreshSaveRoll({ saveType: null }),
            );

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.description).toContain('Save');
        });

        it('includes target name and advantage neutralized note in description', async () => {
            setupTargetResolved('Goblin');
            setupUses(1);
            setupCombatContext(
                makeFreshAttackRoll({ attackerName: 'Goblin' }),
            );

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.description).toContain('Target: Goblin');
            expect(result.payload.description).toContain(
                'Advantage/Disadvantage neutralized',
            );
        });
    });

    describe('usage decrement and logging', () => {
        it('decrements uses by 1 after applying', async () => {
            setupTargetResolved();
            setupUses(3);
            setupCombatContext(makeFreshAttackRoll());

            await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'restorebalanceUses',
                2,
                campaignName,
            );
        });

        it('sets uses to 0 when only 1 use remains', async () => {
            setupTargetResolved();
            setupUses(1);
            setupCombatContext(makeFreshAttackRoll());

            await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'restorebalanceUses',
                0,
                campaignName,
            );
        });

        it('logs an ability_use entry to the campaign log', async () => {
            setupTargetResolved('AllyOne');
            setupUses(2);
            setupCombatContext(
                makeFreshAttackRoll({ attackerName: 'AllyOne' }),
            );

            await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Restore Balance',
                description: expect.stringMatching(
                    /TestSorcerer.*AllyOne/,
                ),
                timestamp: expect.any(Number),
            });
        });

        it('uses action name as feature name in the result payload', async () => {
            setupTargetResolved();
            setupUses(1);
            setupCombatContext(makeFreshAttackRoll());

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.name).toBe('Restore Balance');
        });
    });
});
// @cleaned-by-ai
