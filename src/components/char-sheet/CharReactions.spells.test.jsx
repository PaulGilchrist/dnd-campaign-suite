// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';

vi.mock('../common/popup.jsx', () => ({
    default: ({ children }) => React.createElement('div', { 'data-testid': 'popup' }, children),
}));
vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
    default: ({ spell }) => React.createElement('div', { 'data-testid': 'spell-detail-popup' }, spell?.name),
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
vi.mock('../../services/ui/spellSectionUtils.js', async (importOriginal) => ({
    ...(await importOriginal()),
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
vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
    resolveSpellDamageAtLevel: vi.fn(),
    isAutoHitSpell: vi.fn(() => false),
    resolveHealExpression: vi.fn(),
}));

import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { resolveSpellDamageAtLevel, isAutoHitSpell, resolveHealExpression } from '../../services/rules/core/spellDamageUtils.js';
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';

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

const HELLISH_REBUKE = basePlayerStats.spellAbilities.spells[1];

const HEALING_SPELL = {
    name: 'Lesser Restoration',
    casting_time: '1 reaction',
    level: 2,
    range: 'Touch',
    prepared: 'Always',
    damage: null,
    heal_at_slot_level: true,
};

const THORN_WHIP = {
    name: 'Thorn Whip',
    casting_time: '1 reaction',
    level: 0,
    range: '30 ft.',
    prepared: 'Always',
    attack_type: 'melee',
    damage: '1d8 thunder',
    damage_type: 'thunder',
};

const AUTO_HIT_SPELL = {
    name: 'Guiding Bolt',
    casting_time: '1 reaction',
    level: 2,
    range: '120 ft.',
    prepared: 'Always',
    damage: '4d6 radiant',
    damage_type: 'radiant',
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

// Single-spell reaction table so getByText stays unambiguous per scenario.
function propsWithSpell(spell, overrides = {}) {
    return createProps({
        ...overrides,
        playerStats: {
            ...basePlayerStats,
            spellAbilities: { ...basePlayerStats.spellAbilities, spells: [spell] },
        },
    });
}

let gateMetamagic;
let rollAttack;

beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeValue.mockReturnValue([]);
    getRuntimeValue.mockReturnValue(null);
    setRuntimeValue.mockReturnValue(undefined);
    hasAutomation.mockReturnValue(false);
    buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
    getCategories.mockReturnValue({ featuresToIgnore: [] });
    getReactionSpellNames.mockReturnValue(new Set(['Shield', 'Hellish Rebuke']));
    resolveSpellDamageAtLevel.mockReturnValue('1d10');
    resolveHealExpression.mockReturnValue('2d8+3');
    isAutoHitSpell.mockReturnValue(false);
    gateMetamagic = vi.fn();
    rollAttack = vi.fn();
    useSpellMetamagicFlow.mockReturnValue({
        pendingMetamagic: null,
        gateMetamagic,
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
    });
    useLoggedDiceRoll.mockReturnValue({ rollAttack, rollDamage: vi.fn() });
});

describe('CharReactions - Reaction Spell Row Click Lanes', () => {
    // Damage cell is the SINGLE cast entry point (gateMetamagic); cannotAct must
    // short-circuit it. Heal spells ride the same lane via resolveHealExpression.
    it.each([
        { label: 'damage spell', cannotAct: false, spell: HELLISH_REBUKE, display: '1d10', expectCast: true },
        { label: 'healing spell', cannotAct: false, spell: HEALING_SPELL, display: '3d8+4', expectCast: true },
        { label: 'any spell', cannotAct: true, spell: HELLISH_REBUKE, display: '1d10', expectCast: false },
    ])('clicking the $label damage cell casts via gateMetamagic iff able to act (cannotAct: $cannotAct)', ({ cannotAct, spell, display, expectCast }) => {
        getReactionSpellNames.mockReturnValue(new Set([spell.name]));
        resolveSpellDamageAtLevel.mockReturnValue(display);
        resolveHealExpression.mockReturnValue(display);
        render(<CharReactions {...propsWithSpell(spell, { cannotAct })} />);

        fireEvent.click(screen.getByText(display));

        if (expectCast) {
            expect(gateMetamagic).toHaveBeenCalledWith(spell, expect.any(Object));
        } else {
            expect(gateMetamagic).not.toHaveBeenCalled();
        }
    });

    // fix#344(a) PIN FLIP (honest pin #1348 retired): this lane previously pinned
    // "visual disable on cannotAct, but the click handler stays attached and rolls
    // either way" — that WAS the bypass defect (SP-109/SP-109-class, ledger fix#337S
    // chips row). The hit chip now folds cannotAct silently exactly like canonical
    // handleReactionClick and refuses slowed clicks loudly via the same
    // isSlowed/refuseSlowedReaction gate (CharReactions.jsx:456-469).
    it.each([true, false])(
        'spell attack bonus cell renders disabled-attack when cannotAct=%s and rolls only when able to act',
        (cannotAct) => {
            getReactionSpellNames.mockReturnValue(new Set([THORN_WHIP.name]));
            resolveSpellDamageAtLevel.mockReturnValue('1d8+3 thunder');
            render(<CharReactions {...createProps({
                cannotAct,
                playerStats: {
                    ...basePlayerStats,
                    spellAbilities: { ...basePlayerStats.spellAbilities, toHit: 5, spells: [THORN_WHIP] },
                },
            })} />);

            const attackCell = screen.getByText('+5');
            expect(attackCell).toHaveClass('clickable');
            if (cannotAct) {
                expect(attackCell).toHaveClass('disabled-attack');
            } else {
                expect(attackCell).not.toHaveClass('disabled-attack');
            }
            fireEvent.click(attackCell);
            if (cannotAct) {
                expect(rollAttack).not.toHaveBeenCalled();
            } else {
                expect(rollAttack).toHaveBeenCalledWith('Thorn Whip', 5, expect.any(Object));
            }
        }
    );

    it('clicking a spell name opens its detail popup for the clicked spell', () => {
        render(<CharReactions {...createProps()} />);
        expect(screen.queryByTestId('popup')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Hellish Rebuke'));

        const popup = screen.getByTestId('popup');
        expect(within(popup).getByText('Hellish Rebuke')).toBeInTheDocument();
    });

    it('auto-hit spell shows no attack bonus but its damage cell casts via gateMetamagic', () => {
        isAutoHitSpell.mockReturnValue(true);
        getReactionSpellNames.mockReturnValue(new Set([AUTO_HIT_SPELL.name]));
        resolveSpellDamageAtLevel.mockReturnValue('4d6+3 radiant');
        render(<CharReactions {...propsWithSpell(AUTO_HIT_SPELL)} />);

        expect(screen.queryByText('+6')).not.toBeInTheDocument();
        const damageCell = screen.getByText('4d6+3 radiant');
        expect(damageCell).toHaveClass('clickable');

        fireEvent.click(damageCell);
        expect(gateMetamagic).toHaveBeenCalledWith(AUTO_HIT_SPELL, expect.any(Object));
    });
});
