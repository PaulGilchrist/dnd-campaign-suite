// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// CLA-138: confirm ARMS the latch at usesMax (never decrements at arm — arm-0 +
// cast-auth->0 was a dead free-cast). The spell row consumes the latch and honors
// the runtime no-Concentration choice stamped here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle, confirmFeyReinforcement } from './feyReinforcementsHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve({})),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

const campaignName = 'test-campaign';
const playerName = 'TestCharacter';

function makeAction(overrides = {}) {
    return {
        name: 'Fey Reinforcements',
        description: 'Cast Summon Fey without Material component.',
        automation: {
            type: 'fey_reinforcements',
            spell: 'Summon Fey',
            usesMax: 1,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        ...overrides,
    };
}

function mockFreeCastCount(value) {
    getRuntimeValue.mockImplementation((_name, key, _campaign) => {
        if (key.includes('_freeCastCount')) return value;
        return null;
    });
}

// ── handle ────────────────────────────────────────────────────────

describe('feyReinforcementsHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handle', () => {
        it('returns modal when free casts are available', async () => {
            mockFreeCastCount(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('feyReinforcements');
            expect(result.payload.action).toEqual(expect.objectContaining({ name: 'Fey Reinforcements' }));
            expect(result.payload.playerStats).toEqual(expect.objectContaining({ name: playerName }));
            expect(result.payload.campaignName).toBe(campaignName);
            expect(result.payload.noConcentrationOption).toBe(true);
        });

        it('returns popup when no free casts remain', async () => {
            mockFreeCastCount(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fey Reinforcements');
            expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('falls back to usesMax when runtime value is null', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
        });

        it('uses feature name from action.name for the runtime key', async () => {
            mockFreeCastCount(1);
            const action = makeAction({ name: 'Custom Fey Power' });

            await handle(action, makePlayerStats(), campaignName);

            expect(getRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Custom_Fey_Power_freeCastCount',
                campaignName
            );
        });
    });

    // ── confirmFeyReinforcement ────────────────────────────────────

    describe('confirmFeyReinforcement', () => {
        it('arms the latch at usesMax (CLA-138: never 0) with noConcentration=false', async () => {
            mockFreeCastCount(1);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), campaignName, false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Fey_Reinforcements_freeCastCount',
                1,
                campaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fey Reinforcements');
            expect(result.payload.description).toContain('free cast armed');
            expect(result.payload.description).toContain('no spell slot will be consumed');
            expect(result.payload.description).not.toContain('Does not require Concentration');
            expect(result.payload.description).not.toContain('Duration: 1 minute');
            expect(result.payload.automation.noConcentration).toBeUndefined();
            expect(result.payload.automation.type).toBe('fey_reinforcements');
            expect(result.payload.automation.spell).toBe('Summon Fey');
        });

        it('stamps the runtime no-Concentration choice true when checked (CLA-138)', async () => {
            mockFreeCastCount(1);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), campaignName, true);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Fey_Reinforcements_freeCastCount',
                1,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Fey_Reinforcements_noConcentration',
                true,
                campaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Concentration skipped');
            expect(result.payload.description).toContain('duration 1 minute');
        });

        it('stamps the runtime no-Concentration choice false when unchecked', async () => {
            mockFreeCastCount(1);

            await confirmFeyReinforcement(makeAction(), makePlayerStats(), campaignName, false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Fey_Reinforcements_noConcentration',
                false,
                campaignName
            );
        });

        it('logs the arm as an ability_use entry (automation logging convention)', async () => {
            mockFreeCastCount(1);

            await confirmFeyReinforcement(makeAction(), makePlayerStats(), campaignName, true);

            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Fey Reinforcements',
                    spellName: 'Summon Fey',
                })
            );
            const note = addEntry.mock.calls[0][1].note;
            expect(note).toContain('no spell slot');
            expect(note).toContain('Concentration skipped');
        });

        it('returns info popup and writes nothing when no free casts remain', async () => {
            mockFreeCastCount(0);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), campaignName, false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fey Reinforcements');
            expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('uses correct runtime keys derived from custom action name', async () => {
            mockFreeCastCount(1);
            const action = makeAction({ name: 'Custom Fey Power' });

            await confirmFeyReinforcement(action, makePlayerStats(), campaignName, false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Custom_Fey_Power_freeCastCount',
                1,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Custom_Fey_Power_noConcentration',
                false,
                campaignName
            );
        });

        it('uses custom spell name from automation when provided', async () => {
            mockFreeCastCount(1);
            const action = makeAction({ automation: { spell: 'Summon Greater Fey', usesMax: 2 } });

            const result = await confirmFeyReinforcement(action, makePlayerStats(), campaignName, false);

            expect(result.payload.description).toContain('Summon Greater Fey free cast armed');
            expect(result.payload.automation.spell).toBe('Summon Greater Fey');
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, '_Fey_Reinforcements_freeCastCount', 2, campaignName);
        });

        it('re-arm while armed keeps the latch at usesMax (never decrements at arm)', async () => {
            mockFreeCastCount(1);

            await confirmFeyReinforcement(makeAction(), makePlayerStats(), campaignName, false);
            await confirmFeyReinforcement(makeAction(), makePlayerStats(), campaignName, false);

            const latchWrites = setRuntimeValue.mock.calls.filter(c => String(c[1]).endsWith('_freeCastCount'));
            expect(latchWrites.length).toBe(2);
            latchWrites.forEach(call => expect(call[2]).toBe(1));
        });
    });
});
