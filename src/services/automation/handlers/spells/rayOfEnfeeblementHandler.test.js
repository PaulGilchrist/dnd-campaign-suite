// @maintained-by-ai
/**
 * ray of enfeeblement — SINGLE spells lane on rayOfEnfeeblementHandler.js
 * (197 lines, read fully 2026-10-16). Baseline 41 → trimmed here.
 *
 * LIVE DISPATCH (verified): rules/spells/spellCastService/execution/
 * triggerSpells.js L319 → rayOfEnfeeblementService.js triggerRayOfEnfeeblement
 * (distinct module, own test file) → executeHandler → automation/index.js L601
 * `ray_of_enfeeblem: handleRayOfEnfeeblement` → handle() below.
 *
 * RULES SHAPE — pin what IS (repo's authored interpretation, matches registry):
 *  - Failed CON save → te `ray_of_enfeeble_debuff` with strCheckDisadvantage +
 *    rayOfEnfeebleDamageReduction (-1d8), duration 'concentration', dc stored for
 *    badge-click repeat saves. Registry text targetEffectDefinitions.js L975-982
 *    mirrors this verbatim ("Disadvantage on Strength-based d20 tests and -1d8").
 *    LIVE consumers pinned elsewhere: d20RollComputation.js L65 (reads
 *    te.strCheckDisadvantage), handlePlainDamage.js L78 (reads the te key),
 *    ConditionEffectBadges.jsx L138+L356-357 (badge + dc reroll click),
 *    conditionEffects.js L567-569 (flag projection).
 *  - Successful save → one-shot te `disadvantage_next_attack` (shared multi-
 *    producer channel: registry L31; ray, viciousMockeryHandler,
 *    reactionDebuffHandler, executeActionManeuvers, giantAncestryUtils,
 *    weaponMastery all write it — distinct producers, not dupes; this lane
 *    pins ray's own writes only). Consumed/cleared by attackPostProcessing.js
 *    L346-348; this lane's expiration seam carries expireOnCreatureName=caster
 *    ("until the start of caster's next turn").
 *
 * DEAD-API FLAG — isRayOfEnfeeblementActive L192-197: automation/index.js
 * imports it L265 and re-exports it L633, but grep finds ZERO consumers of
 * that import repo-wide (incl. bracket-string dispatch and barrels). The te
 * lane is consumed directly via the key/flags above, never via this predicate.
 * Same pattern as #1916 isCreatureTrappedInForcecage / isCompelledDuelActive —
 * test block removed; export deletion flagged for owner sign-off.
 *
 * NO-TIMERS audit: failed-save addExpiration passes NO rounds →
 * expirationQueue.js L23 `expiryRounds: rounds ?? Infinity` — concentration
 * latch, never a clock. Old test title "(10 rounds)" was false and is
 * retired. NOTE (comment-only smell, flag for owner): handler L92 still says
 * "1 minute = 10 rounds default" — stale retired-recipe text; behavior is
 * Infinity, like eyebite #1906.
 *
 * abilities-ARRAY inspection (polymorph #prod-bug class): handler never reads
 * playerStats.abilities; savePrompt.js buildSaveDc L15 consumes the ARRAY via
 * getAbilityModifier(playerStats.abilities, ability) and is mocked here —
 * makePlayerStats' [{name:'Intelligence',bonus:4}] array shape matches.
 * No `.CON?.bonus` object-access bug in this module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './rayOfEnfeeblementHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 10),
    createSaveListener: vi.fn(() => ({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
    })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

// ── Imported mocks ─────────────────────────────────────────────

import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
    return {
        name: 'Test Wizard',
        proficiency: 2,
        abilities: [{ name: 'Intelligence', bonus: 4 }],
        ...overrides,
    };
}

// MERGE semantics: automation overrides fold onto the default automation so a
// partial override still carries targetName unless explicitly replaced.
function makeAction(overrides = {}) {
    const { automation, ...rest } = overrides;
    return {
        name: 'Ray of Enfeeblement',
        automation: { targetName: 'Goblin', ...(automation || {}) },
        ...rest,
    };
}

function resolveSave(success) {
    createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success }),
    });
}

function metaWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditionMeta');
}

// ── Tests ──────────────────────────────────────────────────────

describe('rayOfEnfeeblementHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks(); // restores factory defaults (fail-save promise, dc 10, [])
        getCombatSummary.mockReturnValue({ creatures: [] });
    });

    describe('handle — failed save', () => {
        it('returns the failed-save popup — exact payload with own-composition description', async () => {
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Ray of Enfeeblement',
                    targetName: 'Goblin',
                    description: 'Goblin failed the CON save. Goblin has Disadvantage on Strength-based d20 tests and subtracts 1d8 from all damage rolls (Concentration, up to 1 minute). Goblin repeats the save at the end of each turn.',
                    automation: action.automation,
                },
            });
        });

        it('builds the dc from automation+stats and opens the CON save prompt — exact args', async () => {
            const stats = makePlayerStats();
            const action = makeAction();

            await handle(action, stats, 'test-campaign', null);

            expect(buildSaveDc).toHaveBeenCalledWith(action.automation, stats);
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 10,
                dcSuccess: 'none',
                disadvantage: false,
            });
        });

        it('logs the ability use with full cast description', async () => {
            buildSaveDc.mockReturnValue(12);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'Test Wizard',
                abilityName: 'Ray of Enfeeblement',
                description: 'Test Wizard casts Ray of Enfeeblement on Goblin. Goblin must make a CON save (DC 12).',
                promptId: 'test-prompt-id',
            });
        });

        it('writes the exact ray_of_enfeeble_debuff te on a fresh store (dc + slotLevel default 2)', async () => {
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
                {
                    target: 'Goblin',
                    effect: 'ray_of_enfeeble_debuff',
                    source: 'Test Wizard',
                    slotLevel: 2,
                    duration: 'concentration',
                    dc: 10,
                    strCheckDisadvantage: true,
                    rayOfEnfeebleDamageReduction: true,
                },
            ], 'test-campaign');
        });

        it('replaces the same-caster te in place, keeps other casters and unrelated te', async () => {
            const sameCasterEffect = {
                target: 'Goblin',
                effect: 'ray_of_enfeeble_debuff',
                source: 'Test Wizard',
                slotLevel: 2,
                duration: 'concentration',
                strCheckDisadvantage: true,
                rayOfEnfeebleDamageReduction: true,
            };
            const otherEffect = {
                target: 'Goblin',
                effect: 'ray_of_enfeeble_debuff',
                source: 'Other Wizard',
                slotLevel: 2,
                duration: 'concentration',
                strCheckDisadvantage: true,
                rayOfEnfeebleDamageReduction: true,
            };
            getRuntimeValue.mockReturnValue([sameCasterEffect, otherEffect, { target: 'Goblin', effect: 'other' }]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const newEffects = setRuntimeValue.mock.calls[0][2];
            expect(newEffects).toHaveLength(3);
            expect(newEffects[0]).toEqual({
                target: 'Goblin',
                effect: 'ray_of_enfeeble_debuff',
                source: 'Test Wizard',
                slotLevel: 2,
                duration: 'concentration',
                dc: 10,
                strCheckDisadvantage: true,
                rayOfEnfeebleDamageReduction: true,
            });
            expect(newEffects[1]).toBe(otherEffect);
            expect(newEffects[2]).toEqual({ target: 'Goblin', effect: 'other' });
        });

        it('queues a concentration-latched expiration — no rounds passed (expiryRounds Infinity at queue, never a clock)', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'Test Wizard',
                targetName: 'Goblin',
                effects: [{
                    type: 'remove_target_effect',
                    effectKey: 'ray_of_enfeeble_debuff',
                    source: 'Test Wizard',
                }],
                campaignName: 'test-campaign',
            });
        });

        it('merges activeConditionMeta with existing entries and survives a null meta store', async () => {
            buildSaveDc.mockReturnValue(17);
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') return [];
                if (scope === 'Goblin' && key === 'activeConditionMeta') return { poisoned: { dc: 12, ability: 'con' } };
                return [];
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(metaWrites()).toEqual([
                [
                    'Goblin',
                    'activeConditionMeta',
                    {
                        poisoned: { dc: 12, ability: 'con' },
                        ray_of_enfeeble_debuff: { dc: 17, ability: 'con' },
                    },
                    'test-campaign',
                ],
            ]);

            // null meta store: `|| {}` guard yields a fresh map
            vi.resetAllMocks();
            buildSaveDc.mockReturnValue(15);
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'Goblin' && key === 'activeConditionMeta') return null;
                return [];
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(metaWrites()).toEqual([
                ['Goblin', 'activeConditionMeta', { ray_of_enfeeble_debuff: { dc: 15, ability: 'con' } }, 'test-campaign'],
            ]);
        });

        it('logs the condition-applied entry with exact condition/reason/note strings', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'condition',
                action: 'applied',
                characterName: 'Goblin',
                condition: 'Ray of Enfeeblement debuff',
                reason: 'Ray of Enfeeblement (failed save)',
                note: 'Goblin has Disadvantage on Strength-based d20 tests and subtracts 1d8 from all damage rolls (Concentration, up to 1 minute). Target repeats CON save at end of each turn.',
                timestamp: expect.any(Number),
            });
        });

        it('honours automation.slotLevel on the te when upcast', async () => {
            await handle(makeAction({ automation: { slotLevel: 4 } }), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects',
                expect.arrayContaining([expect.objectContaining({ slotLevel: 4 })]),
                'test-campaign');
        });

        it('tracks caster concentration, persists the combatSummary with the resolved dc, and announces the update', async () => {
            const cs = { creatures: [{ name: 'Test Wizard' }] };
            getCombatSummary.mockReturnValue(cs);
            buildSaveDc.mockReturnValue(17);
            let updateEvents = 0;
            const onUpdate = () => { updateEvents++; };
            window.addEventListener('combat-summary-updated', onUpdate);

            try {
                await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

                expect(addConcentration).toHaveBeenCalledWith(cs, 'Test Wizard', 'Ray of Enfeeblement', 17);
                expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'test-campaign');
                expect(updateEvents).toBe(1);
            } finally {
                window.removeEventListener('combat-summary-updated', onUpdate);
            }
        });

        it('skips concentration add and persistence when no combat summary exists', async () => {
            getCombatSummary.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
        });

        it('stores the spell last-attack snapshot for the rollback lane — exact args', async () => {
            buildSaveDc.mockReturnValue(12);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(storeSpellLastAttack).toHaveBeenCalledWith('test-campaign', {
                casterName: 'Test Wizard',
                spellName: 'Ray of Enfeeblement',
                saveType: 'CON',
                saveDc: 12,
                attackScope: 'single',
            });
        });
    });

    describe('handle — successful save', () => {
        it('returns the exact success popup payload — no targetName key is emitted', async () => {
            resolveSave(true);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Ray of Enfeeblement',
                    description: 'Goblin succeeded on the CON save. Goblin has Disadvantage on the next attack roll until the start of Test Wizard\'s next turn.',
                },
            });
        });

        it('logs the save_result entry (2nd addEntry) with exact fields', async () => {
            resolveSave(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenNthCalledWith(2, 'test-campaign', {
                type: 'save_result',
                characterName: 'Test Wizard',
                rollType: 'save-ray-of-enfeeblement',
                targetName: 'Goblin',
                saveDc: 10,
                saveType: 'CON',
                success: true,
                description: 'Goblin succeeded on CON save against Ray of Enfeeblement.',
            });
        });

        it('writes the exact disadvantage_next_attack te — fresh store and null-store guard', async () => {
            resolveSave(true);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
                { target: 'Goblin', source: 'Test Wizard', effect: 'disadvantage_next_attack' },
            ], 'test-campaign');

            vi.resetAllMocks();
            resolveSave(true);
            getRuntimeValue.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
                { target: 'Goblin', source: 'Test Wizard', effect: 'disadvantage_next_attack' },
            ], 'test-campaign');
        });

        it('replaces the same-caster disadvantage te in place, keeps other casters', async () => {
            resolveSave(true);
            const otherEffect = {
                target: 'Goblin',
                source: 'Other Wizard',
                effect: 'disadvantage_next_attack',
            };
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', source: 'Test Wizard', effect: 'disadvantage_next_attack' },
                otherEffect,
            ]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const newEffects = setRuntimeValue.mock.calls[0][2];
            expect(newEffects).toHaveLength(2);
            expect(newEffects[0]).toEqual({
                target: 'Goblin',
                source: 'Test Wizard',
                effect: 'disadvantage_next_attack',
            });
            expect(newEffects[1]).toBe(otherEffect);
        });

        it('queues the one-shot expiration on the caster-turn seam — rounds undefined, expireOnCreatureName=caster', async () => {
            resolveSave(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'Test Wizard',
                targetName: 'Goblin',
                effects: [{
                    type: 'remove_target_effect',
                    effectKey: 'disadvantage_next_attack',
                    source: 'Test Wizard',
                }],
                campaignName: 'test-campaign',
                rounds: undefined,
                expireOnCreatureName: 'Test Wizard',
            });
        });

        it('logs the automation_info applied entry with exact note string', async () => {
            resolveSave(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'automation_info',
                action: 'applied',
                characterName: 'Goblin',
                effect: 'Disadvantage on next attack roll',
                reason: 'Ray of Enfeeblement (successful save)',
                note: 'Goblin has Disadvantage on the next attack roll until the start of Test Wizard\'s next turn.',
                timestamp: expect.any(Number),
            });
        });

        it('success path touches no debuff lane — no ray te, no activeConditionMeta read/write, no concentration', async () => {
            resolveSave(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledTimes(1); // campaign:targetEffects only
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects',
                expect.arrayContaining([expect.objectContaining({ effect: 'disadvantage_next_attack' })]),
                'test-campaign');
            expect(metaWrites()).toHaveLength(0);
            expect(getRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'activeConditionMeta', 'test-campaign');
            expect(addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
        });
    });

    describe('edge cases and error handling', () => {
        it('defaults targetName to Unknown when automation is missing or null', async () => {
            const resultMissing = await handle({ name: 'Ray of Enfeeblement' }, makePlayerStats(), 'test-campaign', null);
            expect(resultMissing.payload.targetName).toBe('Unknown');

            const resultNull = await handle({ name: 'Ray of Enfeeblement', automation: null }, makePlayerStats(), 'test-campaign', null);
            expect(resultNull.payload.targetName).toBe('Unknown');

            expect(createSaveListener).toHaveBeenNthCalledWith(2, 'test-campaign', {
                targetName: 'Unknown',
                saveType: 'CON',
                saveDc: 10,
                dcSuccess: 'none',
                disadvantage: false,
            });
        });

        it('threads a numeric automation.saveDc through prompt, te and popup', async () => {
            buildSaveDc.mockImplementation((auto) => (typeof auto.saveDc === 'number' ? auto.saveDc : 10));

            const result = await handle(makeAction({ automation: { targetName: 'Thug 1', saveDc: 17 } }), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Thug 1',
                saveType: 'CON',
                saveDc: 17,
                dcSuccess: 'none',
                disadvantage: false,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects',
                expect.arrayContaining([expect.objectContaining({ target: 'Thug 1', effect: 'ray_of_enfeeble_debuff', dc: 17 })]),
                'test-campaign');
            expect(result.payload.targetName).toBe('Thug 1');
        });

        it('sets disadvantage on the save prompt from metamagicHeighten', async () => {
            await handle(makeAction({ metaCtx: { metamagicHeighten: true } }), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 10,
                dcSuccess: 'none',
                disadvantage: true,
            });
        });

        it('defaults missing roll/total to 0 on addTargetResult — both lanes', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addTargetResult).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveResult: 'failure',
                roll: 0,
                total: 0,
                conditions: ['ray_of_enfeeble_debuff'],
                appliedDamage: 0,
            });

            vi.resetAllMocks();
            resolveSave(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addTargetResult).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveResult: 'success',
                roll: 0,
                total: 0,
                conditions: [],
                appliedDamage: 0,
            });
        });

        it('failed-save lane survives every addEntry rejection — console.error per site, popup still resolves', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            addEntry.mockImplementation(() => Promise.reject(new Error('log failure')));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledTimes(2); // ability_use + condition
            expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[rayOfEnfeeblement] Error:', expect.any(Error));
            expect(result.type).toBe('popup');
            consoleErrorSpy.mockRestore();
        });

        it('success lane survives every addEntry rejection — three log sites', async () => {
            resolveSave(true);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            addEntry.mockImplementation(() => Promise.reject(new Error('log failure')));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledTimes(3); // ability_use + save_result + automation_info
            expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[rayOfEnfeeblement] Error:', expect.any(Error));
            expect(result.type).toBe('popup');
            consoleErrorSpy.mockRestore();
        });
    });

    // DEAD-API (flag comment, #1916 precedent): isRayOfEnfeeblementActive
    // (handler L192-197) — its former 6-test block removed. index.js imports
    // and re-exports it (L265/L633) but nothing consumes it; debuff liveness
    // is read directly from the te key/flags by d20RollComputation,
    // handlePlainDamage, conditionEffects and the badge. Export deletion is
    // flagged for owner sign-off — nothing here depends on it.
});
