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
        it('returns modal when enough sneak attack dice', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('stealthAttack');
            expect(result.payload.costD6).toBe(1);
            expect(result.payload.availableDice).toBe(2);
            expect(result.payload.action).toEqual(makeAction());
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('parses custom cost from automation', async () => {
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
        });

        it('defaults cost to 1d6', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 2 }] },
            });

            const result = await handle(
                makeAction({ automation: {} }),
                stats,
                'test-campaign'
            );

            expect(result.type).toBe('modal');
            expect(result.payload.costD6).toBe(1);
        });

        it('returns error when not enough sneak attack dice', async () => {
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
            expect(result.payload.description).toContain('Not enough Sneak Attack dice');
            expect(result.payload.description).toContain('Need 2d6, have 1d6');
        });

        it('handles missing class_levels gracefully', async () => {
            const stats = makePlayerStats({
                class: { class_levels: null },
            });

            const result = await handle(makeAction(), stats, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Sneak Attack dice');
        });

        it('handles zero sneak attack dice', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 0 }] },
            });

            const result = await handle(makeAction(), stats, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Need 1d6, have 0d6');
        });

        it('handles undefined sneak_attack_num_d6', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1 }] },
            });

            const result = await handle(makeAction(), stats, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Need 1d6, have 0d6');
        });

        it('costD6 must be <= available dice to return modal', async () => {
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
    });

    describe('applyStealthAttack', () => {
        it('returns error when not enough dice', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 1 }] },
            });

            const result = await applyStealthAttack(makeAction(), stats, 'test-campaign', 2);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Sneak Attack dice');
        });

        it('sets stealthAttackCost runtime value', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 3 }] },
            });

            await applyStealthAttack(makeAction(), stats, 'test-campaign', 2);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'stealthAttackCost',
                2,
                'test-campaign',
                true
            );
        });

        it('logs the ability use', async () => {
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

        it('returns popup with success description', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 3 }] },
            });

            const result = await applyStealthAttack(makeAction(), stats, 'test-campaign', 2);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Stealth Attack');
            expect(result.payload.description).toContain('Stealth Attack active');
            expect(result.payload.description).toContain('2d6 Sneak Attack dice');
        });

        it('includes automationType in payload', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 3 }] },
            });

            const result = await applyStealthAttack(makeAction(), stats, 'test-campaign', 1);

            expect(result.payload.automationType).toBe('stealth_attack');
        });

        it('handles cost equal to available dice', async () => {
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, sneak_attack_num_d6: 3 }] },
            });

            const result = await applyStealthAttack(makeAction(), stats, 'test-campaign', 3);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'stealthAttackCost',
                3,
                'test-campaign',
                true
            );
        });
    });
});
