// @maintained-by-ai
/**
 * Lane #864 — saveResultHandlers.js: the per-effect save-result handlers that
 * Initiative.jsx registers as listeners. This lane owns what a handler WRITES,
 * LOGS, and ADVANCES when a save result event arrives: counter bytes, terminal
 * outcomes (petrified / banished / spell-ends), targetEffects filtering with
 * exact resulting arrays, prompt clearing, and exact save_result description
 * bytes. No wall-clock timers exist here — prompts wait indefinitely (turn-based
 * mandate, app rule).
 *
 * Trigger → owner table:
 *   sendResult() service impls (fleshToStoneService, savePromptService)  → their own tests
 *   Save Success/Fail button dispatch in the UI                          → CreatureCard.prompts.test.jsx (#852, defers here at its line 7)
 *   dice roll flows (rollConditionSaveHandler)                           → rollConditionSaveHandler.test.jsx (#847)
 *   concentration roll/maintain/break flows                              → #833–#835 lane
 *   'save-result' event detail production / listener registration        → Initiative.jsx
 *   handler bodies: counter advance, terminal condition+te writes,
 *   prompt clear, exact log payloads                                     → THIS file
 *
 * old→new map (18 → 11 tests):
 *   11 early-return scenarios across 3 handlers → 3 zero-write guard batteries (5 scenarios each)
 *   flesh 3rd-success / 3rd-failure + indigo 3rd-success / 3rd-failure → shared CON-tracker terminal tests ×2 handlers
 *   flesh name-sanitization → folded into mid-save counter test (sanitized keys everywhere)
 *   indigo/violet non-matching-targetEffects tests → folded into exact-array assertions on every targetEffects write
 *   (new) mid-save counter bytes (failures branch, indigo), setCombatSummary clone on every processed path,
 *   flesh prompt NOT cleared mid-progress, full save_result descriptions — none existed before.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createFleshToStoneHandler,
    createPrismaticSprayIndigoHandler,
    createPrismaticSprayVioletHandler,
} from './saveResultHandlers.js';
import * as logService from '../../services/ui/logService.js';
import { clearFleshToStonePrompt } from '../../services/combat/conditions/savePromptService.js';

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({ id: 'log-entry-1' }),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearFleshToStonePrompt: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const NAME = 'Alice the Brave'; // multi-word name exercises key sanitization everywhere
const CASTER = 'Goblin';

const event = (targetName, result, campaignName = CAMPAIGN) => ({
    detail: { campaignName, targetName, result },
});

/** Zero-write honesty: no store writes, no logs, no prompt clears, no summary refresh. */
function expectNothingHappened() {
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(clearFleshToStonePrompt).not.toHaveBeenCalled();
    expect(setCombatSummary).not.toHaveBeenCalled();
}

let setCombatSummary;

/** Configure the runtime-store mock for a 3-save CON tracker (restrained → petrified). */
function setupTracker(tracker, saveDataOverride) {
    setCombatSummary = vi.fn();
    let saveData = { casterName: CASTER, dc: 15, successes: 0, failures: 0, ...saveDataOverride };
    // Counter writes round-trip so consecutive saves see prior progress.
    setRuntimeValue.mockImplementation((key, prop, value) => {
        if (key === 'campaign' && prop === tracker.trackingKey && value) {
            saveData = { ...saveData, ...value };
        }
    });
    getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === tracker.trackingKey) return saveData;
        if (key === NAME && prop === 'activeConditions') return ['restrained'];
        if (key === 'campaign' && prop === 'targetEffects') return [
            { target: NAME, effect: tracker.teEffect, source: CASTER },
            { target: 'Bob', effect: tracker.teEffect, source: CASTER },
        ];
        return null;
    });
    return saveData;
}

