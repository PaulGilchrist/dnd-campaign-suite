// @maintained-by-ai
// Pass Without Trace badge-face lane (SP-085): golden render of the
// 'pass_without_trace_bonus' targetEffect — label/icon read from the live
// registry via getEffectDefinition (never hand-typed), the builder's
// hardcoded 'effect-buff' semantic class (jsx:126 overrides the registry's
// 'effect-target-adv'), exact count of 1 with a same-kind decoy aimed at a
// different creature folded into the render, caster attribution in the
// tooltip, and the localhost × affordance.
// Owned elsewhere, not repeated here: empty state lives in
// ConditionEffectBadges.test.jsx:73-89; isLocalhost remove-gating face in
// auras.test.jsx:91-98; wrong-target findDirect map in
// control-spells.test.jsx:67-73; dedupe in common.test.jsx; the
// click→store removal dispatch for this badge's generic removeAction
// 'target_effect' (jsx:126) lives in target-effect-removal.test.jsx:98-137.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

// Falsy-guard house shape (auras-lane pattern): with every accumulator
// guard falsy, only the find-based pass_without_trace spec can produce a
// badge here. Built once in the factory and never overridden, so there is
// no mockReturnValue carry-over to reset (#827 lesson).
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({})),
}));

const CREATURE_NAME = 'FeyRanger';
const SOURCE = 'Zephyra';
const CAMPAIGN_NAME = 'test-campaign';

describe('ConditionEffectBadges — Pass Without Trace badge (SP-085)', () => {
    it('renders exactly one golden badge from registry bytes, attributed to its caster, removable on localhost', () => {
        render(
            <ConditionEffectBadges
                conditions={[]}
                targetEffects={[
                    { target: 'Bob', effect: 'pass_without_trace_bonus', source: 'Decoy Caster' },
                    { target: CREATURE_NAME, effect: 'pass_without_trace_bonus', source: SOURCE },
                ]}
                creatureName={CREATURE_NAME}
                campaignName={CAMPAIGN_NAME}
                isLocalhost={true}
            />
        );

        const def = getEffectDefinition('pass_without_trace_bonus');
        expect(screen.getAllByTestId('creature-badge')).toHaveLength(1);
        const badge = screen.getByText(def.label);
        expect(badge.className).toBe('creature-badge effect-buff');
        expect(badge.querySelector('i').className).toBe(`fa-solid ${def.icon}`);
        expect(badge.title).toContain(SOURCE);
        expect(screen.getByTitle('Remove effect')).toBeInTheDocument();
    });
});
