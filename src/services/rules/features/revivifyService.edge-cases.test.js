import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
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

describe('triggerRevivify - edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('event dispatch', () => {
        it('dispatches combat-summary-updated event on success', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            const eventHandler = vi.fn();
            window.addEventListener('combat-summary-updated', eventHandler);

            await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );

            expect(eventHandler).toHaveBeenCalled();

            window.removeEventListener('combat-summary-updated', eventHandler);
        });
    });

    describe('error handling', () => {
        it('logs console.error when addEntry rejects but still returns success', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
            });
            vi.mocked(addEntry).mockReturnValue(Promise.reject(new Error('DB error')));

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats('Cleric'),
                'test-campaign',
                'Ally',
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[revivify] Error logging heal:',
                expect.any(Error),
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

            consoleErrorSpy.mockRestore();
        });
    });

    describe('edge cases', () => {
        it('handles target creature with no maxHp field', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Unknown', currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            const result = await triggerRevivify(
                makeSpell('Revivify'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Unknown',
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'heal',
                    name: 'Revivify',
                    targetName: 'Unknown',
                    finalHeal: 1,
                    total: 1,
                    formula: '1 HP (revived)',
                    rolls: [],
                    rawTotal: 1,
                },
            });
        });

        it('refuses a monster with no currentHp field (cannot confirm dead)', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Unknown', maxHp: 50, type: 'monster' },
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
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses target not found in combat summary (no material consumed)', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Other', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
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
            expect(addEntry).not.toHaveBeenCalled();
        });
    });
});
