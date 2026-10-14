import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerForcecage } from './forcecageService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('forcecageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Charisma', toHit: 9 },
        proficiency: 4,
    };

    function callTrigger(spell = { name: 'Forcecage', level: 7 }, metaCtx = {}, stats = playerStats) {
        return triggerForcecage(spell, metaCtx, stats, campaignName, mapName);
    }

    describe('triggerForcecage', () => {
        describe('spell name matching', () => {
            it.each([
                ['non-matching name', { name: 'Fire Bolt', level: 0 }],
                ['partial name', { name: 'Force', level: 0 }],
                ['empty name', { name: '', level: 7 }],
                ['missing name', {}],
            ])('returns null for non-matching spell: %s', async (_label, spell) => {
                const result = await triggerForcecage(spell, {}, playerStats, campaignName, mapName);
                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            });

            it('matches spell name case-insensitively', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerForcecage(
                    { name: 'forcecage', level: 7 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalled();
                expect(result).toEqual({ type: 'popup' });
            });
        });

        describe('slot level resolution', () => {
            it.each([
                ['metaCtx.slotLevel overrides spell.level', { slotLevel: 9 }, { name: 'Forcecage', level: 7 }, 9],
                ['spell.level when metaCtx has no slotLevel', {}, { name: 'Forcecage', level: 8 }, 8],
                ['default level 7 when neither has level', {}, { name: 'Forcecage' }, 7],
                ['default level 7 when metaCtx is null', {}, { name: 'Forcecage', level: 7 }, 7],
            ])('resolves spellSlotLevel: %s', async (_label, metaCtx, spell, expectedLevel) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerForcecage(spell, metaCtx, playerStats, campaignName, mapName);

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: expectedLevel }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('action structure', () => {
            it('builds action with 2024 forcecage automation config and passes spell object', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const spell = { name: 'Forcecage', level: 7, school: 'Evocation', range: '100 feet' };

                await triggerForcecage(spell, {}, playerStats, campaignName, mapName);

                const [action] = executeHandler.mock.calls[0];
                expect(action).toEqual(
                    expect.objectContaining({
                        name: 'Forcecage',
                        automation: expect.objectContaining({
                            type: 'forcecage',
                            saveDc: 'ability',
                            saveAbility: 'CHA',
                            duration: 'Concentration, up to 1 hour',
                            concentration: true,
                            ruleset: '2024',
                            range: '100 feet',
                        }),
                        spell,
                        spellSlotLevel: 7,
                    }),
                );
            });

            it('passes metaCtx (including creature selections) through to handler', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const spell = { name: 'Forcecage', level: 7 };
                const metaCtx = { slotLevel: 7, creatures: ['Goblin', 'Orc'] };

                await triggerForcecage(spell, metaCtx, playerStats, campaignName, mapName);

                const [action] = executeHandler.mock.calls[0];
                expect(action.metaCtx).toEqual({ slotLevel: 7, creatures: ['Goblin', 'Orc'] });
            });
        });

        describe('return value', () => {
            it.each([
                ['success pass-through', { type: 'popup', payload: { type: 'automation_info', name: 'Forcecage', description: 'A prison of force...' } }, { type: 'popup', payload: { type: 'automation_info', name: 'Forcecage', description: 'A prison of force...' } }],
                ['null pass-through', null, null],
                ['error returns null and logs', null, null],
            ])('returns %s', async (_label, mockResult, expected) => {
                const consoleSpy = vi.spyOn(console, 'error');

                if (_label === 'error returns null and logs') {
                    executeHandler.mockRejectedValue(new Error('Handler failed'));
                } else {
                    executeHandler.mockResolvedValue(mockResult);
                }

                const result = await callTrigger();

                expect(result).toEqual(expected);
                if (_label === 'error returns null and logs') {
                    expect(consoleSpy).toHaveBeenCalledWith(
                        '[forcecage] Failed to execute handler:',
                        expect.any(Error),
                    );
                }
                consoleSpy.mockRestore();
            });
        });
    });
});
