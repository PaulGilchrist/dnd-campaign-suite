// @maintained-by-ai
// MA-1012: Ice Devil Ice Spear frozen_grip badge consumer lane. The composite
// te rides in via the hit_target_effect passthrough; the real fold in
// conditionEffects.js adds te.value||10 to speedReduction, so the accumulator
// guard builds the SAME label 'Speed -10' — dedupeByLabel first-wins keeps the
// frozen_grip spec's badge (its §70 tooltip disambiguates). That collision is
// this lane's canonical face, cited by #822 (old :47-63, now :57-74). Fixture shapes here
// mirror the real fold; storage.js is NOT imported by the component (dead mock
// removed, REC #823). Generic first-wins machinery lives in common (#822),
// click→store removal in the removal lanes (#825), wrong-target in #823.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
}));

// Fold-shaped base: only speedReduction gates a badge on this lane; every
// other guard reads falsy so the frozen_grip badge renders in isolation.
const defaultEffects = {
    speedReduction: 0,
};

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({ ...defaultEffects })),
}));

const CREATURE_NAME = 'Bandit 1';
const CAMPAIGN_NAME = 'test-campaign';

function renderFrozenGrip(te, foldedReduction) {
    getRuntimeValue.mockReturnValue(null);
    computeConditionEffects.mockReturnValue({ ...defaultEffects, speedReduction: foldedReduction, riderNoReactions: true });
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={[te]}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
        />
    );
}

describe('MA-1012 frozen_grip badge consumer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders exactly one Speed -10 badge from the frozen_grip te with the frozen_grip remove key and honest tooltip', () => {
        getRuntimeValue.mockReturnValue(null);
        computeConditionEffects.mockReturnValue({ ...defaultEffects, speedReduction: 10, riderNoReactions: true });
        render(
            <ConditionEffectBadges
                conditions={[]}
                targetEffects={[{ target: CREATURE_NAME, source: 'Ice Devil 1', effect: 'frozen_grip', duration: 'until_start_of_next_turn' }]}
                creatureName={CREATURE_NAME}
                campaignName={CAMPAIGN_NAME}
            />
        );
        const badges = screen.getAllByText('Speed -10');
        expect(badges).toHaveLength(1);
        const badge = badges[0].closest('[title]');
        expect(badge.getAttribute('title')).toContain('Frozen Grip');
        expect(badge.getAttribute('title')).toContain('Ice Devil 1');
        expect(badge.getAttribute('title')).toContain('GM-enforced');
    });

    it('surfaces the live te.value ledger, not the RAW default, when the grip carries a custom reduction', () => {
        // Mirror the real fold (conditionEffects.js frozen_grip: te.value||10)
        // so the accumulator guard builds 'Speed -15' too — dedupeByLabel
        // first-wins must keep frozen_grip's badge and no default-10 ghost.
        renderFrozenGrip({ target: CREATURE_NAME, source: 'Ice Devil 1', effect: 'frozen_grip', value: 15 }, 15);
        const badges = screen.getAllByText('Speed -15');
        expect(badges).toHaveLength(1);
        expect(screen.queryByText('Speed -10')).toBeNull();
        expect(badges[0].closest('[title]').getAttribute('title')).toContain('Speed reduced by 15 ft');
    });

    it('pins the ticket-authored label and tooltip literally — these bytes are spec-authored, not registry-derived', () => {
        // The registry would say label 'Frozen Grip' (golden elsewhere); the
        // MA-1012 badge spec in ConditionEffectBadges.jsx deliberately authors
        // the numeric 'Speed -N' label colliding with speed_reduction plus its
        // own §70 advisory tooltip. A refactor deriving them from the registry
        // must break here loudly.
        expect(getEffectDefinition('frozen_grip').label).toBe('Frozen Grip');
        renderFrozenGrip({ target: CREATURE_NAME, source: 'Ice Devil 1', effect: 'frozen_grip', duration: 'until_start_of_next_turn' }, 10);
        const badge = screen.getByText('Speed -10').closest('[title]');
        expect(badge.getAttribute('title')).toBe(
            'Frozen Grip by Ice Devil 1: Speed reduced by 10 ft and no Reactions until the end of the next turn; no Bonus Action, and it can move or take one action, not both (GM-enforced, \u00A770 advisory)'
        );
    });
});
