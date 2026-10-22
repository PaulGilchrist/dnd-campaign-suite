// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Lane map (#346-#349 family): this file owns the CONCENTRATION seam of the
// initiative-rolled event — which caster-concentration states break/clear at the
// seam and why (CONCENTRATION_SOURCE_EFFECTS table, Protection from Energy buff
// sweep, persisted byte-exact combatSummary). Siblings cover other lanes:
// concentrationClearing2.test.js owns Calm Emotions / Circle of Power / Compulsion /
// Enhance Ability / Polymorph / Shapechange; buffClearing.test.js owns the buff
// clear mechanics; effectClearing.test.js owns INITIATIVE_CLEARED_EFFECT_KEYS
// wholesale clears; initiativeRolled.test.js owns event guards and recoveries.
// Project rule honored: concentration stays concentration — every assertion here is
// event-driven at the initiative seam, never a wall-clock gate.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    // Exactly the four exports live in this import graph: useInitiativeEffects.js:2
    // and its loaded collaborator boonOfCombatProwess.js:2 import
    // getRuntimeValue/setRuntimeValue/setRuntimeBatch/getAllStoreKeys.
    // Dead-mock purge: getStore/useSyncedState/listeners were never read by any
    // module loaded here (probed exports at useRuntimeState.js:5,21 — useSyncedState
    // is not even an export of that file).
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

