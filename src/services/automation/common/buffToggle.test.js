// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearRuntimeState, setRuntimeValue as setRuntimeProp, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { toggleBuff, getActiveBuffs, isBuffActive } from './buffToggle.js';

// ── Helpers ─────────────────────────────────────────────────────

function resetRuntime() {
    for (const key of getAllStoreKeys()) {
        clearRuntimeState(key);
    }
}

function makeAuto(overrides = {}) {
    return {
        effect: 'sample_effect',
        duration: '1 minute',
        enemies_disadvantage_saves: overrides.enemies_disadvantage_saves || [],
        distance: overrides.distance || '',
        extendedDistance: overrides.extendedDistance || '',
        blocksSpellcasting: overrides.blocksSpellcasting || false,
        flySpeed: overrides.flySpeed || null,
        hover: overrides.hover || false,
        seeInvisibleRange: overrides.seeInvisibleRange || null,
        narrowSpace: !!overrides.narrowSpace,
        casting_time: overrides.casting_time || '',
        resistanceTypes: overrides.resistanceTypes || [],
        acBonus: overrides.acBonus || 0,
        saveBonus: overrides.saveBonus || 0,
        ...overrides,
    };
}

// ── Tests ───────────────────────────────────────────────────────

beforeEach(() => {
    vi.restoreAllMocks();
    resetRuntime();
    vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
    });
});

describe('toggleBuff', () => {
    const campaign = 'TestCampaign';

    describe('activation', () => {
        it('returns isActive=true wasActive=false when buff is not yet active', () => {
            clearRuntimeState('fighter');
            const auto = makeAuto({ effect: '+2 AC', duration: 'concentration' });
            const result = toggleBuff('fighter', 'Shield', auto, campaign);

            expect(result.isActive).toBe(true);
            expect(result.wasActive).toBe(false);
            expect(result.targetName).toBe('fighter');
        });

        it('uses targetName instead of playerName when provided, defaults to playerName for undefined and empty string', () => {
            clearRuntimeState('ally-char');
            const auto = makeAuto({ effect: 'bless' });
            const result = toggleBuff('caster', 'Bless', auto, campaign, 'ally-char');

            expect(result.targetName).toBe('ally-char');
            expect(getActiveBuffs('ally-char', campaign)).toHaveLength(1);
            expect(getActiveBuffs('caster', campaign)).toHaveLength(0);

            clearRuntimeState('rogue');
            const result2 = toggleBuff('rogue', 'Cunning Action', makeAuto({ effect: 'stealth' }), campaign);
            expect(result2.targetName).toBe('rogue');

            clearRuntimeState('bard');
            const result3 = toggleBuff('bard', 'Inspiration', makeAuto({ effect: 'inspire' }), campaign, '');
            expect(result3.targetName).toBe('bard');
        });

        it('stores all buff fields from the auto object with correct key mapping and safe defaults', () => {
            clearRuntimeState('full-buff-char');
            const auto = {
                effect: '+3 to saves',
                duration: '1 hour',
                enemies_disadvantage_saves: ['str', 'dex'],
                distance: '60 ft.',
                extendedDistance: '120 ft.',
                blocksSpellcasting: true,
                flySpeed: 30,
                hover: true,
                seeInvisibleRange: 60,
                narrowSpace: true,
                casting_time: '1 action',
                resistanceTypes: ['fire', 'cold'],
                acBonus: 3,
                saveBonus: 2,
            };
            toggleBuff('full-buff-char', 'Full Buff', auto, campaign);

            const buff = getActiveBuffs('full-buff-char', campaign)[0];
            expect(buff.name).toBe('Full Buff');
            expect(buff.effect).toBe('+3 to saves');
            expect(buff.duration).toBe('1 hour');
            expect(buff.enemiesDisadvantageSaves).toEqual(['str', 'dex']);
            expect(buff.distance).toBe('60 ft.');
            expect(buff.extendedDistance).toBe('120 ft.');
            expect(buff.blocksSpellcasting).toBe(true);
            expect(buff.flySpeed).toBe(30);
            expect(buff.hover).toBe(true);
            expect(buff.seeInvisibleRange).toBe(60);
            expect(buff.narrowSpace).toBe(true);
            expect(buff.castingTime).toBe('1 action');
            expect(buff.resistanceTypes).toEqual(['fire', 'cold']);
            expect(buff.acBonus).toBe(3);
            expect(buff.saveBonus).toBe(2);
        });
    });

    describe('deactivation', () => {
        it('returns isActive=false wasActive=true when toggling off an active buff', () => {
            clearRuntimeState('monk');
            const auto = makeAuto({ effect: 'stunned' });
            toggleBuff('monk', 'Stunning Strike', auto, campaign);
            const result = toggleBuff('monk', 'Stunning Strike', auto, campaign);

            expect(result.isActive).toBe(false);
            expect(result.wasActive).toBe(true);
            expect(result.buffs).toHaveLength(0);
        });

        it('deactivating one buff leaves others intact', () => {
            clearRuntimeState('bard2');
            const auto1 = makeAuto({ effect: 'a' });
            const auto2 = makeAuto({ effect: 'b' });
            toggleBuff('bard2', 'BuffA', auto1, campaign);
            toggleBuff('bard2', 'BuffB', auto2, campaign);

            const result = toggleBuff('bard2', 'BuffA', auto1, campaign);

            expect(result.buffs).toHaveLength(1);
            expect(result.buffs[0].name).toBe('BuffB');
        });

        it('removes only the exact matching buff name, not similarly named ones', () => {
            clearRuntimeState('similar-names');
            const auto1 = makeAuto({ effect: 'a' });
            const auto2 = makeAuto({ effect: 'b' });
            toggleBuff('similar-names', 'Shield', auto1, campaign);
            toggleBuff('similar-names', 'Shield of Faith', auto2, campaign);

            const result = toggleBuff('similar-names', 'Shield', auto1, campaign);

            expect(result.buffs).toHaveLength(1);
            expect(result.buffs[0].name).toBe('Shield of Faith');
        });
    });

    describe('edge cases — corrupted stored state', () => {
        const corruptValues = [
            { label: 'string', value: 'not-an-array' },
            { label: 'null', value: null },
            { label: 'undefined (never set)', value: undefined },
            { label: 'empty string', value: '' },
            { label: 'number', value: 42 },
            { label: 'object', value: { name: 'foo' } },
        ];

        for (const { label, value } of corruptValues) {
            it(`treats ${label} stored value as empty array`, () => {
                const charKey = `corrupt-${label.replace(/\s+/g, '-')}`;
                clearRuntimeState(charKey);
                if (value !== undefined) {
                    setRuntimeProp(charKey, 'activeBuffs', value, campaign);
                }

                const auto = makeAuto({ effect: 'fix' });
                const result = toggleBuff(charKey, 'FixIt', auto, campaign);

                expect(result.buffs).toHaveLength(1);
                expect(result.buffs[0].name).toBe('FixIt');
                expect(result.buffs[0].effect).toBe('fix');
                expect(result.isActive).toBe(true);
            });
        }
    });
});

