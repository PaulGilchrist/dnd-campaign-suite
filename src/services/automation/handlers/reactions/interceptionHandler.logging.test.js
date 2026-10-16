// @maintained-by-ai
// interceptionHandler sextet — lane: LOGGING (interceptionHandler.js L85-101, the two
// addEntry ability_use calls).
//
// Six-lane seam map (each lane owns what it pins; do not duplicate across lanes):
//  - consumption:     isReactionSpent gate, stampInterceptionRound mark, latch release,
//                    no-side-effect guards, rounds:1 addExpiration (only expiration pin).
//  - .damage.test.js:         computeInterceptionReduction + bonus resolution,
//                              applyHealingToTarget amounts and skip paths, numeric popup pins.
//  - .description.test.js:  baseDescription + attackDetails popup text templates (full-line
//                              rendering incl. the heal note there — log vs popup split).
//  - .logging.test.js (THIS file): addEntry ability_use entries — strict full-object tables
//                              for BOTH log lines including in-log amounts ('reduce damage by
//                              11', 'healed 8 HP') and the second 'Disadvantage imposed…'
//                              duration line, custom feature name in both lines, and
//                              addEntry rejection handling (this file's own popup is only
//                              checked as "did not throw", envelope belongs to returnValue).
//  - .returnValue.test.js:    popup envelope shape and automation pass-through every path.
//  - .test.js (main):         early-return gates — no recent attack, shield/weapon, range.
//
// Fixture amounts (derived once, pinned once): roll 8 + proficiency 3 = reduction 11;
// original damage 8 → reduced 0, healed min(11, 8) = 8. Distinct inputs keep 'reduce by'
// and 'healed' amounts distinguishable in the strings.
//
// Deterministic: runtime/logService/dice/healing/range/rollback/expirations mocked
// (expirations mocked for isolation only — no pins here), pure handler — no churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

// Mocked for isolation only — addExpiration pins live in .consumption.test.js.
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './interceptionHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as targetResolver from '../../common/targetResolver.js';

// ── Helpers ─────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'test-map';
const playerName = 'Paladin';
const defenderName = 'Rogue';
const attackerName = 'Goblin';

// Amounts: reduction = roll(8) + proficiency(3) = 11; heal = min(11, original 8) = 8.
const ROLL_TOTAL = 8;
const PROFICIENCY = 3;
const ORIGINAL_DAMAGE = 8;
const REDUCTION = 11;
const HEAL = 8;

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        proficiency: PROFICIENCY,
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Interception',
        automation: {
            type: 'interception',
            trigger: 'ally_within_5ft_attacked',
            range: '5_ft',
            damageExpression: '1d10',
            damageType: '',
            damageBonusExpression: 'proficiency_bonus',
            requiresShield: true,
            casting_time: '1 reaction',
            hasAutomation: true,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function lastAttack() {
    return {
        attackerName,
        targetName: defenderName,
        d20: 15,
        bonus: 5,
        hit: true,
        targetAc: 16,
        primaryDamage: ORIGINAL_DAMAGE,
        rawDamage: ORIGINAL_DAMAGE,
        actualDamage: ORIGINAL_DAMAGE,
        damageTypes: ['slashing'],
    };
}

function mainLogEntry(featureName = 'Interception') {
    return {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} (Reaction) to impose Disadvantage and reduce damage by ${REDUCTION} on ${attackerName}'s attack against ${defenderName}. ${defenderName} healed ${HEAL} HP.`,
        targetName: defenderName,
        timestamp: expect.any(Number),
    };
}

function disadvantageLogEntry(featureName = 'Interception') {
    return {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName}: Disadvantage imposed on attack rolls against ${defenderName} until the start of ${playerName}'s next turn.`,
        targetName: defenderName,
        timestamp: expect.any(Number),
    };
}

// ── Tests ───────────────────────────────────────────────────────

describe('interceptionHandler logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
        logService.addEntry.mockResolvedValue({});
        targetResolver.resolveMapPositions.mockResolvedValue({
            attackerPos: { x: 0, y: 0 },
            targetPos: { x: 1, y: 0 },
        });
        rangeCheck.isWithinRange.mockResolvedValue(true);
        damageUtils.getCombatContext.mockResolvedValue({
            players: [{ name: defenderName, hp: 50, maxHp: 50 }],
            lastAttack: lastAttack(),
        });
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: lastAttack(),
            attackerName,
            targetName: defenderName,
            primaryDamage: ORIGINAL_DAMAGE,
            secondaryDamage: 0,
            totalDamage: ORIGINAL_DAMAGE,
            damageTypes: ['slashing'],
        });
        diceRoller.rollExpression.mockReturnValue({ total: ROLL_TOTAL, rolls: [ROLL_TOTAL], modifier: 0 });
    });

    describe('logging', () => {
        it('logs the main ability_use entry with exact shape and in-log amounts', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            expect(logService.addEntry).toHaveBeenCalledTimes(2);
            expect(logService.addEntry).toHaveBeenNthCalledWith(
                1,
                campaignName,
                mainLogEntry()
            );
        });

        it('logs the Disadvantage duration entry as the second line', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            expect(logService.addEntry).toHaveBeenNthCalledWith(
                2,
                campaignName,
                disadvantageLogEntry()
            );
        });

        it('uses the custom feature name in both log lines', async () => {
            await handle(makeAction({ name: 'CustomIntercept' }), makePlayerStats(), campaignName, mapName);

            expect(logService.addEntry).toHaveBeenNthCalledWith(
                1,
                campaignName,
                mainLogEntry('CustomIntercept')
            );
            expect(logService.addEntry).toHaveBeenNthCalledWith(
                2,
                campaignName,
                disadvantageLogEntry('CustomIntercept')
            );
        });

        it('completes without throwing when logService.addEntry rejects', async () => {
            const logError = new Error('Log service unavailable');
            logService.addEntry.mockRejectedValueOnce(logError).mockRejectedValueOnce(logError);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

            // Both log lines were attempted; the .catch guards absorbed the rejections.
            expect(logService.addEntry).toHaveBeenCalledTimes(2);
            expect(result.type).toBe('popup');
        });
    });
});
