// @maintained-by-ai
// interceptionHandler sextet — lane: REACTION CONSUMPTION (one Reaction per round latch).
//
// Six-lane seam map (each lane owns what it pins; do not duplicate across lanes):
//  - consumption (THIS file):          isReactionSpent gate (same-trigger latch via
//                                      lastAttackTimestamp, round-spent latch), stampInterceptionRound
//                                      consumption mark (round/activeCreature/lastAttackTimestamp),
//                                      latch release on a new round, no-side-effect guards when
//                                      blocked, and the rounds:1 addExpiration that expires the
//                                      protection latch (only addExpiration pin for this handler).
//  - .damage.test.js:                computeInterceptionReduction + resolveInterceptionDamageBonus
//                                      (roll + bonus, clamp to 0, null roll, zero damage),
//                                      applyHealingToTarget amounts and skip paths.
//  - .description.test.js:           baseDescription + attackDetails popup text templates,
//                                      combatSummary-null basic-description path.
//  - .logging.test.js:             addEntry ability_use entries (shape, names, amounts in log,
//                                      addEntry rejection handling).
//  - .returnValue.test.js:         popup envelope shape and automation pass-through on every
//                                      path (success + errors).
//  - .test.js (main):              early-return gates — no recent attack, shield/weapon
//                                      requirement (incl. magic-name parsing), range checks
//                                      (custom range, no-map, unavailable positions).
//  - .targetEffects.test.js (companion, outside sextet queue): upsertProtectionEffect campaign
//                                      store push/update/append pins (with duration + timestamp).
//
// Deterministic: runtime/logService/dice/healing/expirations mocked, pure handler, exact
// pins — no churn expected.
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

function withConsumptionMark(mark) {
    useRuntimeState.getRuntimeValue.mockImplementation((characterKey, propertyName) => {
        if (characterKey === 'campaign' && propertyName === 'targetEffects') return [];
        if (characterKey === playerName && propertyName === 'interceptionUsedRound') return mark;
        return null;
    });
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

    it('blocks a re-click on the same trigger in the same round (no second heal)', async () => {
        setupAttack(4, 1000);
        withConsumptionMark({ round: 4, activeCreature: attackerName, lastAttackTimestamp: 1000 });

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
        withConsumptionMark({ round: 4, activeCreature: attackerName, lastAttackTimestamp: 1000 });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already been used this round');
        expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
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

    it('allows use again on a new round and re-stamps the consumption mark', async () => {
        setupAttack(5, 2000);
        withConsumptionMark({ round: 4, activeCreature: attackerName, lastAttackTimestamp: 1000 });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).not.toContain('already been used this round');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            playerName,
            'interceptionUsedRound',
            { round: 5, activeCreature: attackerName, lastAttackTimestamp: 2000 },
            campaignName
        );
    });

    it('schedules removal of the protection effect after 1 round', async () => {
        setupAttack(4, 1000);

        await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(expirations.addExpiration).toHaveBeenCalledWith({
            attackerName: playerName,
            targetName: defenderName,
            effects: [{ type: 'remove_target_effect', effectKey: 'protection', source: playerName, target: defenderName }],
            campaignName,
            rounds: 1,
        });
    });

    it('does not schedule expiration when the attack has no defender', async () => {
        setupAttack(4, 1000);
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: { ...makeAttackEvent(1000), targetName: null },
            attackerName,
            targetName: null,
            primaryDamage: 8,
            secondaryDamage: 0,
            totalDamage: 8,
            damageTypes: ['slashing'],
        });

        await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
});
