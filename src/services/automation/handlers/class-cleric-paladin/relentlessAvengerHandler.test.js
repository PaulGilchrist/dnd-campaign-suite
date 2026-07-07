// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './relentlessAvengerHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../../rules/combat/damageUtils.js');

const CAMPAIGN_NAME = 'test-campaign';

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestPaladin',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Relentless Avenger',
        automation: {
            type: 'relentless_avenger',
            duration: 'until_end_of_current_turn',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('relentlessAvengerHandler', () => {
    describe('no target', () => {
        it('logs ability use and returns popup when no target is available', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestPaladin',
                abilityName: 'Relentless Avenger',
            }));
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Relentless Avenger');
            expect(result.payload.automationType).toBe('relentless_avenger');
            expect(result.payload.description).toContain('No target selected');
        });
    });

    describe('with target', () => {
        it('logs ability use with target name', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestPaladin',
                abilityName: 'Relentless Avenger',
                description: 'Relentless Avenger used against Goblin',
            }));
        });

        it('applies target effects and condition, then returns popup', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', conditions: [] }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue([]);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'Relentless Avenger',
                        option: 'Relentless Avenger',
                        effect: 'speed_zero',
                        value: null,
                        duration: 'until_end_of_current_turn',
                    }),
                ]),
                CAMPAIGN_NAME
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                ['speed_zero'],
                CAMPAIGN_NAME
            );
            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Relentless Avenger');
            expect(result.payload.automationType).toBe('relentless_avenger');
            expect(result.payload.description).toContain("Goblin's Speed is reduced to 0");
            expect(result.payload.description).toContain('half your Speed');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('skips activeConditions when creature already has speed_zero', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', conditions: [{ key: 'speed_zero' }] }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue(['speed_zero']);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(targetEffectCalls.length).toBe(1);
            expect(conditionCalls.length).toBe(0);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Goblin's Speed is reduced to 0");
        });

        it('uses custom duration when provided', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue([]);

            await handle(
                makeAction({ automation: { duration: '1_round' } }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                null
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_round' }),
                ]),
                CAMPAIGN_NAME
            );
        });

        it('appends to existing target effects', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue([
                { target: 'PreviousTarget', effect: 'blinded' },
            ]);

            await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ target: 'PreviousTarget', effect: 'blinded' }),
                    expect.objectContaining({ target: 'Goblin', effect: 'speed_zero' }),
                ]),
                CAMPAIGN_NAME
            );
        });
    });
});
