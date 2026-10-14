import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispelSpellsOnTarget, resolveSpellLevel } from './clockworkCavalcadeDispel.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadSpells: vi.fn(),
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

const CAMPAIGN = 'test-campaign';
const TARGET = 'Goblin';

const MOCK_SPELLS = [
    { name: 'Bane', level: 1 },
    { name: 'Bless', level: 1 },
    { name: 'Hold Person', level: 2 },
    { name: 'Fly', level: 3 },
    { name: 'Death Ward', level: 4 },
    { name: 'Wall of Force', level: 5 },
    { name: 'Invisibility', level: 2 },
    { name: 'Mage Armor', level: 1 },
    { name: 'Simulacrum', level: 7 },
    { name: 'Power Word Kill', level: 9 },
];

function baseRuntimeValues() {
    useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return baseEffects();
        if (key === TARGET && prop === 'activeBuffs') return baseBuffs();
        if (key === TARGET && prop === 'activeConditions') return ['charmed', 'poisoned'];
        if (key === TARGET && prop === 'activeConditionMeta') return { charmed: { label: 'Charmed' } };
        return null;
    });
}

function baseEffects() {
    return [
        { target: TARGET, effect: 'charmed', spellName: 'Hold Person', condition: 'charmed' },
        { target: TARGET, effect: 'bless', spellName: 'Bless' },
        { target: TARGET, effect: 'simulacrum', spellName: 'Simulacrum' },
        { target: 'Other', effect: 'shield', spellName: 'Shield' },
    ];
}

function baseBuffs() {
    return [
        { name: 'Mage Armor', duration: '8_hours' },
        { name: 'Death Ward', duration: '8_hours' },
        { name: 'Invisibility', duration: '1_minute' },
        { name: 'Bardic Inspiration', duration: '10_minutes' },
    ];
}

