// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';

const { mockSetPopupHtml } = vi.hoisted(() => ({ mockSetPopupHtml: vi.fn() }));

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
    getReactionSpellNames: vi.fn(() => new Set()),
    applyPotentSpellcasting: vi.fn((s) => s),
}));
vi.mock('../../services/character/featureCategories.js', () => ({
    getCategories: vi.fn(() => ({ featuresToIgnore: [] })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: (html) => (typeof html === 'string' ? html : String(html ?? '')) }));
vi.mock('../../hooks/combat/useActionPopup.js', () => ({
    buildFeatureDetailHtml: vi.fn((reaction) => `<div>${reaction.name}</div>`),
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(),
}));
vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
    useDiceRollPopup: vi.fn(() => ({ setPopupHtml: mockSetPopupHtml })),
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
    useRuntimeValue: vi.fn(() => []),
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

import { useRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { executeHandler } from '../../services/automation/index.js';

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
        spells: [],
    },
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Wisdom', bonus: 2 },
    ],
    _trackedResources: {},
};

function createProps(overrides = {}) {
    return {
        playerStats: { ...basePlayerStats, ...overrides.playerStats },
        campaignName,
        cannotAct: false,
        mapName: null,
        characters: [],
        ...overrides,
    };
}

// Runtime reads default to "nothing dynamic active"; override per key in tests.
function runtimeWith(overrides = {}) {
    useRuntimeValue.mockImplementation((_charKey, key) =>
        key in overrides ? overrides[key] : []);
}

describe('CharReactions - dynamic reaction list assembly', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSetPopupHtml.mockReset();
        runtimeWith();
        getRuntimeValue.mockReturnValue(null);
        hasAutomation.mockReturnValue(false);
        buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
        getCategories.mockReturnValue({ featuresToIgnore: [] });
        executeHandler.mockResolvedValue(null);
        useLoggedDiceRoll.mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
    });

    // ─── Opportunity Attack is the base reaction everyone gets ─────────────
    // (Click-through roll lane is covered in CharReactions.handlers.test.jsx.)

    it.each([
        ['null', null],
        ['an empty array', []],
        ['reactions without one', [{ name: 'Other Reaction', description: 'other' }]],
    ])('renders exactly one clickable Opportunity Attack row when reactions is %s', (_label, reactions) => {
        const props = createProps({ playerStats: { ...basePlayerStats, reactions } });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        const rows = screen.queryAllByText('Opportunity Attack:');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveClass('clickable');
    });

    it('keeps a character-provided Opportunity Attack without duplicating or overwriting it', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [{ name: 'Opportunity Attack', description: 'Custom OA desc' }],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.queryAllByText('Opportunity Attack:')).toHaveLength(1);
        expect(screen.getByText('Custom OA desc')).toBeInTheDocument();
    });

    // ─── Revivification rides in on active buffs ─────────────────────────────

    it('adds exactly one Revivification row from reactionSave buffs, never duplicated', () => {
        runtimeWith({
            activeBuffs: [
                { reactionSave: { dc: 15, type: 'CON' } },
                { reactionSave: { dc: 12, type: 'CHA' } },
            ],
        });
        render(<CharReactions {...createProps()} />);
        expect(screen.queryAllByText('Revivification:')).toHaveLength(1);
    });

    it('does not add Revivification when active buffs carry no reactionSave', () => {
        runtimeWith({ activeBuffs: [{ effect: 'some_buff' }] });
        render(<CharReactions {...createProps()} />);
        expect(screen.queryByText('Revivification:')).not.toBeInTheDocument();
    });

    it('does not duplicate the Stand (Power Word Heal) row when it is already in reactions', () => {
        runtimeWith({ powerWordHealStandPermission: true });
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [
                    { name: 'Opportunity Attack', description: '...' },
                    { name: 'Stand (Power Word Heal)', description: 'Already present' },
                ],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.queryAllByText('Stand (Power Word Heal):')).toHaveLength(1);
    });

    // ─── Bastion of Law ward state drives the row ────────────────────────────

    it.each([
        ['ward active but no dice', true, []],
        ['ward inactive but dice held', false, [{ value: 8 }]],
    ])('does not show a Bastion of Law ward row when %s', (_label, wardActive, wardDice) => {
        runtimeWith({ bastionOfLawActive: wardActive, bastionOfLawWardDice: wardDice });
        render(<CharReactions {...createProps()} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.queryByText('Bastion of Law:')).not.toBeInTheDocument();
    });

    it('adds a Bastion of Law ward row with remaining dice count when ward is active', () => {
        runtimeWith({ bastionOfLawActive: true, bastionOfLawWardDice: [{ value: 8 }] });
        render(<CharReactions {...createProps()} />);
        expect(screen.queryAllByText('Bastion of Law:')).toHaveLength(1);
        expect(screen.getByText(/1d8 remaining/)).toBeInTheDocument();
    });

    // FT-103 contrast: the existing bastion_of_law ACTION row is REPLACED by the
    // spend variant so clicking spends dice instead of creating a new ward.
    it('replaces a Bastion of Law action row with the spend reaction and dispatches it on click', async () => {
        runtimeWith({ bastionOfLawActive: true, bastionOfLawWardDice: [{ value: 8 }] });
        hasAutomation.mockImplementation((feature) => feature?.automation?.type === 'bastion_of_law_spend');
        executeHandler.mockResolvedValue(null);
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [
                    { name: 'Opportunity Attack', description: 'Can attack creature that moves out of your reach' },
                    { name: 'Bastion of Law', description: 'Action desc', automation: { type: 'bastion_of_law' } },
                ],
            },
        });
        render(<CharReactions {...props} />);
        const rows = screen.queryAllByText('Bastion of Law:');
        expect(rows).toHaveLength(1);
        fireEvent.click(rows[0]);
        await waitFor(() => expect(executeHandler).toHaveBeenCalledTimes(1));
        expect(executeHandler.mock.calls[0][0].automation.type).toBe('bastion_of_law_spend');
    });
});

