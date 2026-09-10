// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
    setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(),
}));

vi.mock('../../../encounters/encounterToInitiative.js', () => ({
    getMonsterSaveBonuses: vi.fn(),
}));

import { activateWildShape, cleanupWildShape } from './wildShapeCreatureBuilder.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import storage from '../../../ui/storage.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { setTempHp } from '../buffs/tempHpService.js';
import { addEntry } from '../../../ui/logService.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { getMonsterSaveBonuses } from '../../../encounters/encounterToInitiative.js';

const campaignName = 'TestCampaign';

const giantSpider = { index: 'giant-spider', name: 'Giant Spider', challenge_rating: 1, armor_class: 11 };

const druidStats = {
    name: 'Maribelle',
    level: 2,
    class: { major: { name: 'Druid' }, class_levels: [{ level: 2, wild_shape: 2 }] },
};

const moonDruidStats = {
    name: 'Maribelle',
    level: 4,
    class: { major: { name: 'Circle of the Moon' }, class_levels: [{ level: 4, wild_shape: 2 }] },
    abilities: [{ name: 'Wisdom', bonus: 3 }],
};

const level14MoonDruidStats = {
    name: 'Maribelle',
    level: 14,
    class: { major: { name: 'Circle of the Moon' }, class_levels: [{ level: 14, wild_shape: 4 }] },
    abilities: [{ name: 'Wisdom', bonus: 4 }],
};

function mockRuntimeForActivate() {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'targetEffects') return [];
        return undefined;
    });
}

