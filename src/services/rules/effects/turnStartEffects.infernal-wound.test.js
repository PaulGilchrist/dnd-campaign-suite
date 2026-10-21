// @maintained-by-ai
// MA-0367 seam lock: applyTurnStartEffects invokes the Infernal Wound bleed
// tick for the ACTIVE creature's turn start BEFORE the playerStats guard, so it
// fires for monster victims (EB) as well as PCs — the same pre-guard shape as
// applyHolyNimbusDamage / regainLegendaryUses. Gate logic (te scan, 1d10 roll,
// HP loss, heal-close) is owned by infernalWoundService.test.js; effect-handler
// order/dispatch by applyTurnStartEffects.test.js — this file pins only the
// pre-guard bleed seam: exactly one (activeName, campaignName) dispatch per
// turn start for ANY active creature, silence when there is none.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const applyInfernalWoundBleedTurnStart = vi.fn(async () => {});

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
    applyInfernalWoundBleedTurnStart: (...args) => applyInfernalWoundBleedTurnStart(...args),
}));
// Pre-guard siblings (turnStartEffects.js:216/:222) run on EVERY dispatch
// with a truthy activeName — stubbed 1:1 so this seam file never executes
// their real bodies (constrictGrapple/whirlwind lane owns them).
vi.mock('../features/whirlwindService.js', () => ({ applyWhirlwindTurnStart: vi.fn(async () => {}) }));
vi.mock('../features/constrictGrappleService.js', () => ({ applyConstrictGrappleTurnStart: vi.fn(async () => {}) }));
vi.mock('../../ui/utils.js', () => ({ default: { getName: (n) => n } }));
vi.mock('../../ui/storage.js', () => ({ default: { set: vi.fn(), get: vi.fn() } }));

import { applyTurnStartEffects } from './turnStartEffects.js';

const CAMPAIGN = 'test-campaign';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('MA-0367 turn-start bleed tick seam', () => {
    it.each([
        // playerStats null proves the call sits BEFORE the guard (EB monster turn)
        { name: 'BEARDED_DEVIL', stats: null, label: 'monster active creature with no playerStats' },
        { name: 'Wild_Sage_Druid', stats: { turnStartEffects: [] }, label: 'PC active creature' },
    ])('dispatches the bleed tick exactly once for a $label', async ({ name, stats }) => {
        await applyTurnStartEffects(name, stats, CAMPAIGN, []);
        expect(applyInfernalWoundBleedTurnStart).toHaveBeenCalledTimes(1);
        expect(applyInfernalWoundBleedTurnStart).toHaveBeenCalledWith(name, CAMPAIGN);
    });

    it('does not fire without an active creature', async () => {
        await applyTurnStartEffects(null, null, CAMPAIGN, []);
        expect(applyInfernalWoundBleedTurnStart).not.toHaveBeenCalled();
    });
});