// Two structurally identical 3-save CON trackers; only keys, roll types, log bytes,
// and flesh's prompt clearing differ.
const CON_TRACKERS = [
    {
        label: 'flesh-to-stone',
        create: createFleshToStoneHandler,
        trackingKey: `_fleshToStone_${NAME.replace(/\s+/g, '_')}`,
        rollType: 'save-flesh-to-stone',
        teEffect: 'flesh_to_stone',
        clearsPrompt: true,
        midFailDesc: (n) => `${NAME} failed CON save against Flesh to Stone (${n}/3 failures needed).`,
        midSuccessDesc: (n) => `${NAME} succeeded on CON save against Flesh to Stone (${n}/3 successes needed).`,
        doneSuccessDesc: `${NAME} collected 3 successful saves against Flesh to Stone. The spell ends.`,
        doneFailDesc: `${NAME} failed 3 CON saves against Flesh to Stone and is turned to stone (Petrified).`,
    },
    {
        label: 'prismatic-spray-indigo',
        create: createPrismaticSprayIndigoHandler,
        trackingKey: `_prismaticSprayIndigo_${NAME.replace(/\s+/g, '_')}`,
        rollType: 'save-prismatic-spray-indigo',
        teEffect: 'prismatic_spray_indigo',
        clearsPrompt: false,
        midFailDesc: (n) => `${NAME} failed CON save against Prismatic Spray Indigo ray (${n}/3 failures needed).`,
        midSuccessDesc: (n) => `${NAME} succeeded on CON save against Prismatic Spray Indigo ray (${n}/3 successes needed).`,
        doneSuccessDesc: `${NAME} collected 3 successful CON saves against Prismatic Spray (Indigo ray). Restrained ends.`,
        doneFailDesc: `${NAME} failed 3 CON saves against Prismatic Spray (Indigo ray) and is turned to stone (Petrified).`,
    },
];

describe.each(CON_TRACKERS)('$label save-result handler', (tracker) => {
    const combatSummary = { round: 1, creatures: [{ name: NAME, type: 'player' }] };

    beforeEach(() => {
        vi.clearAllMocks();
        setupTracker(tracker);
    });

    it('writes nothing for invalid events (wrong campaign, no summary, no result, unknown creature, no tracking data)', async () => {
        const handler = tracker.create(CAMPAIGN, combatSummary, setCombatSummary);
        await handler(event(NAME, { success: true }, 'other-campaign'));
        await tracker.create(CAMPAIGN, null, setCombatSummary)(event(NAME, { success: true }));
        await handler(event(NAME, undefined));
        await handler(event('Bob', { success: true }));
        getRuntimeValue.mockImplementation(() => null);
        await handler(event(NAME, { success: true }));
        expectNothingHappened();
    });

    it('advances the counter only on non-terminal saves, under the sanitized key', async () => {
        const handler = tracker.create(CAMPAIGN, combatSummary, setCombatSummary);

        await handler(event(NAME, { success: false }));
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign', tracker.trackingKey,
            { casterName: CASTER, dc: 15, successes: 0, failures: 1 }, CAMPAIGN);
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'save_result',
            characterName: CASTER,
            rollType: tracker.rollType,
            targetName: NAME,
            saveDc: 15,
            saveType: 'CON',
            success: false,
            description: tracker.midFailDesc(1),
        }));

        await handler(event(NAME, { success: true }));
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign', tracker.trackingKey,
            { casterName: CASTER, dc: 15, successes: 1, failures: 1 }, CAMPAIGN);
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'save_result',
            success: true,
            description: tracker.midSuccessDesc(1),
        }));

        // Non-terminal saves touch ONLY the counter: no conditions, no targetEffects, no prompt clear.
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(clearFleshToStonePrompt).not.toHaveBeenCalled();
        expect(setCombatSummary).toHaveBeenCalledTimes(2);
        expect(setCombatSummary).toHaveBeenCalledWith(combatSummary);
    });

    it('ends the spell on the 3rd success: conditions cleared, tracking nulled, other targets preserved', async () => {
        setupTracker(tracker, { successes: 2 });
        const handler = tracker.create(CAMPAIGN, combatSummary, setCombatSummary);

        await handler(event(NAME, { success: true }));

        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, NAME, 'activeConditions', [], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects',
            [{ target: 'Bob', effect: tracker.teEffect, source: CASTER }], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(3, 'campaign', tracker.trackingKey, null, CAMPAIGN);
        if (tracker.clearsPrompt) {
            expect(clearFleshToStonePrompt).toHaveBeenCalledWith(CAMPAIGN, NAME);
        } else {
            expect(clearFleshToStonePrompt).not.toHaveBeenCalled();
        }
        expect(logService.addEntry).toHaveBeenCalledTimes(2);
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'save_result',
            rollType: tracker.rollType,
            targetName: NAME,
            saveType: 'CON',
            success: true,
            description: tracker.doneSuccessDesc,
        }));
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: NAME,
            condition: 'Restrained',
        }));
        expect(setCombatSummary).toHaveBeenCalledWith(combatSummary);
    });

    it('petrifies on the 3rd failure: restrained removed, petrified applied, tracking nulled', async () => {
        setupTracker(tracker, { failures: 2 });
        const handler = tracker.create(CAMPAIGN, combatSummary, setCombatSummary);

        await handler(event(NAME, { success: false }));

        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, NAME, 'activeConditions', ['petrified'], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects',
            [{ target: 'Bob', effect: tracker.teEffect, source: CASTER }], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(3, 'campaign', tracker.trackingKey, null, CAMPAIGN);
        expect(logService.addEntry).toHaveBeenCalledTimes(3);
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'save_result',
            rollType: tracker.rollType,
            targetName: NAME,
            saveType: 'CON',
            success: false,
            description: tracker.doneFailDesc,
        }));
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: NAME,
            condition: 'Restrained',
        }));
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: NAME,
            condition: 'Petrified',
        }));
        expect(setCombatSummary).toHaveBeenCalledWith(combatSummary);
    });
});

