// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
vi.mock('../../hooks/combat/DiceRollContext.js', () => {
    const mockSetPopupHtml = vi.fn();
    return {
        useDiceRollPopup: vi.fn(() => ({ setPopupHtml: mockSetPopupHtml })),
        _getMockSetPopupHtml: () => mockSetPopupHtml,
    };
});
vi.mock('../../services/combat/baseCombatActions.js', () => ({
    OPPORTUNITY_ATTACK: { name: 'Opportunity Attack', description: 'Can attack creature that moves out of your reach' },
    MELEE_REACH_FEET: 5,
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasAutomation: vi.fn(() => false),
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

import { useRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation, hasSpeedyOpportunityDisadvantage } from '../../services/combat/automation/automationService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { addEntry } from '../../services/ui/logService.js';
import { _getMockSetPopupHtml } from '../../hooks/combat/DiceRollContext.js';

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
        ...overrides,
    };
}

// Drain the click's promise chain (all-async, timer-free) so negative
// "did not roll / did not log" assertions run after the lane has finished.
async function flushClickChain() {
    await act(async () => {
        await Promise.resolve();
    });
}

describe('CharReactions - Opportunity Attack click lane', () => {
    let setPopupHtml;
    let rollAttack;

    beforeEach(() => {
        vi.clearAllMocks();
        setPopupHtml = _getMockSetPopupHtml();
        rollAttack = vi.fn();
        useLoggedDiceRoll.mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        useRuntimeValue.mockReturnValue([]);
        getRuntimeValue.mockReturnValue(null);
        hasAutomation.mockReturnValue(false);
        hasSpeedyOpportunityDisadvantage.mockReturnValue(false);
        buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
        getCategories.mockReturnValue({ featuresToIgnore: [] });
        getReactionSpellNames.mockReturnValue(new Set());
        getCombatContext.mockResolvedValue(null);
    });

    // No applicable target-side refusal: the OA must roll the melee attack
    // flagged isOpportunityAttack, with no popup and no log entry. Covers all
    // three short-circuit branches of the refusal resolver plus the
    // unprotected-target path (CLA-353: a permanent tactical_shift_no_oa
    // passive alone never refuses — cs combatants carry no passives, so only
    // live runtime protections gate the roll).
    // [label, setup]
    it.each([
        ['no combat context', () => getCombatContext.mockResolvedValue(null)],
        ['combat context lookup rejects', () => getCombatContext.mockRejectedValue(new Error('network error'))],
        ['no combat target', () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue(null);
        }],
        ['unprotected target (CLA-353 passive must not refuse)', () => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Enemy1', passives: [{ name: 'tactical_shift_no_oa' }] });
        }],
    ])('rolls the melee attack flagged isOpportunityAttack when there is %s', async (_label, setup) => {
        setup();
        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        await waitFor(() => expect(rollAttack).toHaveBeenCalledWith(
            'Longsword',
            6,
            expect.objectContaining({ isOpportunityAttack: true })
        ));
        expect(setPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    // Weapon picker: prefer a melee-reach attack; fall back to the first
    // attack when none is in melee reach.
    // [label, attacks, expectedWeapon]
    it.each([
        ['only a ranged attack exists', [{ name: 'Ranged Bolt', type: 'Action', range: 120, hitBonus: 6 }], 'Ranged Bolt'],
        ['a ranged attack is listed before the melee one', [
            { name: 'Ranged Bolt', type: 'Action', range: 120, hitBonus: 6 },
            { name: 'Longsword', type: 'Action', range: 5, hitBonus: 6 },
        ], 'Longsword'],
    ])('picks %s as the OA weapon', async (_label, attacks, expectedWeapon) => {
        render(<CharReactions {...createProps({ playerStats: { ...basePlayerStats, attacks } })} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        await waitFor(() => expect(rollAttack).toHaveBeenCalledWith(
            expectedWeapon,
            6,
            expect.objectContaining({ isOpportunityAttack: true })
        ));
    });

    it('does nothing when the character has no attacks', async () => {
        render(<CharReactions {...createProps({ playerStats: { ...basePlayerStats, attacks: [] } })} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        await flushClickChain();
        expect(rollAttack).not.toHaveBeenCalled();
        expect(setPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    // Protected-target refusals (CLA-353): gated on the per-character
    // inspiringMovementNoOA runtime key OR a live campaign-level
    // no_opportunity_attacks te — never a permanent passive. The refusal
    // popup names the protector, is logged, and the attack does not roll.
    // [label, protector, runtimeSetup]
    it.each([
        ['inspiringMovementNoOA', 'Inspiring Movement', () => getRuntimeValue.mockImplementation((charKey, key) =>
            key === 'inspiringMovementNoOA' ? true : null)],
        ['a campaign no_opportunity_attacks te', 'Tactical Shift', () => getRuntimeValue.mockImplementation((charKey, key) =>
            charKey === 'campaign' && key === 'targetEffects'
                ? [{ target: 'Enemy1', source: 'Tactical Shift', effect: 'no_opportunity_attacks', duration: 'until_start_of_next_turn' }]
                : null)],
    ])('refuses with a popup naming %label and logs it', async (_label, protector, runtimeSetup) => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Enemy1' });
        runtimeSetup();

        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        // The log fires after the popup, so waiting on it proves both ran.
        await waitFor(() => expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            name: 'Opportunity Attack',
            description: expect.stringContaining(protector),
        })));
        expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Enemy1'));
        expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining(protector));
        expect(rollAttack).not.toHaveBeenCalled();
    });

    // Agile Movement is an informational popup (disadvantage), not a refusal:
    // unlike protected-target refusals it never logs.
    it('shows the Agile Movement popup without rolling or logging when the target has speedy disadvantage', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Enemy1' });
        hasSpeedyOpportunityDisadvantage.mockReturnValue(true);

        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        await waitFor(() => expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Agile Movement')));
        expect(hasSpeedyOpportunityDisadvantage).toHaveBeenCalledWith({ name: 'Enemy1' });
        expect(rollAttack).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
