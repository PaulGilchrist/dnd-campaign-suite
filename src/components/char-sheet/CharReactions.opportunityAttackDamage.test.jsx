// @maintained-by-ai
// bug-sheet-oa-hit-deals-no-damage: both PC sheet OA press lanes (pending-
// trigger marker lane + legacy free-press lane) rolled the attack WITHOUT the
// autoDamageFormula/autoDamageName/damageType trio the damage stage in
// useLoggedDiceRoll is gated on — an OA HIT printed "✓ HIT (N vs AC M)",
// logged a roll row with hit:true, and dealt ZERO damage (no stage-2 popup,
// no damage roll row, no hp_change). These legs pin the fix: the roll options
// forwarded from BOTH lanes carry the chosen melee attack row's damage trio
// (same derivation as the attack_roll automation lane), the OA/economy flags
// stay byte-unchanged, and a damageless row honestly forwards null.
// Marker math / consume / latch legs live in
// CharReactions.opportunityAttackTriggered.test.jsx (untouched).
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
// Real liveness/shape math; the bucket WRITE is spied.
vi.mock('../../services/combat/pendingOpportunityAttacks.js', async (importActual) => {
    const actual = await importActual();
    return { ...actual, clearPendingOa: vi.fn(() => true) };
});

import { useRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { assertCanAct } from '../../services/combat/assertCanAct.js';
import { chargeSlot } from '../../services/combat/chargeEconomy.js';
import * as pendingOas from '../../services/combat/pendingOpportunityAttacks.js';

const CAMPAIGN = 'test-campaign';
const DEFENDER = 'TestFighter';
const MOVER = 'EvasiveFighter';

const MARKER = { defender: DEFENDER, mover: MOVER, promptId: 'p-oa-dmg-1' };

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

let playerStats = statsWithAttacks([LONGSWORD]);
let pendingOasStore = null;

function renderSheet() {
    return render(<CharReactions
        playerStats={playerStats}
        campaignName={CAMPAIGN}
        cannotAct={false}
        mapName={null}
        characters={[]}
    />);
}

const boardWithMover = () => ({
    creatures: [
        { name: DEFENDER, type: 'player', currentHp: 10 },
        { name: MOVER, type: 'player', currentHp: 9 },
    ],
});

let rollAttackSpy;

beforeEach(() => {
    vi.clearAllMocks();
    rollAttackSpy = vi.fn();
    playerStats = statsWithAttacks([LONGSWORD]);
    pendingOasStore = null;
    useRuntimeValue.mockImplementation((_charKey, prop) => (prop === 'pendingOAs' ? pendingOasStore : []));
    getRuntimeValue.mockReturnValue(null);
    useLoggedDiceRoll.mockReturnValue({ rollAttack: rollAttackSpy, rollDamage: vi.fn() });
    buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
    getCategories.mockReturnValue({ featuresToIgnore: [] });
    getReactionSpellNames.mockReturnValue(new Set());
    getCombatContext.mockResolvedValue(null);
    assertCanAct.mockReturnValue({ allowed: true, reason: null });
    chargeSlot.mockReturnValue(true);
});

function clickOa() {
    fireEvent.click(screen.getByText('Opportunity Attack:'));
}

describe('Pending-trigger OA press — HIT can reach the damage stage', () => {
    beforeEach(() => {
        pendingOasStore = { [DEFENDER]: MARKER };
        getCombatContext.mockResolvedValue(boardWithMover());
    });

    it('forwards the melee row\u2019s damage trio alongside the marker-pinned target (was: attack-only roll, hits dealt no damage)', async () => {
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalledWith(
            'Longsword',
            6,
            expect.objectContaining({
                targetName: MOVER,
                isOpportunityAttack: true,
                autoDamageFormula: '1d8+5',
                autoDamageName: 'Longsword',
                damageType: 'Slashing',
            })
        ));
        // Economy/flag law unchanged: marker lane never re-charges.
        expect(chargeSlot).not.toHaveBeenCalled();
        expect(pendingOas.clearPendingOa).toHaveBeenCalledWith(CAMPAIGN, DEFENDER);
    });

    it('honours the row\u2019s own damageType (Piercing spear row is not forced to Slashing)', async () => {
        playerStats = statsWithAttacks([
            { name: 'Spear', type: 'Action', range: 5, hitBonus: 5, damage: '1d6+3', damageType: 'Piercing' },
        ]);
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalledWith(
            'Spear',
            5,
            expect.objectContaining({
                autoDamageFormula: '1d6+3',
                autoDamageName: 'Spear',
                damageType: 'Piercing',
            })
        ));
    });

    it('damageless melee row honestly forwards formula null (no fabricated damage stage)', async () => {
        playerStats = statsWithAttacks([{ name: 'Rusty Nail', type: 'Action', range: 5, hitBonus: 6 }]);
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalledWith(
            'Rusty Nail',
            6,
            expect.objectContaining({
                targetName: MOVER,
                isOpportunityAttack: true,
                autoDamageFormula: null,
            })
        ));
    });
});

describe('Legacy free-press OA lane — same damage transport, gate law intact', () => {
    it('forwards the damage trio with the gated (non-marker) press and still charges at fire', async () => {
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalledWith(
            'Longsword',
            6,
            expect.objectContaining({
                isOpportunityAttack: true,
                autoDamageFormula: '1d8+5',
                autoDamageName: 'Longsword',
                damageType: 'Slashing',
            })
        ));
        // Free-press lane keeps its economy shape: gate + charge, no target pin.
        expect(assertCanAct).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'reaction' }));
        expect(chargeSlot).toHaveBeenCalledWith({ creatureName: DEFENDER, bucket: 'reaction', campaignName: CAMPAIGN });
        expect(rollAttackSpy.mock.calls[0][2]).not.toHaveProperty('targetName');
    });

    it('economy denial still refuses with zero roll (denied press forwards no damage options either)', async () => {
        assertCanAct.mockReturnValue({ allowed: false, reason: 'No reaction left this turn.' });
        renderSheet();
        clickOa();
        await waitFor(() => expect(assertCanAct).toHaveBeenCalled());
        expect(rollAttackSpy).not.toHaveBeenCalled();
        expect(chargeSlot).not.toHaveBeenCalled();
    });
});
