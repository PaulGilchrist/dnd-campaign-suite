// @maintained-by-ai
// bug-speedy-oa-disadvantage-inert: the 2024 Speedy feat (Agile Movement —
// "Opportunity Attacks have Disadvantage against you") was consulted at OA
// resolution against the combatSummary creature ROW, which carries no
// `automation` key — the advisory was unreachable and both sheet OA press
// lanes rolled mode:'normal' silently. These legs pin the fix: BOTH press
// lanes (pending-trigger marker lane + legacy free-press lane) consult the
// defender's DERIVED stats through the characters list (the Initiative
// "OA Disadv" badge lookup) and, when the defender holds the passive, roll
// with forced Disadvantage carrying the Agile Movement attribution, plus a
// `speedy_opportunity_disadvantage` ledger row. Without the passive (or
// without a characters-list entry) the roll options stay byte-identical to
// the pre-fix shape — no forcedMode, no advantageReason key, no extra row.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
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
    default: () => React.createElement('div', { 'data-testid': 'bend-fate-modal', onClick: () => {} }, null),
}));
vi.mock('./modals/BoonFateModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'boon-fate-modal', onClick: () => {} }, null),
}));
vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'steps-of-fey-modal', onClick: () => {} }, null),
}));
vi.mock('./modals/SearingVengeanceModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'searing-vengeance-modal' }, null),
}));
vi.mock('../../services/ui/spellSectionUtils.js', () => ({
    getReactionSpellNames: vi.fn(() => new Set()),
    applyPotentSpellcasting: vi.fn((v) => v),
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
vi.mock('../../services/combat/assertCanAct.js', () => ({
    assertCanAct: vi.fn(() => ({ allowed: true, reason: null })),
    bucketForAction: vi.fn(() => 'action'),
}));
vi.mock('../../services/combat/chargeEconomy.js', () => ({
    chargeSlot: vi.fn(() => true),
    refundSlot: vi.fn(() => false),
    chargeMovement: vi.fn(() => 0),
}));
// Real liveness/shape math AND the real attribution builders; the bucket
// WRITE is spied.
vi.mock('../../services/combat/pendingOpportunityAttacks.js', async (importActual) => {
    const actual = await importActual();
    return { ...actual, clearPendingOa: vi.fn(() => true) };
});

import { useRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { hasSpeedyOpportunityDisadvantage } from '../../services/combat/automation/automationService.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { assertCanAct } from '../../services/combat/assertCanAct.js';
import { chargeSlot } from '../../services/combat/chargeEconomy.js';
import { addEntry } from '../../services/ui/logService.js';
import * as pendingOas from '../../services/combat/pendingOpportunityAttacks.js';

const CAMPAIGN = 'test-campaign';
const DEFENDER = 'TestFighter';
const MOVER = 'EvasiveFighter';

const MARKER = { defender: DEFENDER, mover: MOVER, promptId: 'p-oa-speedy-1' };

const LONGSWORD = { name: 'Longsword', type: 'Action', range: 5, hitBonus: 6, damage: '1d8+5', damageType: 'Slashing' };

function statsWithAttacks(attacks) {
    return {
        name: DEFENDER,
        level: 5,
        class: { name: 'Fighter' },
        reactions: [
            { name: 'Opportunity Attack', description: 'Can attack creature that moves out of your reach' },
        ],
        attacks,
        spellAbilities: { modifier: 3, toHit: 6, saveDc: 13, spells: [] },
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Wisdom', bonus: 2 }],
        _trackedResources: {},
    };
}

// The cs row is feature-less by design; the Speedy passive lives ONLY on the
// derived characters entry (computedStats.automation.passives) — the exact
// shape the Initiative "OA Disadv" badge resolves.
const SPEEDY_CHARACTER = {
    name: MOVER,
    computedStats: {
        automation: { passives: [{ type: 'passive_rule', effect: 'opportunity_attacks_disadvantage', name: 'Agile Movement' }] },
    },
};

let playerStats = statsWithAttacks([LONGSWORD]);
let pendingOasStore = null;
let charactersProp = [];

function renderSheet() {
    return render(<CharReactions
        playerStats={playerStats}
        campaignName={CAMPAIGN}
        cannotAct={false}
        mapName={null}
        characters={charactersProp}
    />);
}

const boardWithMover = () => ({
    creatures: [
        { name: DEFENDER, type: 'player', currentHp: 10 },
        { name: MOVER, type: 'player', currentHp: 9 },
    ],
});

let rollAttackSpy;

function speedyRows() {
    return addEntry.mock.calls.map(c => c[1]).filter(e => e && e.automationType === 'speedy_opportunity_disadvantage');
}

beforeEach(() => {
    vi.clearAllMocks();
    rollAttackSpy = vi.fn();
    playerStats = statsWithAttacks([LONGSWORD]);
    pendingOasStore = null;
    charactersProp = [];
    useRuntimeValue.mockImplementation((_charKey, prop) => (prop === 'pendingOAs' ? pendingOasStore : []));
    getRuntimeValue.mockReturnValue(null);
    useLoggedDiceRoll.mockReturnValue({ rollAttack: rollAttackSpy, rollDamage: vi.fn() });
    buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
    getCategories.mockReturnValue({ featuresToIgnore: [] });
    getReactionSpellNames.mockReturnValue(new Set());
    getCombatContext.mockResolvedValue(null);
    getTargetFromAttacker.mockReturnValue(null);
    hasSpeedyOpportunityDisadvantage.mockReturnValue(false);
    assertCanAct.mockReturnValue({ allowed: true, reason: null });
    chargeSlot.mockReturnValue(true);
});

function clickOa() {
    fireEvent.click(screen.getByText('Opportunity Attack:'));
}

describe('Pending-trigger marker lane vs a Speedy mover', () => {
    beforeEach(() => {
        pendingOasStore = { [DEFENDER]: MARKER };
        getCombatContext.mockResolvedValue(boardWithMover());
    });

    it('rolls the marked-mover OA with FORCED Disadvantage + Agile Movement attribution (was: silent mode:normal)', async () => {
        charactersProp = [SPEEDY_CHARACTER];
        hasSpeedyOpportunityDisadvantage.mockReturnValue(true);
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalled());
        const [name, bonus, options] = rollAttackSpy.mock.calls[0];
        expect(name).toBe('Longsword');
        expect(bonus).toBe(6);
        expect(options.forcedMode).toBe('disadvantage');
        expect(options.advantageReason).toContain(MOVER);
        expect(options.advantageReason).toContain('Agile Movement');
        expect(options.advantageReason).toContain('Disadvantage');
        // Damage trio + marker pin from the (484e45ec6) fix stay intact.
        expect(options.targetName).toBe(MOVER);
        expect(options.isOpportunityAttack).toBe(true);
        expect(options.autoDamageFormula).toBe('1d8+5');
        // The consult resolves the DERIVED stats, never the cs row.
        expect(hasSpeedyOpportunityDisadvantage).toHaveBeenCalledWith(SPEEDY_CHARACTER.computedStats);
        // One-charge/consume law untouched by the fold.
        expect(pendingOas.clearPendingOa).toHaveBeenCalledWith(CAMPAIGN, DEFENDER);
    });

    it('logs a speedy_opportunity_disadvantage ledger row naming attacker, action and mover', async () => {
        charactersProp = [SPEEDY_CHARACTER];
        hasSpeedyOpportunityDisadvantage.mockReturnValue(true);
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalled());
        const rows = speedyRows();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual(expect.objectContaining({
            type: 'automation',
            automationType: 'speedy_opportunity_disadvantage',
            creatureName: DEFENDER,
            characterName: DEFENDER,
            name: 'Longsword',
            targetName: MOVER,
        }));
        expect(rows[0].description).toContain(`${DEFENDER} has Disadvantage on Longsword`);
        // OA provenance row (marker lane law) still lands alongside.
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ automationType: 'opportunity_attack' }));
    });

    it('defender without the passive ⇒ roll options stay byte-identical (no forcedMode, no advantageReason key, no ledger row)', async () => {
        charactersProp = [{ name: MOVER, computedStats: { automation: { passives: [] } } }];
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalled());
        const options = rollAttackSpy.mock.calls[0][2];
        expect(options.forcedMode).toBeUndefined();
        expect(options).not.toHaveProperty('advantageReason');
        expect(speedyRows()).toHaveLength(0);
    });

    it('mover absent from the characters list (bestiary monster) ⇒ honestly inert, never consulted on the cs row', async () => {
        charactersProp = [];
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalled());
        expect(hasSpeedyOpportunityDisadvantage).not.toHaveBeenCalled();
        const options = rollAttackSpy.mock.calls[0][2];
        expect(options.forcedMode).toBeUndefined();
        expect(options).not.toHaveProperty('advantageReason');
        expect(speedyRows()).toHaveLength(0);
    });
});

