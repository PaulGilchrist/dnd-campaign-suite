// @maintained-by-ai
// PC-sheet PENDING-TRIGGER opportunity-attack resolution (bug-monster-oa-
// resolution-auto-missed-by-melee-range-gate, PC face of the root bug).
// Pre-fix, a trigger that already charged the reaction (opportunityTrigger)
// sent the defender to a sheet lane that (a) ran assertCanAct(bucket:
// 'reaction') — DENIED by the very budget the trigger spent ("No reaction
// left this turn." + enforcement_denied row) — and (b) would have charged a
// SECOND reaction at fire time when budget did stand. These legs pin:
//   • with a live marker: NO assertCanAct call, NO chargeSlot, roll pinned to
//     the MARKED MOVER (targetName), isOpportunityAttack true, provenance row
//     written, marker consumed — even while the economy would deny;
//   • no marker ⇒ today's lane byte-identical (gated dispatch, chargeSlot at
//     fire, no targetName override);
//   • stale marker (mover away/dead) ⇒ nothing rolls, marker evicts, spent
//     reaction stays spent;
//   • protected-mover refusal keeps the marker (retryable), rolls nothing;
//   • same-tab double-click resolves exactly once (promptId latch).
// Plain sheet-OA refusal/picker/browser legs live in
// CharReactions.opportunityAttack.test.jsx (untouched); marker math in
// pendingOpportunityAttacks.test.js; monster card lane in
// MonsterCardModal.opportunityAttack.test.jsx.
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
// Economy gates: observed, decisions scripted (the marker lane must NEVER
// reach either — that is the double-charge/self-deny fix).
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
import { addEntry } from '../../services/ui/logService.js';
import { assertCanAct } from '../../services/combat/assertCanAct.js';
import { chargeSlot } from '../../services/combat/chargeEconomy.js';
import { _getMockSetPopupHtml } from '../../hooks/combat/DiceRollContext.js';
import * as pendingOas from '../../services/combat/pendingOpportunityAttacks.js';

const CAMPAIGN = 'test-campaign';
const DEFENDER = 'TestFighter';
const MOVER = 'EvasiveFighter';

const MARKER = { defender: DEFENDER, mover: MOVER, promptId: 'p-oa-1' };

const basePlayerStats = {
    name: DEFENDER,
    level: 5,
    class: { name: 'Fighter' },
    reactions: [
        { name: 'Opportunity Attack', description: 'Can attack creature that moves out of your reach' },
    ],
    attacks: [
        { name: 'Longsword', type: 'Action', range: 5, hitBonus: 6 },
    ],
    spellAbilities: { modifier: 3, toHit: 6, saveDc: 13, spells: [] },
    abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Wisdom', bonus: 2 }],
    _trackedResources: {},
};

let pendingOasStore;

function renderSheet() {
    return render(<CharReactions
        playerStats={basePlayerStats}
        campaignName={CAMPAIGN}
        cannotAct={false}
        mapName={null}
        characters={[]}
    />);
}

const boardWith = (moverRow) => ({
    creatures: [
        { name: DEFENDER, type: 'player', currentHp: 10 },
        moverRow,
    ],
});

let rollAttackSpy;

