// @maintained-by-ai
// Save-dismiss leak pin for CharReactions.handleBeguilingTwistConfirm: the raw
// 'save-result' listener (beguiling-twist producer) registered beside
// createSaveListener's own listener used to be removed ONLY on a matching
// save-result arrival, so the GM's un-rolled Dismiss (which broadcasts the
// dedicated `save-dismissed` event, 2026-11-05 family) leaked one window
// listener + closure set per dismissed cast. Fix mirrors createSaveListener
// (savePrompt.js:167-172) and DivineSparkModal: a promptId-gated
// 'save-dismissed' companion detaches BOTH listeners and logs a
// beguiling_twist_refused row — zero further state, the reaction spend stays
// (§9 pay-early family). Ledger counting mirrors
// StepsOfTheFeyTauntModal.saveListenerCleanup.test.jsx: exact add/remove
// pairs per handler identity. UI-lane mocks reuse the
// CharReactions.cla034-beguiling-twist.test.jsx scaffold.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    // No self-registered routing listener here (unlike the StepsOfTheFey lane):
    // every ledger add/remove below belongs to the PRODUCER handler under test,
    // keeping the open-count exact.
    createSaveListener: vi.fn(() => ({ promptId: 'dismiss-prompt-1', promise: Promise.resolve({ promptId: 'dismiss-prompt-1', success: false }) })),
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
// Unique promptId per test (saveOnlyHandler.test.js:46-49 doctrine): listeners
// left armed by earlier tests must never match a later dispatch, or their
// self-removals pollute the leak ledger of the test being observed.
let promptCounter = 0;
let currentPromptId = 'dismiss-prompt-1';

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

function openPicker() {
    fireEvent.click(screen.getByText('Beguiling Twist:'));
    return waitFor(() => expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument());
}

// Leak ledger: records every add/remove of both save events (delegating to the
// real implementation so dispatch still reaches live listeners) with a net
// open count per event type.
function trackSaveLedger() {
    const ledger = { adds: [], removes: [], open: 0 };
    const realAdd = window.addEventListener.bind(window);
    const realRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
        if (type === 'save-result' || type === 'save-dismissed') {
            ledger.adds.push(fn);
            ledger.open += 1;
        }
        return realAdd(type, fn, opts);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
        if (type === 'save-result' || type === 'save-dismissed') {
            ledger.removes.push(fn);
            ledger.open -= 1;
        }
        return realRemove(type, fn, opts);
    });
    return ledger;
}

const removesFor = (ledger, fn) => ledger.removes.filter((f) => f === fn);

function dispatchSaveDismissed(promptId) {
    window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId } }));
}

function dispatchSaveResult(promptId, success) {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success } }));
}

const logEntriesByType = (type) => addEntry.mock.calls.map(c => c[1]).filter(e => e.type === type);
const refusalRows = () => logEntriesByType('automation').filter(e => e.automationDetail === 'beguiling_twist_refused');
const conditionsWrites = () => setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');

describe('CharReactions — Beguiling Twist save-dismiss listener detach', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useLoggedDiceRoll.mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
        useRuntimeValue.mockReturnValue([]);
        getRuntimeValue.mockReturnValue(null);
        executeHandler.mockResolvedValue(modalPayload());
        currentPromptId = `dismiss-prompt-${++promptCounter}`;
        createSaveListener.mockReturnValue({ promptId: currentPromptId, promise: Promise.resolve({ promptId: currentPromptId, success: false }) });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('confirm registers exactly one save-result + one save-dismissed producer listener', async () => {
        const ledger = trackSaveLedger();
        renderSheet();
        await openPicker();
        fireEvent.click(screen.getByTestId('confirm-btn'));

        expect(ledger.adds).toHaveLength(2);
        expect(ledger.adds.filter(f => f.name === 'handleSaveResult')).toHaveLength(1);
        expect(ledger.adds.filter(f => f.name === 'handleSaveDismissed')).toHaveLength(1);
        expect(ledger.open).toBe(2);
    });

    it('matching save-dismissed detaches BOTH listeners (zero net leak) and logs beguiling_twist_refused with zero state writes', async () => {
        const ledger = trackSaveLedger();
        renderSheet();
        await openPicker();
        fireEvent.click(screen.getByTestId('confirm-btn'));
        expect(ledger.open).toBe(2);

        dispatchSaveDismissed(currentPromptId);

        // Leak census: every added handler removed exactly once, ledger balanced.
        expect(ledger.open).toBe(0);
        expect(ledger.removes).toHaveLength(2);
        ledger.adds.forEach((fn) => {
            expect(removesFor(ledger, fn)).toHaveLength(1);
        });

        // Abandonment row only — the ability_use spend + refusal are the whole
        // story (§9 pay-early family).
        expect(refusalRows()).toHaveLength(1);
        expect(refusalRows()[0]).toMatchObject({
            type: 'automation',
            characterName: 'FeyRanger',
            abilityName: 'Beguiling Twist',
            automationType: 'reaction_save',
            automationDetail: 'beguiling_twist_refused',
            reason: 'save_dismissed',
        });
        expect(refusalRows()[0].description).toContain('Bandit 1');

        // Zero further state: no condition merge, no clock, no save_result row.
        expect(conditionsWrites()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(logEntriesByType('save_result')).toHaveLength(0);
    });

    it('save-dismissed for a different promptId stays inert (mismatch guard)', async () => {
        const ledger = trackSaveLedger();
        renderSheet();
        await openPicker();
        fireEvent.click(screen.getByTestId('confirm-btn'));

        dispatchSaveDismissed('someone-elses-prompt');

        expect(ledger.open).toBe(2);
        expect(ledger.removes).toHaveLength(0);
        expect(refusalRows()).toHaveLength(0);
        expect(conditionsWrites()).toHaveLength(0);
    });

    it('a resolved save-result detaches the dismissed companion too: a trailing save-dismissed cannot log a phantom refusal', async () => {
        const ledger = trackSaveLedger();
        renderSheet();
        await openPicker();
        fireEvent.click(screen.getByTestId('confirm-btn'));

        dispatchSaveResult(currentPromptId, false);
        await waitFor(() => expect(logEntriesByType('save_result')).toHaveLength(1));

        // Arrival path drains both handlers (idempotent with the dismiss path).
        expect(ledger.open).toBe(0);
        expect(logEntriesByType('save_result')[0]).toMatchObject({ targetName: 'Bandit 1', success: false });

        dispatchSaveDismissed(currentPromptId);
        expect(refusalRows()).toHaveLength(0);
    });
});