describe('Legacy free-press lane vs an armed Speedy target', () => {
    beforeEach(() => {
        getCombatContext.mockResolvedValue(boardWithMover());
        getTargetFromAttacker.mockReturnValue({ name: MOVER, type: 'player', currentHp: 9 });
    });

    it('forced Disadvantage + attribution rides the gated press and the reaction still charges at fire', async () => {
        charactersProp = [SPEEDY_CHARACTER];
        hasSpeedyOpportunityDisadvantage.mockReturnValue(true);
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalled());
        const options = rollAttackSpy.mock.calls[0][2];
        expect(options.forcedMode).toBe('disadvantage');
        expect(options.advantageReason).toContain('Agile Movement');
        // Gate + charge shape unchanged; free press carries no target pin.
        expect(assertCanAct).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'reaction' }));
        expect(chargeSlot).toHaveBeenCalledWith({ creatureName: DEFENDER, bucket: 'reaction', campaignName: CAMPAIGN });
        expect(options).not.toHaveProperty('targetName');
        expect(speedyRows()).toHaveLength(1);
    });

    it('no armed target ⇒ no defender lookup, options byte-identical to the pre-fix shape', async () => {
        getTargetFromAttacker.mockReturnValue(null);
        charactersProp = [SPEEDY_CHARACTER];
        hasSpeedyOpportunityDisadvantage.mockReturnValue(true);
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalled());
        const options = rollAttackSpy.mock.calls[0][2];
        expect(options.forcedMode).toBeUndefined();
        expect(options).not.toHaveProperty('advantageReason');
        expect(hasSpeedyOpportunityDisadvantage).not.toHaveBeenCalled();
        expect(speedyRows()).toHaveLength(0);
    });
});
