// @maintained-by-ai
// Golden lane for the disadvantage_next_attack badge (CLA-158): the badge face
// comes from the targetEffectDefinitions registry (golden-bytes-once #820) and
// the tooltip must cite the effect's source. Owned elsewhere: dedupe collision
// mechanism — common #822; generic wrong-target exclusion — control-spells
// #823 :67-73; array-target findResolved shape — auras #820 :101-110;
// click→store removal — target-effect-removal ('target_effect' removeAction)
// and effect-removal; consumption/decay of this one-shot te lives in services
// (reactionDebuffHandler, weaponMasteryHandler, viciousMockeryHandler), not
// this render seam.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

const RUG = 'Animated Rug of Smothering 1';
const CAMPAIGN = 'test-campaign';

// Real authored sources of this te (reactionDebuffHandler, viciousMockeryHandler).
function sapEffect(source) {
    return { target: RUG, source, effect: 'disadvantage_next_attack', duration: 'until_used' };
}

describe('ConditionEffectBadges — disadvantage_next_attack badge (CLA-158)', () => {
    beforeEach(() => {
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    it('renders the golden registry badge with the sap source in its tooltip', () => {
        render(
            <ConditionEffectBadges
                conditions={[]}
                targetEffects={[sapEffect('Hand of Harm')]}
                creatureName={RUG}
                campaignName={CAMPAIGN}
            />
        );
        const def = getEffectDefinition('disadvantage_next_attack');
        const badge = screen.getByText(def.label);
        expect(badge.querySelector('i')).toHaveClass(def.icon);
        expect(badge.getAttribute('title')).toContain('next attack roll');
        expect(badge.getAttribute('title')).toContain('Hand of Harm');
    });

    it('renders exactly one badge when multiple sources sap the same creature', () => {
        render(
            <ConditionEffectBadges
                conditions={[]}
                targetEffects={[sapEffect('Hand of Harm'), sapEffect('Vicious Mockery')]}
                creatureName={RUG}
                campaignName={CAMPAIGN}
            />
        );
        expect(screen.getAllByText(getEffectDefinition('disadvantage_next_attack').label)).toHaveLength(1);
    });
});
