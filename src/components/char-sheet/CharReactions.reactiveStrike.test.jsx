// FT-103: Reactive Strike reaction row — clickable, dispatches through the
// hasAutomation → executeHandler lane, and the returned attack_roll rides the
// verified OA adjudication seam (rollAttack with armed target + auto damage).
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
    default: () => React.createElement('div', { 'data-testid': 'secondary-target-modal' }, null),
}));
vi.mock('./modals/BendFateModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'bend-fate-modal' }, null),
}));
vi.mock('./modals/BoonFateModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'boon-fate-modal' }, null),
}));
vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'steps-of-fey-modal' }, null),
}));
vi.mock('./modals/SearingVengeanceModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'searing-vengeance-modal' }, null),
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
    hasAutomation: vi.fn((r) => !!(r && r.automation)),
    hasTacticalShift: vi.fn(() => false),
    hasSpeedyOpportunityDisadvantage: vi.fn(() => false),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(() => []),
    getRuntimeValue: vi.fn(() => null),
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

import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { executeHandler } from '../../services/automation/index.js';

const campaignName = 'test-campaign';

const REACTIVE_STRIKE = {
    name: 'Reactive Strike',
    description: 'While you\'re holding a Quarterstaff, a Spear, or a weapon that has the Heavy and Reach properties, you can take a Reaction to make one melee attack against a creature that enters the 5-foot reach you have with that weapon.',
    automation: {
        type: 'reaction_damage',
        trigger: 'creature_enters_reach_while_holding_polearm',
        range: '5_ft',
        effect: 'melee_attack',
        casting_time: '1 reaction',
    },
};

const basePlayerStats = {
    name: 'EvasiveFighter',
    level: 18,
    rules: '2024',
    class: { name: 'Fighter' },
    reactions: [REACTIVE_STRIKE],
    attacks: [
        { name: 'Glaive', type: 'Action', range: 5, hitBonus: 8, damage: '1d10+2', damageType: 'Slashing' },
    ],
    spellAbilities: { modifier: 3, toHit: 8, saveDc: 13, spells: [] },
    abilities: [
        { name: 'Strength', bonus: 4 },
        { name: 'Dexterity', bonus: 3 },
    ],
    _trackedResources: {},
};

function createProps(overrides = {}) {
    return {
        playerStats: basePlayerStats,
        campaignName,
        cannotAct: false,
        mapName: null,
        characters: [],
        ...overrides,
    };
}

describe('CharReactions - FT-103 Reactive Strike row', () => {
    let rollAttack;
    beforeEach(() => {
        vi.clearAllMocks();
        rollAttack = vi.fn();
        useLoggedDiceRoll.mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        executeHandler.mockResolvedValue(null);
    });

    it('renders the Reactive Strike row clickable', () => {
        render(<CharReactions {...createProps()} />);
        expect(screen.getByText('Reactive Strike:')).toHaveClass('clickable');
    });

    it('click dispatches the reaction through the automation router', async () => {
        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Reactive Strike:'));
        await waitFor(() => expect(executeHandler).toHaveBeenCalled());
        const [reaction, playerStats] = executeHandler.mock.calls[0];
        expect(reaction.name).toBe('Reactive Strike');
        expect(playerStats.name).toBe('EvasiveFighter');
    });

    it('attack_roll result resolves against the chosen entering target via the OA adjudication seam', async () => {
        executeHandler.mockResolvedValue({
            type: 'attack_roll',
            payload: {
                attack: { name: 'Glaive', hitBonus: 8, damage: '1d10+2', damageType: 'Slashing' },
                targetName: 'Bandit 1',
                sourceName: 'Reactive Strike',
            },
        });
        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Reactive Strike:'));

        await waitFor(() => expect(rollAttack).toHaveBeenCalled());
        expect(rollAttack).toHaveBeenCalledWith(
            'Glaive',
            8,
            expect.objectContaining({
                targetName: 'Bandit 1',
                isOpportunityAttack: true,
                autoDamageFormula: '1d10+2',
                autoDamageName: 'Glaive',
                damageType: 'Slashing',
            })
        );
    });

    it('popup refusal result surfaces the popup html (no attack roll)', async () => {
        executeHandler.mockResolvedValue({
            type: 'popup',
            payload: { type: 'automation_info', name: 'Reactive Strike', description: 'You have already used Reactive Strike this round.' },
        });
        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Reactive Strike:'));

        await waitFor(() => expect(executeHandler).toHaveBeenCalled());
        expect(rollAttack).not.toHaveBeenCalled();
    });
});
