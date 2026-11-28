// @maintained-by-ai 2026-11-27 CharReactions Stand-row dispatch: ordered chargeSlot→writes census, exact popup copy, RB-1115 zero-write denial; phantom hasTacticalShift mock key purged.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
    // CharReactions.jsx:23 imports exactly these two; hasTacticalShift was a
    // phantom key (on disk, never imported by this component).
    hasAutomation: vi.fn(() => false),
    hasSpeedyOpportunityDisadvantage: vi.fn(() => false),
}));
vi.mock('../../services/combat/chargeEconomy.js', () => ({
    // Real module returns false with zero writes when enforcement is off, but
    // mocking lets this lane pin the L5-002 dispatch itself: chargeSlot's
    // exact args and its ORDER in the click sequence.
    chargeSlot: vi.fn(() => false),
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
import { chargeSlot } from '../../services/combat/chargeEconomy.js';
import { addEntry } from '../../services/ui/logService.js';
import { CANNOT_ACT_REASON } from '../../services/combat/canTakeAction.js';

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

// Runtime reads default to "nothing dynamic active"; override per key in tests.
function runtimeWith(overrides = {}) {
    useRuntimeValue.mockImplementation((_charKey, key) =>
        key in overrides ? overrides[key] : []);
}

// Exact confirmation copy from CharReactions.jsx:580 (stand lane, non-OA popup).
const STAND_POPUP_HTML =
    '<b>Stand (Power Word Heal)</b><br/>You used your Reaction to stand up.';

// Stand (Power Word Heal) click lane — this file owns the handleReactionClick
// dispatch for this row. Row assembly/dedup lives in CharReactions.edgeCases.
// test.jsx; the OA roll lane lives in CharReactions.opportunityAttack.test.jsx
// and the pending-marker precedence lane in ...opportunityAttackTriggered.
describe('CharReactions - Stand (Power Word Heal) click', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks keeps mockReturnValue/mockImplementation (leak class) —
        // re-baseline EVERY overridable stub.
        runtimeWith();
        getRuntimeValue.mockReturnValue(null);
        useLoggedDiceRoll.mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
        chargeSlot.mockReturnValue(false); // honest enforcement-off value
    });

    // [label, activeConditions, ordered setRuntimeValue census expected]
    it.each([
        ['removes Prone and preserves other conditions', ['Prone', 'Poisoned'],
            [['TestFighter', 'activeConditions', ['Poisoned'], campaignName],
             ['TestFighter', 'powerWordHealStandPermission', false, campaignName]]],
        ['matches lowercase prone and writes remaining list', ['prone'],
            [['TestFighter', 'activeConditions', [], campaignName],
             ['TestFighter', 'powerWordHealStandPermission', false, campaignName]]],
        ['writes no activeConditions when no prone is present', ['Poisoned'],
            [['TestFighter', 'powerWordHealStandPermission', false, campaignName]]],
        ['writes no activeConditions when there are no conditions', [],
            [['TestFighter', 'powerWordHealStandPermission', false, campaignName]]],
    ])('clicking the row — %s, consumes the permission, confirms via popup', (_label, conditions, expectedWrites) => {
        runtimeWith({ powerWordHealStandPermission: true });
        getRuntimeValue.mockImplementation((_charKey, key) =>
            key === 'activeConditions' ? conditions : null);

        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Stand (Power Word Heal):'));

        // L5-002: standing consumes the reaction budget — charge first, with
        // the exact dispatch args.
        expect(chargeSlot).toHaveBeenCalledTimes(1);
        expect(chargeSlot).toHaveBeenCalledWith({
            creatureName: 'TestFighter',
            bucket: 'reaction',
            campaignName,
        });
        // Ordered exact-array census doubles as the double-fire detector:
        // condition write (only when a prone row was stripped) lands BEFORE
        // the single-use permission consumption, each written exactly once.
        expect(setRuntimeValue.mock.calls).toEqual(expectedWrites);
        // The stand lane logs nothing; confirmation is one popup, exact copy.
        expect(addEntry).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
        expect(mockSetPopupHtml).toHaveBeenCalledWith(STAND_POPUP_HTML);
    });

    it('blocks a cannotAct press with zero writes/charges/log rows but pops the shared reason (RB-1115)', () => {
        runtimeWith({ powerWordHealStandPermission: true });

        render(<CharReactions {...createProps({ cannotAct: true })} />);
        fireEvent.click(screen.getByText('Stand (Power Word Heal):'));

        expect(chargeSlot).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        // RB-1115: the silent gate now routes through the assertCanAct popup
        // lane with the shared canTakeAction copy — enforcement-off denial is
        // exactly ONE popup and ZERO campaign-log rows (UI-only).
        expect(addEntry).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
        expect(mockSetPopupHtml).toHaveBeenCalledWith(CANNOT_ACT_REASON);
    });
});