describe('clockworkCavalcadeDispel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadSpells.mockResolvedValue(MOCK_SPELLS);
        baseRuntimeValues();
    });

    describe('resolveSpellLevel', () => {
        it('returns spellLevel value when present', async () => {
            expect(await resolveSpellLevel({ spellLevel: 0 })).toBe(0);
            expect(await resolveSpellLevel({ spellLevel: 4 })).toBe(4);
            expect(loadSpells).not.toHaveBeenCalled();
        });

        it('falls through to name lookup when spellLevel is null or undefined', async () => {
            expect(await resolveSpellLevel({ spellLevel: null, spellName: 'Fly' })).toBe(3);
            expect(await resolveSpellLevel({ spellLevel: undefined, spellName: 'Fly' })).toBe(3);
        });

        it('looks up spell level by spellName and returns null for unknown', async () => {
            expect(await resolveSpellLevel({ spellName: 'Wall of Force' })).toBe(5);
            expect(await resolveSpellLevel({ spellName: 'Not A Spell' })).toBeNull();
        });
    });

    describe('dispelSpellsOnTarget', () => {
        it('removes target effects and buffs of level 6 or lower, keeps higher-level and other-target effects', async () => {
            const result = await dispelSpellsOnTarget(TARGET, CAMPAIGN);

            expect(result.effects.map(te => te.spellName)).toEqual(['Hold Person', 'Bless']);
            expect(result.buffs.map(b => b.name)).toEqual(['Mage Armor', 'Death Ward', 'Invisibility']);
            expect(result.conditions).toEqual(['charmed']);
            const remaining = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
            const remainingForTarget = remaining[2].filter(te => te.target === TARGET);
            expect(remainingForTarget.map(te => te.spellName)).toEqual(['Simulacrum']);
            expect(remaining[2]).toContainEqual(expect.objectContaining({ target: 'Other' }));
            const buffsCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
            expect(buffsCall[2].map(b => b.name)).toEqual(['Bardic Inspiration']);
            const condsCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
            expect(condsCall[2]).toEqual(['poisoned']);
            const metaCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
            expect(metaCall[2]).toEqual({});
        });

        it('keeps high-level and unresolvable effects while removing low-level buffs', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return [
                        { target: TARGET, effect: 'pwk', spellName: 'Power Word Kill' },
                        { target: TARGET, effect: 'heroism', label: 'Heroism' },
                    ];
                }
                if (key === TARGET && prop === 'activeBuffs') {
                    return [{ name: 'Mage Armor' }];
                }
                return [];
            });

            const result = await dispelSpellsOnTarget(TARGET, CAMPAIGN);

            expect(result.effects).toEqual([]);
            expect(result.buffs.map(b => b.name)).toEqual(['Mage Armor']);
            const buffsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
                c => c[1] === 'activeBuffs'
            );
            expect(buffsCall[2]).toEqual([]);
        });

        it('returns a report with the target name', async () => {
            const result = await dispelSpellsOnTarget(TARGET, CAMPAIGN);
            expect(result.target).toBe(TARGET);
        });

        it('does not call setRuntimeValue when no effects are dispelled', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return [
                        { target: TARGET, effect: 'simulacrum', spellName: 'Simulacrum' },
                    ];
                }
                if (key === TARGET && prop === 'activeBuffs') {
                    return [{ name: 'Bardic Inspiration' }];
                }
                return [];
            });

            await dispelSpellsOnTarget(TARGET, CAMPAIGN);

            const effectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
                c => c[1] === 'targetEffects'
            );
            expect(effectsCall).toBeUndefined();
            const buffsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
                c => c[1] === 'activeBuffs'
            );
            expect(buffsCall).toBeUndefined();
        });

        it('handles null targetEffects gracefully', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') return null;
                if (key === TARGET && prop === 'activeBuffs') return [];
                return [];
            });

            const result = await dispelSpellsOnTarget(TARGET, CAMPAIGN);
            expect(result.effects).toEqual([]);
            expect(result.buffs).toEqual([]);
            expect(result.conditions).toEqual([]);
            expect(result.target).toBe(TARGET);
        });

        it('handles null activeBuffs gracefully', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') return [];
                if (key === TARGET && prop === 'activeBuffs') return null;
                return [];
            });

            const result = await dispelSpellsOnTarget(TARGET, CAMPAIGN);
            expect(result.effects).toEqual([]);
            expect(result.buffs).toEqual([]);
            expect(result.conditions).toEqual([]);
        });

        it('handles null activeConditions gracefully', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return [{ target: TARGET, effect: 'bless', spellName: 'Bless' }];
                }
                if (key === TARGET && prop === 'activeBuffs') return [];
                if (key === TARGET && prop === 'activeConditions') return null;
                return {};
            });

            const result = await dispelSpellsOnTarget(TARGET, CAMPAIGN);
            expect(result.effects.map(te => te.spellName)).toEqual(['Bless']);
            expect(result.conditions).toEqual([]);
        });

        it('keeps buffs with no resolvable spell level', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') return [];
                if (key === TARGET && prop === 'activeBuffs') {
                    return [{ name: 'Rage', duration: '1_minute' }];
                }
                return [];
            });

            const result = await dispelSpellsOnTarget(TARGET, CAMPAIGN);
            expect(result.buffs).toEqual([]);
            const buffsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
                c => c[1] === 'activeBuffs'
            );
            expect(buffsCall).toBeUndefined();
        });

        it('removes only matching conditions from the condition list', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return [
                        { target: TARGET, effect: 'charmed', spellName: 'Hold Person', condition: 'charmed' },
                        { target: TARGET, effect: 'frightened', spellName: 'Bane', condition: 'frightened' },
                    ];
                }
                if (key === TARGET && prop === 'activeBuffs') return [];
                if (key === TARGET && prop === 'activeConditions') return ['charmed', 'frightened', 'poisoned'];
                if (key === TARGET && prop === 'activeConditionMeta') return {
                    charmed: { label: 'Charmed' },
                    frightened: { label: 'Frightened' },
                    poisoned: { label: 'Poisoned' },
                };
                return null;
            });

            const result = await dispelSpellsOnTarget(TARGET, CAMPAIGN);
            expect(result.conditions).toEqual(['charmed', 'frightened']);
            const condsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
                c => c[1] === 'activeConditions'
            );
            expect(condsCall[2]).toEqual(['poisoned']);
        });
    });
});
