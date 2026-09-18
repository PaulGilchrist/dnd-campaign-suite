// MA-0367 seam lock: applyTurnStartEffects invokes the Infernal Wound bleed
// tick for the ACTIVE creature's turn start BEFORE the playerStats guard, so it
// fires for monster victims (EB) as well as PCs — the same pre-guard shape as
// applyHolyNimbusDamage / regainLegendaryUses.
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
vi.mock('../../ui/utils.js', () => ({ default: { getName: (n) => n } }));
vi.mock('../../ui/storage.js', () => ({ default: { set: vi.fn(), get: vi.fn() } }));

import { applyTurnStartEffects } from './turnStartEffects.js';

const CAMPAIGN = 'test-campaign';

beforeEach(() => {
    vi.clearAllMocks();
    applyInfernalWoundBleedTurnStart.mockClear();
});

describe('MA-0367 turn-start bleed tick seam', () => {
    it('fires for a MONSTER active creature with NO playerStats (pre-guard)', async () => {
        await applyTurnStartEffects('Hero', null, CAMPAIGN, []);
        expect(applyInfernalWoundBleedTurnStart).toHaveBeenCalledWith('Hero', CAMPAIGN);
    });

    it('fires for a PC active creature too', async () => {
        await applyTurnStartEffects('Wild_Sage_Druid', { turnStartEffects: [] }, CAMPAIGN, []);
        expect(applyInfernalWoundBleedTurnStart).toHaveBeenCalledWith('Wild_Sage_Druid', CAMPAIGN);
    });

    it('does not fire without an active creature', async () => {
        await applyTurnStartEffects(null, null, CAMPAIGN, []);
        expect(applyInfernalWoundBleedTurnStart).not.toHaveBeenCalled();
    });
});