beforeEach(() => {
    vi.clearAllMocks();
    rollAttackSpy = vi.fn();
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

describe('Triggered OA press (live marker) — no double-charge, no self-deny', () => {
    beforeEach(() => {
        pendingOasStore = { [DEFENDER]: MARKER };
        getCombatContext.mockResolvedValue(boardWith({ name: MOVER, type: 'player', currentHp: 9 }));
    });

    it('resolves vs the MARKED MOVER: no assertCanAct, no chargeSlot, targetName pinned, marker consumed', async () => {
        // Economy-on hostile face: the generic reaction gate DENIES (budget
        // already spent by the trigger) — the marker lane must not consult it.
        assertCanAct.mockReturnValue({ allowed: false, reason: 'No reaction left this turn.' });
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalledWith(
            'Longsword',
            6,
            expect.objectContaining({ targetName: MOVER, isOpportunityAttack: true })
        ));
        expect(assertCanAct).not.toHaveBeenCalled();
        expect(chargeSlot).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'automation',
            automationType: 'opportunity_attack',
            name: 'Opportunity Attack',
            description: `${DEFENDER} makes an opportunity attack against ${MOVER}, who left ${DEFENDER}'s reach.`,
        }));
        expect(pendingOas.clearPendingOa).toHaveBeenCalledWith(CAMPAIGN, DEFENDER);
    });

    it('same-tab double-click rolls the one charged reaction EXACTLY once', async () => {
        renderSheet();
        clickOa();
        clickOa();
        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalledTimes(1));
        expect(pendingOas.clearPendingOa).toHaveBeenCalledTimes(1);
    });

    it('mover LEFT the encounter (away row) ⇒ zero roll, marker evicts, honest drop row + popup, no refund seam', async () => {
        getCombatContext.mockResolvedValue(boardWith({ name: MOVER, type: 'player', currentHp: 9, away: true }));
        renderSheet();
        clickOa();

        await waitFor(() => expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            automationType: 'opportunity_attack_dropped',
            description: `${DEFENDER}'s opportunity attack was dropped — ${MOVER} left the encounter. Reaction stays spent.`,
        })));
        expect(rollAttackSpy).not.toHaveBeenCalled();
        expect(chargeSlot).not.toHaveBeenCalled();
        expect(pendingOas.clearPendingOa).toHaveBeenCalledWith(CAMPAIGN, DEFENDER);
        expect(_getMockSetPopupHtml()).toHaveBeenCalledWith(expect.stringContaining('no longer in the encounter'));
    });

    it('mover DEAD (0 hp) ⇒ same drop law', async () => {
        getCombatContext.mockResolvedValue(boardWith({ name: MOVER, type: 'player', currentHp: 0 }));
        renderSheet();
        clickOa();
        await waitFor(() => expect(pendingOas.clearPendingOa).toHaveBeenCalledWith(CAMPAIGN, DEFENDER));
        expect(rollAttackSpy).not.toHaveBeenCalled();
    });

    it('protected MOVER (no_opportunity_attacks te) ⇒ refusal popup names the mover, marker stays for retry, zero roll', async () => {
        getRuntimeValue.mockImplementation((charKey, key) => (
            charKey === 'campaign' && key === 'targetEffects'
                ? [{ target: MOVER, source: 'Tactical Shift', effect: 'no_opportunity_attacks' }]
                : null
        ));
        renderSheet();
        clickOa();

        await waitFor(() => expect(_getMockSetPopupHtml()).toHaveBeenCalledWith(expect.stringContaining(MOVER)));
        expect(rollAttackSpy).not.toHaveBeenCalled();
        expect(pendingOas.clearPendingOa).not.toHaveBeenCalled();
        expect(chargeSlot).not.toHaveBeenCalled();
    });

    it('a latch-released refusal allows a clean second press', async () => {
        // First press refused (no target found via explicit lookup ⇒ cs board
        // lacks the mover ROW but summary shape still reads live? No — build
        // refusal face instead): protection lifted on the retry.
        getRuntimeValue.mockImplementation((charKey, key) => (
            charKey === 'campaign' && key === 'targetEffects'
                ? [{ target: MOVER, source: 'Tactical Shift', effect: 'no_opportunity_attacks' }]
                : null
        ));
        renderSheet();
        clickOa();
        await waitFor(() => expect(_getMockSetPopupHtml()).toHaveBeenCalled());
        getRuntimeValue.mockReturnValue(null); // lift the protection
        clickOa();
        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalledWith(
            'Longsword', 6, expect.objectContaining({ targetName: MOVER })
        ));
    });
});

describe('No-marker OA press — today\u2019s gated lane stays byte-identical', () => {
    it('runs assertCanAct (economy gate) and charges the reaction at fire; roll not target-pinned', async () => {
        renderSheet();
        clickOa();

        await waitFor(() => expect(rollAttackSpy).toHaveBeenCalledWith(
            'Longsword',
            6,
            expect.objectContaining({ isOpportunityAttack: true })
        ));
        expect(assertCanAct).toHaveBeenCalledWith(expect.objectContaining({
            campaignName: CAMPAIGN,
            creatureName: DEFENDER,
            bucket: 'reaction',
        }));
        expect(chargeSlot).toHaveBeenCalledWith({ creatureName: DEFENDER, bucket: 'reaction', campaignName: CAMPAIGN });
        expect(rollAttackSpy.mock.calls[0][2]).not.toHaveProperty('targetName');
        expect(pendingOas.clearPendingOa).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('economy denial still refuses the untriggered press with zero roll/zero charge (spent reaction law intact)', async () => {
        assertCanAct.mockReturnValue({ allowed: false, reason: 'No reaction left this turn.' });
        renderSheet();
        clickOa();
        await act(async () => { await Promise.resolve(); });
        expect(rollAttackSpy).not.toHaveBeenCalled();
        expect(chargeSlot).not.toHaveBeenCalled();
    });
});
