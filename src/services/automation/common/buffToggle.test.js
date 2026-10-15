// @maintained-by-ai
// Pure-function contract tests over the runtime store: stable key mapping,
// exact-name matching, array guards. Deterministic; no app churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearRuntimeState, setRuntimeValue as setRuntimeProp, getRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { computeToggledBuffs, toggleBuff, getActiveBuffs, isBuffActive, hasBuffEffect } from './buffToggle.js';

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

describe('computeToggledBuffs', () => {
    const campaign = 'TestCampaign';

    it('is pure — computes toggled buffs without writing to the runtime store', () => {
        clearRuntimeState('pure-char');
        const existing = [{ name: 'Bless', effect: '+1 saves' }];

        const activation = computeToggledBuffs([], 'Shield', makeAuto({ effect: '+2 AC' }), 'caster');
        expect(activation).toMatchObject({ isActive: true, wasActive: false });
        expect(activation.buffs).toHaveLength(1);
        expect(activation.buffs[0].sourceCharacter).toBe('caster');

        const deactivation = computeToggledBuffs(existing, 'Bless', makeAuto(), 'caster');
        expect(deactivation).toMatchObject({ isActive: false, wasActive: true });
        expect(deactivation.buffs).toHaveLength(0);

        // Neither call above may touch the store — SP-094 callers write atomically themselves.
        expect(getRuntimeValue('pure-char', 'activeBuffs', campaign)).toBeNull();
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

    it('finds the correct buff among many active buffs', () => {
        clearRuntimeState('multi-char');
        setRuntimeProp('multi-char', 'activeBuffs', [
            { name: 'Haste', effect: '+speed' },
            { name: 'Bless', effect: '+1' },
            { name: 'Shield', effect: '+2 AC' },
        ], campaign);

        expect(isBuffActive('multi-char', 'Bless', campaign)).toBe(true);
        expect(isBuffActive('multi-char', 'Invisibility', campaign)).toBe(false);
    });
});

describe('hasBuffEffect', () => {
    const campaign = 'TestCampaign';

    it('CLA-394: returns true when a buff with the effect is active', () => {
        clearRuntimeState('zealot-target');
        setRuntimeProp('zealot-target', 'activeBuffs', [
            { name: 'Zealous Presence', effect: 'advantage_attacks_and_saves' },
        ], campaign);

        expect(hasBuffEffect('zealot-target', 'advantage_attacks_and_saves', campaign)).toBe(true);
    });

    it('returns false when no active buff carries the effect', () => {
        clearRuntimeState('plain-target');
        setRuntimeProp('plain-target', 'activeBuffs', [
            { name: 'Haste', effect: '+speed' },
        ], campaign);

        expect(hasBuffEffect('plain-target', 'advantage_attacks_and_saves', campaign)).toBe(false);
    });

    it('returns false when activeBuffs is empty or missing', () => {
        clearRuntimeState('empty-target');

        expect(hasBuffEffect('empty-target', 'advantage_attacks_and_saves', campaign)).toBe(false);
    });
});