describe('getActiveBuffs', () => {
    const campaign = 'TestCampaign';

    it('returns the stored buffs array with correct structure', () => {
        clearRuntimeState('buffed-char');
        setRuntimeProp('buffed-char', 'activeBuffs', [
            { name: 'Bless', effect: '+1 saves' },
            { name: 'Haste', effect: '+speed' },
        ], campaign);

        const buffs = getActiveBuffs('buffed-char', campaign);
        expect(buffs).toHaveLength(2);
        expect(buffs[0].name).toBe('Bless');
        expect(buffs[1].name).toBe('Haste');
    });
});

describe('isBuffActive', () => {
    const campaign = 'TestCampaign';

    it('returns true when buff name matches an active buff', () => {
        clearRuntimeState('check-char');
        setRuntimeProp('check-char', 'activeBuffs', [
            { name: 'Bless', effect: '+1' },
        ], campaign);

        expect(isBuffActive('check-char', 'Bless', campaign)).toBe(true);
    });

    it('returns false when buff name does not match any active buff', () => {
        clearRuntimeState('miss-char');
        setRuntimeProp('miss-char', 'activeBuffs', [
            { name: 'Haste', effect: '+speed' },
        ], campaign);

        expect(isBuffActive('miss-char', 'Bless', campaign)).toBe(false);
    });

    it('returns false when no buffs are active', () => {
        clearRuntimeState('none-char');
        expect(isBuffActive('none-char', 'AnyBuff', campaign)).toBe(false);
    });

    it('is case-sensitive for buff name matching', () => {
        clearRuntimeState('case-char');
        setRuntimeProp('case-char', 'activeBuffs', [
            { name: 'bless', effect: '+1' },
        ], campaign);

        expect(isBuffActive('case-char', 'Bless', campaign)).toBe(false);
        expect(isBuffActive('case-char', 'bless', campaign)).toBe(true);
    });

    it('finds the correct buff among many active buffs', () => {
        clearRuntimeState('multi-char');
        setRuntimeProp('multi-char', 'activeBuffs', [
            { name: 'Haste', effect: '+speed' },
            { name: 'Bless', effect: '+1' },
            { name: 'Shield', effect: '+2 AC' },
        ], campaign);

        expect(isBuffActive('multi-char', 'Bless', campaign)).toBe(true);
        expect(isBuffActive('multi-char', 'Shield', campaign)).toBe(true);
        expect(isBuffActive('multi-char', 'Haste', campaign)).toBe(true);
        expect(isBuffActive('multi-char', 'Invisibility', campaign)).toBe(false);
    });
});
