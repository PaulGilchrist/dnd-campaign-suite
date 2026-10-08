// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    getReactionSpellNames: vi.fn(() => new Set()),
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

import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { resolveSpellDamageAtLevel } from '../../services/rules/core/spellDamageUtils.js';
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
    const playerStats = { ...basePlayerStats, ...overrides.playerStats };
    return {
        playerStats,
        campaignName,
        cannotAct: false,
        mapName: null,
        characters: [],
        modalState: {},
        setModalState: vi.fn(),
        ...overrides,
    };
}

describe('CharReactions - Edge Cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeValue.mockReturnValue([]);
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        hasAutomation.mockReturnValue(false);
        buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
        getCategories.mockReturnValue({ featuresToIgnore: [] });
        getReactionSpellNames.mockReturnValue(new Set());
        resolveSpellDamageAtLevel.mockReturnValue(null);
        useLoggedDiceRoll.mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
    });

    // ─── Null/undefined prop handling ──────────────────────────────────────────
    // Consolidated: removed 20+ individual null/undefined tests that all asserted
    // the same thing (header renders). Coverage is provided by rendering.test.jsx
    // and integration.test.jsx which test the same structural resilience.

    it('throws when playerStats is null', () => {
        expect(() => render(<CharReactions playerStats={null} campaignName={campaignName} />)).toThrow();
    });

    it('renders header and opportunity attack when reactions is null', () => {
        const props = createProps({ playerStats: { ...basePlayerStats, reactions: null } });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    });

    it('renders header and opportunity attack when reactions is an empty array', () => {
        const props = createProps({ playerStats: { ...basePlayerStats, reactions: [] } });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    });

    it('throws when spellAbilities.spells is null (cannot access .length)', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                spellAbilities: { ...basePlayerStats.spellAbilities, spells: null },
            },
        });
        expect(() => render(<CharReactions {...props} />)).toThrow();
    });

    it('throws when reactions contains null element', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [null, { name: 'Opportunity Attack', description: '...' }],
            },
        });
        expect(() => render(<CharReactions {...props} />)).toThrow();
    });

    it('throws when getCategories throws', () => {
        getCategories.mockImplementation(() => { throw new Error('category error'); });
        const props = createProps();
        expect(() => render(<CharReactions {...props} />)).toThrow('category error');
    });

    // ─── Reaction rendering ────────────────────────────────────────────────────

    it('renders reaction with details property as clickable', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [
                    { name: 'Custom Reaction', description: 'Has details', details: 'Some detail' },
                ],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Custom Reaction:')).toHaveClass('clickable');
    });

    // FT-103 (inverted pin): the `reaction.name !== 'Reactive Strike'` hard-block
    // was removed — the automation-backed row is clickable and dispatches through
    // the generic hasAutomation → executeHandler lane.
    it('renders reactive strike as clickable when it carries automation (FT-103)', async () => {
        hasAutomation.mockImplementation((r) => !!(r && r.automation));
        executeHandler.mockResolvedValue(null);
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
        await waitFor(() => expect(executeHandler).toHaveBeenCalled());
    });

    it('renders automation-less reactive strike as non-clickable', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [
                    { name: 'Reactive Strike', description: 'Reactive strike desc' },
                ],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactive Strike:')).not.toHaveClass('clickable');
    });

    it('renders header when buildFeatureDetailHtml returns null for a reaction', () => {
        buildFeatureDetailHtml.mockReturnValue(null);
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [{ name: 'No Detail Reaction', description: 'No details' }],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
    });

    it('renders header when buildFeatureDetailHtml returns empty string', () => {
        buildFeatureDetailHtml.mockReturnValue('');
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [{ name: 'Empty Detail Reaction', description: 'Empty' }],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
    });

    // ─── Dynamic reactions from runtime values ─────────────────────────────────

    it('adds Revivification reaction when activeBuffs has buff with reactionSave', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'activeBuffs') return [{ reactionSave: { dc: 15, type: 'CON' } }];
            return [];
        });
        const props = createProps();
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.getByText('Revivification:')).toBeInTheDocument();
    });

    it('does not add Revivification when activeBuffs has buff without reactionSave', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'activeBuffs') return [{ effect: 'some_buff' }];
            return [];
        });
        const props = createProps();
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.queryByText('Revivification:')).not.toBeInTheDocument();
    });

    it('does not add duplicate Revivification when multiple buffs have reactionSave', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'activeBuffs') return [
                { reactionSave: { dc: 15, type: 'CON' } },
                { reactionSave: { dc: 12, type: 'CHA' } },
                { reactionSave: { dc: 10, type: 'WIS' } },
            ];
            return [];
        });
        const props = createProps();
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        const revivificationElements = screen.queryAllByText(/Revivification/);
        expect(revivificationElements).toHaveLength(1);
    });

    it('does not add duplicate Stand reaction when pwhStance is true and reaction already present', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'powerWordHealStandPermission') return true;
            return [];
        });
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
        expect(screen.getByText('Reactions')).toBeInTheDocument();
    });

    it('does not add Bastion of Law when wardActive is true but wardDice is empty', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'bastionOfLawActive') return true;
            if (key === 'bastionOfLawWardDice') return [];
            return [];
        });
        const props = createProps();
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.queryByText('Bastion of Law:')).not.toBeInTheDocument();
    });

    it('adds Bastion of Law when wardActive is true and wardDice has one element', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'bastionOfLawActive') return true;
            if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
            return [];
        });
        const props = createProps();
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.getByText('Bastion of Law:')).toBeInTheDocument();
    });

    it('does not add Bastion of Law when wardActive is falsy but wardDice has elements', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'bastionOfLawActive') return false;
            if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
            return [];
        });
        const props = createProps();
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.queryByText('Bastion of Law:')).not.toBeInTheDocument();
    });

    it('replaces Bastion of Law action with spend reaction when ward is active', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'bastionOfLawActive') return true;
            if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
            return [];
        });
        hasAutomation.mockImplementation((feature) => {
            if (feature?.automation?.type === 'bastion_of_law_spend') return true;
            return false;
        });
        executeHandler.mockResolvedValue({ type: 'modal', modalName: 'bastionOfLawSpend', payload: {} });
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
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        const bastionElements = screen.queryAllByText(/Bastion of Law:/);
        expect(bastionElements).toHaveLength(1);
        bastionElements[0].click();
        expect(executeHandler).toHaveBeenCalledTimes(1);
        const actionArg = executeHandler.mock.calls[0][0];
        expect(actionArg.automation.type).toBe('bastion_of_law_spend');
    });

    it('does not add duplicate Bastion of Law when wardActive is true and action already exists', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'bastionOfLawActive') return true;
            if (key === 'bastionOfLawWardDice') return [{ value: 8 }];
            return [];
        });
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
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        const bastionElements = screen.queryAllByText(/Bastion of Law:/);
        expect(bastionElements).toHaveLength(1);
    });

    it('does not add duplicate Opportunity Attack when already in reactions', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [
                    { name: 'Opportunity Attack', description: 'Custom desc' },
                ],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        const oaElements = screen.queryAllByText(/Opportunity Attack/);
        expect(oaElements).toHaveLength(1);
    });

    it('adds Opportunity Attack automatically when missing from reactions', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.getByText('Opportunity Attack:')).toBeInTheDocument();
    });

    // ─── Ignore list filtering ─────────────────────────────────────────────────

    it('hides all reactions when getCategories returns featuresToIgnore with all reaction names', () => {
        getCategories.mockReturnValue({
            featuresToIgnore: ['Opportunity Attack', 'Revivification', "Stone's Endurance", "Storm's Thunder", 'Bastion of Law', 'Stand (Power Word Heal)', 'Reactive Strike'],
        });
        const props = createProps();
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(screen.queryByText('Opportunity Attack:')).not.toBeInTheDocument();
    });

    // ─── Uses remaining display ────────────────────────────────────────────────

    it('renders "No uses remaining" when getRuntimeValue returns 0 for stonesEnduranceUses', () => {
        getRuntimeValue.mockReturnValue(0);
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [{ name: "Stone's Endurance", description: 'Original desc' }],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText(/No uses remaining/)).toBeInTheDocument();
    });

    it('renders "No uses remaining" when getRuntimeValue returns 0 for stormsThunderUses', () => {
        getRuntimeValue.mockReturnValue(0);
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [{ name: "Storm's Thunder", description: 'Original desc' }],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText(/No uses remaining/)).toBeInTheDocument();
    });

    it('renders uses from _trackedResources fallback when getRuntimeValue returns null for stonesEnduranceUses', () => {
        getRuntimeValue.mockReturnValue(null);
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                _trackedResources: { stonesEnduranceUses: { current: 5 } },
                reactions: [{ name: "Stone's Endurance", description: 'Original desc' }],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText(/5 uses remaining/)).toBeInTheDocument();
    });

    it('renders uses from _trackedResources fallback when getRuntimeValue returns null for stormsThunderUses', () => {
        getRuntimeValue.mockReturnValue(null);
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                _trackedResources: { stormsThunderUses: { current: 3 } },
                reactions: [{ name: "Storm's Thunder", description: 'Original desc' }],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText(/3 uses remaining/)).toBeInTheDocument();
    });

    it('renders "No uses remaining" when both runtime and _trackedResources sources are missing', () => {
        getRuntimeValue.mockReturnValue(null);
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

    // ─── Automation reaction types ─────────────────────────────────────────────

    it('renders header when playerStats.reactions has reaction with automation type revivification', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [
                    {
                        name: 'Revivification',
                        description: 'Rage reaction',
                        automation: { type: 'revivification', reactionSave: { dc: 15, type: 'CON' } },
                    },
                ],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
    });

    it('renders header when playerStats.reactions has reaction with automation type bastion_of_law_spend', () => {
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [
                    {
                        name: 'Bastion of Law',
                        description: 'Ward reaction',
                        automation: { type: 'bastion_of_law_spend' },
                    },
                ],
            },
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
    });

    it('renders header when hasAutomation returns true for a reaction', () => {
        hasAutomation.mockReturnValue(true);
        const props = createProps();
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
    });

    // ─── Runtime value error handling ──────────────────────────────────────────

    it('renders header when getRuntimeValue for activeConditions throws', () => {
        getRuntimeValue.mockImplementation((_charKey, key, _cn) => {
            if (key === 'activeConditions') throw new Error('runtime error');
            return null;
        });
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [{ name: 'Stand (Power Word Heal)', description: 'Stand up' }],
            },
        });
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'powerWordHealStandPermission') return true;
            return [];
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
    });

    it('renders header when setRuntimeValue for activeConditions throws', () => {
        setRuntimeValue.mockImplementation(() => { throw new Error('set error'); });
        getRuntimeValue.mockImplementation((_charKey, key, _cn) => {
            if (key === 'activeConditions') return ['Prone'];
            return null;
        });
        const props = createProps({
            playerStats: {
                ...basePlayerStats,
                reactions: [{ name: 'Stand (Power Word Heal)', description: 'Stand up' }],
            },
        });
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'powerWordHealStandPermission') return true;
            return [];
        });
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
    });

    // ─── Hooks arguments verification ──────────────────────────────────────────

    it('calls useRuntimeValue with correct keys for runtime reads', () => {
        const calls = [];
        useRuntimeValue.mockImplementation((charKey, key) => {
            calls.push({ charKey, key });
            return [];
        });
        getRuntimeValue.mockImplementation((charKey, key) => {
            calls.push({ charKey, key });
            return null;
        });
        const props = createProps();
        render(<CharReactions {...props} />);
        expect(screen.getByText('Reactions')).toBeInTheDocument();
        expect(calls.some(c => c.key === 'stonesEnduranceUses')).toBe(true);
        expect(calls.some(c => c.key === 'stormsThunderUses')).toBe(true);
    });
});
