// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearRuntimeState, setRuntimeValue as setRuntimeProp } from '../../../hooks/runtime/useRuntimeState.js';
import { toggleBuff, getActiveBuffs, isBuffActive } from './buffToggle.js';

// ── Helpers ─────────────────────────────────────────────────────

function resetRuntime() {
    const keys = [...storeKeys];
    for (const k of keys) { clearRuntimeState(k); }
    storeKeys.clear();
    localStorage.clear();
}

function trackKey(k) { storeKeys.add(k); }

const storeKeys = new Set();

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
        it('returns result with isActive true and wasActive false when buff is not yet active', () => {
            trackKey('fighter');
            const auto = makeAuto({ effect: '+2 AC', duration: 'concentration' });
            const result = toggleBuff('fighter', 'Shield', auto, campaign);

            expect(result.isActive).toBe(true);
            expect(result.wasActive).toBe(false);
            expect(result.targetName).toBe('fighter');
        });

        it('stores the buff in runtime state', () => {
            trackKey('paladin');
            const auto = makeAuto({ effect: '+2 AC' });
            toggleBuff('paladin', 'Divine Shield', auto, campaign);

            const buffs = getActiveBuffs('paladin', campaign);
            expect(buffs).toHaveLength(1);
            expect(buffs[0].name).toBe('Divine Shield');
        });

        it('preserves existing buffs when adding a new one', () => {
            trackKey('wizard');
            const auto1 = makeAuto({ effect: 'invisibility' });
            toggleBuff('wizard', 'Invisibility', auto1, campaign);

            const auto2 = makeAuto({ effect: 'haste' });
            const result = toggleBuff('wizard', 'Haste', auto2, campaign);

            expect(result.buffs).toHaveLength(2);
            const names = result.buffs.map(b => b.name);
            expect(names).toContain('Invisibility');
            expect(names).toContain('Haste');
        });

        it('uses targetName when provided instead of playerName', () => {
            trackKey('ally-char');
            const auto = makeAuto({ effect: 'bless' });
            const result = toggleBuff('caster', 'Bless', auto, campaign, 'ally-char');

            expect(result.targetName).toBe('ally-char');
            expect(getActiveBuffs('ally-char', campaign)).toHaveLength(1);
            expect(getActiveBuffs('caster', campaign)).toHaveLength(0);
        });

        it('defaults target to playerName when targetName is undefined', () => {
            trackKey('rogue');
            const auto = makeAuto({ effect: 'stealth' });
            const result = toggleBuff('rogue', 'Cunning Action', auto, campaign);

            expect(result.targetName).toBe('rogue');
        });

        it('defaults target to playerName when targetName is empty string', () => {
            trackKey('bard');
            const auto = makeAuto({ effect: 'inspire' });
            const result = toggleBuff('bard', 'Inspiration', auto, campaign, '');

            expect(result.targetName).toBe('bard');
        });

        it('stores all buff fields from the auto object', () => {
            trackKey('full-buff-char');
            const auto = makeAuto({
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
                sourceCharacter: undefined,
            });
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

        it('sets sourceCharacter to the playerName that triggered the toggle', () => {
            trackKey('cleric');
            const auto = makeAuto({ effect: 'heal' });
            toggleBuff('cleric', 'Cure Wounds', auto, campaign);

            expect(getActiveBuffs('cleric', campaign)[0].sourceCharacter).toBe('cleric');
        });

        it('defaults missing optional fields to safe values', () => {
            trackKey('minimal-char');
            const auto = { effect: 'hex', duration: '1 hour' };
            toggleBuff('minimal-char', 'Hex', auto, campaign);

            const buff = getActiveBuffs('minimal-char', campaign)[0];
            expect(buff.enemiesDisadvantageSaves).toEqual([]);
            expect(buff.distance).toBe('');
            expect(buff.extendedDistance).toBe('');
            expect(buff.blocksSpellcasting).toBe(false);
            expect(buff.flySpeed).toBeNull();
            expect(buff.hover).toBe(false);
            expect(buff.seeInvisibleRange).toBeNull();
            expect(buff.narrowSpace).toBe(false);
            expect(buff.castingTime).toBe('');
            expect(buff.resistanceTypes).toEqual([]);
            expect(buff.acBonus).toBe(0);
            expect(buff.saveBonus).toBe(0);
        });
    });

    describe('deactivation', () => {
        it('returns result with isActive false and wasActive true when buff is toggled off', () => {
            trackKey('monk');
            const auto = makeAuto({ effect: 'stunned' });
            toggleBuff('monk', 'Stunning Strike', auto, campaign);
            const result = toggleBuff('monk', 'Stunning Strike', auto, campaign);

            expect(result.isActive).toBe(false);
            expect(result.wasActive).toBe(true);
            expect(result.buffs).toHaveLength(0);
        });

        it('deactivating one buff leaves others intact', () => {
            trackKey('bard2');
            const auto1 = makeAuto({ effect: 'a' });
            const auto2 = makeAuto({ effect: 'b' });
            toggleBuff('bard2', 'BuffA', auto1, campaign);
            toggleBuff('bard2', 'BuffB', auto2, campaign);

            const result = toggleBuff('bard2', 'BuffA', auto1, campaign);

            expect(result.buffs).toHaveLength(1);
            expect(result.buffs[0].name).toBe('BuffB');
        });

        it('removes only the matching buff name, not similarly named ones', () => {
            trackKey('similar-names');
            const auto1 = makeAuto({ effect: 'a' });
            const auto2 = makeAuto({ effect: 'b' });
            toggleBuff('similar-names', 'Shield', auto1, campaign);
            toggleBuff('similar-names', 'Shield of Faith', auto2, campaign);

            const result = toggleBuff('similar-names', 'Shield', auto1, campaign);

            expect(result.buffs).toHaveLength(1);
            expect(result.buffs[0].name).toBe('Shield of Faith');
        });
    });

    describe('edge cases', () => {
        it('treats non-array stored value as empty array and starts fresh', () => {
            trackKey('broken');
            setRuntimeProp('broken', 'activeBuffs', 'not-an-array', campaign);

            const auto = makeAuto({ effect: 'fix' });
            const result = toggleBuff('broken', 'FixIt', auto, campaign);

            expect(result.buffs).toHaveLength(1);
            expect(result.buffs[0].name).toBe('FixIt');
            expect(result.buffs[0].effect).toBe('fix');
        });

        it('treats null stored value as empty array and starts fresh', () => {
            trackKey('null-buffs');
            setRuntimeProp('null-buffs', 'activeBuffs', null, campaign);

            const auto = makeAuto({ effect: 'repair' });
            const result = toggleBuff('null-buffs', 'Repair', auto, campaign);

            expect(result.buffs).toHaveLength(1);
            expect(result.buffs[0].name).toBe('Repair');
        });

        it('handles undefined stored value as empty array', () => {
            // No prior call to setRuntimeProp — the key was never initialized
            const auto = makeAuto({ effect: 'new' });
            const result = toggleBuff('never-initialized', 'NewBuff', auto, campaign);

            expect(result.buffs).toHaveLength(1);
            expect(result.isActive).toBe(true);
        });

        it('handles empty string stored value as empty array', () => {
            trackKey('empty-string');
            setRuntimeProp('empty-string', 'activeBuffs', '', campaign);

            const auto = makeAuto({ effect: 'new' });
            const result = toggleBuff('empty-string', 'NewBuff', auto, campaign);

            expect(result.buffs).toHaveLength(1);
        });

        it('handles numeric stored value as empty array', () => {
            trackKey('numeric');
            setRuntimeProp('numeric', 'activeBuffs', 42, campaign);

            const auto = makeAuto({ effect: 'new' });
            const result = toggleBuff('numeric', 'NewBuff', auto, campaign);

            expect(result.buffs).toHaveLength(1);
        });
    });
});

