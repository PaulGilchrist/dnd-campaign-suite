// @maintained-by-ai
// interceptionHandler sextet — lane: DESCRIPTION COMPOSITION (baseDescription heading +
// interposition template, attackDetails line templates incl. placeholder fallbacks
// 'vs AC —', '+ 0', 'd20(undefined)', '→ <b>MISS</b>', and the actualHeal note
// render/skip) + the combatSummary-null basic-description early path (L41-44).
// Bare-prefix pins only for reduction lines — full-string numeric reduction pins live
// in .damage.test.js; popup envelope shape lives in .returnValue.test.js; consumption
// gate text lives in .consumption.test.js; addEntry text lives in .logging.test.js.
//
// Deterministic: runtime/logService/dice/healing/range/expirations mocked, pure
// handler, own-composition string pins — no churn expected.
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

// addExpiration pins live in the consumption lane; keep the barrel graph inert here.
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './interceptionHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
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
        inventory: { equipped: [] },
        equipment: [],
        ...overrides,
    };
}

function makeShieldUser() {
    return makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
    });
}

function makeAction(overrides = {}) {
    const { automation, ...rest } = overrides;
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
            ...automation,
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

// Stub findLastAttack with the canonical lastAttack overridden per scenario
// (attackDetails placeholder/MISS rendering under test).
function stubAttackEvent(eventOverrides) {
    damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { ...makeCombatSummary().lastAttack, ...eventOverrides },
        attackerName,
        targetName: defenderName,
        primaryDamage: 12,
        secondaryDamage: 0,
        totalDamage: 12,
        damageTypes: ['slashing'],
    });
}

// ── Tests ───────────────────────────────────────────────────────

describe('interceptionHandler description', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
        targetResolver.resolveMapPositions.mockResolvedValue({
            attackerPos: { x: 0, y: 0 },
            targetPos: { x: 1, y: 0 },
        });
        rangeValidation.getDistanceFeet.mockReturnValue(5);
        rangeValidation.rangeToFeet.mockReturnValue(5);
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
        diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 50, newHp: 55 });
    });

    it('composes the exact baseDescription heading and interposition template', async () => {
        const result = await handle(makeAction(), makeShieldUser(), campaignName, mapName);

        expect(result.payload.description).toContain(
            '<b>Interception</b><br/>You interpose yourself between Goblin and Rogue. ' +
            'Goblin and all other creatures have Disadvantage on attack rolls against Rogue ' +
            'until the start of your next turn.'
        );
    });

    it('renders the attack roll line and damage-section skeleton after the base description', async () => {
        const result = await handle(makeAction(), makeShieldUser(), campaignName, mapName);

        const description = result.payload.description;
        expect(description).toContain('Attack roll: d20(15) + 5 = 20 vs AC 16 → <b>HIT</b>');
        // Bare prefixes only — numeric reduction content is pinned in the damage lane.
        expect(description).toContain('Original damage:');
        expect(description).toContain('Interception damage reduction:');
        expect(description).toContain('Reduced damage:');
    });

    it('renders the heal note when actualHeal > 0 and omits it when reduction is zero', async () => {
        const hit = await handle(makeAction(), makeShieldUser(), campaignName, mapName);
        // Template pin — the exact amount is damage-lane content.
        expect(hit.payload.description).toMatch(/The target healed for \d+ HP\./);

        diceRoller.rollExpression.mockReturnValue({ total: 0, rolls: [], modifier: 0 });
        const zeroReduction = await handle(
            makeAction({ automation: { damageBonusExpression: '' } }),
            makeShieldUser(),
            campaignName,
            mapName
        );
        expect(zeroReduction.payload.description).toContain('Interception damage reduction:');
        expect(zeroReduction.payload.description).not.toContain('healed for');
    });

    it('propagates action.name into the popup name and the description heading', async () => {
        const result = await handle(makeAction({ name: 'MyInterception' }), makeShieldUser(), campaignName, mapName);

        expect(result.payload.name).toBe('MyInterception');
        expect(result.payload.description).toContain('<b>MyInterception</b>');
    });

    it('returns popup with basic description only when combatSummary is null', async () => {
        damageUtils.getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makeShieldUser(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('interpose yourself between');
        expect(result.payload.description).not.toContain('Attack roll:');
        expect(result.payload.description).not.toContain('Original damage:');
        expect(result.payload.description).not.toContain('Interception damage reduction:');
    });

    it('renders AC placeholder as em dash when targetAc is null', async () => {
        stubAttackEvent({ targetAc: null });

        const result = await handle(makeAction(), makeShieldUser(), campaignName, mapName);

        expect(result.payload.description).toContain('Attack roll: d20(15) + 5 = 20 vs AC — → <b>HIT</b>');
    });

    it('renders bonus as + 0 when attack bonus is null', async () => {
        stubAttackEvent({ bonus: null });

        const result = await handle(makeAction(), makeShieldUser(), campaignName, mapName);

        expect(result.payload.description).toContain('+ 0 = 15');
    });

    it('renders d20(undefined) = NaN when d20 is missing from the attack event', async () => {
        stubAttackEvent({ d20: undefined });

        const result = await handle(makeAction(), makeShieldUser(), campaignName, mapName);

        expect(result.payload.description).toContain('Attack roll: d20(undefined) + 5 = NaN vs AC 16');
    });

    it('renders MISS when hit is undefined', async () => {
        stubAttackEvent({ hit: undefined });

        const result = await handle(makeAction(), makeShieldUser(), campaignName, mapName);

        expect(result.payload.description).toContain('Attack roll: d20(15) + 5 = 20 vs AC 16 → <b>MISS</b>');
    });
});
