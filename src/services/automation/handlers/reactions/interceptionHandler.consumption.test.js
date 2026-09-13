// @improved-by-ai
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

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
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

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './interceptionHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ─────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'test-map';
const playerName = 'EvasiveFighter';
const defenderName = 'HexWarlock';
const attackerName = 'Wight 1';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        proficiency: 6,
        inventory: { equipped: ['Shortsword', 'Shield'] },
        equipment: [
            { name: 'Shield', armor_category: 'Shield' },
            { name: 'Shortsword', equipment_category: 'Weapon' },
        ],
        ...overrides,
    };
}

function makeAction() {
    return {
        name: 'Interception',
        automation: {
            type: 'interception',
            trigger: 'creature_hits_ally_within_5ft',
            range: '5_ft',
            damageExpression: '1d10',
            damageType: '',
            damageBonusExpression: 'proficiency_bonus',
            requiresShieldOrWeapon: true,
            casting_time: '1 reaction',
            hasAutomation: true,
        },
    };
}

function makeAttackEvent(timestamp) {
    return {
        attackerName,
        targetName: defenderName,
        d20: 6,
        bonus: 4,
        hit: true,
        targetAc: 9,
        primaryDamage: 8,
        rawDamage: 8,
        actualDamage: 8,
        damageTypes: ['slashing'],
        timestamp,
    };
}

function setupAttack(round, timestamp) {
    damageUtils.getCombatContext.mockResolvedValue({ round, activeCreatureName: attackerName });
    damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: makeAttackEvent(timestamp),
        attackerName,
        targetName: defenderName,
        primaryDamage: 8,
        secondaryDamage: 0,
        totalDamage: 8,
        damageTypes: ['slashing'],
    });
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 8, newHp: 68 });
}

// ── Tests ───────────────────────────────────────────────────────

describe('interceptionHandler reaction consumption (FS-008)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
        useRuntimeState.getRuntimeValue.mockImplementation((characterKey, propertyName) => {
            if (characterKey === 'campaign' && propertyName === 'targetEffects') return [];
            return null;
        });
    });

    it('writes the protection targetEffect at campaign scope', async () => {
        setupAttack(4, 1000);

        await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'protection',
                    target: defenderName,
                    source: playerName,
                }),
            ]),
            campaignName
        );
        expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: playerName, targetName: defenderName, effects: [{ type: 'remove_target_effect', effectKey: 'protection', source: playerName, target: defenderName }], campaignName, rounds: 1 });
    });

    it('blocks a re-click on the same trigger in the same round (no second heal)', async () => {
        setupAttack(4, 1000);
        useRuntimeState.getRuntimeValue.mockImplementation((characterKey, propertyName) => {
            if (characterKey === 'campaign' && propertyName === 'targetEffects') return [];
            if (characterKey === playerName && propertyName === 'interceptionUsedRound') {
                return { round: 4, activeCreature: attackerName, lastAttackTimestamp: 1000 };
            }
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already been used this round');
        expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.anything(),
            campaignName
        );
    });

    it('blocks a different trigger while the reaction is spent this round', async () => {
        setupAttack(4, 2000);
        useRuntimeState.getRuntimeValue.mockImplementation((characterKey, propertyName) => {
            if (characterKey === 'campaign' && propertyName === 'targetEffects') return [];
            if (characterKey === playerName && propertyName === 'interceptionUsedRound') {
                return { round: 4, activeCreature: attackerName, lastAttackTimestamp: 1000 };
            }
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already been used this round');
        expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    });

    it('marks the reaction consumed with round and lastAttack timestamp', async () => {
        setupAttack(4, 1000);

        await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            playerName,
            'interceptionUsedRound',
            { round: 4, activeCreature: attackerName, lastAttackTimestamp: 1000 },
            campaignName
        );
    });

    it('allows use again on a new round against a new trigger', async () => {
        setupAttack(5, 2000);
        useRuntimeState.getRuntimeValue.mockImplementation((characterKey, propertyName) => {
            if (characterKey === 'campaign' && propertyName === 'targetEffects') return [];
            if (characterKey === playerName && propertyName === 'interceptionUsedRound') {
                return { round: 4, activeCreature: attackerName, lastAttackTimestamp: 1000 };
            }
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.description).toContain('Interception damage reduction');
        expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
            expect.anything(),
            defenderName,
            8,
            campaignName
        );
    });

    it('logs reaction use, reduction, heal and disadvantage application', async () => {
        setupAttack(4, 1000);
        const { addEntry } = await import('../../../ui/logService.js');

        await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        const descriptions = addEntry.mock.calls.map(c => c[1].description);
        expect(descriptions.some(d => d.includes('used Interception') && d.includes('reduce damage by 11'))).toBe(true);
        expect(descriptions.some(d => d.includes('Disadvantage imposed on attack rolls against') && d.includes(defenderName))).toBe(true);
    });
});
