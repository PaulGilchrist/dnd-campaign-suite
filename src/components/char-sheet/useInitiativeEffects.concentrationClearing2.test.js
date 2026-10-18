// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Lane map: this file owns the spell-specific concentration branches NOT reached by
// concentrationClearing.test.js (#350, which owns the CONCENTRATION_SOURCE_EFFECTS
// table + Protection from Energy sweep): restoreCalmEmotions (useInitiativeEffects.js:158),
// Circle of Power clear+sweep (:210-213), LATE_CONCENTRATION_SOURCE_EFFECTS Compulsion /
// Enhance Ability (:27-30, dispatched :214-216), and revertShapeEffects Polymorph /
// Shapechange (:181-187, dispatched :217-222). Split consolidated from 20 tests to 6
// parameterized tests (13 runs); Calm Emotions restore-guard rows that also lived in
// edgeCases.test.js are folded into one it.each here (edgeCases pruning reported upstream).
// Project rule honored: concentration stays concentration — every assertion is event-driven
// at the initiative seam, never a wall-clock gate.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    // Exactly the four live bindings in this import graph: useInitiativeEffects.js:2
    // and its loaded collaborator boonOfCombatProwess.js:2 import
    // getRuntimeValue/setRuntimeValue/setRuntimeBatch/getAllStoreKeys.
    // Dead-mock purge: getStore/useSyncedState/listeners were never read by any module
    // loaded here (probed exports at useRuntimeState.js:5,21 — useSyncedState is not
    // even an export of that file; #350 justification adopted).
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

// Each factory supplies every named binding useInitiativeEffects.js imports (:3-9);
// inert defaults keep the non-owned lanes (invisibility, dice, generic buffs) silent
// so only the spell-specific concentration seam is observed. combatData also exports
// getCurrentCombatRound (boonOfCombatProwess.js:1) but it is never called on this
// lane, so an undefined binding is honest here (#350/buffClearing precedent).
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
import { revertPolymorph } from '../../services/automation/handlers/spells/polymorphService.js';
import { revertShapechange } from '../../services/automation/handlers/spells/shapechangeService.js';

