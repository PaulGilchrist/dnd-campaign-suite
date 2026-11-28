// @maintained-by-ai 2026-11-27 CharReactions REACTION-ROW VISIBILITY lane: which rows appear under which
// states — reaction-spell section gate (length-guard legs vs filter leg) and
// the PWH stance-row negative. Pre-refresh harness purged (slow #1970 idiom):
// 7 modal mocks + MetamagicPopup + popup/SpellDetailPopup (no click lane here —
// modalState/selectedSpell/pendingMetamagic can never populate, none can mount),
// baseCombatActions + formatUtils + spellSectionUtils + spellDamageUtils mirror
// mocks (rows ride the REAL constants/eligibility/damage math — eligibility is
// props-driven now: '1 reaction' + prepared), useSpellCastExecutor mock, and the
// phantom hasTacticalShift key (CharReactions.jsx:23 imports exactly
// hasAutomation + hasSpeedyOpportunityDisadvantage). Row assembly/dedup →
// edgeCases (23 observed); click dispatch → handlers (5) / slow (5) / OA (14);
// spell-row cells + castable testids → spells (10).
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';

// Only surfaces this lane can reach/mount are mocked; the rest are import-graph
// containment for modules the component statically imports but this lane never
// dispatches into (click/handler territory lives in the sibling lanes).
vi.mock('../../services/character/featureCategories.js', () => ({
    getCategories: vi.fn(() => ({ featuresToIgnore: [] })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: (html) => html }));
vi.mock('../../hooks/combat/useActionPopup.js', () => ({
    buildFeatureDetailHtml: vi.fn(),
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ rollAttack: vi.fn(), rollDamage: vi.fn() })),
}));
vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
    useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({
    // CharReactions.jsx:23 imports exactly these two; hasTacticalShift was a
    // phantom exported-but-never-imported key (#1910/#1964).
    hasAutomation: vi.fn(() => false),
    hasSpeedyOpportunityDisadvantage: vi.fn(() => false),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    // No per-test overrides in this visibility lane, so the keyed baseline
    // lives in the factory (mockClear/reset never run here).
    useRuntimeValue: vi.fn((_charKey, key) => {
        if (key === 'powerWordHealStandPermission') return false;
        return [];
    }),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/automation/index.js', () => ({
    executeHandler: vi.fn(),
    confirmSearingVengeance: vi.fn(),
    skipSearingVengeance: vi.fn(),
}));
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));
vi.mock('../../services/automation/handlers/reactions/reactionSpellHandler.js', () => ({
    applyWarCasterReaction: vi.fn(),
}));
vi.mock('../../services/automation/handlers/reactions/reactionBonusHandler.js', () => ({
    applyInspiringMovement: vi.fn(),
}));
vi.mock('./useAttackDamageResolution.js', () => ({
    normalizeAutoDamage: vi.fn(),
    resolveAttackDamageStandalone: vi.fn(),
}));
vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
    useSpellMetamagicFlow: vi.fn(() => ({ pendingMetamagic: null })),
}));
vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
    useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: () => [] })),
}));
vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
    useSpellPositionResolver: vi.fn(() => ({
        resolvePositions: () => {},
        cachedPosRef: { current: null },
    })),
}));

const campaignName = 'test-campaign';

const baseSpell = (name, castingTime, extra = {}) => ({
    name,
    casting_time: castingTime,
    level: 1,
    range: 'Self',
    prepared: 'Always',
    damage: null,
    heal_at_slot_level: false,
    ...extra,
});

const reactionSpells = [
    baseSpell('Shield', '1 reaction'),
    baseSpell('Hellish Rebuke', '1 reaction', { range: '60 ft.', damage: { expression: '1d10', damage_type: 'fire' } }),
];

const basePlayerStats = {
    name: 'TestFighter',
    level: 5,
    class: { name: 'Fighter' },
    reactions: [
        { name: 'Opportunity Attack', description: 'Can attack creature that moves out of your reach' },
    ],
    attacks: [
        { name: 'Longsword', type: 'Action', range: 5, hitBonus: 6 },
    ],
    spellAbilities: {
        modifier: 3,
        toHit: 6,
        saveDc: 13,
        spells: reactionSpells,
    },
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Wisdom', bonus: 2 },
    ],
    _trackedResources: {},
};

function createProps(overrides = {}) {
    const playerStats = { ...basePlayerStats, ...overrides.playerStats };
    return {
        playerStats,
        campaignName,
        cannotAct: false,
        mapName: null,
        characters: [],
        ...overrides,
    };
}

