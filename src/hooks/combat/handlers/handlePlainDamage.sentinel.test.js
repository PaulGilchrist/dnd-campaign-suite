// @maintained-by-ai: 2026-10-14
// FT-101 Sentinel (Halt) coverage for the handlePlainDamage OA-hit seam
// (applySentinelHalt) — rules-validated against public/data/2024/feats.json
// Sentinel: "When you hit a creature with an Opportunity Attack, the
// creature's Speed becomes 0 for the rest of the current turn" → registry te
// + activeConditions speed_zero + ONE anchor expiry clock on the target's
// next turn-start (no-timers policy: expiryRounds Infinity, seam-anchored) +
// granted log row. Ram-prone / auto-Halt-action lanes live in their own
// files and never share this producer.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    parseConstant: vi.fn(() => null),
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { addEntry } from '../../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { KEY } from '../../../services/rules/effects/turnStartEffects.js';

describe('Plain damage sentinel (FT-101 Halt seam)', () => {
    const goblin = { name: 'Goblin', computedStats: { armorClass: 12 } };

    const baseDeps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [
            { name: 'TestFighter', feats: ['Great Weapon Master', 'Sentinel'], computedStats: { armorClass: 16 } },
            goblin,
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockReset().mockReturnValue(null);
        setRuntimeValue.mockClear();
        addEntry.mockClear();
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    function makeOpportunityAttackContext(extra = {}) {
        return {
            targetName: 'Goblin',
            damageType: 'slashing',
            isOpportunityAttack: true,
            attackerName: 'TestFighter',
            ...extra,
        };
    }

    const oaRoll = (context) => ({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context });

    // Campaign lastAttack resolved as a TestFighter hit; empty targetEffects.
    function oaHitRuntime(key, prop) {
        if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'TestFighter' };
        if (key === 'campaign') return [];
        return null;
    }

    function runtimeWrites(prop) {
        return setRuntimeValue.mock.calls.filter((call) => call[1] === prop);
    }

    const haltTe = (props = {}) => expect.objectContaining({
        target: 'Goblin',
        source: 'TestFighter',
        effect: 'speed_zero',
        option: 'Halt',
        duration: 'end_of_turn',
        ...props,
    });

    const grantLogs = () => addEntry.mock.calls.map((c) => c[1]).filter((e) => e && e.automationType === 'speed_zero_granted');

    describe('OA hit by Sentinel-holder stamps Halt', () => {
        it('writes the te, activeConditions, ONE anchored expiry clock, and the grant log', async () => {
            getRuntimeValue.mockImplementation(oaHitRuntime);
            await createLogDamageAndShow(baseDeps)(oaRoll(makeOpportunityAttackContext()));

            // ONE registry te write (skipSync=true mirror of MA-0146 shape).
            expect(runtimeWrites('targetEffects')).toEqual([
                ['campaign', 'targetEffects', [haltTe()], 'test-campaign', true],
            ]);

            // Enforcement lane: activeConditions speed_zero on the target.
            expect(runtimeWrites('activeConditions')).toEqual([
                ['Goblin', 'activeConditions', ['speed_zero'], 'test-campaign'],
            ]);

            // ONE anchor clock, no round countdown — cleared at the target's
            // next turn-start via expireOnCreatureName (no-timers policy).
            const clocks = runtimeWrites(KEY);
            expect(clocks).toHaveLength(1);
            expect(clocks[0][0]).toBe('TestFighter');
            expect(clocks[0][2]).toEqual([{
                target: 'Goblin',
                expireOnCreatureName: 'Goblin',
                appliedRound: 1,
                expiryRounds: Infinity,
                effects: [
                    { type: 'remove_target_effect', effectKey: 'speed_zero', source: 'TestFighter', target: 'Goblin' },
                    { type: 'speed_zero' },
                ],
            }]);

            // Every automation grants log with event details.
            const grants = grantLogs();
            expect(grants).toHaveLength(1);
            expect(grants[0]).toMatchObject({
                type: 'automation',
                characterName: 'Goblin',
                sourceName: 'TestFighter',
                abilityName: 'Sentinel',
            });
            expect(grants[0].description).toContain('Speed is 0');
        });

        it('merges Halt into existing targetEffects', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'TestFighter' };
                if (key === 'campaign') return [{ target: 'Goblin', source: 'Other', effect: 'some_effect' }];
                return null;
            });
            await createLogDamageAndShow(baseDeps)(oaRoll(makeOpportunityAttackContext()));

            const writes = runtimeWrites('targetEffects');
            expect(writes).toHaveLength(1);
            expect(writes[0][2][0]).toEqual({ target: 'Goblin', source: 'Other', effect: 'some_effect' });
            expect(writes[0][2][1]).toMatchObject({ target: 'Goblin', source: 'TestFighter', effect: 'speed_zero' });
        });
    });

    describe('zero-stamp refusals', () => {
        async function expectNoStamp(deps, context, runtime = oaHitRuntime) {
            getRuntimeValue.mockImplementation(runtime);
            await createLogDamageAndShow(deps)(oaRoll(context));
            expect(runtimeWrites('targetEffects')).toHaveLength(0);
            expect(runtimeWrites('activeConditions')).toHaveLength(0);
            expect(runtimeWrites(KEY)).toHaveLength(0);
            expect(grantLogs()).toHaveLength(0);
        }

        it('skips when not an opportunity attack', async () => {
            await expectNoStamp(baseDeps, { targetName: 'Goblin', damageType: 'slashing', attackerName: 'TestFighter' });
        });

        it('skips when the attack did not hit', async () => {
            await expectNoStamp(baseDeps, makeOpportunityAttackContext(), (key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: false, attackerName: 'TestFighter' };
                if (key === 'campaign') return [];
                return null;
            });
        });

        it('skips when the lastAttack attacker identity differs', async () => {
            await expectNoStamp(baseDeps, makeOpportunityAttackContext({ attackerName: 'OtherAttacker' }), (key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'OtherAttacker' };
                if (key === 'campaign') return [];
                return null;
            });
        });

        it('skips when the attacker lacks the Sentinel feat', async () => {
            await expectNoStamp({
                ...baseDeps,
                characters: [
                    { name: 'TestFighter', feats: ['Great Weapon Master'], computedStats: { armorClass: 16 } },
                    goblin,
                ],
            }, makeOpportunityAttackContext());
        });
    });
});
