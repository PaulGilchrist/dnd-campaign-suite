// @maintained-by-ai 2026-11-27
// interceptionHandler sextet — lane: MAIN / EARLY-RETURN GATES (gate behavior only;
// envelope shape, description text, damage math, logging, consumption latch owned elsewhere).
//
// Six-lane seam map (each lane owns what it pins; do not duplicate across lanes):
//  - .consumption.test.js:           isReactionSpent gate, stampInterceptionRound mark,
//                                      latch release, no-side-effect guards, rounds:1 addExpiration.
//  - .damage.test.js:                computeInterceptionReduction + resolveInterceptionDamageBonus,
//                                      applyHealingToTarget amounts and skip paths.
//  - .description.test.js:           baseDescription + attackDetails popup text templates,
//                                      combatSummary-null basic-description text.
//  - .logging.test.js:             addEntry ability_use entries (shape, names, amounts).
//  - .returnValue.test.js:         envelope key set on EVERY return path, automation
//                                      pass-through by reference; probes the gate call seams
//                                      (order only). Shape only — gate messages owned here.
//  - .test.js (main, THIS file):   early-return gate behavior — no recent attack
//                                      (featureName in message), shield/weapon requirement
//                                      (incl. magic-name parsing + equipment lookup miss),
//                                      range gate parsed rangeFt passed to isWithinRange
//                                      (default 5, custom, non-numeric fallback) and the
//                                      skip paths (no map, unavailable positions).
//
// Range seam is isWithinRange (rangeValidation.js is NOT imported by the handler).
// parseMagicItemName is intentionally NOT mocked — the magic-name arms exercise the
// real shared parser (fix#201). All other handler imports mocked (incl. expirations
// barrel). Refusal legs carry a zero-spend census (no later channel read/written) and
// the gate channels pin campaignName threading (findLastAttack, resolveMapPositions).
// Deterministic: exact-string gate-message pins, call-seam range pins — no churn expected.
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
    findLastAttack: vi.fn().mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
    }),
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
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';

// Zero-spend census for every early-return refusal: no gate may read the spent-mark,
// write the runtime store, log, schedule an expiration, or heal.
function expectNoCommitWrites() {
    expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
}

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
        inventory: { equipped: [] },
        equipment: [],
        ...overrides,
    };
}

const shieldStats = {
    inventory: { equipped: ['Shield'] },
    equipment: [{ name: 'Shield', armor_category: 'Shield' }],
};

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

function makeCombatSummary() {
    return {
        players: [{ name: defenderName, hp: 50, maxHp: 50 }],
        lastAttack: {
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
        },
    };
}

// ── Tests ───────────────────────────────────────────────────────

