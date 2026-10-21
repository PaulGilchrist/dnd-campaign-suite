// @maintained-by-ai
// BUG CLA-198 — Inner Radiance recurring Radiant tick at the turn-start seam.
// THIS lane owns, at applyTurnStartEffects level:
//  1. The `inner_radiance_turn_start` consumer dispatches EXACTLY ONE
//     applyAuraDamage call per invocation even when the creature carries
//     multiple turnStartEffects entries (regression: applyAuraDamage sat
//     unconditionally in the loop and ticked once per entry).
//  2. Recurrence: the dispatch consumes no latch at this seam — it ticks
//     again on every later invocation while the entry persists (cited BY
//     auraDamageService.test.js and expirations_applyAuraDamage.test.js).
//  3. Inertness: zero dispatch with foreign entries only or an empty
//     turnStartEffects list (cited BY expirations_additional.test.js and
//     by the #1296 fold trail).
//  4. Caller-side options contract (cited BY applyAuraDamage.test.js):
//     damageValue is playerStats.proficiency (NOT the expression evaluator —
//     pinned by using a proficiency distinct from every mock return),
//     range 10, damageType Radiant, activeKey 'innerRadianceActive', and
//     characters are passed through untouched. The active-gate itself and
//     damage application run INSIDE applyAuraDamage — owned by
//     applyAuraDamage.test.js / auraDamageService.test.js /
//     expirations_applyAuraDamage.test.js; the collector entry shape is
//     owned by automationCollector.turnStartEffects.test.js against disk
//     truth public/data/2024/races.json (Radiant, proficiency_bonus, 10_ft).
// Zero-write / zero-log budget: this lane mutates no runtime store and logs
// nothing itself (extra entries are chosen from zero-write handlers so the
// full-set write budget stays exact; write-side bookkeeping is #1280's).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(() => 5),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
    loadCombatSummary: vi.fn(async () => null),
    setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../automation/handlers/spells/confusionTurnStartHandler.js', () => ({
    handleConfusionTurnStart: vi.fn(async () => null),
}));

vi.mock('./auraDamageService.js', () => ({
    applyAuraDamage: vi.fn(async () => {}),
    applyHolyNimbusDamage: vi.fn(async () => {}),
}));

vi.mock('./toppleCleanup.js', () => ({
    cleanUpToppleConditions: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
    default: { getName: (n) => String(n) },
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: vi.fn(() => Promise.resolve()) },
}));

import { applyTurnStartEffects } from './turnStartEffects.js';
import { applyAuraDamage } from './auraDamageService.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';

// Collector shape per automation/turnStartEffects.js + public/data/2024/races.json.
const INNER_RADIANCE = {
    type: 'inner_radiance_turn_start',
    name: 'Inner Radiance',
    damageExpression: 'proficiency_bonus',
    damageType: 'Radiant',
    range: '10_ft',
};

describe('BUG CLA-198 — Inner Radiance tick in applyTurnStartEffects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        {
            label: 'dispatches once even with extra turnStartEffects entries, damageValue from proficiency 3',
            invocations: 1,
            proficiency: 3,
            // proficiency 3 vs evaluateAutoExpression mock 5 pins the value as
            // playerStats.proficiency, not the expression evaluator. Extras are
            // zero-write handlers so the full-set write budget stays exact.
            turnStartEffects: [INNER_RADIANCE, { type: 'use_magic_device' }, { type: 'mage_hand_legerdemain' }],
        },
        {
            label: 'recurrence — ticks again at every later invocation while the entry persists',
            invocations: 3,
            proficiency: 5,
            turnStartEffects: [INNER_RADIANCE],
        },
    ])('ticks: $label', async ({ invocations, proficiency, turnStartEffects }) => {
        const playerStats = { name: 'AasimarTest', proficiency, turnStartEffects };
        const characters = ['AasimarTest', 'Goblin'];

        for (let i = 0; i < invocations; i++) {
            await applyTurnStartEffects('AasimarTest', playerStats, campaignName, characters);
        }

        expect(applyAuraDamage).toHaveBeenCalledTimes(invocations);
        expect(applyAuraDamage).toHaveBeenCalledWith('AasimarTest', playerStats, campaignName, characters, {
            activeKey: 'innerRadianceActive',
            damageValue: proficiency,
            range: 10,
            damageType: 'Radiant',
        });
        // This seam neither mutates the runtime store nor logs — all of that
        // happens inside applyAuraDamage (#1280 write-side, #1282 consumer).
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it.each([
        { label: 'foreign turnStartEffects entries only', turnStartEffects: [{ type: 'steady_aim_clear', name: 'Steady Aim Clear' }] },
        { label: 'empty turnStartEffects list', turnStartEffects: [] },
    ])('does NOT tick with $label', async ({ turnStartEffects }) => {
        await applyTurnStartEffects(
            'AasimarTest',
            { name: 'AasimarTest', proficiency: 3, turnStartEffects },
            campaignName,
            []
        );

        expect(applyAuraDamage).not.toHaveBeenCalled();
    });
});
