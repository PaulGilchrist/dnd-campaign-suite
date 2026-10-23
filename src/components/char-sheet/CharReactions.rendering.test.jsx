// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';

vi.mock('../common/popup.jsx', () => ({
    default: ({ children }) => React.createElement('div', { 'data-testid': 'popup' }, children),
}));
vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'spell-detail-popup' }, null),
}));
vi.mock('./popups/MetamagicPopup.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'metamagic-popup' }, null),
}));
vi.mock('./modals/arcane/ArcaneWardRestoreModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'arcane-ward-restore' }, null),
}));
vi.mock('./modals/divine/BastionOfLawSpendModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'bastion-of-law-spend' }, null),
}));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
    default: ({ title, onTargetSelected, onSkip }) =>
        React.createElement('div', { 'data-testid': 'secondary-target-modal' },
            React.createElement('span', { 'data-testid': 'modal-title' }, title),
            React.createElement('button', { 'data-testid': 'confirm-btn', onClick: () => onTargetSelected('Target1') }, 'Confirm'),
            React.createElement('button', { 'data-testid': 'skip-btn', onClick: () => onSkip() }, 'Skip'),
        ),
}));
vi.mock('./modals/BendFateModal.jsx', () => ({
    default: ({ onClose }) =>
        React.createElement('div', { 'data-testid': 'bend-fate-modal', onClick: onClose }, null),
}));
vi.mock('./modals/BoonFateModal.jsx', () => ({
    default: ({ onClose }) =>
        React.createElement('div', { 'data-testid': 'boon-fate-modal', onClick: onClose }, null),
}));
vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({
    default: ({ onClose }) =>
        React.createElement('div', { 'data-testid': 'steps-of-fey-modal', onClick: onClose }, null),
}));
vi.mock('./modals/SearingVengeanceModal.jsx', () => ({
    default: ({ onConfirm, onSkip }) =>
        React.createElement('div', { 'data-testid': 'searing-vengeance-modal' },
            React.createElement('button', { 'data-testid': 'sv-confirm', onClick: () => onConfirm([{ name: 'Enemy1' }]) }, 'Confirm'),
            React.createElement('button', { 'data-testid': 'sv-skip', onClick: onSkip }, 'Skip'),
        ),
}));
vi.mock('../../services/ui/spellSectionUtils.js', () => ({
    getReactionSpellNames: vi.fn(() => new Set(['Shield', 'Hellish Rebuke'])),
}));
vi.mock('../../services/character/featureCategories.js', () => ({
    getCategories: vi.fn(() => ({ featuresToIgnore: [] })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: (html) => html }));
vi.mock('../../hooks/combat/useActionPopup.js', () => ({
    buildFeatureDetailHtml: vi.fn((reaction) => `<div>${reaction.name}</div>`),
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(),
}));
vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
    useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));
vi.mock('../../services/combat/baseCombatActions.js', () => ({
    OPPORTUNITY_ATTACK: { name: 'Opportunity Attack', description: 'Can attack creature that moves out of your reach' },
    MELEE_REACH_FEET: 5,
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasAutomation: vi.fn(() => false),
    hasTacticalShift: vi.fn(() => false),
    hasSpeedyOpportunityDisadvantage: vi.fn(() => false),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/automation/index.js', () => ({
    executeHandler: vi.fn(),
    confirmSearingVengeance: vi.fn(),
    skipSearingVengeance: vi.fn(),
}));
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
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
    useSpellMetamagicFlow: vi.fn(() => ({
        pendingMetamagic: null,
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
    })),
}));
vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
    useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));
vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
    useSpellPositionResolver: vi.fn(() => ({
        resolvePositions: vi.fn(),
        cachedPosRef: { current: null },
    })),
}));
vi.mock('../../hooks/combat/useSpellCastExecutor.js', () => ({
    useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));
vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
    resolveSpellDamageAtLevel: vi.fn(),
    isAutoHitSpell: vi.fn(() => false),
    resolveHealExpression: vi.fn(),
}));
vi.mock('../../services/ui/formatUtils.js', () => ({
    signFormatter: { format: (val) => (val >= 0 ? '+' : '') + val },
}));

import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation, hasTacticalShift, hasSpeedyOpportunityDisadvantage } from '../../services/combat/automation/automationService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { resolveSpellDamageAtLevel, isAutoHitSpell, resolveHealExpression } from '../../services/rules/core/spellDamageUtils.js';

const campaignName = 'test-campaign';

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
        spells: [
            { name: 'Shield', casting_time: '1 reaction', level: 1, range: 'Self', prepared: 'Always', damage: null, heal_at_slot_level: false },
            { name: 'Hellish Rebuke', casting_time: '1 reaction', level: 1, range: '60 ft.', prepared: 'Always', damage: { expression: '1d10', damage_type: 'fire' }, heal_at_slot_level: false },
        ],
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

