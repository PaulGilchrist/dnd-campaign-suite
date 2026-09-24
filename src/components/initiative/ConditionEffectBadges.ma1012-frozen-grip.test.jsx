// MA-1012: Ice Devil Ice Spear frozen_grip badge consumer leg. The
// composite te registers via the hit_target_effect passthrough; the
// ConditionEffectBadges.jsx findDirect spec must render a single removable
// "Speed -10" badge carrying the 'frozen_grip' remove key (label collides
// with the speed_reduction accumulator guard on purpose so dedupeByLabel
// keeps this spec — its remove targets the standing te). Tooltip carries the
// honest full clause incl. §70 GM-enforced advisory copy.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

const defaultEffects = {
    cannotAct: false,
    speedZero: false,
    speedReduction: 0,
    pushEffect: false,
    pushDistance: null,
    riderNoReactions: false,
};

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({ ...defaultEffects })),
}));

const CREATURE_NAME = 'Bandit 1';
const CAMPAIGN_NAME = 'test-campaign';

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
});