describe('getActiveBuffs', () => {
    const campaign = 'TestCampaign';

    it('returns empty array when no buffs stored for the character', () => {
        trackKey('empty-char');
        expect(getActiveBuffs('empty-char', campaign)).toEqual([]);
    });

    it('returns the stored buffs array', () => {
        trackKey('buffed-char');
        setRuntimeProp('buffed-char', 'activeBuffs', [
            { name: 'Bless', effect: '+1 saves' },
            { name: 'Haste', effect: '+speed' },
        ], campaign);

        const buffs = getActiveBuffs('buffed-char', campaign);
        expect(buffs).toHaveLength(2);
        expect(buffs[0].name).toBe('Bless');
        expect(buffs[1].name).toBe('Haste');
    });

    it('returns empty array when stored value is not an array (string)', () => {
        trackKey('bad-buffs');
        setRuntimeProp('bad-buffs', 'activeBuffs', 'corrupted', campaign);
        expect(getActiveBuffs('bad-buffs', campaign)).toEqual([]);
    });

    it('returns empty array when stored value is an object (not array)', () => {
        trackKey('obj-buffs');
        setRuntimeProp('obj-buffs', 'activeBuffs', { name: 'Foo' }, campaign);
        expect(getActiveBuffs('obj-buffs', campaign)).toEqual([]);
    });

    it('returns empty array when stored value is null', () => {
        trackKey('null-buffs');
        setRuntimeProp('null-buffs', 'activeBuffs', null, campaign);
        expect(getActiveBuffs('null-buffs', campaign)).toEqual([]);
    });

    it('returns empty array when stored value is undefined (key never set)', () => {
        expect(getActiveBuffs('never-set', campaign)).toEqual([]);
    });

    it('returns empty array when stored value is a number', () => {
        trackKey('num-buffs');
        setRuntimeProp('num-buffs', 'activeBuffs', 42, campaign);
        expect(getActiveBuffs('num-buffs', campaign)).toEqual([]);
    });
});

describe('isBuffActive', () => {
    const campaign = 'TestCampaign';

    it('returns true when buff name matches an active buff', () => {
        trackKey('check-char');
        setRuntimeProp('check-char', 'activeBuffs', [
            { name: 'Bless', effect: '+1' },
        ], campaign);

        expect(isBuffActive('check-char', 'Bless', campaign)).toBe(true);
    });

    it('returns false when buff name does not match any active buff', () => {
        trackKey('miss-char');
        setRuntimeProp('miss-char', 'activeBuffs', [
            { name: 'Haste', effect: '+speed' },
        ], campaign);

        expect(isBuffActive('miss-char', 'Bless', campaign)).toBe(false);
    });

    it('returns false when no buffs are active', () => {
        trackKey('none-char');
        expect(isBuffActive('none-char', 'AnyBuff', campaign)).toBe(false);
    });

    it('is case-sensitive for buff name matching', () => {
        trackKey('case-char');
        setRuntimeProp('case-char', 'activeBuffs', [
            { name: 'bless', effect: '+1' },
        ], campaign);

        expect(isBuffActive('case-char', 'Bless', campaign)).toBe(false);
        expect(isBuffActive('case-char', 'bless', campaign)).toBe(true);
    });

    it('returns false when stored value is not an array', () => {
        trackKey('corrupted-char');
        setRuntimeProp('corrupted-char', 'activeBuffs', 'not-an-array', campaign);
        expect(isBuffActive('corrupted-char', 'Foo', campaign)).toBe(false);
    });

    it('handles multiple buffs and finds the correct one', () => {
        trackKey('multi-char');
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
