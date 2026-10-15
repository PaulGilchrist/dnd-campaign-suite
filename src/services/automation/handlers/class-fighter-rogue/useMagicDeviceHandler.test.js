// @maintained-by-ai
// Use Magic Device (CLA-374, Rogue Thief 2024): passive toggle handler — owns
// activation/deactivation of the 'use_magic_device' buff on activeBuffs, the
// popup + campaign-log composition (full-string pins below are canonical for
// THIS handler's copy), write-before-log ordering, and input guards. Upstream
// coverage lives elsewhere: automationCollector (categorization),
// automationService.isInteractiveAutomation, automationInfoBuilder defaults,
// and turnStartEffects each have their own suites. Deterministic over mocked
// runtime/log boundaries — pin stable contract, update only if the rules change.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './useMagicDeviceHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { addEntry } = await import('../../../../services/ui/logService.js');

function makeAction(overrides = {}) {
    return {
        name: 'Use Magic Device',
        automation: {
            type: 'use_magic_device',
            attunementLimit: 4,
            chargeReroll: '1d6',
            chargeRerollSuccess: 6,
            scrollAbility: 'INT',
            scrollCheckDC: '10 + spell_level',
            scrollDisintegratesOnFail: true,
            casting_time: 'passive',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestRogue',
        level: 13,
        ...overrides,
    };
}

function makeGetRuntime(activeBuffs) {
    return vi.fn((_, key) =>
        key === 'activeBuffs' ? activeBuffs : undefined
    );
}

// Canonical popup/log copy owned by this handler (full-string pins).
const ACTIVATE_POPUP =
    'Use Magic Device activated. Attune to up to 4 magic items. Charges: roll 1d6, on 6 use without expending. Scrolls: Intelligence as spellcasting ability. Cantrips/Level 1 cast reliably. Higher levels: Arcana check DC 10 + spell level; on fail, scroll disintegrates.';
const DEACTIVATE_POPUP =
    'Use Magic Device ended. Attunement limit returns to normal.';
const ACTIVATE_LOG =
    'TestRogue activates Use Magic Device: attune up to 4 magic items; charges reroll 1d6 on 6; scrolls cast with INT (Arcana DC 10 + spell level, disintegrates on fail). Charges/scroll clauses GM-adjudicated.';
const DEACTIVATE_LOG =
    'TestRogue deactivates Use Magic Device. Attunement limit returns to normal.';

describe('useMagicDeviceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('activation', () => {
        it('toggles on when not already active, writes exact buff, and returns info popup', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime([]));
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Use Magic Device');
            expect(result.payload.automationType).toBe('use_magic_device');
            expect(result.payload.description).toBe(ACTIVATE_POPUP);
            expect(result.payload.automation).toEqual(action.automation);

            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                [{
                    name: 'Use Magic Device',
                    effect: 'use_magic_device',
                    duration: '1_minute',
                    hasAutomation: true,
                }],
                'test-campaign'
            );
        });
    });

    describe('deactivation', () => {
        it('toggles off when already active, writes emptied list, and returns info popup', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime([
                { name: 'Use Magic Device', effect: 'use_magic_device' },
            ]));
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Use Magic Device');
            expect(result.payload.automationType).toBe('use_magic_device');
            expect(result.payload.description).toBe(DEACTIVATE_POPUP);
            expect(result.payload.automation).toEqual(action.automation);

            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                [],
                'test-campaign'
            );
        });
    });

    describe('custom parameters', () => {
        it('interpolates custom duration, attunementLimit, chargeReroll, and chargeRerollSuccess', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime([]));

            const result = await handle(
                makeAction({
                    automation: {
                        duration: '10_minutes',
                        attunementLimit: 6,
                        chargeReroll: '1d8',
                        chargeRerollSuccess: 5,
                    },
                }),
                makePlayerStats(),
                'test-campaign'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                [{
                    name: 'Use Magic Device',
                    effect: 'use_magic_device',
                    duration: '10_minutes',
                    hasAutomation: true,
                }],
                'test-campaign'
            );
            // Popup interpolates the limit and success threshold; its
            // "roll 1d6" wording is hardcoded in the handler's composition.
            expect(result.payload.description).toContain('6 magic items');
            expect(result.payload.description).toContain('roll 1d6, on 5 use without expending');
            // Log interpolates all three config values.
            const [, entry] = addEntry.mock.calls[0];
            expect(entry.description).toContain('attune up to 6 magic items');
            expect(entry.description).toContain('charges reroll 1d8 on 5');
        });
    });

    describe('buff preservation', () => {
        it('preserves other buffs when activating (append order)', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime([
                { name: 'Other Buff', effect: 'other' },
            ]));

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                [
                    { name: 'Other Buff', effect: 'other' },
                    { name: 'Use Magic Device', effect: 'use_magic_device', duration: '1_minute', hasAutomation: true },
                ],
                'test-campaign'
            );
        });

        it('removes only this buff, preserving order, when deactivating', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime([
                { name: 'Buff A', effect: 'buff_a' },
                { name: 'Use Magic Device', effect: 'use_magic_device' },
                { name: 'Buff B', effect: 'buff_b' },
            ]));

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            const callArgs = setRuntimeValue.mock.calls[0];
            const buffs = callArgs[2];
            expect(buffs.map(b => b.name)).toEqual(['Buff A', 'Buff B']);
        });
    });

    describe('campaign log (CLA-374)', () => {
        it('logs an ability_use entry on activation with full clause detail', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime([]));

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(addEntry).toHaveBeenCalledTimes(1);
            const [campaign, entry] = addEntry.mock.calls[0];
            expect(campaign).toBe('test-campaign');
            expect(entry.type).toBe('ability_use');
            expect(entry.characterName).toBe('TestRogue');
            expect(entry.abilityName).toBe('Use Magic Device');
            expect(entry.description).toBe(ACTIVATE_LOG);
            expect(typeof entry.timestamp).toBe('number');
        });

        it('logs an ability_use entry on deactivation', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime([
                { name: 'Use Magic Device', effect: 'use_magic_device' },
            ]));

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(addEntry).toHaveBeenCalledTimes(1);
            const [, entry] = addEntry.mock.calls[0];
            expect(entry.type).toBe('ability_use');
            expect(entry.description).toBe(DEACTIVATE_LOG);
        });

        it('awaits the buff write before returning (state lands before popup)', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime([]));

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            const writeIdx = setRuntimeValue.mock.invocationCallOrder[0];
            const logIdx = addEntry.mock.invocationCallOrder[0];
            expect(writeIdx).toBeLessThan(logIdx);
        });
    });

    describe('edge cases', () => {
        it('treats null/undefined/non-array activeBuffs as empty array', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Use Magic Device' }),
                ]),
                'test-campaign'
            );
        });

        it('uses default values and an empty automation echo when automation is missing', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime([]));

            const result = await handle(
                { name: 'Use Magic Device' },
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.automationType).toBeUndefined();
            expect(result.payload.automation).toEqual({});
            expect(result.payload.description).toBe(ACTIVATE_POPUP);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_minute' }),
                ]),
                'test-campaign'
            );
        });
    });
});
