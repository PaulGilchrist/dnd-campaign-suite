import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyBeaconOfHopeEffect } from './beaconOfHopeHandler.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as targetEffectDefs from '../../../combat/conditions/targetEffectDefinitions.js';
import * as targetResolver from '../../common/targetResolver.js';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
    getEffectDefinition: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((r) => parseInt(r.replace(' feet', ''), 10) || 30),
}));

const campaignName = 'TestCampaign';
const casterName = 'Cleric1';

function makePlayerStats(overrides = {}) {
    return {
        name: casterName,
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Beacon of Hope',
        automation: { type: 'beacon_of_hope', ...overrides.automation },
        spell: { range: '30 feet', level: 3, casting_time: '1 action', ...overrides.spell },
        spellSlotLevel: overrides.spellSlotLevel,
    };
}

const baseCombatContext = {
    creatures: [
        { name: 'Goblin', type: 'monster' },
        { name: 'Orc', type: 'monster' },
        { name: casterName, gridX: 5, gridY: 10 },
    ],
    players: [{ name: casterName, gridX: 5, gridY: 10 }],
    placedItems: [],
};

// ─── handle ───

describe('handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('combat context validation', () => {
        it('should return popup when no combat context exists', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No combat context found');
            expect(result.payload.description).toContain('Beacon of Hope');
        });

        it('should return creature targets list when combat context exists', async () => {
            damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
            targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 5, y: 10 } });

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                'main-map',
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('beacon_of_hope_target_selection');
            expect(result.payload.creatureTargets).toEqual(['Goblin', 'Orc', casterName]);
            expect(result.payload.range).toBe('30 feet');
            expect(result.payload.rangeFt).toBe(30);
            expect(result.payload.slotLevel).toBe(3);
            expect(result.payload.attackerPos).toEqual({ x: 5, y: 10 });
        });

        it('should default slotLevel to 3 when no spell info provided', async () => {
            damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
            targetResolver.resolveMapPositions.mockResolvedValue(null);

            const result = await handle(
                { name: 'Beacon of Hope' },
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.slotLevel).toBe(3);
        });

        it('should use spellSlotLevel from action when provided', async () => {
            damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
            targetResolver.resolveMapPositions.mockResolvedValue(null);

            const result = await handle(
                makeAction({ spellSlotLevel: 5 }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.slotLevel).toBe(5);
        });

        it('should use spell.level when spellSlotLevel is not provided', async () => {
            damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
            targetResolver.resolveMapPositions.mockResolvedValue(null);

            const result = await handle(
                makeAction({ spell: { level: 4 } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.slotLevel).toBe(4);
        });

        it('should use auto.range when provided', async () => {
            damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
            targetResolver.resolveMapPositions.mockResolvedValue(null);

            const result = await handle(
                makeAction({ automation: { range: '60 feet' } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.range).toBe('60 feet');
            expect(result.payload.rangeFt).toBe(60);
        });

        it('should pass null attackerPos when no mapName', async () => {
            damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
            targetResolver.resolveMapPositions.mockResolvedValue(null);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.attackerPos).toBeNull();
        });

        it('should pass automation object in payload', async () => {
            damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
            targetResolver.resolveMapPositions.mockResolvedValue(null);

            const result = await handle(
                makeAction({ automation: { type: 'beacon_of_hope', customField: 'value' } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.automation).toEqual({ type: 'beacon_of_hope', customField: 'value' });
        });
    });
});

// ─── applyBeaconOfHopeEffect ───

describe('applyBeaconOfHopeEffect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        targetEffectDefs.getEffectDefinition.mockReturnValue({
            label: 'Beacon of Hope',
        });
    });

    describe('input validation', () => {
        it('should return null when targetNames is null', async () => {
            const result = await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                null,
            );

            expect(result).toBeNull();
        });

        it('should return null when targetNames is undefined', async () => {
            const result = await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                undefined,
            );

            expect(result).toBeNull();
        });

        it('should return null when targetNames is an empty array', async () => {
            const result = await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                [],
            );

            expect(result).toBeNull();
        });
    });

    describe('effect application', () => {
        it('should add beacon_of_hope effect for each valid target', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);

            const result = await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin', 'Orc'],
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('2 of 2 target(s) affected');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        effect: 'beacon_of_hope',
                        caster: casterName,
                        duration: 'concentration',
                    }),
                    expect.objectContaining({
                        target: 'Orc',
                        effect: 'beacon_of_hope',
                        caster: casterName,
                        duration: 'concentration',
                    }),
                ]),
                campaignName,
                true,
            );
        });

        it('should skip targets that already have beacon_of_hope', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'beacon_of_hope', label: 'Beacon of Hope' },
            ]);

            const result = await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin', 'Orc'],
            );

            expect(result.payload.description).toContain('2 of 2 target(s) affected');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ target: 'Goblin', effect: 'beacon_of_hope' }),
                    expect.objectContaining({ target: 'Orc', effect: 'beacon_of_hope' }),
                ]),
                campaignName,
                true,
            );
        });

        it('should use effect definition label from registry', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);
            targetEffectDefs.getEffectDefinition.mockReturnValue({
                label: 'Custom Beacon Label',
            });

            await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin'],
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ label: 'Custom Beacon Label' }),
                ]),
                campaignName,
                true,
            );
        });

        it('should default label to Beacon of Hope when no definition', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);
            targetEffectDefs.getEffectDefinition.mockReturnValue(null);

            await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin'],
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ label: 'Beacon of Hope' }),
                ]),
                campaignName,
                true,
            );
        });

        it('should preserve existing targetEffects entries', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'faerie_fire', label: 'Faerie Fire' },
            ]);

            await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Orc'],
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ effect: 'faerie_fire' }),
                    expect.objectContaining({ effect: 'beacon_of_hope' }),
                ]),
                campaignName,
                true,
            );
        });

        it('should set reasons array on each effect entry', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);

            await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin'],
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        reasons: expect.arrayContaining([
                            expect.objectContaining({
                                name: 'Beacon of Hope',
                                caster: casterName,
                                duration: 'concentration',
                            }),
                        ]),
                    }),
                ]),
                campaignName,
                true,
            );
        });
    });

    describe('logging', () => {
        it('should log a spell entry with full details', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);

            await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin', 'Orc'],
            );

            const { addEntry } = await import('../../../ui/logService.js');
            const spellEntry = addEntry.mock.calls.find(
                ([, entry]) => entry.type === 'spell' && entry.spellName === 'Beacon of Hope',
            );
            expect(spellEntry).toBeTruthy();
            expect(spellEntry[1].characterName).toBe(casterName);
            expect(spellEntry[1].spellName).toBe('Beacon of Hope');
            expect(spellEntry[1].spellLevel).toBe(3);
            expect(spellEntry[1].targets).toEqual(['Goblin', 'Orc']);
            expect(spellEntry[1].description).toContain('casts Beacon of Hope');
            expect(spellEntry[1].description).toContain('Goblin');
            expect(spellEntry[1].description).toContain('WIS saves');
            expect(spellEntry[1].description).toContain('death saves');
            expect(spellEntry[1].description).toContain('maximum HP');
        });

        it('should log a summary entry with creature count', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);

            await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin', 'Orc', 'Troll'],
            );

            const { addEntry } = await import('../../../ui/logService.js');
            const summaryEntry = addEntry.mock.calls.find(
                ([, entry]) =>
                    entry.type === 'spell' &&
                    entry.description &&
                    entry.description.includes('creature(s) affected'),
            );
            expect(summaryEntry).toBeTruthy();
            expect(summaryEntry[1].description).toContain('3 creature(s) affected');
        });

        it('should use action.spell.level for spellLevel in log', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);

            await applyBeaconOfHopeEffect(
                makeAction({ spell: { level: 5 } }),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin'],
            );

            const { addEntry } = await import('../../../ui/logService.js');
            const spellEntry = addEntry.mock.calls.find(
                ([, entry]) => entry.type === 'spell' && entry.spellName === 'Beacon of Hope',
            );
            expect(spellEntry[1].spellLevel).toBe(5);
        });

        it('should default spellLevel to 3 in log when no spell info', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);

            await applyBeaconOfHopeEffect(
                { name: 'Beacon of Hope' },
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin'],
            );

            const { addEntry } = await import('../../../ui/logService.js');
            const spellEntry = addEntry.mock.calls.find(
                ([, entry]) => entry.type === 'spell' && entry.spellName === 'Beacon of Hope',
            );
            expect(spellEntry[1].spellLevel).toBe(3);
        });

        it('should use action.spell.casting_time in log', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);

            await applyBeaconOfHopeEffect(
                makeAction({ spell: { casting_time: '1 bonus action' } }),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin'],
            );

            const { addEntry } = await import('../../../ui/logService.js');
            const spellEntry = addEntry.mock.calls.find(
                ([, entry]) => entry.type === 'spell' && entry.spellName === 'Beacon of Hope',
            );
            expect(spellEntry[1].castingTime).toBe('1 bonus action');
        });

        it('should not log when no new effects were added (all duplicates)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'beacon_of_hope' },
                { target: 'Orc', effect: 'beacon_of_hope' },
            ]);

            await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin', 'Orc'],
            );

            const { addEntry } = await import('../../../ui/logService.js');
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('return value', () => {
        it('should return popup with automation_info type', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);

            const result = await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin'],
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Beacon of Hope');
        });

        it('should report 1 of 1 when single target', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);

            const result = await applyBeaconOfHopeEffect(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
                ['Goblin'],
            );

            expect(result.payload.description).toContain('1 of 1 target(s) affected');
        });
    });
});
