// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

function makeAction(overrides = {}) {
    return {
        name: 'Stealth Attack',
        automation: {
            type: 'stealth_attack',
            cost: '1d6',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('stealthAttackHandler', () => {
    describe('handle', () => {
        it('returns modal with correct payload when sneak attack dice cover the cost', async () => {
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

        it('allows cost equal to available dice', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 2 }] },
            });

            const result = await handle(
                makeAction({ automation: { cost: '2d6' } }),
                stats,
                'test-campaign'
            );

            expect(result.type).toBe('modal');
            expect(result.payload.costD6).toBe(2);
            expect(result.payload.availableDice).toBe(2);
        });

        it('defaults cost to 1d6 when automation cost is malformed or empty', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 2 }] },
            });

            const result = await handle(
                makeAction({ automation: { cost: '2d8' } }),
                stats,
                'test-campaign'
            );

            expect(result.type).toBe('modal');
            expect(result.payload.costD6).toBe(1);
        });

        it('returns error popup when sneak attack dice are insufficient', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 1 }] },
            });

            const result = await handle(
                makeAction({ automation: { cost: '2d6' } }),
                stats,
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Stealth Attack');
            expect(result.payload.description).toContain('Not enough Sneak Attack dice');
            expect(result.payload.description).toContain('Need 2d6, have 1d6');
            expect(result.payload.automation).toEqual({ cost: '2d6' });
        });

        it('returns error popup when sneak attack dice are zero', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 0 }] },
            });

            const result = await handle(makeAction(), stats, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Need 1d6, have 0d6');
        });
    });

    describe('applyStealthAttack', () => {
        it('returns error popup when sneak attack dice are insufficient', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 1 }] },
            });

            const result = await applyStealthAttack(makeAction(), stats, 'test-campaign', 2);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Stealth Attack');
            expect(result.payload.description).toContain('Not enough Sneak Attack dice');
            expect(result.payload.description).toContain('Need 2d6, have 1d6');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('returns success popup and sets runtime value on sufficient dice', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 3 }] },
            });

            const result = await applyStealthAttack(makeAction(), stats, 'test-campaign', 2);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Stealth Attack');
            expect(result.payload.automationType).toBe('stealth_attack');
            expect(result.payload.description).toContain('Stealth Attack active');
            expect(result.payload.description).toContain('2d6 Sneak Attack dice');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'stealthAttackCost',
                2,
                'test-campaign',
                true
            );
        });

        it('logs an ability_use entry on success', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 3 }] },
            });

            await applyStealthAttack(makeAction(), stats, 'test-campaign', 1);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestRogue',
                abilityName: 'Stealth Attack',
            }));
        });

        it('does not call setRuntimeValue or addEntry on failure', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 1 }] },
            });

            await applyStealthAttack(makeAction(), stats, 'test-campaign', 5);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('swallows addEntry errors without throwing', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 3 }] },
            });

            addEntry.mockRejectedValue(new Error('network error'));

            const result = await applyStealthAttack(makeAction(), stats, 'test-campaign', 1);

            expect(result.type).toBe('popup');
        });
    });
});