describe('wildShapeCreatureBuilder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntimeForActivate();
        setTempHp.mockImplementation(() => {});
        addEntry.mockResolvedValue(undefined);
        loadMonsters.mockResolvedValue([]);
        getMonsterSaveBonuses.mockReturnValue({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
    });

    describe('activateWildShape', () => {
        it('marks the druid player creature and does not add a beast creature', async () => {
            const cs = { creatures: [{ name: 'Maribelle', type: 'player', initiative: '20' }] };
            getCombatContext.mockResolvedValue(cs);

            const result = await activateWildShape('Maribelle', giantSpider, druidStats, campaignName);

            expect(cs.creatures).toHaveLength(1);
            expect(cs.creatures[0].name).toBe('Maribelle');
            expect(cs.creatures[0].type).toBe('player');
            expect(cs.creatures[0].wildShapeSource).toBe('Maribelle');
            expect(cs.creatures[0].beastIndex).toBe('giant-spider');
            expect(cs.creatures[0].beastName).toBe('Giant Spider');
            expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
                { target: 'Maribelle', source: 'Maribelle', effect: 'wild_shape', beastName: 'Giant Spider' },
            ], campaignName);
            expect(setTempHp).toHaveBeenCalledWith('Maribelle', 2, campaignName);
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Maribelle', 'circleFormsAC', expect.any(Number), campaignName);
            expect(result).toEqual({ name: 'Giant Spider', index: 'giant-spider' });
        });

        it('sets circleFormsAC for Circle of the Moon Druid', async () => {
            const cs = { creatures: [{ name: 'Maribelle', type: 'player', initiative: '20' }] };
            getCombatContext.mockResolvedValue(cs);

            await activateWildShape('Maribelle', giantSpider, moonDruidStats, campaignName);

            expect(setTempHp).toHaveBeenCalledWith('Maribelle', 12, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('Maribelle', 'circleFormsAC', 16, campaignName);
        });

        it('uses beast AC when higher than 13 + wis mod for Circle of the Moon', async () => {
            const wolf = { index: 'wolf', name: 'Wolf', challenge_rating: 1 / 8, armor_class: 18 };
            const cs = { creatures: [{ name: 'Maribelle', type: 'player', initiative: '20' }] };
            getCombatContext.mockResolvedValue(cs);

            await activateWildShape('Maribelle', wolf, moonDruidStats, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith('Maribelle', 'circleFormsAC', 18, campaignName);
        });

        it('sets wildShapeConSaveBonus and saving_throws for Circle of the Moon Druid', async () => {
            const wolf = { index: 'wolf', name: 'Wolf', challenge_rating: 1 / 8, armor_class: 13 };
            const cs = { creatures: [{ name: 'Maribelle', type: 'player', initiative: '20', saveBonuses: { str: 1, dex: 2, con: 0, int: 3, wis: 4, cha: 1 }, saving_throws: { str: { modifier: 2 }, dex: { modifier: 1 }, con: { modifier: 0 }, int: { modifier: 3 }, wis: { modifier: 4 }, cha: { modifier: 1 } } }] };
            getCombatContext.mockResolvedValue(cs);
            loadMonsters.mockResolvedValue([wolf]);
            getMonsterSaveBonuses.mockReturnValue({ str: 2, dex: 1, con: 4, int: 0, wis: 0, cha: 0 });

            await activateWildShape('Maribelle', wolf, moonDruidStats, campaignName);

            expect(cs.creatures[0].wildShapeConSaveBonus).toBe(7);
            expect(cs.creatures[0].saving_throws).toEqual({
                str: { modifier: 2 },
                dex: { modifier: 1 },
                con: { modifier: 7 },
                int: { modifier: 0 },
                wis: { modifier: 0 },
                cha: { modifier: 0 },
            });
        });

        it('does not set wildShapeConSaveBonus for non-Moon Druid', async () => {
            const cs = { creatures: [{ name: 'Maribelle', type: 'player', initiative: '20', saveBonuses: { str: 1, dex: 2, con: 0, int: 3, wis: 4, cha: 1 } }] };
            getCombatContext.mockResolvedValue(cs);

            await activateWildShape('Maribelle', giantSpider, druidStats, campaignName);

            expect(cs.creatures[0].wildShapeConSaveBonus).toBeUndefined();
        });

        it('removes leftover beast creatures from previous versions', async () => {
            const cs = {
                creatures: [
                    { name: 'Giant Spider', type: 'npc', wildShapeSource: 'Maribelle' },
                    { name: 'Maribelle', type: 'player' },
                ],
            };
            getCombatContext.mockResolvedValue(cs);

            await activateWildShape('Maribelle', giantSpider, druidStats, campaignName);

            expect(cs.creatures).toHaveLength(1);
            expect(cs.creatures[0].name).toBe('Maribelle');
            expect(cs.creatures[0].wildShapeSource).toBe('Maribelle');
        });

        it('keeps working when there is no combat summary yet', async () => {
            getCombatContext.mockResolvedValue(null);

            await expect(activateWildShape('Maribelle', giantSpider, druidStats, campaignName)).resolves.toBeDefined();
        });

        it('does not add lunarFormAction for Moon Druid below level 14', async () => {
            const wolf = { index: 'wolf', name: 'Wolf', challenge_rating: 1 / 8, armor_class: 13, actions: [{ name: 'Bite', attack_bonus: 3 }] };
            const cs = { creatures: [{ name: 'Maribelle', type: 'player', initiative: '20' }] };
            getCombatContext.mockResolvedValue(cs);
            loadMonsters.mockResolvedValue([wolf]);

            await activateWildShape('Maribelle', wolf, moonDruidStats, campaignName);

            expect(cs.creatures[0].lunarFormAction).toBeUndefined();
        });

        it('adds lunarFormAction for Moon Druid at level 14', async () => {
            const wolf = { index: 'wolf', name: 'Wolf', challenge_rating: 1 / 8, armor_class: 13, actions: [{ name: 'Bite', attack_bonus: 5 }] };
            const cs = { creatures: [{ name: 'Maribelle', type: 'player', initiative: '20' }] };
            getCombatContext.mockResolvedValue(cs);
            loadMonsters.mockResolvedValue([wolf]);

            await activateWildShape('Maribelle', wolf, level14MoonDruidStats, campaignName);

            expect(cs.creatures[0].lunarFormAction).toEqual({
                name: 'Lunar Form',
                damage_dice_primary: '2d10',
                damage_type_primary: 'Radiant',
                description: 'Once per turn on a hit with a Wild Shape form attack, you can deal an extra 2d10 Radiant damage to the target.',
            });
        });

        it('writes a NEW targetEffects array on every activation so the POST is not skipped (CLA-391)', async () => {
            // Simulate a hydrated runtime store: the store hands back the SAME
            // array reference each read. An in-place push would make the
            // valuesEqual a===b dirty-check skip the POST (playbook 44d).
            const storedEffects = [];
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Maribelle', type: 'player' }] });
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'campaign' && key === 'targetEffects') return storedEffects;
                return undefined;
            });

            await activateWildShape('Maribelle', giantSpider, druidStats, campaignName);

            const teWrite = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teWrite).toBeDefined();
            const written = teWrite[2];
            expect(written).not.toBe(storedEffects);
            expect(written).toEqual([
                { target: 'Maribelle', source: 'Maribelle', effect: 'wild_shape', beastName: 'Giant Spider' },
            ]);
        });

        it('replaces the prior wild_shape te instead of stacking on re-activation', async () => {
            const storedEffects = [
                { target: 'Other', source: 'Other', effect: 'other_effect' },
                { target: 'Maribelle', source: 'Maribelle', effect: 'wild_shape', beastName: 'Rat' },
            ];
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Maribelle', type: 'player' }] });
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'campaign' && key === 'targetEffects') return storedEffects;
                return undefined;
            });

            await activateWildShape('Maribelle', giantSpider, druidStats, campaignName);

            const teWrite = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teWrite[2]).toEqual([
                { target: 'Other', source: 'Other', effect: 'other_effect' },
                { target: 'Maribelle', source: 'Maribelle', effect: 'wild_shape', beastName: 'Giant Spider' },
            ]);
        });

        it('does not add lunarFormAction when no monsters loaded', async () => {
            const cs = { creatures: [{ name: 'Maribelle', type: 'player', initiative: '20' }] };
            getCombatContext.mockResolvedValue(cs);
            loadMonsters.mockResolvedValue([]);

            await activateWildShape('Maribelle', giantSpider, level14MoonDruidStats, campaignName);

            expect(cs.creatures[0].lunarFormAction).toBeUndefined();
        });
    });

    describe('cleanupWildShape', () => {
        it('clears markers from the druid player creature and removes leftover beast cards', () => {
            const cs = {
                creatures: [
                    { name: 'Giant Spider', type: 'npc', wildShapeSource: 'Maribelle' },
                    { name: 'Maribelle', type: 'player', wildShapeSource: 'Maribelle', beastIndex: 'giant-spider', beastName: 'Giant Spider' },
                ],
            };
            getCombatSummary.mockReturnValue(cs);
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'campaign' && key === 'targetEffects') {
                    return [{ target: 'Maribelle', source: 'Maribelle', effect: 'wild_shape', beastName: 'Giant Spider' }];
                }
                if (name === 'Maribelle' && key === 'activeBuffs') {
                    return [{ name: 'Wild Shape', effect: 'shape_shift' }];
                }
                return undefined;
            });

            cleanupWildShape('Maribelle', campaignName);

            expect(cs.creatures).toHaveLength(1);
            expect(cs.creatures[0].name).toBe('Maribelle');
            expect(cs.creatures[0].wildShapeSource).toBeUndefined();
            expect(cs.creatures[0].beastIndex).toBeUndefined();
            expect(cs.creatures[0].beastName).toBeUndefined();
            expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], campaignName, true);
            expect(setRuntimeValue).toHaveBeenCalledWith('Maribelle', 'activeBuffs', [], campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('Maribelle', 'tempHp', 0, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('Maribelle', 'circleFormsAC', null, campaignName);
        });

        it('clears wildShapeConSaveBonus and saving_throws when cleaning up Moon Druid wild shape', () => {
            const cs = {
                creatures: [
                    { name: 'Maribelle', type: 'player', wildShapeSource: 'Maribelle', beastIndex: 'wolf', beastName: 'Wolf', wildShapeConSaveBonus: 7, saveBonuses: { str: 1, dex: 2, con: 0, int: 3, wis: 4, cha: 1 }, saving_throws: { str: { modifier: 2 }, dex: { modifier: 1 }, con: { modifier: 7 }, int: { modifier: 3 }, wis: { modifier: 4 }, cha: { modifier: 1 } } },
                ],
            };
            getCombatSummary.mockReturnValue(cs);
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'campaign' && key === 'targetEffects') {
                    return [{ target: 'Maribelle', source: 'Maribelle', effect: 'wild_shape', beastName: 'Wolf' }];
                }
                if (name === 'Maribelle' && key === 'activeBuffs') {
                    return [{ name: 'Wild Shape', effect: 'shape_shift' }];
                }
                return undefined;
            });

            cleanupWildShape('Maribelle', campaignName);

            expect(cs.creatures[0].wildShapeConSaveBonus).toBeUndefined();
            expect(cs.creatures[0].saving_throws).toBeUndefined();
        });

        it('clears lunarFormAction when cleaning up Moon Druid wild shape', () => {
            const cs = {
                creatures: [
                    { name: 'Maribelle', type: 'player', wildShapeSource: 'Maribelle', beastIndex: 'wolf', beastName: 'Wolf', lunarFormAction: { name: 'Lunar Form', damage_dice_primary: '2d10', damage_type_primary: 'Radiant', description: 'Once per turn on a hit with a Wild Shape form attack, you can deal an extra 2d10 Radiant damage to the target.' } },
                ],
            };
            getCombatSummary.mockReturnValue(cs);
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === 'campaign' && key === 'targetEffects') {
                    return [{ target: 'Maribelle', source: 'Maribelle', effect: 'wild_shape', beastName: 'Wolf' }];
                }
                if (name === 'Maribelle' && key === 'activeBuffs') {
                    return [{ name: 'Wild Shape', effect: 'shape_shift' }];
                }
                return undefined;
            });

            cleanupWildShape('Maribelle', campaignName);

            expect(cs.creatures[0].lunarFormAction).toBeUndefined();
        });
    });
});