describe('prismatic-spray-violet save-result handler', () => {
    const combatSummary = { round: 1, creatures: [{ name: NAME, type: 'player' }] };
    const trackingKey = `_prismaticSprayViolet_${NAME.replace(/\s+/g, '_')}`;
    const BANISHMENT = {
        effect: 'banishment',
        target: NAME,
        source: CASTER,
        duration: 'Concentration, up to 1 minute',
        permanent: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        setCombatSummary = vi.fn();
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === trackingKey) return { casterName: CASTER, dc: 15 };
            if (key === NAME && prop === 'activeConditions') return ['blinded'];
            if (key === 'campaign' && prop === 'targetEffects') return [
                { target: NAME, effect: 'prismatic_spray_violet', source: CASTER },
                { target: 'Bob', effect: 'prismatic_spray_violet', source: CASTER },
            ];
            return null;
        });
    });

    it('writes nothing for invalid events (wrong campaign, no summary, no result, unknown creature, no tracking data)', async () => {
        const handler = createPrismaticSprayVioletHandler(CAMPAIGN, combatSummary, setCombatSummary);
        await handler(event(NAME, { success: true }, 'other-campaign'));
        await createPrismaticSprayVioletHandler(CAMPAIGN, null, setCombatSummary)(event(NAME, { success: true }));
        await handler(event(NAME, undefined));
        await handler(event('Bob', { success: true }));
        getRuntimeValue.mockImplementation(() => null);
        await handler(event(NAME, { success: true }));
        expectNothingHappened();
    });

    it('ends blindness on a WIS save success: blinded removed, other targets preserved, no banishment', async () => {
        const handler = createPrismaticSprayVioletHandler(CAMPAIGN, combatSummary, setCombatSummary);

        await handler(event(NAME, { success: true }));

        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, NAME, 'activeConditions', [], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects',
            [{ target: 'Bob', effect: 'prismatic_spray_violet', source: CASTER }], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(3, 'campaign', trackingKey, null, CAMPAIGN);
        expect(clearFleshToStonePrompt).not.toHaveBeenCalled();
        expect(logService.addEntry).toHaveBeenCalledTimes(2);
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'save_result',
            rollType: 'save-prismatic-spray-violet',
            targetName: NAME,
            saveDc: 15,
            saveType: 'WIS',
            success: true,
            description: `${NAME} succeeded on WIS save against Prismatic Spray (Violet ray). Blindness ends.`,
        }));
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: NAME,
            condition: 'Blinded',
        }));
        expect(setCombatSummary).toHaveBeenCalledWith(combatSummary);
    });

    it('banishes on a WIS save failure: incapacitated applied, exact banishment effect replaces the ray entry, other targets preserved', async () => {
        const handler = createPrismaticSprayVioletHandler(CAMPAIGN, combatSummary, setCombatSummary);

        await handler(event(NAME, { success: false }));

        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, NAME, 'activeConditions', ['incapacitated'], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects',
            [{ target: 'Bob', effect: 'prismatic_spray_violet', source: CASTER }, BANISHMENT], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(3, 'campaign', trackingKey, null, CAMPAIGN);
        expect(logService.addEntry).toHaveBeenCalledTimes(4);
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'save_result',
            rollType: 'save-prismatic-spray-violet',
            targetName: NAME,
            saveDc: 15,
            saveType: 'WIS',
            success: false,
            description: `${NAME} failed WIS save against Prismatic Spray (Violet ray) and is banished to another plane of existence.`,
        }));
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'condition',
            action: 'removed',
            characterName: NAME,
            condition: 'Blinded',
        }));
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: NAME,
            condition: 'Incapacitated',
        }));
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'ability_use',
            characterName: CASTER,
            abilityName: 'Prismatic Spray (Violet ray)',
        }));
        expect(setCombatSummary).toHaveBeenCalledWith(combatSummary);
    });

    // #871 pin: on save FAILURE the handler swaps this target's ray te for a fresh
    // banishment te. The dedupe must be banishment-identity-exact (effect+target+source):
    // same-caster effects of OTHER classes on this target (hunter's-mark-shaped te) and
    // banishments from OTHER casters / on OTHER targets must survive byte-intact.
    it('#871: failed save removes ONLY the same-caster banishment te — hunter\'s-mark-shaped and other-caster te survive byte-intact', async () => {
        const huntersMark = { target: NAME, effect: 'hunters_mark', source: CASTER, duration: 'concentration' };
        const banishmentOtherCaster = { effect: 'banishment', target: NAME, source: 'OtherCaster', duration: 'Concentration, up to 1 minute', permanent: false };
        const banishmentOtherTarget = { effect: 'banishment', target: 'Bob', source: 'OtherCaster', duration: 'Concentration, up to 1 minute', permanent: false };
        const staleBanishment = { ...BANISHMENT, duration: 'stale duplicate, must be replaced' };

        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === trackingKey) return { casterName: CASTER, dc: 15 };
            if (key === NAME && prop === 'activeConditions') return ['blinded'];
            if (key === 'campaign' && prop === 'targetEffects') return [
                { target: NAME, effect: 'prismatic_spray_violet', source: CASTER },
                { target: 'Bob', effect: 'prismatic_spray_violet', source: CASTER },
                huntersMark,
                banishmentOtherCaster,
                banishmentOtherTarget,
                staleBanishment,
            ];
            return null;
        });

        const handler = createPrismaticSprayVioletHandler(CAMPAIGN, combatSummary, setCombatSummary);
        await handler(event(NAME, { success: false }));

        // Exact-array: filter preserves seed order; only the (NAME, CASTER, 'banishment')
        // triple is removed and the fresh BANISHMENT appended. Hunters-mark survives.
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects', [
            { target: 'Bob', effect: 'prismatic_spray_violet', source: CASTER },
            huntersMark,
            banishmentOtherCaster,
            banishmentOtherTarget,
            BANISHMENT,
        ], CAMPAIGN);
    });

    // #871 cross-guard: multi-caster on the SAME target — save-result for NAME must not
    // strip CASTER's banishment from OTHER targets, nor another caster's te on NAME.
    it('#871 cross-guard: two casters banishing two targets — each save-result touches only its own pair', async () => {
        const secondTarget = 'Bob';
        const otherTrackingKey = `_prismaticSprayViolet_${NAME.replace(/\s+/g, '_')}`;
        const markOnOther = { target: secondTarget, effect: 'hunters_mark', source: CASTER, duration: 'concentration' };
        const banishmentMineOnOther = { effect: 'banishment', target: secondTarget, source: CASTER, duration: 'Concentration, up to 1 minute', permanent: false };
        const banishmentOtherOnName = { effect: 'banishment', target: NAME, source: 'OtherCaster', duration: 'Concentration, up to 1 minute', permanent: false };

        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === otherTrackingKey) return { casterName: CASTER, dc: 15 };
            if (key === NAME && prop === 'activeConditions') return ['blinded'];
            if (key === 'campaign' && prop === 'targetEffects') return [
                { target: NAME, effect: 'prismatic_spray_violet', source: CASTER },
                { target: secondTarget, effect: 'prismatic_spray_violet', source: 'OtherCaster' },
                markOnOther,
                banishmentMineOnOther,
                banishmentOtherOnName,
            ];
            return null;
        });

        const handler = createPrismaticSprayVioletHandler(CAMPAIGN, combatSummary, setCombatSummary);
        await handler(event(NAME, { success: false }));

        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects', [
            { target: secondTarget, effect: 'prismatic_spray_violet', source: 'OtherCaster' },
            markOnOther,
            banishmentMineOnOther,   // my banishment on Bob: untouched (wrong target)
            banishmentOtherOnName,   // OtherCaster's banishment on NAME: untouched (wrong source)
            BANISHMENT,              // fresh te for (NAME, CASTER)
        ], CAMPAIGN);
    });
});
