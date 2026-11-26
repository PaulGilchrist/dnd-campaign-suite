// @maintained-by-ai 2026-10-29
// Registry-fallback lane for ConditionEffectBadges: every stored targetEffect
// whose key has NO dedicated BADGE_SPECS entry must still render exactly one
// generic badge built from getEffectDefinition (label/icon/cls/description)
// with the standard target_effect removal affordance. Live bug (2026-10-29):
// the GM EffectAdder applied redirect_attack, it persisted + logged, but no
// badge rendered anywhere — invisible and unremovable from the UI.
// Contract pinned here:
//   1. spec-less registry te → one removable generic badge;
//   2. × click = ONE byte-exact campaign write (target+effect filtered);
//   3. effects with a dedicated spec (rendered OR guard-suppressed) and te
//      keys whose badge lives on CreatureCard (CARD_DEDICATED_TE_BADGES)
//      get NO generic duplicate;
//   4. unknown (unregistered) keys stay honest — no fabricated badge;
//   5. array targets resolve via target[0] (findResolved convention).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

// Fully caller-controlled compute: empty shape keeps every accumulator guard
// falsy so only find-specs and the registry-fallback pass can produce badges.
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(),
}));

const CREATURE = 'Alice';
const CAMPAIGN = 'test-campaign';

function renderBadges(targetEffects, props = {}) {
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE && key === 'activeBuffs') return [];
        if (name === 'campaign' && key === 'targetEffects') return targetEffects;
        return null;
    });
    computeConditionEffects.mockReturnValue({});
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={targetEffects}
            creatureName={CREATURE}
            campaignName={CAMPAIGN}
            isLocalhost={true}
            {...props}
        />
    );
}

function renderedBadgeLabels() {
    return screen.queryAllByTestId('creature-badge').map(el => el.textContent.trim());
}

describe('ConditionEffectBadges - registry-fallback generic badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders one generic badge for a spec-less registry effect (redirect_attack repro)', () => {
        const te = { target: CREATURE, effect: 'redirect_attack', source: 'Goblin Boss' };
        renderBadges([te]);
        expect(renderedBadgeLabels()).toEqual(['Redirected Attack']);
        const def = getEffectDefinition('redirect_attack');
        const badge = screen.getByTestId('creature-badge');
        expect(badge).toHaveClass('creature-badge', def.cls);
        expect(badge.querySelector('i')).toHaveClass(`fa-solid`, def.icon);
        expect(screen.getByTestId('creature-badge')).toHaveAttribute('title', `${def.description} (from Goblin Boss)`);
        // Standard sibling × affordance
        expect(screen.getAllByTitle('Remove effect')).toHaveLength(1);
    });

    it('removes the spec-less effect via one byte-exact campaign write', () => {
        const te = { target: CREATURE, effect: 'redirect_attack', source: 'Goblin Boss' };
        const decoy = { target: 'Bob', effect: 'redirect_attack', source: 'Other' };
        renderBadges([te, decoy]);
        fireEvent.click(screen.getByTitle('Remove effect'));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [decoy],
            CAMPAIGN
        );
    });

    // EG 2026-11-17 improve (dual-badge clarity): while a Wild Shape form is
    // active the card shows this registry mirror AND the CreatureCard-owned
    // activeBuffs badge hardcoded as 'Wild Shape'. The mirror must render the
    // distinct registry label — never the bare 'Wild Shape' duplicate — while
    // keeping its generic target_effect removal affordance (semantics
    // unchanged: × evicts only the te row, the buff lane keeps cleanupWildShape).
    it('renders the wild_shape mirror with a label distinct from the Wild Shape buff badge', () => {
        renderBadges([{ target: CREATURE, effect: 'wild_shape', source: CREATURE, beastName: 'Wolf' }]);
        expect(renderedBadgeLabels()).toEqual(['Wild Shape (Beast Form)']);
        const badge = screen.getByTestId('creature-badge');
        expect(badge).toHaveClass('creature-badge', 'effect-buff');
        expect(badge.querySelector('i')).toHaveClass('fa-solid', 'fa-paw');
        expect(badge).toHaveAttribute(
            'title',
            `${getEffectDefinition('wild_shape').description} (from ${CREATURE})`
        );
        expect(screen.queryByText('Wild Shape', { selector: '.creature-badge' })).not.toBeInTheDocument();
        expect(screen.getAllByTitle('Remove effect')).toHaveLength(1);
    });

    it('appends GM notes to the generic tooltip and renders without a source', () => {
        renderBadges([{ target: CREATURE, effect: 'no_healing', notes: 'until spirit turn ends' }]);
        const def = getEffectDefinition('no_healing');
        expect(renderedBadgeLabels()).toEqual([def.label]);
        expect(screen.getByTestId('creature-badge')).toHaveAttribute('title', `${def.description} — until spirit turn ends`);
    });

    it('renders a generic badge for an array-target spec-less effect via target[0]', () => {
        const def = getEffectDefinition('lair_fog_cloud');
        renderBadges([{ target: [CREATURE, 'Bob'], effect: 'lair_fog_cloud' }]);
        expect(renderedBadgeLabels()).toEqual([def.label]);
    });

    it('does NOT duplicate a dedicated spec badge (silenced renders exactly once)', () => {
        renderBadges([{ target: CREATURE, effect: 'silenced', source: 'Wizard' }]);
        expect(renderedBadgeLabels()).toEqual(['Silenced']);
    });

    it('does NOT fabricate a badge for a guard-suppressed dedicated effect (bless_bonus)', () => {
        // bless_bonus has a find+guard spec; with neutral compute the spec
        // intentionally stays silent and the fallback must respect that.
        renderBadges([{ target: CREATURE, effect: 'bless_bonus', source: 'Cleric' }]);
        expect(renderedBadgeLabels()).toEqual([]);
    });

    it.each([
        'resilient_sphere',
        'polymorph',
        'animal_shapes',
        'shapechange',
        'summoned',
        'reckless_attack',
        'starry_form',
    ])('does NOT duplicate the CreatureCard-owned badge for %s', (effect) => {
        renderBadges([{ target: CREATURE, effect, source: 'Wizard' }]);
        expect(screen.queryAllByTestId('creature-badge')).toHaveLength(0);
    });

    it('renders nothing for unknown effect keys (honesty contract)', () => {
        renderBadges([{ target: CREATURE, effect: 'not_a_real_effect', source: 'Bob' }]);
        expect(screen.queryAllByTestId('creature-badge')).toHaveLength(0);
    });

    it('renders one badge per distinct spec-less effect and none for other creatures', () => {
        renderBadges([
            { target: CREATURE, effect: 'redirect_attack' },
            { target: CREATURE, effect: 'goad' },
            { target: 'Bob', effect: 'no_healing' },
        ]);
        expect(renderedBadgeLabels()).toEqual(['Redirected Attack', 'Goad']);
    });

    it('hides the × affordance for non-localhost viewers but keeps the badge', () => {
        renderBadges([{ target: CREATURE, effect: 'redirect_attack' }], { isLocalhost: false });
        expect(renderedBadgeLabels()).toEqual(['Redirected Attack']);
        expect(screen.queryByTitle('Remove effect')).not.toBeInTheDocument();
    });
});
