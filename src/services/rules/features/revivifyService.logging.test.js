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
import { addEntry } from '../../ui/logService.js';
import { consumeMaterial } from '../spells/materialComponents.js';

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

describe('triggerRevivify - logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('log entry', () => {
        it('posts an hp_change log entry for successful revival', async () => {
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
                makePlayerStats('Cleric'),
                CAMPAIGN,
                'Ally',
            );

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    type: 'hp_change',
                    targetName: 'Ally',
                    delta: 1,
                    currentHp: 1,
                    maxHp: 30,
                    isHealing: true,
                    sourceName: 'Cleric',
                    note: 'Revivify',
                    timestamp: expect.any(Number),
                }),
            );
        });

        it('includes sourceName from playerStats', async () => {
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
                makePlayerStats('Paladin'),
                CAMPAIGN,
                'Ally',
            );

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({ sourceName: 'Paladin' }),
            );
        });

        it('uses spell name in the note field', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' },
                    ]),
                ),
            });

            await triggerRevivify(
                makeSpell('Raise Dead'),
                {},
                makePlayerStats(),
                CAMPAIGN,
                'Ally',
            );

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({ note: 'Raise Dead' }),
            );
        });

        it('logs delta +1 for a revived dead monster', async () => {
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
                expect.objectContaining({ delta: 1, currentHp: 1, maxHp: 7 }),
            );
        });

        it('refuses an alive monster and logs nothing', async () => {
            vi.mocked(consumeMaterial).mockResolvedValue(true);
            global.fetch.mockResolvedValueOnce({ ok: true,
                json: () => Promise.resolve(
                    mockCombatSummary([
                        { name: 'Goblin', maxHp: 7, currentHp: 2, type: 'monster' },
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
            expect(addEntry).not.toHaveBeenCalled();
            expect(consumeMaterial).not.toHaveBeenCalled();
        });
    });
});
