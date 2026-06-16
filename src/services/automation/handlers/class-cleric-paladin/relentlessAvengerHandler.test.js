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
    describe('combat context', () => {
        it('logs ability use regardless of combat context', async () => {
            getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestPaladin',
                abilityName: 'Relentless Avenger',
                description: 'Relentless Avenger used',
            }));
        });

        it('logs with target name when target exists', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: 'Relentless Avenger used against Goblin',
            }));
        });
    });

    describe('no target', () => {
        it('returns popup when no target from combat context', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No target selected');
        });

        it('returns popup when combat context is null', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });
    });

    describe('with target', () => {
        it('adds target effect to runtime', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue([]);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'Relentless Avenger',
                        option: 'Relentless Avenger',
                        effect: 'speed_zero',
                        duration: 'until_end_of_current_turn',
                    }),
                ]),
                'test-campaign'
            );
            expect(result.payload.description).toContain("Goblin's Speed is reduced to 0");
        });

        it('adds speed_zero condition to creature', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', conditions: [] }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'combatContext',
                expect.objectContaining({
                    creatures: expect.arrayContaining([
                        expect.objectContaining({
                            conditions: expect.arrayContaining([
                                expect.objectContaining({ key: 'speed_zero' }),
                            ]),
                        }),
                    ]),
                }),
                'test-campaign'
            );
        });

        it('skips condition when speed_zero already present', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', conditions: [{ key: 'speed_zero' }] }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            // setRuntimeValue should be called for targetEffects but NOT for combatContext
            // since the condition already exists
            const combatContextCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'combatContext'
            );
            expect(combatContextCalls.length).toBe(0);
        });

        it('uses custom duration from automation', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockReturnValue([]);

            await handle(
                makeAction({ automation: { duration: '1_round' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_round' }),
                ]),
                'test-campaign'
            );
        });

        it('returns popup with correct description', async () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
            getRuntimeValue.mockReturnValue([]);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Relentless Avenger');
            expect(result.payload.automationType).toBe('relentless_avenger');
            expect(result.payload.description).toContain("Orc's Speed is reduced to 0");
            expect(result.payload.description).toContain('half your Speed');
        });
    });
});
