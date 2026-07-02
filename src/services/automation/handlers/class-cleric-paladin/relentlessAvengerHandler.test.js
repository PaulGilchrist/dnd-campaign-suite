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
    describe('logging', () => {
        it('logs ability use when no combat context', async () => {
            getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestPaladin',
                abilityName: 'Relentless Avenger',
                description: 'Relentless Avenger used',
            }));
        });

        it('logs ability use with target name when target exists', async () => {
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

        it('does not call getTargetFromAttacker when combat context is null', async () => {
            getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(getTargetFromAttacker).not.toHaveBeenCalled();
        });
    });

    describe('no target selected', () => {
        it('returns popup noting no target when combat context exists but no target found', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Relentless Avenger');
            expect(result.payload.automationType).toBe('relentless_avenger');
            expect(result.payload.description).toContain('No target selected');
        });

        it('returns popup noting no target when combat context is null', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No target selected');
        });
    });

    describe('with target', () => {
        it('adds target effect to runtime state', async () => {
            getCombatContext.mockResolvedValue({});
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
            expect(result.payload.description).toContain("Goblin's Speed is reduced to 0");
        });

        it('adds speed_zero condition to creature in combat context', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', conditions: [] }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                ['speed_zero'],
                CAMPAIGN_NAME
            );
        });

        it('skips adding speed_zero when creature already has it', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', conditions: [{ key: 'speed_zero' }] }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue(['speed_zero']);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            // targetEffects should still be set; activeConditions should not be modified
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

        it('uses custom duration from automation config', async () => {
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

        it('defaults duration when automation duration is missing', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
            getRuntimeValue.mockReturnValue([]);

            await handle(
                makeAction({ automation: {} }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                null
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ duration: 'until_end_of_current_turn' }),
                ]),
                CAMPAIGN_NAME
            );
        });

        it('returns popup with correct payload fields and description', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
            getRuntimeValue.mockReturnValue([]);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Relentless Avenger');
            expect(result.payload.automationType).toBe('relentless_avenger');
            expect(result.payload.description).toContain("Orc's Speed is reduced to 0");
            expect(result.payload.description).toContain('half your Speed');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('does not add condition when combat context is null', async () => {
            getCombatContext.mockResolvedValue(null);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(conditionCalls.length).toBe(0);
        });

        it('does not add condition when creature not found in combat context', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'OtherCreature', conditions: [] }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'OtherCreature' });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(conditionCalls.length).toBe(1);
            expect(conditionCalls[0][1]).toBe('activeConditions');
            expect(conditionCalls[0][2]).toContain('speed_zero');
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
