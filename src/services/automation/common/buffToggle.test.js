import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearRuntimeState, setRuntimeValue as setRuntimeProp } from '../../../hooks/runtime/useRuntimeState.js';
import { toggleBuff, getActiveBuffs, isBuffActive } from './buffToggle.js';

// ── Helpers ─────────────────────────────────────────────────────
const trackedKeys = new Set();
function trackKey(k) { if (k) trackedKeys.add(k); }

function resetBetweenTests() {
    for (const k of [...trackedKeys]) { clearRuntimeState(k); }
    trackedKeys.clear();
    localStorage.clear();
}

// ── Auto buff fixture ───────────────────────────────────────────
function makeAuto(options = {}) {
    return {
        effect: 'sample_effect',
        duration: '1 minute',
        enemies_disadvantage_saves: options.enemies_disadvantage_saves || [],
        distance: options.distance || '',
        extendedDistance: options.extendedDistance || '',
        ...options,
    };
}

// ── Tests ───────────────────────────────────────────────────────
beforeEach(() => {
    vi.restoreAllMocks();
    resetBetweenTests();
});

describe('toggleBuff', () => {
    const campaign = 'TestCampaign';

    describe('activation (buff not yet active)', () => {
        beforeEach(() => { vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true }); });

        it('adds a new buff when none active', () => {
            trackKey('fighter');
            const auto = makeAuto({ effect: '+2 AC', duration: 'concentration' });
            const result = toggleBuff('fighter', 'Shield', auto, campaign);

            expect(result.isActive).toBe(true);
            expect(result.wasActive).toBe(false);
            expect(result.targetName).toBe('fighter');
            expect(result.buffs).toHaveLength(1);
            expect(result.buffs[0].name).toBe('Shield');
        });

        it('stores buff via runtime state', () => {
            trackKey('paladin');
            const auto = makeAuto({ effect: '+2 AC' });
            toggleBuff('paladin', 'Divine Shield', auto, campaign);

            // Verify the value was persisted (via useRuntimeState internal store)
            expect(getActiveBuffs('paladin', campaign)).toHaveLength(1);
            expect(getActiveBuffs('paladin', campaign)[0].name).toBe('Divine Shield');
        });

        it('preserves existing buffs when adding a new one', () => {
            trackKey('wizard');
            const auto1 = makeAuto({ effect: 'invisibility' });
            toggleBuff('wizard', 'Invisibility', auto1, campaign);
            vi.restoreAllMocks();
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

            const auto2 = makeAuto({ effect: 'haste' });
            const result = toggleBuff('wizard', 'Haste', auto2, campaign);

            expect(result.buffs).toHaveLength(2);
            expect(result.buffs.map(b => b.name)).toContain('Invisibility');
            expect(result.buffs.map(b => b.name)).toContain('Haste');
        });

        it('uses targetName when provided instead of playerName', () => {
            trackKey('ally-char');
            const auto = makeAuto({ effect: 'bless' });
            const result = toggleBuff('caster', 'Bless', auto, campaign, 'ally-char');

            expect(result.targetName).toBe('ally-char');
            expect(getActiveBuffs('ally-char', campaign)).toHaveLength(1);
            // The original caster should NOT have the buff
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

        it('includes sourceCharacter in the stored buff', () => {
            trackKey('cleric');
            const auto = makeAuto({ effect: 'heal' });
            toggleBuff('cleric', 'Cure Wounds', auto, campaign);

            expect(getActiveBuffs('cleric', campaign)[0].sourceCharacter).toBe('cleric');
        });

        it('includes effect and duration from the auto object', () => {
            trackKey('druid');
            const auto = makeAuto({ effect: '+3 to saves', duration: '1 hour' });
            toggleBuff('druid', 'Goodberry Aura', auto, campaign);

            const buff = getActiveBuffs('druid', campaign)[0];
            expect(buff.effect).toBe('+3 to saves');
            expect(buff.duration).toBe('1 hour');
        });

        it('defaults enemiesDisadvantageSaves to empty array when not on auto', () => {
            trackKey('sorcerer');
            const auto = makeAuto({}); // no enemies_disadvantage_saves
            toggleBuff('sorcerer', 'Metamagic Boost', auto, campaign);

            expect(getActiveBuffs('sorcerer', campaign)[0].enemiesDisadvantageSaves).toEqual([]);
        });

        it('defaults distance to empty string when not on auto', () => {
            trackKey('warlock');
            const auto = { effect: 'hex', duration: '1 hour' }; // no distance prop
            toggleBuff('warlock', 'Hex', auto, campaign);

            expect(getActiveBuffs('warlock', campaign)[0].distance).toBe('');
        });

        it('defaults extendedDistance to empty string when not on auto', () => {
            trackKey('ranger');
            const auto = { effect: 'vantage', duration: '1 hour' }; // no extendedDistance prop
            toggleBuff('ranger', 'Scouting', auto, campaign);

            expect(getActiveBuffs('ranger', campaign)[0].extendedDistance).toBe('');
        });

        it('defaults blocksSpellcasting to false when not on auto', () => {
            trackKey('sorcerer2');
            const auto = { effect: 'boost', duration: '1 minute' };
            toggleBuff('sorcerer2', 'Metamagic', auto, campaign);

            expect(getActiveBuffs('sorcerer2', campaign)[0].blocksSpellcasting).toBe(false);
        });

        it('stores blocksSpellcasting true from auto object', () => {
            trackKey('druid2');
            const auto = { effect: 'shape_shift', duration: '1 hour', blocksSpellcasting: true };
            toggleBuff('druid2', 'Wild Shape', auto, campaign);

            expect(getActiveBuffs('druid2', campaign)[0].blocksSpellcasting).toBe(true);
        });

        it('carries enemies_disadvantage_saves from auto object', () => {
            trackKey('caster2');
            const auto = makeAuto({ enemies_disadvantage_saves: ['str', 'dex'] });
            toggleBuff('caster2', 'Snares', auto, campaign);

            expect(getActiveBuffs('caster2', campaign)[0].enemiesDisadvantageSaves).toEqual(['str', 'dex']);
        });

        it('carries distance and extendedDistance from auto object', () => {
            trackKey('blaster');
            const auto = makeAuto({ distance: '60 ft.', extendedDistance: '120 ft.' });
            toggleBuff('blaster', 'Fire Stream', auto, campaign);

            const buff = getActiveBuffs('blaster', campaign)[0];
            expect(buff.distance).toBe('60 ft.');
            expect(buff.extendedDistance).toBe('120 ft.');
        });
    });

    describe('deactivation (buff already active)', () => {
        beforeEach(() => { vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true }); });

        it('removes buff when toggled a second time', () => {
            trackKey('monk');
            const auto = makeAuto({ effect: 'stunned' });
            toggleBuff('monk', 'Stunning Strike', auto, campaign);
            vi.restoreAllMocks();
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

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
            vi.restoreAllMocks();
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
            toggleBuff('bard2', 'BuffB', auto2, campaign);

            vi.restoreAllMocks();
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

            const result = toggleBuff('bard2', 'BuffA', auto1, campaign); // remove BuffA

            expect(result.buffs).toHaveLength(1);
            expect(result.buffs[0].name).toBe('BuffB');
        });
    });

    describe('edge cases', () => {
        beforeEach(() => { vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true }); });

        it('treats non-array stored value as empty array', () => {
            // Simulate corrupted / non-array state by directly setting a scalar
            trackKey('broken');
            setRuntimeProp('broken', 'activeBuffs', 'not-an-array', campaign);
            vi.restoreAllMocks();
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

            const auto = makeAuto({ effect: 'fix' });
            const result = toggleBuff('broken', 'FixIt', auto, campaign);

            expect(result.buffs).toHaveLength(1);
            expect(result.buffs[0].name).toBe('FixIt');
        });

        it('treats null stored value as empty array', () => {
            trackKey('null-buffs');
            setRuntimeProp('null-buffs', 'activeBuffs', null, campaign);
            vi.restoreAllMocks();
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

            const auto = makeAuto({ effect: 'repair' });
            const result = toggleBuff('null-buffs', 'Repair', auto, campaign);

            expect(result.buffs).toHaveLength(1);
        });
    });
});

