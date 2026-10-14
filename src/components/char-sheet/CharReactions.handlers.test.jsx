import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

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

describe('CharReactions - handleReactionClick', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useLoggedDiceRoll.mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
    });

    it('handles Stand (Power Word Heal) reaction - removes prone condition and sets permission to false', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'powerWordHealStandPermission') return true;
            if (key === 'activeBuffs') return [];
            return [];
        });
        getRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'activeConditions') return ['Prone', 'Poisoned'];
            return null;
        });

        const props = createProps();
        render(<CharReactions {...props} />);

        const standReaction = screen.getByText('Stand (Power Word Heal):');
        fireEvent.click(standReaction);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'activeConditions',
            ['Poisoned'],
            campaignName
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'powerWordHealStandPermission',
            false,
            campaignName
        );
    });

    it('does not update activeConditions when prone is already absent', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'powerWordHealStandPermission') return true;
            if (key === 'activeBuffs') return [];
            return [];
        });
        getRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'activeConditions') return ['Poisoned'];
            return null;
        });

        const props = createProps();
        render(<CharReactions {...props} />);

        const standReaction = screen.getByText('Stand (Power Word Heal):');
        fireEvent.click(standReaction);

        const conditionCalls = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');
        expect(conditionCalls.length).toBe(0);
    });

    it('sets permission to false even when no conditions change', () => {
        useRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'powerWordHealStandPermission') return true;
            if (key === 'activeBuffs') return [];
            return [];
        });
        getRuntimeValue.mockImplementation((_charKey, key) => {
            if (key === 'activeConditions') return [];
            return null;
        });

        const props = createProps();
        render(<CharReactions {...props} />);

        const standReaction = screen.getByText('Stand (Power Word Heal):');
        fireEvent.click(standReaction);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'powerWordHealStandPermission',
            false,
            campaignName
        );
    });
});