describe('useInitiativeEffects - spell-specific concentration clearing (Calm Emotions, Circle of Power, Compulsion, Enhance Ability, Polymorph, Shapechange)', () => {
    const campaignName = 'test-campaign';
    const TE = 'targetEffects';
    const BUFFS = 'activeBuffs';
    const CONDS = 'activeConditions';

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

    const PRESERVED = { name: 'Mage Armor', effect: 'mage_armor' };

    // Production-faithful fake store (#348/#350 pattern): setRuntimeValue updates the
    // value the NEXT getRuntimeValue sees, so multi-effect restore chains filter fresh
    // data and a resurrection or overwrite of written state fails the final-state
    // byte checks — unlike a static mock returning stale data.
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

    // TestMonk concentrates `spell`; extras add buff-sweep bystanders.
    function concentrate(spell, extras = []) {
        const cs = {
            creatures: [
                { name: 'TestMonk', concentration: { spell }, hp: 30 },
                ...extras,
            ],
        };
        getCombatSummary.mockReturnValue(cs);
        return cs;
    }

    const teWrites = () =>
        setRuntimeValue.mock.calls.filter(([name, key]) => name === 'campaign' && key === TE);
    const buffWrites = () =>
        setRuntimeValue.mock.calls.filter(([, key]) => key === BUFFS);
    const condWrites = () =>
        setRuntimeValue.mock.calls.filter(([, key]) => key === CONDS);
    const storedTE = () => store.get(`campaign|${TE}`);

    describe('Calm Emotions — restoreCalmEmotions chain', () => {
        it('restores suppressed conditions to every target, strips only TestMonk-sourced calm_emotions, and sweeps the buff from all creatures — byte-exact', () => {
            const cs = concentrate('Calm Emotions', [{ name: 'Ally1' }, { name: 'Ally2' }]);
            const calmFrighten1 = { effect: 'calm_emotions', source: 'TestMonk', mode: 'immunity', suppressedConditions: ['Frightened'], target: 'Enemy1' };
            // Second effect re-targets Enemy1: with the fake store the restore must see
            // the fresh ['Frightened'] and append, not clobber (static mocks hid this).
            const calmCharm1 = { effect: 'calm_emotions', source: 'TestMonk', mode: 'immunity', suppressedConditions: ['Charmed'], target: 'Enemy1' };
            // Enemy2 has no activeConditions stored at all — restore from nothing.
            const calmCharm2 = { effect: 'calm_emotions', source: 'TestMonk', mode: 'immunity', suppressedConditions: ['Charmed'], target: 'Enemy2' };
            const allyCalm = { effect: 'calm_emotions', source: 'AllyCaster', mode: 'immunity', suppressedConditions: ['Frightened'], target: 'Enemy3' };
            const unrelated = { effect: 'other_effect', source: 'Ally' };
            store.set(`campaign|${TE}`, [calmFrighten1, calmCharm1, calmCharm2, allyCalm, unrelated]);
            const CALM_BUFF = { name: 'Calm Emotions', effect: 'calm_emotions' };
            store.set(`TestMonk|${BUFFS}`, [CALM_BUFF, PRESERVED]);
            store.set(`Ally1|${BUFFS}`, [CALM_BUFF, PRESERVED]);
            store.set(`Ally2|${BUFFS}`, [PRESERVED]);

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            // Condition restores, in effect order, byte-exact (4 args, no skipSync).
            expect(condWrites()).toEqual([
                ['Enemy1', CONDS, ['Frightened'], campaignName],
                ['Enemy1', CONDS, ['Frightened', 'Charmed'], campaignName],
                ['Enemy2', CONDS, ['Charmed'], campaignName],
            ]);
            expect(store.get(`Enemy1|${CONDS}`)).toEqual(['Frightened', 'Charmed']);
            expect(store.get(`Enemy2|${CONDS}`)).toEqual(['Charmed']);
            // One skipSync=true strip holding every survivor byte-exactly: an
            // over-clear (allyCalm) or under-clear breaks these bytes.
            const survivors = [allyCalm, unrelated];
            expect(teWrites()).toEqual([['campaign', TE, survivors, campaignName, true]]);
            expect(storedTE()).toEqual(survivors);
            // Buff sweep: exactly two writes (cs order TestMonk, Ally1; Ally2 holds no match).
            expect(buffWrites()).toEqual([
                ['TestMonk', BUFFS, [PRESERVED], campaignName],
                ['Ally1', BUFFS, [PRESERVED], campaignName],
            ]);
            // Concentration flag persists cleared, once, with bystanders intact.
            expect(storageService.default.set).toHaveBeenCalledTimes(1);
            expect(cs.creatures).toEqual([
                { name: 'TestMonk', concentration: null, hp: 30 },
                { name: 'Ally1' },
                { name: 'Ally2' },
            ]);
        });

        // Guard branch (useInitiativeEffects.js:162-163): malformed/satisfied effects
        // skip the restore, but the strip (filter on effect+source only, :173) and the
        // concentration break still fire — positive legs keep the absence non-vacuous.
        it.each([
            ['mode is not immunity', { effect: 'calm_emotions', source: 'TestMonk', mode: 'suppressed', suppressedConditions: ['Frightened'], target: 'Enemy1' }, {}],
            ['suppressedConditions is not an array', { effect: 'calm_emotions', source: 'TestMonk', mode: 'immunity', suppressedConditions: 'Frightened', target: 'Enemy1' }, {}],
            ['suppressedConditions is empty', { effect: 'calm_emotions', source: 'TestMonk', mode: 'immunity', suppressedConditions: [], target: 'Enemy1' }, {}],
            ['target is missing', { effect: 'calm_emotions', source: 'TestMonk', mode: 'immunity', suppressedConditions: ['Frightened'] }, {}],
            ['the condition is already present (case-insensitive)', { effect: 'calm_emotions', source: 'TestMonk', mode: 'immunity', suppressedConditions: ['frightened'], target: 'Enemy1' }, { [`Enemy1|${CONDS}`]: ['Frightened'] }],
        ])('restores no conditions when %s, yet still breaks concentration and strips the effect', (_label, effect, seeds) => {
            const cs = concentrate('Calm Emotions');
            const unrelated = { effect: 'other_effect', source: 'Ally' };
            store.set(`campaign|${TE}`, [effect, unrelated]);
            Object.entries(seeds).forEach(([k, v]) => store.set(k, v));

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            expect(condWrites()).toHaveLength(0);
            expect(storageService.default.set).toHaveBeenCalledTimes(1);
            expect(cs.creatures[0]).toEqual({ name: 'TestMonk', concentration: null, hp: 30 });
            expect(teWrites()).toEqual([['campaign', TE, [unrelated], campaignName, true]]);
            expect(storedTE()).toEqual([unrelated]);
        });
    });

    describe('Circle of Power concentration clearing', () => {
        it('clears only TestMonk-sourced circle_of_power and sweeps the buff from all creatures', () => {
            const cs = concentrate('Circle of Power', [{ name: 'Ally1' }, { name: 'Ally2' }]);
            const own = { effect: 'circle_of_power', source: 'TestMonk', target: 'Ally1' };
            const allySameKey = { effect: 'circle_of_power', source: 'AllyCaster', target: 'Ally2' };
            const unrelated = { effect: 'other_effect', source: 'Ally' };
            store.set(`campaign|${TE}`, [own, allySameKey, unrelated]);
            const COP_BUFF = { name: 'Circle of Power', effect: 'circle_power' };
            store.set(`TestMonk|${BUFFS}`, [COP_BUFF, PRESERVED]);
            store.set(`Ally1|${BUFFS}`, [COP_BUFF, PRESERVED]);
            store.set(`Ally2|${BUFFS}`, [PRESERVED]);

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            expect(teWrites()).toEqual([['campaign', TE, [allySameKey, unrelated], campaignName, true]]);
            expect(storedTE()).toEqual([allySameKey, unrelated]);
            expect(buffWrites()).toEqual([
                ['TestMonk', BUFFS, [PRESERVED], campaignName],
                ['Ally1', BUFFS, [PRESERVED], campaignName],
            ]);
            expect(storageService.default.set).toHaveBeenCalledTimes(1);
            expect(cs.creatures[0]).toEqual({ name: 'TestMonk', concentration: null, hp: 30 });
        });
    });

    describe('LATE_CONCENTRATION_SOURCE_EFFECTS clearing', () => {
        // Late-dispatched table (useInitiativeEffects.js:27-30) — same clearSourceEffects
        // mechanism as #350's early table but reached only through these rows.
        it.each([
            ['Compulsion', 'compulsion'],
            ['Enhance Ability', 'enhance_ability'],
        ])(
            'losing %s concentration removes only TestMonk-sourced %s, byte-exact, with skipSync',
            (spell, effectKey) => {
                const cs = concentrate(spell);
                const own = { effect: effectKey, source: 'TestMonk', target: 'Enemy' };
                const allySameKey = { effect: effectKey, source: 'AllyCaster', target: 'Ally' };
                const ownUnrelated = { effect: 'frightened', source: 'TestMonk' };
                store.set(`campaign|${TE}`, [own, allySameKey, ownUnrelated]);

                renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
                rollInitiative();

                const survivors = [allySameKey, ownUnrelated];
                expect(teWrites()).toEqual([['campaign', TE, survivors, campaignName, true]]);
                expect(storedTE()).toEqual(survivors);
                expect(storageService.default.set).toHaveBeenCalledTimes(1);
                expect(cs.creatures[0]).toEqual({ name: 'TestMonk', concentration: null, hp: 30 });
            }
        );
    });

    describe('spell gating across owned lanes', () => {
        it('losing Compulsion concentration touches no other spell lane — other keys, buffs and reverts survive byte-exact', () => {
            const cs = concentrate('Compulsion', [{ name: 'Ally1' }]);
            const otherLaneEffects = ['calm_emotions', 'circle_of_power', 'polymorph', 'shapechange'].map(
                effect => ({ effect, source: 'TestMonk', mode: 'immunity', suppressedConditions: ['Frightened'], target: 'Enemy1' })
            );
            const ownCompulsion = { effect: 'compulsion', source: 'TestMonk', target: 'Enemy2' };
            store.set(`campaign|${TE}`, [...otherLaneEffects, ownCompulsion]);
            const otherBuffs = [
                { name: 'Circle of Power', effect: 'circle_power' },
                { name: 'Calm Emotions', effect: 'calm_emotions' },
                { name: 'Protection from Energy', effect: 'protection_energy' },
            ];
            store.set(`TestMonk|${BUFFS}`, otherBuffs);
            store.set(`Ally1|${BUFFS}`, otherBuffs);

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            // Positive leg: the Compulsion clear itself happened...
            expect(teWrites()).toEqual([['campaign', TE, otherLaneEffects, campaignName, true]]);
            expect(storageService.default.set).toHaveBeenCalledTimes(1);
            expect(cs.creatures[0]).toEqual({ name: 'TestMonk', concentration: null, hp: 30 });
            // ...so these absences are spell-gating, not a dead seam: no calm restore,
            // no buff sweep, no shape reverts for un-concentrated spells.
            expect(condWrites()).toHaveLength(0);
            expect(buffWrites()).toHaveLength(0);
            expect(revertPolymorph).not.toHaveBeenCalled();
            expect(revertShapechange).not.toHaveBeenCalled();
            expect(storedTE()).toEqual(otherLaneEffects);
        });
    });

    describe('Polymorph / Shapechange reverts', () => {
        it.each([
            ['Polymorph', 'polymorph', revertPolymorph],
            ['Shapechange', 'shapechange', revertShapechange],
        ])('losing %s concentration reverts exactly each caster-sourced target and leaves targetEffects to the service', (_spell, effectKey, revert) => {
            concentrate(_spell);
            const own1 = { effect: effectKey, source: 'TestMonk', target: 'Goblin1' };
            const own2 = { effect: effectKey, source: 'TestMonk', target: 'Goblin2' };
            const allySameKey = { effect: effectKey, source: 'AllyCaster', target: 'Dragon' };
            const unrelated = { effect: 'other_effect', source: 'TestMonk' };
            const seed = [own1, own2, allySameKey, unrelated];
            store.set(`campaign|${TE}`, seed);

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            // Exact call list: other-source effects never revert, no phantom extra calls.
            expect(revert.mock.calls).toEqual([
                ['Goblin1', campaignName],
                ['Goblin2', campaignName],
            ]);
            // The seam itself strips nothing — revert service owns the effect removal.
            expect(teWrites()).toHaveLength(0);
            expect(storedTE()).toEqual(seed);
            expect(storageService.default.set).toHaveBeenCalledTimes(1);
        });
    });
});
