// @maintained-by-ai
// CLA-034: Beguiling Twist redirect confirm — char-sheet UI lane pins only (DC flows from the
// spell_save_dc payload seam, never a CHA-baked 13; save prompt carries the redirect condition;
// failing save merges + stamps a 10-round "1 minute" clock; passing save grants nothing).
// Handler internals (trigger tables, target eligibility) are owned by beguilingTwistHandler.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { createSaveListener } from '../../services/automation/common/savePrompt.js';
import { addEntry } from '../../services/ui/logService.js';
import { addExpiration } from '../../services/rules/effects/expirations.js';
import { setRuntimeValue, getRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../common/popup.jsx', () => ({
    default: ({ children }) => React.createElement('div', { 'data-testid': 'popup' }, children),
}));
vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
    default: () => React.createElement('div', null),
}));
vi.mock('./popups/MetamagicPopup.jsx', () => ({
    default: () => React.createElement('div', null),
}));
vi.mock('./modals/arcane/ArcaneWardRestoreModal.jsx', () => ({
    default: () => React.createElement('div', null),
}));
vi.mock('./modals/divine/BastionOfLawSpendModal.jsx', () => ({
    default: () => React.createElement('div', null),
}));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
    default: ({ title, featureDescription, onTargetSelected, onSkip }) =>
        React.createElement('div', { 'data-testid': 'secondary-target-modal' },
            React.createElement('span', { 'data-testid': 'modal-title' }, title),
            React.createElement('span', { 'data-testid': 'modal-desc' }, featureDescription),
            React.createElement('button', { 'data-testid': 'confirm-btn', onClick: () => onTargetSelected('Bandit 1') }, 'Confirm'),
            React.createElement('button', { 'data-testid': 'skip-btn', onClick: () => onSkip() }, 'Skip'),
        ),
}));
vi.mock('./modals/BendFateModal.jsx', () => ({ default: () => React.createElement('div', null) }));
vi.mock('./modals/BoonFateModal.jsx', () => ({ default: () => React.createElement('div', null) }));
vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({ default: () => React.createElement('div', null) }));
vi.mock('./modals/SearingVengeanceModal.jsx', () => ({
    default: ({ onConfirm, onSkip }) =>
        React.createElement('div', null,
            React.createElement('button', { 'data-testid': 'sv-confirm', onClick: () => onConfirm([{ name: 'Enemy1' }]) }, 'Confirm'),
            React.createElement('button', { 'data-testid': 'sv-skip', onClick: onSkip }, 'Skip'),
        ),
}));
vi.mock('../../services/ui/spellSectionUtils.js', () => ({
    getReactionSpellNames: vi.fn(() => new Set()),
    applyPotentSpellcasting: vi.fn(x => x),
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
    hasAutomation: vi.fn((r) => r?.automation?.type === 'reaction_save'),
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
    createSaveListener: vi.fn(() => ({ promptId: 'cla034-prompt' })),
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
    useSpellMetamagicFlow: vi.fn(() => ({ pendingMetamagic: null, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn() })),
}));
vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
    useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));
vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
    useSpellPositionResolver: vi.fn(() => ({ resolvePositions: vi.fn(), cachedPosRef: { current: null } })),
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

const campaignName = 'test-campaign';

const beguilingAction = {
    name: 'Beguiling Twist',
    description: 'Redirect a save.',
    automation: {
        type: 'reaction_save',
        trigger: 'save_success_charmed_frightened',
        saveType: 'WIS',
        saveDc: 'spell_save_dc',
        condition: 'charmed_frightened',
        duration: '1_minute',
        range: '120_ft',
        casting_time: '1 reaction',
        target: 'different_creature',
    },
};

const playerStats = {
    name: 'FeyRanger',
    level: 17,
    class: { name: 'Ranger' },
    reactions: [beguilingAction],
    attacks: [],
    spellAbilities: { modifier: 3, toHit: 9, saveDc: 17, spells: [], spellCastingAbility: 'WIS' },
    abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Charisma', bonus: -1 }],
    _trackedResources: {},
};

function modalPayload() {
    return {
        type: 'modal',
        modalName: 'beguilingTwist',
        payload: {
            targets: [{ name: 'Bandit 1', type: 'npc' }],
            action: beguilingAction,
            playerStats,
            campaignName,
            conditionKey: 'frightened',
            saveDc: 17,
            featureName: 'Beguiling Twist',
            rangeFt: 120,
            triggeredBy: 'FeyRanger',
        },
    };
}

function renderSheet() {
    render(
        <CharReactions
            playerStats={playerStats}
            campaignName={campaignName}
            cannotAct={false}
            mapName={null}
            characters={[]}
        />
    );
}

function logEntryByType(type) {
    return addEntry.mock.calls.map(c => c[1]).find(e => e.type === type);
}

async function openPicker() {
    fireEvent.click(screen.getByText('Beguiling Twist:'));
    await waitFor(() => expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument());
}

describe('CharReactions — CLA-034 Beguiling Twist confirm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useLoggedDiceRoll.mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
        useRuntimeValue.mockReturnValue([]);
        getRuntimeValue.mockReturnValue(null);
        executeHandler.mockResolvedValue(modalPayload());
        createSaveListener.mockReturnValue({ promptId: 'cla034-prompt' });
    });

    it('picker shows the seam DC (17, never a CHA-baked 13) and confirm wires the WIS save prompt + ability_use log at that DC', async () => {
        renderSheet();
        await openPicker();
        const desc = screen.getByTestId('modal-desc').textContent;
        expect(desc).toContain('DC 17');
        expect(desc).toContain('frightened');
        expect(desc).not.toContain('DC 13');

        fireEvent.click(screen.getByTestId('confirm-btn'));
        await waitFor(() => expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
            targetName: 'Bandit 1',
            saveType: 'WIS',
            saveDc: 17,
            condition: 'frightened',
            saveConditions: ['frightened'],
        }));

        const entry = logEntryByType('ability_use');
        expect(entry.characterName).toBe('FeyRanger');
        expect(entry.description).toContain('DC 17');
        expect(entry.description).toContain('different creature from FeyRanger');
        expect(entry.description).toContain('Bandit 1');
    });

    it('failed save merges frightened into existing conditions and stamps a 10-round (1 minute) clock', async () => {
        getRuntimeValue.mockImplementation((_name, key) => (key === 'activeConditions' ? ['poisoned'] : null));
        renderSheet();
        await openPicker();
        fireEvent.click(screen.getByTestId('confirm-btn'));
        window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: 'cla034-prompt', success: false } }));

        await waitFor(() => expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
            attackerName: 'FeyRanger',
            targetName: 'Bandit 1',
            campaignName,
            rounds: 10,
            effects: [{ type: 'condition', condition: 'frightened' }],
        })));
        expect(setRuntimeValue).toHaveBeenCalledWith('Bandit 1', 'activeConditions', ['poisoned', 'frightened'], campaignName);
        expect(logEntryByType('save_result')).toMatchObject({ targetName: 'Bandit 1', saveDc: 17, saveType: 'WIS', success: false });
    });

    it('successful save logs the pass and grants no condition, no clock', async () => {
        renderSheet();
        await openPicker();
        fireEvent.click(screen.getByTestId('confirm-btn'));
        window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: 'cla034-prompt', success: true } }));

        await waitFor(() => expect(logEntryByType('save_result')).toMatchObject({ targetName: 'Bandit 1', success: true }));
        expect(addExpiration).not.toHaveBeenCalled();
        expect(setRuntimeValue.mock.calls.some(c => c[1] === 'activeConditions')).toBe(false);
    });
});
