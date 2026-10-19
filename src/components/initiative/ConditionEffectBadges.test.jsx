// @maintained-by-ai
// Base lane for ConditionEffectBadges: empty-state canonical (cited by auras
// #828 / pass-without-trace), plus the base counter/flag faces the sibling
// lanes explicitly delegate here (save-ability, no-oa-speedy #827): the
// 'Speed -N' accumulator branches (incl. the 'Speed 0' >=1000 threshold),
// 'Disadv vs'/'No Adv vs' with guard precedence, '+5 to hit' rider bonus,
// Insp. Move from inspiringMovementNoOA, the CLA-353 negatives, and the
// 'No OA' badge carrying te source attribution.
// Dropped per carried recs: 'Save Disadv' rider row (#822 — common.test.jsx:82-97
// owns the surviving-badge + tooltip face through the same guard); 'No OA'
// label row (#827 — no-oa-speedy.test.jsx:90-99 owns the full face through
// the same guard). Golden te/aura/control/spell faces, dedupe/order (common
// #822), click→store removal (#825 lanes), and isLocalhost gating (#820)
// live in the sibling lanes — never re-pin them here.
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

// Falsy-guard house shape (control-spells/effect-removal pattern): every
// accumulator guard reads falsy except the reason arrays the builders and
// applyActiveBuffs may read/push; makeEffects flips exactly the flags a
// test exercises. Trimmed from 43 fields (REC #830) — unused fields read
// undefined-falsy safely at jsx:235-294.
const defaultEffects = {
    attackAdvantageReasons: [],
    targetAdvantageReasons: [],
    saveAdvantageReasons: [],
    saveDisadvantage: [],
};

function makeEffects(overrides = {}) {
    return { ...defaultEffects, ...overrides };
}

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => makeEffects({})),
}));

const CREATURE_NAME = 'Alice';
const CAMPAIGN_NAME = 'test-campaign';

// Determinism (#827): both mocks are pinned on every render, so no test can
// inherit a stale implementation from its predecessor. `runtime` flips only
// named runtime-store keys for CREATURE_NAME; everything else stays null.
function renderBadges({ targetEffects = [], effects = {}, runtime = {} } = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return [];
        if (name === CREATURE_NAME && key in runtime) return runtime[key];
        return null;
    });
    computeConditionEffects.mockReturnValue(makeEffects(effects));
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={targetEffects}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
        />
    );
}

describe('ConditionEffectBadges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('empty state', () => {
        it('should render nothing when conditions is empty and no effects apply', () => {
            renderBadges();
            // Exact count of 0 badges — testid catches span badges too,
            // which a role=button query would miss.
            expect(screen.queryAllByTestId('creature-badge')).toHaveLength(0);
        });
    });

    describe('badges from conditions and target effects', () => {
        it.each([
            ['Speed -15', { speedReduction: 15 }, 'Speed -15'],
            ['Speed 0', { speedReduction: 1000 }, 'Speed 0'],
            ['Disadv vs', { targetDisadvantageCount: 2 }, 'Disadv vs'],
            ['No Adv vs', { noAdvantageAgainst: true }, 'No Adv vs'],
            ['+5 to hit', { riderAttackBonus: 5 }, '+5 to hit'],
        ])('should render %s badge when condition is active', (_, effects, expectedLabel) => {
            renderBadges({ effects });
            // Each flag lights exactly one badge (#744).
            expect(screen.queryAllByTestId('creature-badge')).toHaveLength(1);
            expect(screen.getByText(expectedLabel)).toBeInTheDocument();
        });

        it('should prefer No Adv vs over Disadv vs when both are set', () => {
            renderBadges({ effects: { noAdvantageAgainst: true, targetDisadvantageCount: 3 } });
            expect(screen.getByText('No Adv vs')).toBeInTheDocument();
            expect(screen.queryByText('Disadv vs')).not.toBeInTheDocument();
            expect(screen.queryAllByTestId('creature-badge')).toHaveLength(1);
        });
    });

    describe('badges from props', () => {
        it('should render Insp. Move badge when inspiringMovementNoOA is set', () => {
            renderBadges({ runtime: { inspiringMovementNoOA: true } });
            expect(screen.getByText('Insp. Move')).toBeInTheDocument();
            // Exactly one badge — the key-pinned runtime mock must not light
            // Stealth Attack / Mnv. Move / No OA (Crit) siblings.
            expect(screen.queryAllByTestId('creature-badge')).toHaveLength(1);
        });

        // CLA-353: the tactical_shift_no_oa passive is permanent for lv5+ Fighters —
        // it must never render an always-on badge. Protection shows only via the
        // no_opportunity_attacks te written at Second Wind activation.
        it('does not render any no-OA move badge without inspiringMovementNoOA or the te (CLA-353)', () => {
            renderBadges();
            expect(screen.queryByText('Insp. Move')).not.toBeInTheDocument();
            expect(screen.queryByText('No OA')).not.toBeInTheDocument();
            expect(screen.queryAllByTestId('creature-badge')).toHaveLength(0);
        });

        it('renders No OA badge with Tactical Shift source from the te (CLA-353)', () => {
            renderBadges({
                effects: { riderCannotOpportunityAttack: true },
                targetEffects: [{ target: CREATURE_NAME, source: 'Tactical Shift', effect: 'no_opportunity_attacks', duration: 'until_start_of_next_turn' }],
            });
            expect(screen.queryAllByTestId('creature-badge')).toHaveLength(1);
            // Exact-byte tooltip (#829): buildNoOABadge at jsx:106 authors
            // 'No Opportunity Attacks (from <sources>)'.
            expect(screen.getByText('No OA').closest('[title]')).toHaveAttribute('title', 'No Opportunity Attacks (from Tactical Shift)');
        });
    });
});
