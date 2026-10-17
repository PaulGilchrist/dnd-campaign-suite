// @maintained-by-ai
// MN-017: CharReactions.handleAutomationReaction must flush handler logEntries to the
// campaign log on EVERY handled result type (the drop shared with MN-013 Parry / CLA-228) —
// mirror of the MN-016 Rally flush. Three lanes, three pins:
//   attack_roll → flush + rollAttack; popup refusal → no flush, no roll (reaction unspent,
//   unique pin vs reactiveStrike #47); popup WITH logEntries → flush, still no roll.
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

import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { executeHandler } from '../../services/automation/index.js';
import { addEntry } from '../../services/ui/logService.js';

const campaignName = 'test-campaign';

const riposteReaction = {
    name: 'Riposte',
    description: 'When a creature misses you with a melee attack roll...',
    automation: { type: 'combat_superiority_reaction', maneuverName: 'Riposte', actionType: 'reaction', trigger: 'melee_attack_miss' },
    hasAutomation: true,
};

const basePlayerStats = {
    name: 'EvasiveFighter',
    level: 18,
    reactions: [riposteReaction],
    attacks: [{ name: 'Shortsword', type: 'Action', range: 5, hitBonus: 9, damage: '1d6+4', damageType: 'Piercing' }],
    spellAbilities: { modifier: 0, toHit: 9, saveDc: 17, spells: [] },
    abilities: [],
    _trackedResources: {},
};

function createProps() {
    return {
        playerStats: basePlayerStats,
        campaignName,
        cannotAct: false,
        mapName: null,
        characters: [],
    };
}

describe('CharReactions — MN-017 automation handler logEntries flush', () => {
    const rollAttack = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        useLoggedDiceRoll.mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        useRuntimeValue.mockReturnValue([]);
        hasAutomation.mockImplementation((r) => r.name === 'Riposte');
    });

    it('attack_roll result: flushes the ability_use entry AND arms rollAttack vs the attacker with auto damage', async () => {
        executeHandler.mockResolvedValue({
            type: 'attack_roll',
            payload: { attack: basePlayerStats.attacks[0], targetName: 'Thug 1' },
            logEntries: [{ type: 'ability_use', characterName: 'EvasiveFighter', abilityName: 'Riposte', targetName: 'Thug 1', description: 'EvasiveFighter used Riposte (Reaction) — melee attack against Thug 1.' }],
        });

        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Riposte:'));

        await waitFor(() => expect(rollAttack).toHaveBeenCalledTimes(1));
        expect(rollAttack).toHaveBeenCalledWith('Shortsword', 9, expect.objectContaining({
            targetName: 'Thug 1',
            isOpportunityAttack: true,
            autoDamageFormula: '1d6+4',
            autoDamageName: 'Shortsword',
            damageType: 'Piercing',
        }));
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Riposte',
            targetName: 'Thug 1',
        }));
    });

    it('popup refusal (ungated click refused): refusal payload reaches the popup, no roll, NO log flush', async () => {
        executeHandler.mockResolvedValue({
            type: 'popup',
            payload: { type: 'automation_info', name: 'Riposte', description: 'The last attack against you was not a miss.' },
        });

        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Riposte:'));

        await waitFor(() => expect(executeHandler).toHaveBeenCalledTimes(1));
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            type: 'automation_info',
            description: 'The last attack against you was not a miss.',
        }));
        expect(rollAttack).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('popup result WITH logEntries (e.g. Parry use) still flushes once — flush precedes the type branch', async () => {
        executeHandler.mockResolvedValue({
            type: 'popup',
            payload: { type: 'automation_info', name: 'Riposte', description: 'Riposte resolved.' },
            logEntries: [{ type: 'ability_use', characterName: 'EvasiveFighter', abilityName: 'Riposte', description: 'Riposte: Superiority Die expended.' }],
        });

        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Riposte:'));

        await waitFor(() => expect(addEntry).toHaveBeenCalledTimes(1));
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Riposte',
        }));
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ description: 'Riposte resolved.' }));
        expect(rollAttack).not.toHaveBeenCalled();
    });
});
