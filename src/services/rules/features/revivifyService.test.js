import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    // PCs are canonical via the runtime store: dead at currentHitPoints 0,
    // hitPoints null so maxHp falls back to the combatSummary entry.
    getRuntimeValue: vi.fn((_name, key) => (key === 'currentHitPoints' ? 0 : null)),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../spells/materialComponents.js', () => ({
    consumeMaterial: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { triggerRevivify } from './revivifyService.js';
import { consumeMaterial } from '../spells/materialComponents.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

// ── Globals ────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

const CAMPAIGN = 'TestCampaign';

function makeSpell(name) {
    return { name };
}

function makePlayerStats(casterName) {
    return { name: casterName || 'Cleric' };
}

// getCombatContext reads data.combatSummary from the change-data endpoint.
function mockCombatSummary(creatures) {
    return { combatSummary: { round: 1, creatures } };
}

// ── Tests ──────────────────────────────────────────────────────

describe('triggerRevivify', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('material component check', () => {
        it('returns popup when diamond material is not available', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(false);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Target', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Target',
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Revivify',
                    automationType: 'revivify',
                    description: 'Revivify requires a diamond worth 300+ GP, which the spell consumes.',
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('calls consumeMaterial with correct diamond item name', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(mockCombatSummary([
                    { name: 'Target', maxHp: 30, currentHp: 0, type: 'player' },
                ])),
            });

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats('Cleric'),
                CAMPAIGN,
                'Target',
            );

            expect(consumeMaterial).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Cleric' }),
                'Diamond (300 gp)',
                CAMPAIGN,
            );
        });
    });

    describe('target resolution', () => {
        it('resolves combat summary via canonical change-data combat context', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockCombatSummary([])),
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Target',
            );
            consoleErrorSpy.mockRestore();

            expect(global.fetch).toHaveBeenCalledWith(
                `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/change-data`,
            );
            expect(result.payload.type).toBe('automation_info');
        });

        it('refuses (does not throw) when the fetch rejects', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockImplementationOnce(() =>
                Promise.reject(new Error('Network error')),
            );

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Target',
            );
            consoleErrorSpy.mockRestore();

            expect(result.payload.type).toBe('automation_info');
            expect(consumeMaterial).not.toHaveBeenCalled();
        });

        it('refuses when combat summary is missing (cannot validate target is dead)', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(null),
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Target',
            );
            consoleErrorSpy.mockRestore();

            expect(result.payload.type).toBe('automation_info');
            expect(consumeMaterial).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses with empty creatures list (target not present)', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(mockCombatSummary([])),
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Target',
            );
            consoleErrorSpy.mockRestore();

            expect(result.payload.type).toBe('automation_info');
            expect(consumeMaterial).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('finds target by name in creatures array', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Goblin', maxHp: 7, currentHp: 0, type: 'monster' },
                        { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' },
                        { name: 'Orc', maxHp: 15, currentHp: 0, type: 'monster' },
                    ]),
                ),
            });

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally',
                'currentHitPoints',
                1,
                CAMPAIGN,
            );
        });
    });

    describe('player vs monster target handling', () => {
        it('sets oldHp to 0 for player targets', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 30, currentHp: 5, type: 'player' },
                    ]),
                ),
            });

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    targetName: 'Ally',
                    delta: 1,
                    currentHp: 1,
                    maxHp: 30,
                    isHealing: true,
                    note: 'Revivify',
                }),
            );
        });

        it('revives a dead monster at 1 HP from combatSummary currentHp', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Goblin', maxHp: 7, currentHp: 0, type: 'monster' },
                    ]),
                ),
            });

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Goblin',
            );

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    targetName: 'Goblin',
                    delta: 1,
                    currentHp: 1,
                    maxHp: 7,
                    isHealing: true,
                }),
            );
        });

        it('refuses an ALIVE monster (no material consumed, no HP write)', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Goblin', maxHp: 7, currentHp: 3, type: 'monster' },
                    ]),
                ),
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Goblin',
            );
            consoleErrorSpy.mockRestore();

            expect(result.payload.type).toBe('automation_info');
            expect(consumeMaterial).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses an ALIVE player (runtime currentHitPoints above 0) — no diamond, no HP write', async () => {
            const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
            vi.mocked(getRuntimeValue).mockImplementation((name, key) => (key === 'currentHitPoints' ? 12 : null));
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 12, currentHp: 1, type: 'player' },
                    ]),
                ),
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );
            consoleErrorSpy.mockRestore();

            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('not dead');
            expect(consumeMaterial).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();

            // clearAllMocks does not reset implementations — restore the dead-PC default.
            vi.mocked(getRuntimeValue).mockImplementation((name, key) => (key === 'currentHitPoints' ? 0 : null));
        });

        it('treats target with no type field as monster', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Unknown', maxHp: 20, currentHp: 0 },
                    ]),
                ),
            });

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Unknown',
            );

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    targetName: 'Unknown',
                    delta: 1,
                    currentHp: 1,
                    maxHp: 20,
                    isHealing: true,
                }),
            );
        });

        it('refuses an ALIVE target with no type field', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Unknown', maxHp: 20, currentHp: 5 },
                    ]),
                ),
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Unknown',
            );
            consoleErrorSpy.mockRestore();

            expect(result.payload.type).toBe('automation_info');
            expect(consumeMaterial).not.toHaveBeenCalled();
        });
    });

    describe('runtime store updates', () => {
        it('sets currentHitPoints to 1 for the target', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally',
                'currentHitPoints',
                1,
                CAMPAIGN,
            );
        });

        it('resets deathSaves to all false', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally',
                'deathSaves',
                [false, false, false],
                CAMPAIGN,
            );
        });

        it('resets deathFailures to all false', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally',
                'deathFailures',
                [false, false, false],
                CAMPAIGN,
            );
        });

        it('sets isDead to 0', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally',
                'isDead',
                0,
                CAMPAIGN,
            );
        });

        it('sets all four runtime values in correct order', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );

            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                1, 'Ally', 'currentHitPoints', 1, CAMPAIGN,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                2, 'Ally', 'deathSaves', [false, false, false], CAMPAIGN,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                3, 'Ally', 'deathFailures', [false, false, false], CAMPAIGN,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                4, 'Ally', 'isDead', 0, CAMPAIGN,
            );
        });
    });

    describe('result structure', () => {
        it('returns correct result structure for player target', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'heal',
                    name: 'Revivify',
                    targetName: 'Ally',
                    finalHeal: 1,
                    total: 1,
                    formula: '1 HP (revived)',
                    rolls: [],
                    rawTotal: 1,
                },
            });
        });

        it('returns correct result structure for dead monster target', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Goblin', maxHp: 7, currentHp: 0, type: 'monster' },
                    ]),
                ),
            });

            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Goblin',
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'heal',
                    name: 'Revivify',
                    targetName: 'Goblin',
                    finalHeal: 1,
                    total: 1,
                    formula: '1 HP (revived)',
                    rolls: [],
                    rawTotal: 1,
                },
            });
        });

        it('includes targetName in result', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'TargetName', maxHp: 50, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'TargetName',
            );

            expect(result.payload.targetName).toBe('TargetName');
        });

        it('includes spell name in result', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Target', maxHp: 50, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            const result = await triggerRevivify(
                makeSpell('CustomSpell'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Target',
            );

            expect(result.payload.name).toBe('CustomSpell');
        });

        it('always sets total and rawTotal to 1', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Target', maxHp: 50, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Target',
            );

            expect(result.payload.total).toBe(1);
            expect(result.payload.rawTotal).toBe(1);
        });

        it('always sets formula to "1 HP (revived)"', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Target', maxHp: 50, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Target',
            );

            expect(result.payload.formula).toBe('1 HP (revived)');
        });
    });
});