// Each factory supplies every named binding useInitiativeEffects.js imports;
// inert defaults keep the non-concentration lanes (invisibility, shapechange,
// dice) silent so only the concentration seam is observed. combatData also exports
// getCurrentCombatRound (boonOfCombatProwess.js:1) but it is never called on this
// lane, so an undefined binding is honest here (buffClearing precedent).
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
    },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibility: vi.fn(),
    endGreaterInvisibility: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
    revertPolymorph: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({
    revertShapechange: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import * as storageService from '../../services/ui/storage.js';

describe('useInitiativeEffects - concentration clearing at the initiative seam', () => {
    const campaignName = 'test-campaign';
    const TE = 'targetEffects';
    const BUFFS = 'activeBuffs';

    const playerStats = {
        name: 'TestMonk',
        level: 15,
        class: {
            name: 'Monk',
            class_levels: [{ level: 15, focus_points: 6 }],
        },
        abilities: [{ name: 'Wisdom', bonus: 4 }],
        automation: {
            passives: [],
            actions: [],
        },
        actions: [],
    };

    // Mirrors CONCENTRATION_SOURCE_EFFECTS (useInitiativeEffects.js:18): spell whose
    // concentration break must purge the caster-sourced campaign targetEffect.
    // Blade Ward intentionally shares bane_penalty with Bane.
    const SOURCE_TABLE = [
        ['Bane', 'bane_penalty'],
        ['Blade Ward', 'bane_penalty'],
        ['Bless', 'bless_bonus'],
        ['Ray of Enfeeblement', 'ray_of_enfeeble_debuff'],
        ['Compelled Duel', 'compelled_duel'],
        ['Resistance', 'resistance_damage_reduction'],
    ];
    const ALL_SOURCE_KEYS = [...new Set(SOURCE_TABLE.map(([, key]) => key))];

    // Production-faithful fake store (#348 pattern): setRuntimeValue updates the
    // value the NEXT getRuntimeValue sees (useRuntimeState.js writes synchronously),
    // so the clear chain filters fresh data and a resurrection of a cleared effect
    // fails the final-state byte check — unlike a static mock returning stale data.
    let store;

    beforeEach(() => {
        vi.clearAllMocks();
        store = new Map();
        getRuntimeValue.mockImplementation((name, key) =>
            store.has(`${name}|${key}`) ? store.get(`${name}|${key}`) : null
        );
        setRuntimeValue.mockImplementation((name, key, value) => {
            store.set(`${name}|${key}`, value);
        });
    });

    function rollInitiative() {
        window.dispatchEvent(
            new CustomEvent('initiative-rolled', {
                detail: { characterName: 'TestMonk', roll: 15 },
            })
        );
    }

    function concentrate(spell) {
        const cs = {
            creatures: [
                { name: 'TestMonk', concentration: { spell }, hp: 30 },
                { name: 'Ally', concentration: { spell: 'Bless' } },
            ],
        };
        getCombatSummary.mockReturnValue(cs);
        return cs;
    }

    const teWrites = () =>
        setRuntimeValue.mock.calls.filter(([name, key]) => name === 'campaign' && key === TE);
    const buffWrites = () =>
        setRuntimeValue.mock.calls.filter(([, key]) => key === BUFFS);
    const storedTE = () => store.get(`campaign|${TE}`);

    describe('CONCENTRATION_SOURCE_EFFECTS table clearing', () => {
        it.each(SOURCE_TABLE)(
            'losing %s concentration removes only TestMonk-sourced %s, byte-exact, and persists the cleared summary',
            (spell, effectKey) => {
                concentrate(spell);
                const own = { effect: effectKey, source: 'TestMonk', target: 'Goblin1' };
                const allySameKey = { effect: effectKey, source: 'AllyCaster', target: 'Goblin2' };
                const allyOtherKeys = ALL_SOURCE_KEYS
                    .filter(k => k !== effectKey)
                    .map(k => ({ effect: k, source: 'AllyCaster', target: 'Goblin1' }));
                const ownUnrelated = { effect: 'frightened', source: 'TestMonk' };
                store.set(`campaign|${TE}`, [own, allySameKey, ...allyOtherKeys, ownUnrelated]);

                renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
                rollInitiative();

                // One 4-arg POST write (exact store signature, useRuntimeState.js:78)
                // holding every survivor byte-exactly: any wrong
                // spell→key row, source-filter slip, or over-clear breaks these bytes.
                const survivors = [allySameKey, ...allyOtherKeys, ownUnrelated];
                expect(teWrites()).toEqual([
                    ['campaign', TE, survivors, campaignName],
                ]);
                expect(storedTE()).toEqual(survivors);
                // Combat summary persists once with only TestMonk's concentration nulled
                // (hp and Ally's own concentration must survive).
                expect(storageService.default.set).toHaveBeenCalledTimes(1);
                expect(storageService.default.set).toHaveBeenCalledWith(
                    'combatSummary',
                    {
                        creatures: [
                            { name: 'TestMonk', concentration: null, hp: 30 },
                            { name: 'Ally', concentration: { spell: 'Bless' } },
                        ],
                    },
                    campaignName
                );
            }
        );

        it('clears the concentration flag but no targetEffects when the stored spell is undefined', () => {
            const ownBane = { effect: 'bane_penalty', source: 'TestMonk', target: 'Goblin1' };
            store.set(`campaign|${TE}`, [ownBane]);
            const cs = { creatures: [{ name: 'TestMonk', concentration: {}, hp: 30 }] };
            getCombatSummary.mockReturnValue(cs);

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            // Truthy concentration object without a spell still breaks at the seam...
            expect(storageService.default.set).toHaveBeenCalledTimes(1);
            expect(cs.creatures[0]).toEqual({ name: 'TestMonk', concentration: null, hp: 30 });
            // ...but an undefined spell matches no table row: even the caster's own
            // bane_penalty must survive (proves spell-match gating, not blanket clearing).
            expect(teWrites()).toHaveLength(0);
            expect(storedTE()).toEqual([ownBane]);
        });

        it('writes nothing when the caster has no sourced entries for the spell', () => {
            concentrate('Bane');
            const allyBane = { effect: 'bane_penalty', source: 'AllyCaster', target: 'Goblin1' };
            store.set(`campaign|${TE}`, [allyBane]);

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            expect(teWrites()).toHaveLength(0);
            expect(storedTE()).toEqual([allyBane]);
            expect(storageService.default.set).toHaveBeenCalledTimes(1);
        });
    });

    describe('Protection from Energy buff sweep', () => {
        const PRESERVED = { name: 'Mage Armor', effect: 'mage_armor' };
        const PFE = { name: 'Protection from Energy', effect: 'protection_energy' };

        it('clears the buff from every creature in combat, byte-exact, and persists the cleared summary', () => {
            const cs = {
                creatures: [
                    { name: 'TestMonk', concentration: { spell: 'Protection from Energy' }, hp: 30 },
                    { name: 'Ally1' },
                    { name: 'Ally2' },
                ],
            };
            getCombatSummary.mockReturnValue(cs);
            store.set(`TestMonk|${BUFFS}`, [PFE, PRESERVED]);
            store.set(`Ally1|${BUFFS}`, [PFE, PRESERVED]);
            store.set(`Ally2|${BUFFS}`, [PRESERVED]);

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            // Exactly two writes (cs order TestMonk, then Ally1; Ally2 holds no match).
            expect(buffWrites()).toEqual([
                ['TestMonk', BUFFS, [PRESERVED], campaignName],
                ['Ally1', BUFFS, [PRESERVED], campaignName],
            ]);
            expect(store.get(`TestMonk|${BUFFS}`)).toEqual([PRESERVED]);
            expect(store.get(`Ally1|${BUFFS}`)).toEqual([PRESERVED]);
            expect(store.get(`Ally2|${BUFFS}`)).toEqual([PRESERVED]);
            expect(storageService.default.set).toHaveBeenCalledTimes(1);
            expect(cs.creatures[0]).toEqual({
                name: 'TestMonk',
                concentration: null,
                hp: 30,
            });
        });

        it.each([
            ['unrelated buffs only', [PRESERVED]],
            ['an unset buff list', null],
        ])('writes no buff lists when creatures hold %s, while still clearing concentration', (_label, storedBuffs) => {
            concentrate('Protection from Energy');
            if (storedBuffs) {
                store.set(`TestMonk|${BUFFS}`, storedBuffs);
                store.set(`Ally|${BUFFS}`, storedBuffs);
            }

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            // Positive leg first: the concentration break happened, so this absence is
            // the buff-absent branch — not the whole seam never firing.
            expect(storageService.default.set).toHaveBeenCalledTimes(1);
            expect(buffWrites()).toHaveLength(0);
            expect(store.get(`TestMonk|${BUFFS}`)).toEqual(storedBuffs ?? undefined);
        });
    });

    describe('no-op guards', () => {
        it.each([
            ['a null combat summary', null],
            ['a combat summary with no creatures key', {}],
            ['an empty creatures array', { creatures: [] }],
            ['the rolling creature absent from combat', { creatures: [{ name: 'OtherPlayer', concentration: { spell: 'Bane' } }] }],
        ])('persists nothing and clears no effects for %s', (_label, cs) => {
            getCombatSummary.mockReturnValue(cs);
            // Seed a real caster-sourced effect so a wrongly-firing clear is observable
            // (an empty store would make this a vacuous absence).
            const ownBane = { effect: 'bane_penalty', source: 'TestMonk', target: 'Goblin1' };
            store.set(`campaign|${TE}`, [ownBane]);

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            expect(storageService.default.set).not.toHaveBeenCalled();
            expect(teWrites()).toHaveLength(0);
            expect(buffWrites()).toHaveLength(0);
            expect(storedTE()).toEqual([ownBane]);
        });
    });
});