describe('interceptionHandler', () => {
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
        damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: makeCombatSummary().lastAttack,
            attackerName,
            targetName: defenderName,
            primaryDamage: 12,
            secondaryDamage: 0,
            totalDamage: 12,
            damageTypes: ['slashing'],
        });
    });

    describe('no recent attack gate', () => {
        it.each([
            { label: 'action.name', overrides: {}, expected: 'Interception: No recent attack found. Can only be used after an attack roll.' },
            { label: 'custom name', overrides: { name: 'CustomFeature' }, expected: 'CustomFeature: No recent attack found. Can only be used after an attack roll.' },
            { label: 'Feature fallback', overrides: { name: undefined }, expected: 'Feature: No recent attack found. Can only be used after an attack roll.' },
        ])('returns automation_info popup naming $label when no attack found', async ({ overrides, expected }) => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                totalDamage: 0,
            });

            const result = await handle(makeAction(overrides), makePlayerStats(), campaignName, mapName);

            expect(damageRollback.findLastAttack).toHaveBeenCalledWith(campaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe(expected);
            expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
            expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
            expectNoCommitWrites();
        });
    });

    describe('shield or weapon gate', () => {
        it.each([
            { label: 'nothing equipped', stats: {} },
            {
                label: 'equipped slot misses the equipment lookup',
                stats: {
                    inventory: { equipped: ['Longsword', null] },
                    equipment: [{ name: 'Something Else', equipment_category: 'Weapon' }],
                },
            },
        ])('refuses with exact message when $label', async ({ stats }) => {
            const result = await handle(makeAction(), makePlayerStats(stats), campaignName, mapName);

            expect(damageRollback.findLastAttack).toHaveBeenCalledWith(campaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe(
                'Interception: You must be holding a Shield or a Simple or Martial weapon to use this Reaction.'
            );
            expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
            expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
            expectNoCommitWrites();
        });

        it.each([
            { label: 'shield', inventory: { equipped: ['Shield'] }, equipment: [{ name: 'Shield', armor_category: 'Shield' }] },
            { label: 'weapon', inventory: { equipped: ['Longsword'] }, equipment: [{ name: 'Longsword', equipment_category: 'Weapon' }] },
            { label: 'shield and weapon', inventory: { equipped: ['Shield', 'Shortsword'] }, equipment: [{ name: 'Shield', armor_category: 'Shield' }, { name: 'Shortsword', equipment_category: 'Weapon' }] },
            { label: 'magic shield name', inventory: { equipped: ['+1 Shield'] }, equipment: [{ name: 'Shield', armor_category: 'Shield' }] },
            { label: 'magic weapon name', inventory: { equipped: ['+1 Mace'] }, equipment: [{ name: 'Mace', equipment_category: 'Weapon' }] },
            // fix#201 shared-parser arm: digit-less '+' keeps the full name
            // (old local substring(3) copy produced 'hield'/'ace' — refusal).
            { label: 'digit-less + prefix keeps full name (fix#201)', inventory: { equipped: ['+ Shield'] }, equipment: [{ name: 'Shield', armor_category: 'Shield' }] },
            { label: 'null/undefined slots skipped', inventory: { equipped: [null, 'Shield', undefined] }, equipment: [{ name: 'Shield', armor_category: 'Shield' }] },
        ])('proceeds past the gate when $label is equipped', async ({ inventory, equipment }) => {
            const result = await handle(makeAction(), makePlayerStats({ inventory, equipment }), campaignName, mapName);

            expect(result.payload.description).not.toContain('You must be holding a Shield');
            expect(result.payload.description).toContain('interpose yourself');
        });
    });

    describe('range gate', () => {
        it.each([
            { label: 'default 5_ft', range: '5_ft', expectedFt: 5 },
            { label: 'custom 10_ft', range: '10_ft', expectedFt: 10 },
            { label: 'non-numeric falls back to 5', range: 'Self', expectedFt: 5 },
            { label: 'missing range falls back to 5', range: undefined, expectedFt: 5 },
        ])('blocks with parsed $expectedFt ft ($label) and reports out of range', async ({ range, expectedFt }) => {
            rangeCheck.isWithinRange.mockResolvedValue(false);

            const result = await handle(makeAction({ automation: { range } }), makePlayerStats(shieldStats), campaignName, mapName);

            expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(campaignName, playerName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(`${attackerName} is out of range.`);
            expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(playerName, attackerName, expectedFt);
            expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
            expectNoCommitWrites();
        });

        it('skips range check when no map (no position lookup, no range call)', async () => {
            rangeCheck.isWithinRange.mockResolvedValue(false);

            const result = await handle(makeAction(), makePlayerStats(shieldStats), campaignName, null);

            expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
            expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
            expect(result.payload.description).not.toContain('out of range');
            expect(result.payload.description).toContain('interpose yourself');
        });

        it.each([
            ['positions unavailable', null],
            ['only attacker position', { attackerPos: { x: 0, y: 0 }, targetPos: null }],
            ['only target position', { attackerPos: null, targetPos: { x: 1, y: 0 } }],
        ])('skips range check with %s', async (_label, positions) => {
            rangeCheck.isWithinRange.mockResolvedValue(false);
            targetResolver.resolveMapPositions.mockResolvedValue(positions);

            const result = await handle(makeAction(), makePlayerStats(shieldStats), campaignName, mapName);

            expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
            expect(result.payload.description).not.toContain('out of range');
            expect(result.payload.description).toContain('interpose yourself');
        });
    });
});