describe('CharReactions - reaction-row visibility', () => {
    // Section-absence guard legs. fix#148: the `?.spells?.length` guard covers
    // the inner array, not just the container — pre-fix, slot-only containers
    // (disk census: test-campaign HeroesFeastBard.json carries
    // spell_slots_level_1..9 with no spells key) and store round-trips carrying
    // { spells: null } crashed on `.spells.length`. All absent-ish shapes hit
    // the SAME falsy leg of the one guard (a falsy-variant family per
    // #1897/#1920), so they are pinned as ONE identical-output case: each shape
    // renders (a null-deref would throw), all DOMs are byte-equal to each
    // other (#1348 same-empty-state), and the shared DOM is the section-
    // omitted face with the reactions list intact. Falsifiability: reverting
    // the optional-chain throws on the null/absent arms; widening the guard to
    // always-render would leak the 'Range' header into every arm.
    it('renders identical section-omitted DOM for null container, null/absent/empty spells (#1348/#148)', () => {
        const slotOnlyContainer = Object.fromEntries(
            Object.entries(basePlayerStats.spellAbilities).filter(([key]) => key !== 'spells'),
        );
        const shapes = [
            null,
            { ...basePlayerStats.spellAbilities, spells: null },
            slotOnlyContainer,
            { ...basePlayerStats.spellAbilities, spells: [] },
        ];
        const texts = shapes.map((spellAbilities) => {
            const { container } = render(
                <CharReactions {...createProps({ playerStats: { ...basePlayerStats, spellAbilities } })} />,
            );
            return container.textContent;
        });
        const [nullContainer, nullSpells, absentSpells, emptySpells] = texts;
        expect(nullSpells).toBe(absentSpells);
        expect(absentSpells).toBe(emptySpells);
        expect(nullContainer).toBe(emptySpells);
        for (const text of texts) {
            expect(text).not.toContain('Range');
            expect(text).not.toContain('Shield');
            // Reactions list still renders — the guard hides only the spell table.
            expect(text).toContain('Opportunity Attack:');
        }
    });

    // The OTHER guard leg: spells array populated but the filter yields nothing
    // eligible (real getReactionSpellNames: reaction casting time AND prepared
    // are both required — two falsy filter legs collapse into one empty-set
    // case, #1897). Distinct from the length-guard arms above: here
    // spellAbilities.spells.length > 0 passes and only the filter empties it.
    it('omits the reaction-spells section when no listed spell is an eligible reaction spell', () => {
        render(<CharReactions {...createProps({
            playerStats: {
                ...basePlayerStats,
                spellAbilities: {
                    ...basePlayerStats.spellAbilities,
                    spells: [
                        baseSpell('Fireball', '1 action', { level: 3, range: '150 ft.' }),
                        baseSpell('Counterspell', '1 reaction', { prepared: 'Not' }),
                    ],
                },
            },
        })} />);
        expect(screen.queryByText('Range')).not.toBeInTheDocument();
        expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
        expect(screen.queryByText('Counterspell')).not.toBeInTheDocument();
        expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    });

    // Populated arm — proves neither the length guard nor the filter is
    // vacuous: exactly the eligible rows list, each getByText query pins
    // uniqueness (duplicates would throw), and the ineligible spell is absent.
    it('lists exactly the eligible reaction spells, once each, when the section renders', () => {
        render(<CharReactions {...createProps({
            playerStats: {
                ...basePlayerStats,
                spellAbilities: {
                    ...basePlayerStats.spellAbilities,
                    spells: [...reactionSpells, baseSpell('Fireball', '1 action', { level: 3, range: '150 ft.' })],
                },
            },
        })} />);
        expect(screen.getByText('Range')).toBeInTheDocument();
        expect(screen.getByText('Shield')).toBeInTheDocument();
        expect(screen.getByText('Hellish Rebuke')).toBeInTheDocument();
        expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
        expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    });

    // Dynamic-grant negative (appendDynamicReactions, CharReactions.jsx:84):
    // without the PWH stance the Stand row must never appear. Positive grant
    // is pinned by the click lane in handlers.test.jsx and the dedupe pin in
    // edgeCases.test.jsx — this is the app-wide-gap counterpart.
    it('does not render the Stand (Power Word Heal) row when the PWH stance is not granted', () => {
        // Runtime baseline pins powerWordHealStandPermission=false.
        render(<CharReactions {...createProps()} />);
        expect(screen.queryByText('Stand (Power Word Heal):')).not.toBeInTheDocument();
        // Sanity: rows do render in this config, so the absence above is meaningful.
        expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    });
});