describe('CharReactions - Basic Rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'powerWordHealStandPermission') return false;
            if (key === 'bastionOfLawActive') return false;
            if (key === 'bastionOfLawWardDice') return [];
            return [];
        });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        hasAutomation.mockReturnValue(false);
        hasTacticalShift.mockReturnValue(false);
        hasSpeedyOpportunityDisadvantage.mockReturnValue(false);
        getCombatContext.mockResolvedValue(null);
        getTargetFromAttacker.mockReturnValue(null);
        buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
        getCategories.mockReturnValue({ featuresToIgnore: [] });
        getReactionSpellNames.mockReturnValue(new Set(['Shield', 'Hellish Rebuke']));
        resolveSpellDamageAtLevel.mockReturnValue('1d10');
        resolveHealExpression.mockReturnValue('2d8+3');
        isAutoHitSpell.mockReturnValue(false);
        useLoggedDiceRoll.mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
    });

    afterEach(cleanup);

    // Section-absence guard (reactionSpells.length > 0). spells.test.jsx owns the
    // positive spell-row rendering; this file owns the negative for both branches
    // of buildReactions: empty eligible-name set (filter leg) and null
    // spellAbilities (guard leg).
    // fix#148 arms: the guard leg only guarded the container — the inner spells
    // array was dereferenced unguarded (CharReactions.jsx:144 `.spells.length`).
    // Persisted disk census shows slot-only containers (test-campaign
    // HeroesFeastBard.json carries spell_slots_level_1..9 with no spells key), and
    // the store round-trip can carry { spells: null }. absent/null/[] all reach the
    // same UI outcome (section omitted, reactions list intact) — silent guard per
    // fix#40 precedent and the house `?.spells` treatment (spellSectionUtils.js:53,
    // formatUtils.js:19). The populated arm proves the optional-chain is not
    // vacuous: real rows still list through the same guard.
    it.each([
        ['no reaction spells are configured', () => {
            getReactionSpellNames.mockReturnValue(new Set());
            return createProps();
        }],
        ['spellAbilities is null', () => {
            return createProps({
                playerStats: { ...basePlayerStats, spellAbilities: null },
            });
        }],
        ['spellAbilities.spells is null', () => {
            return createProps({
                playerStats: { ...basePlayerStats, spellAbilities: { ...basePlayerStats.spellAbilities, spells: null } },
            });
        }],
        ['spellAbilities has no spells key (disk shape)', () => {
            const slotOnlyContainer = Object.fromEntries(
                Object.entries(basePlayerStats.spellAbilities).filter(([key]) => key !== 'spells'),
            );
            return createProps({
                playerStats: { ...basePlayerStats, spellAbilities: slotOnlyContainer },
            });
        }],
        ['spellAbilities.spells is empty', () => {
            return createProps({
                playerStats: { ...basePlayerStats, spellAbilities: { ...basePlayerStats.spellAbilities, spells: [] } },
            });
        }],
    ])('does not render the reaction spells section when %s', (_label, buildProps) => {
        render(<CharReactions {...buildProps()} />);
        expect(screen.queryByText('Range')).not.toBeInTheDocument();
        expect(screen.queryByText('Shield')).not.toBeInTheDocument();
        expect(screen.queryByText('Hellish Rebuke')).not.toBeInTheDocument();
        // Reactions list still renders — the guard hides only the spell table.
        expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    });

    it('still lists reaction spells when the spells array is populated (non-vacuous guard)', () => {
        // Same section-absence assertions inverted: the exact spell row that the
        // null/absent/[] arms above omit must appear byte-identical in label when
        // a legal spells array is present, proving fix#148's ?. chain passes
        // populated paths through unchanged.
        render(<CharReactions {...createProps()} />);
        expect(screen.getByText('Range')).toBeInTheDocument();
        expect(screen.getByText('Shield')).toBeInTheDocument();
        expect(screen.getByText('Hellish Rebuke')).toBeInTheDocument();
        expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    });

    it('renders the reactions list identically for null, absent, and empty spells arrays (#1348 same-empty-state)', () => {
        // Identical-input, differing-output discrimination: all three absent-ish
        // shapes must produce the SAME DOM as each other (section omitted), not
        // just "not the populated DOM".
        const shapes = [
            { ...basePlayerStats.spellAbilities, spells: null },
            (() => Object.fromEntries(Object.entries(basePlayerStats.spellAbilities).filter(([key]) => key !== 'spells')))(),
            { ...basePlayerStats.spellAbilities, spells: [] },
        ];
        const containers = shapes.map((spellAbilities, i) => {
            const { container } = render(<CharReactions {...createProps({ playerStats: { ...basePlayerStats, spellAbilities } })} key={i} />);
            return container;
        });
        expect(containers[0].textContent).toBe(containers[1].textContent);
        expect(containers[1].textContent).toBe(containers[2].textContent);
        // And that shared DOM is the section-omitted state.
        expect(containers[0].textContent).not.toContain('Range');
        expect(containers[0].textContent).toContain('Opportunity Attack:');
    });

    // Dynamic-grant negative (appendDynamicReactions, CharReactions.jsx:82):
    // without the PWH stance the Stand row must never appear. Positive grant
    // is pinned by the click lane in handlers.test.jsx and the dedupe pin in
    // edgeCases.test.jsx — this is the app-wide-gap counterpart.
    it('does not render the Stand (Power Word Heal) row when the PWH stance is not granted', () => {
        // beforeEach pins powerWordHealStandPermission=false.
        render(<CharReactions {...createProps()} />);
        expect(screen.queryByText('Stand (Power Word Heal):')).not.toBeInTheDocument();
        // Sanity: rows do render in this config, so the absence above is meaningful.
        expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    });
});