describe('CharReactions - row clickability and popup lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSetPopupHtml.mockReset();
        runtimeWith();
        getRuntimeValue.mockReturnValue(null);
        hasAutomation.mockReturnValue(false);
        buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
        getCategories.mockReturnValue({ featuresToIgnore: [] });
        executeHandler.mockResolvedValue(null);
        useLoggedDiceRoll.mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
    });

    // FT-103 (inverted pin): the `reaction.name !== 'Reactive Strike'` hard-block
    // was removed — automation-backed rows ride the generic executeHandler lane.
    it('clicking an automation-backed reaction dispatches through executeHandler', async () => {
        hasAutomation.mockImplementation((r) => !!(r && r.automation));
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [
                    {
                        name: 'Reactive Strike',
                        description: 'Reactive strike desc',
                        automation: { type: 'reaction_damage', trigger: 'creature_enters_reach_while_holding_polearm' },
                    },
                ],
            },
        });
        render(<CharReactions {...props} />);
        const row = screen.getByText('Reactive Strike:');
        expect(row).toHaveClass('clickable');
        fireEvent.click(row);
        await waitFor(() => expect(executeHandler).toHaveBeenCalledTimes(1));
        expect(executeHandler.mock.calls[0][0].name).toBe('Reactive Strike');
    });

    it('renders a non-automated custom reaction as non-clickable', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [{ name: 'Reactive Strike', description: 'No automation here' }],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactive Strike:')).not.toHaveClass('clickable');
    });

    it('clicking a details-only reaction opens its detail popup', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [{ name: 'Custom Reaction', description: 'Has details', details: 'Some detail' }],
            },
        });
        render(<CharReactions {...props} />);
        const row = screen.getByText('Custom Reaction:');
        expect(row).toHaveClass('clickable');
        fireEvent.click(row);
        expect(mockSetPopupHtml).toHaveBeenCalledWith('<div>Custom Reaction</div>');
    });

    it.each([['empty string', ''], ['null', null]])(
        'opens no popup when the detail html is %s', (_label, html) => {
            buildFeatureDetailHtml.mockReturnValue(html);
            const props = createProps({
                playerStats: {
                    ...basePlayerStats,
                    reactions: [{ name: 'No Detail Reaction', description: 'desc', details: 'd' }],
                },
            });
            render(<CharReactions {...props} />);
            fireEvent.click(screen.getByText('No Detail Reaction:'));
            expect(mockSetPopupHtml).not.toHaveBeenCalled();
            expect(screen.getByText('Reactions')).toBeInTheDocument();
        });

    it('hides every listed reaction — static and buff-granted — via featuresToIgnore', () => {
        runtimeWith({ activeBuffs: [{ reactionSave: { dc: 15, type: 'CON' } }] });
        getCategories.mockReturnValue({
            featuresToIgnore: ['Opportunity Attack', 'Revivification', "Stone's Endurance", "Storm's Thunder", 'Bastion of Law', 'Stand (Power Word Heal)', 'Reactive Strike'],
        });
        render(<CharReactions {...createProps()} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.queryByText('Opportunity Attack:')).not.toBeInTheDocument();
        expect(screen.queryByText('Revivification:')).not.toBeInTheDocument();
    });
});

describe('CharReactions - tracked uses display', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSetPopupHtml.mockReset();
        runtimeWith();
        hasAutomation.mockReturnValue(false);
        buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
        getCategories.mockReturnValue({ featuresToIgnore: [] });
        useLoggedDiceRoll.mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
    });

    it.each([
        ["Stone's Endurance", 'stonesEnduranceUses', 5, null],
        ["Storm's Thunder", 'stormsThunderUses', 2, null],
        ["Stone's Endurance", 'stonesEnduranceUses', null, { current: 5 }],
        ["Storm's Thunder", 'stormsThunderUses', null, { current: 3 }],
    ])('shows the live use count for %s (runtime=%s, tracked fallback=%o)', (_name, resourceKey, runtimeValue, tracked) => {
        getRuntimeValue.mockImplementation((_charKey, key) => (key === resourceKey ? runtimeValue : null));
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                _trackedResources: tracked ? { [resourceKey]: tracked } : {},
                reactions: [{ name: _name, description: 'Original desc' }],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText(new RegExp(`${runtimeValue ?? tracked.current} uses remaining`))).toBeInTheDocument();
    });

    it.each([
        ['runtime reports zero', () => getRuntimeValue.mockReturnValue(0)],
        ['no source reports any uses', () => getRuntimeValue.mockReturnValue(null)],
    ])('shows "No uses remaining" for Stone\'s Endurance when %s', (_label, setup) => {
        setup();
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                _trackedResources: {},
                reactions: [{ name: "Stone's Endurance", description: 'Original desc' }],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText(/No uses remaining/)).toBeInTheDocument();
    });
});
