// @maintained-by-ai
// Canonical owner of the generic removeAction:'target_effect' click→store
// removal dispatch (jsx:20-27 removeTargetEffect via REMOVE_HANDLERS:537).
// Cited here by pass-without-trace.test.jsx:13-14, banished-demiplane:15,
// common:9, disadvantage-next-attack:7, no-oa-speedy:8, save-ability:12,
// spell-effects:14.
// Face per case: exactly ONE badge rendered, × click writes the campaign
// store EXACTLY once with the byte-exact survivor payload — the removal te,
// a wrong-target decoy sharing the effect, and a wrong-effect decoy sharing
// the creature (payload asserted as fixture literals, never recomputed
// filters #786; survivors prove it removed the right one — anti-vacuous
// #825; exact counts #744). Fresh fixture built inside every case (#771);
// mocks pinned per render (#827).
//
// Path representatives only (#825) — each row earns its slot by a distinct
// code path, not a distinct string:
//   sanctuary                  → findDirect + isLocalhost gating (canonical)
//   banishment               → findDirect control/debuff family rep
//   forcecage                → findResolved array-target resolution (te.target
//                              is an array here; removal filters target[0])
//   pass_without_trace_bonus → findDirect + live-registry getEffectDefinition
//                              build (#828, this badge's removal cited :13-14)
//   slasher_enhanced_critical→ compute-guard override (badge exists with no
//                              find match; effectType is builder-constant)
// Dropped keys, each byte-shaped identical to sanctuary's spec
// (findDirect + removeAction:'target_effect', only the effect string varies):
// regenerate, aura_of_life, aura_of_purity, circle_of_power, heroism,
// holy_aura, maze, imprisonment, confusion.
// protection_from_poison was EXCLUDED pre-#820: the builder (jsx:142)
// deferred ctx.te into a lazy onClick while the specs loop (jsx:617)
// reassigned ctx.te, so its badge's deferred callbacks read undefined after
// render. Fixed at source with an eager poisonDc capture — now enumerated
// below via its findResolved array-target path; click→CON-save payload is
// pinned in auras.test.jsx (#820).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';
import { logConditionEvent } from '../../services/encounters/combatLoggingService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

// Falsy-guard house shape (pass-without-trace-lane pattern): the computed
// effects object is fully caller-controlled — with an empty shape every
// accumulator guard stays falsy and only the fixture-matched find-based spec
// (or an explicit per-case override) can produce a badge.
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(),
}));

// Manual badge-× removal must log exactly one symmetric audit row
// (action:'target-effect-removed', creature + registry label). Pinned via
// mock; the fallback leg mocks getEffectDefinition to simulate an
// unregistered key without touching the real registry.
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConditionEvent: vi.fn(),
}));

const UNREGISTERED_KEY = 'disadvantage_on_next_save';
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getEffectDefinition: (key) =>
            key === UNREGISTERED_KEY ? undefined : actual.getEffectDefinition(key),
    };
});

const CREATURE = 'Alice';
const CAMPAIGN = 'test-campaign';

describe('ConditionEffectBadges - generic target_effect removal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function renderBadgeFace(removalKey, target, computeOverrides = {}) {
        const removal = { target, effect: removalKey, source: 'Cleric' };
        const wrongTargetDecoy = { target: 'Bob', effect: removalKey, source: 'Wizard' };
        const wrongEffectDecoy = { target: CREATURE, effect: 'bless_bonus', source: 'Other' };
        const targetEffects = [removal, wrongTargetDecoy, wrongEffectDecoy];
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'targetEffects') return targetEffects;
            return null;
        });
        computeConditionEffects.mockReturnValue({ ...computeOverrides });
        render(
            <ConditionEffectBadges
                conditions={[]}
                targetEffects={targetEffects}
                creatureName={CREATURE}
                campaignName={CAMPAIGN}
                isLocalhost={true}
            />
        );
        return { wrongTargetDecoy, wrongEffectDecoy };
    }

    const pathRepresentatives = [
        { key: 'sanctuary', label: 'Sanctuary', path: 'findDirect + isLocalhost gating (canonical)' },
        { key: 'banishment', label: 'Banishment', path: 'findDirect control/debuff family' },
        { key: 'forcecage', label: 'Forcecage', target: ['Alice', 'Bob'], path: 'findResolved array-target resolution' },
        { key: 'protection_from_poison', label: 'Protection from Poison', target: ['Alice', 'Bob'], path: 'findResolved post-#820 eager-capture fix' },
        { key: 'pass_without_trace_bonus', label: 'Pass Without Trace', path: 'findDirect + live-registry build' },
        { key: 'slasher_enhanced_critical', label: 'Attack Disadv', compute: { targetAttackDisadvantageCount: 1 }, path: 'compute-guard override, no find' },
    ];

    it.each(pathRepresentatives)(
        'removes $key via one byte-exact campaign write — $path',
        ({ key, label, target = CREATURE, compute }) => {
            const { wrongTargetDecoy, wrongEffectDecoy } = renderBadgeFace(key, target, compute);

            const removeBtns = screen.getAllByTitle('Remove effect');
            expect(removeBtns).toHaveLength(1);

            fireEvent.click(removeBtns[0]);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [wrongTargetDecoy, wrongEffectDecoy],
                CAMPAIGN
            );

            // Audit symmetry (FT 2026-11-09 backlog): the eviction logs ONE
            // condition row naming creature + registry label, mirroring the
            // 'broken'/'removed' sibling end-lanes and the apply lane's
            // 'target-effect-applied'.
            expect(logConditionEvent).toHaveBeenCalledTimes(1);
            expect(logConditionEvent).toHaveBeenCalledWith({
                campaignName: CAMPAIGN,
                action: 'target-effect-removed',
                creatureName: CREATURE,
                conditionLabel: label,
            });
        }
    );

    it('falls back to the effect key when the registry has no definition', () => {
        // The riderSaveDisadvantage compute-guard badge hard-codes
        // effectType 'disadvantage_on_next_save' without a registry lookup;
        // the module mock above makes getEffectDefinition miss for that key
        // so the removal row must name the raw key, never 'undefined'.
        renderBadgeFace(UNREGISTERED_KEY, CREATURE, { riderSaveDisadvantage: true });

        const removeBtns = screen.getAllByTitle('Remove effect');
        expect(removeBtns).toHaveLength(1);
        fireEvent.click(removeBtns[0]);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(logConditionEvent).toHaveBeenCalledTimes(1);
        expect(logConditionEvent).toHaveBeenCalledWith({
            campaignName: CAMPAIGN,
            action: 'target-effect-removed',
            creatureName: CREATURE,
            conditionLabel: UNREGISTERED_KEY,
        });
    });
});
