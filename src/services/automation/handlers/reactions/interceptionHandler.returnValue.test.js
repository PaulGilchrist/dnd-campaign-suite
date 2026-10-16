// @maintained-by-ai
// interceptionHandler sextet — lane: RETURN VALUE ENVELOPE (the pass-through contract
// callers consume from the automation router: registry `interception: handleInterception`).
//
// Six-lane seam map (each lane owns what it pins; do not duplicate across lanes):
//  - .consumption.test.js:           isReactionSpent gate, stampInterceptionRound mark,
//                                      latch release, no-side-effect guards, rounds:1 addExpiration.
//  - .damage.test.js:                computeInterceptionReduction + resolveInterceptionDamageBonus,
//                                      applyHealingToTarget amounts and skip paths.
//  - .description.test.js:           baseDescription + attackDetails popup text templates,
//                                      combatSummary-null basic-description text.
//  - .logging.test.js:             addEntry ability_use entries (shape, names, amounts).
//  - .returnValue.test.js (THIS):  envelope key set on EVERY return path (success + all
//                                      early returns), payload.type constant, payload.name =
//                                      action.name, automation passed through by reference.
//                                      Shape only — description/log content owned elsewhere.
//  - .test.js (main):              early-return gate behavior (no attack, shield/weapon,
//                                      range checks).
//
// Deterministic: every handler import mocked (incl. expirations barrel), pure return
// -shape pins, no timer or wall-clock coupling — no churn expected.
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

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './interceptionHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as targetResolver from '../../common/targetResolver.js';

// ── Helpers ─────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'test-map';
const playerName = 'Paladin';
const defenderName = 'Rogue';
const attackerName = 'Goblin';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        proficiency: 3,
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
        ...overrides,
    };
}

// Trailing-`...overrides` replace-wholesale defect fixed here: automation patches
// merge INTO the defaults, they never replace the automation object wholesale.
function makeAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Interception',
        ...rest,
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
            ...automationOverrides,
        },
    };
}

// The envelope contract every return path of the handler must satisfy.
function expectEnvelope(result, action) {
    expect(result.type).toBe('popup');
    expect(Object.keys(result).sort()).toEqual(['payload', 'type']);
    expect(Object.keys(result.payload).sort()).toEqual(['automation', 'description', 'name', 'type']);
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe(action.name);
    expect(typeof result.payload.description).toBe('string');
    expect(result.payload.automation).toBe(action.automation);
}

// ── Tests ───────────────────────────────────────────────────────

describe('interceptionHandler return value envelope', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
        targetResolver.resolveMapPositions.mockResolvedValue({
            attackerPos: { x: 0, y: 0 },
            targetPos: { x: 1, y: 0 },
        });
        rangeCheck.isWithinRange.mockResolvedValue(true);
        damageUtils.getCombatContext.mockResolvedValue({ round: 4, activeCreatureName: attackerName });
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: {
                attackerName,
                targetName: defenderName,
                d20: 15,
                bonus: 5,
                hit: true,
                targetAc: 16,
                primaryDamage: 12,
                rawDamage: 12,
                actualDamage: 12,
                damageTypes: ['slashing'],
                timestamp: 1000,
            },
            attackerName,
            targetName: defenderName,
            primaryDamage: 12,
            secondaryDamage: 0,
            totalDamage: 12,
            damageTypes: ['slashing'],
        });
    });

    it('success path returns popup envelope with exact key set and automation passed through by reference', async () => {
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), campaignName, mapName);

        expectEnvelope(result, action);
    });

    // One row per early-return path in handle(). Each pins only the envelope +
    // automation identity — gate behavior and description text are other lanes' seams.
    // `probe` is a call-seam identifier proving the row actually short-circuited at
    // its claimed gate rather than silently falling through to a later path.
    const earlyReturnPaths = [
        {
            label: 'no recent attack (custom action name)',
            action: () => makeAction({ name: 'Guarding Strike' }),
            divert: () => damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                totalDamage: 0,
            }),
            probe: () => expect(damageUtils.getCombatContext).not.toHaveBeenCalled(),
        },
        {
            label: 'no shield or weapon equipped',
            stats: { inventory: { equipped: [] }, equipment: [] },
            probe: () => expect(rangeCheck.isWithinRange).not.toHaveBeenCalled(),
        },
        {
            label: 'attacker out of range',
            divert: () => rangeCheck.isWithinRange.mockResolvedValue(false),
            probe: () => expect(damageUtils.getCombatContext).not.toHaveBeenCalled(),
        },
        {
            label: 'combat summary unavailable',
            divert: () => damageUtils.getCombatContext.mockResolvedValue(null),
            probe: () => expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled(),
        },
        {
            label: 'reaction already spent this round',
            divert: () => useRuntimeState.getRuntimeValue.mockImplementation((characterKey, propertyName) => {
                if (characterKey === playerName && propertyName === 'interceptionUsedRound') {
                    return { round: 4, activeCreature: attackerName, lastAttackTimestamp: 1000 };
                }
                return null;
            }),
            probe: () => expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled(),
        },
    ];

    it.each(earlyReturnPaths)('early return — $label: same envelope, automation passed through', async ({ divert, stats, action, probe }) => {
        divert?.();
        const act = action ? action() : makeAction();

        const result = await handle(act, makePlayerStats(stats), campaignName, mapName);

        expectEnvelope(result, act);
        probe();
    });
});
