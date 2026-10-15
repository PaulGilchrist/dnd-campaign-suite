// @maintained-by-ai — deterministic unit tests for the pure stealth_attack handler:
// modal/popup payload contracts consumed by StealthAttackModal and the exact-key
// runtime pin ('stealthAttackCost'). No timers, no real I/O (mocked at the boundary).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle, applyStealthAttack } from './stealthAttackHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestRogue',
        level: 1,
        class: {
            class_levels: [
                { level: 1, sneak_attack_num_d6: 2 },
            ],
            ...overrides.class,
        },
        ...overrides,
    };
}

// automation overrides REPLACE the whole automation object (not merged).
function makeAction(overrides = {}) {
    return {
        name: 'Stealth Attack',
        automation: { type: 'stealth_attack', cost: '1d6' },
        ...overrides,
    };
}

describe('stealthAttackHandler', () => {
    describe('handle', () => {
        it('returns modal with default cost when sneak attack dice are sufficient', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 3 }] },
            });
            const action = makeAction();
            const campaignName = 'test-campaign';

            const result = await handle(action, stats, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('stealthAttack');
            expect(result.payload.costD6).toBe(1);
            expect(result.payload.availableDice).toBe(3);
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(stats);
            expect(result.payload.campaignName).toBe(campaignName);
        });

        it('parses custom cost from automation cost field', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 5 }] },
            });

            const result = await handle(
                makeAction({ automation: { cost: '3d6' } }),
                stats,
                'test-campaign'
            );

            expect(result.type).toBe('modal');
            expect(result.payload.costD6).toBe(3);
            expect(result.payload.availableDice).toBe(5);
        });

        it.each([
            ['insufficient dice', 1, '2d6', { cost: '2d6' }],
            ['zero dice (falsy normalization)', 0, '1d6', undefined],
        ])('returns error popup when sneak attack dice are %s', async (_label, availableDice, expectedCostText, automation) => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: availableDice }] },
            });
            const action = makeAction(automation ? { automation } : {});

            const result = await handle(action, stats, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Stealth Attack');
            expect(result.payload.description).toBe(
                `Not enough Sneak Attack dice to use Stealth Attack. Need ${expectedCostText}, have ${availableDice}d6.`
            );
            expect(result.payload.automation).toEqual(action.automation);
        });
    });

    describe('applyStealthAttack', () => {
        it.each([
            ['exact match', 2, 2],
            ['sufficient surplus', 2, 3],
        ])('returns success popup and sets runtime value when dice %s (cost=%d, available=%d)', async (_label, costD6, availableDice) => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: availableDice }] },
            });

            const result = await applyStealthAttack(makeAction(), stats, 'test-campaign', costD6);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Stealth Attack');
            expect(result.payload.automationType).toBe('stealth_attack');
            expect(result.payload.description).toContain('Stealth Attack active');
            expect(result.payload.description).toContain(`${costD6}d6 Sneak Attack dice`);
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'stealthAttackCost',
                costD6,
                'test-campaign',
                true
            );
        });

        it('returns error popup without side effects when dice are insufficient at apply time', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 2 }] },
            });

            const result = await applyStealthAttack(makeAction(), stats, 'test-campaign', 3);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Stealth Attack');
            // apply-time guard text differs from handle()'s guard — pinned in full
            expect(result.payload.description).toBe(
                'Not enough Sneak Attack dice. Need 3d6, have 2d6.'
            );
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('calls addEntry with ability_use log on success', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 3 }] },
            });

            await applyStealthAttack(makeAction(), stats, 'test-campaign', 2);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestRogue',
                abilityName: 'Stealth Attack',
                description: expect.stringContaining('Stealth Attack enabled'),
            });
        });

        describe('log resilience', () => {
            let consoleError;
            beforeEach(() => {
                consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            });
            afterEach(() => {
                consoleError.mockRestore();
            });

            it('still applies stealth attack when the log write rejects', async () => {
                addEntry.mockRejectedValueOnce(new Error('log down'));
                const stats = makePlayerStats({
                    class: { class_levels: [{ level: 1, sneak_attack_num_d6: 3 }] },
                });

                const result = await applyStealthAttack(makeAction(), stats, 'test-campaign', 2);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('Stealth Attack active');
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestRogue',
                    'stealthAttackCost',
                    2,
                    'test-campaign',
                    true
                );
                expect(consoleError).toHaveBeenCalledWith(
                    '[stealthAttackHandler:log-error]',
                    expect.any(Error)
                );
            });
        });
    });
});