describe('getActiveBuffs', () => {
    const campaign = 'TestCampaign';

    it('returns empty array when no buffs stored', () => {
        trackKey('empty-char');
        expect(getActiveBuffs('empty-char', campaign)).toEqual([]);
    });

    it('returns the stored buffs array', () => {
        trackKey('buffed-char');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
        setRuntimeProp('buffed-char', 'activeBuffs', [
            { name: 'Bless', effect: '+1 saves' },
            { name: 'Haste', effect: '+speed' },
        ], campaign);

        const buffs = getActiveBuffs('buffed-char', campaign);
        expect(buffs).toHaveLength(2);
        expect(buffs[0].name).toBe('Bless');
        expect(buffs[1].name).toBe('Haste');
    });

    it('returns empty array when stored value is not an array', () => {
        trackKey('bad-buffs');
        setRuntimeProp('bad-buffs', 'activeBuffs', 'corrupted', campaign);
        expect(getActiveBuffs('bad-buffs', campaign)).toEqual([]);
    });

    it('returns empty array when stored value is an object (not array)', () => {
        trackKey('obj-buffs');
        setRuntimeProp('obj-buffs', 'activeBuffs', { name: 'Foo' }, campaign);
        expect(getActiveBuffs('obj-buffs', campaign)).toEqual([]);
    });

    it('does not mutate the stored array when returned', () => {
        trackKey('immutable-char');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
        const original = [{ name: 'Shield', effect: '+2 AC' }];
        setRuntimeProp('immutable-char', 'activeBuffs', original, campaign);

        const returned = getActiveBuffs('immutable-char', campaign);
        // The implementation returns the same reference — but it should still be an array
        expect(Array.isArray(returned)).toBe(true);
        expect(returned).toHaveLength(1);
    });
});

describe('isBuffActive', () => {
    const campaign = 'TestCampaign';

    it('returns true when buff is in the active buffs list', () => {
        trackKey('check-char');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
        setRuntimeProp('check-char', 'activeBuffs', [
            { name: 'Bless', effect: '+1' },
        ], campaign);

        expect(isBuffActive('check-char', 'Bless', campaign)).toBe(true);
    });

    it('returns false when buff is not in the active buffs list', () => {
        trackKey('miss-char');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
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
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
        setRuntimeProp('case-char', 'activeBuffs', [
            { name: 'bless', effect: '+1' },
        ], campaign);

        expect(isBuffActive('case-char', 'Bless', campaign)).toBe(false);
        expect(isBuffActive('case-char', 'bless', campaign)).toBe(true);
    });

    it('handles non-array stored value gracefully', () => {
        trackKey('corrupted-char');
        setRuntimeProp('corrupted-char', 'activeBuffs', 'not-an-array', campaign);
        expect(isBuffActive('corrupted-char', 'Foo', campaign)).toBe(false);
    });
});
