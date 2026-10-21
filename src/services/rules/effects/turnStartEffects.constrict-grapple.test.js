// @maintained-by-ai
// MA-1842 seam lock: applyTurnStartEffects dispatches the Constrict grapple
// ongoing-damage tick (constrictGrappleService) at the ACTIVE creature's turn
// start BEFORE the playerStats guard, so it fires for monster victims (EB) as
// well as PCs — the same pre-guard shape as MA-0367 infernal wound /
// MA-0610 whirlwind. This lane pins ONLY the dispatcher seam (fires for any
// active creature, exactly once per invocation, exact args, never latched by
// the dispatcher). Service internals (te gating, 4d8 dice, victim HP paths,
// release/death strips) are owned by constrictGrappleService.test.js; the
// post-guard grapple_damage (Unarmed Fighting) handler is a DISTINCT
// turnStartEffects type owned by turnStartEffects_additional.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const applyConstrictGrappleTurnStart = vi.fn(async () => {});

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({ setTempHp: vi.fn() }));
vi.mock('../../combat/automation/automationExpressions.js', () => ({ evaluateAutoExpression: vi.fn(() => null) }));
vi.mock('../../encounters/combatData.js', () => ({ getCombatSummary: vi.fn(() => null) }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../automation/handlers/spells/confusionTurnStartHandler.js', () => ({ handleConfusionTurnStart: vi.fn() }));
vi.mock('./auraDamageService.js', () => ({ applyAuraDamage: vi.fn(async () => {}), applyHolyNimbusDamage: vi.fn(async () => {}) }));
vi.mock('./toppleCleanup.js', () => ({ cleanUpToppleConditions: vi.fn() }));
vi.mock('../../encounters/monsterLegendaryUses.js', () => ({ regainLegendaryUses: vi.fn(async () => {}) }));
vi.mock('../../encounters/monsterRecharge.js', () => ({ rollMonsterRecharges: vi.fn(async () => {}) }));
vi.mock('../../rules/features/infernalWoundService.js', () => ({
    applyInfernalWoundBleedTurnStart: vi.fn(async () => {}),
}));
vi.mock('../features/whirlwindService.js', () => ({
    applyWhirlwindTurnStart: vi.fn(async () => {}),
}));
vi.mock('../features/constrictGrappleService.js', () => ({
    applyConstrictGrappleTurnStart: (...args) => applyConstrictGrappleTurnStart(...args),
}));
vi.mock('../../ui/utils.js', () => ({ default: { getName: (n) => n } }));
vi.mock('../../ui/storage.js', () => ({ default: { set: vi.fn(), get: vi.fn() } }));

import { applyTurnStartEffects } from './turnStartEffects.js';

const CAMPAIGN = 'test-campaign';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('MA-1842 turn-start constrict grapple tick seam', () => {
    it.each([
        // [label, activeName, playerStats, expectedDispatches]
        ['MONSTER active creature with NO playerStats (pre-guard)', 'ElderPaladin', null, 1],
        ['PC active creature', 'Wild_Sage_Druid', { turnStartEffects: [] }, 1],
        ['no active creature', null, null, 0],
    ])('dispatches %s — exactly the expected number of ticks with exact args', async (_label, activeName, playerStats, expected) => {
        await applyTurnStartEffects(activeName, playerStats, CAMPAIGN, []);
        if (expected === 0) {
            expect(applyConstrictGrappleTurnStart).not.toHaveBeenCalled();
        } else {
            expect(applyConstrictGrappleTurnStart).toHaveBeenCalledTimes(1);
            expect(applyConstrictGrappleTurnStart).toHaveBeenCalledWith(activeName, CAMPAIGN);
        }
    });

    it('re-ticks on every consecutive turn start (dispatcher never latches the recurring damage)', async () => {
        await applyTurnStartEffects('ElderPaladin', null, CAMPAIGN, []);
        await applyTurnStartEffects('ElderPaladin', null, CAMPAIGN, []);
        expect(applyConstrictGrappleTurnStart).toHaveBeenCalledTimes(2);
    });
});
