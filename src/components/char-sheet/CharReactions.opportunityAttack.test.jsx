// @maintained-by-ai 2026-11-27 Plain sheet-OA press: exact roll-options toEqual, weapon-picker hitBonus carry, exact refusal popup/log copy (incl. array-te + maneuveringGrant zero-log branch + cross-granter roll), hoisted popup spy; mirror/dead mocks purged (baseCombatActions/formatUtils/modals), importOriginal spellSectionUtils.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';

// setPopupHtml must be inspectable AND stable across renders (handlers #1910
// idiom): the old factory rebuilt a fresh inner vi.fn per hook call through a
// _getMockSetPopupHtml accessor — not a real module export, so the factory
// shipped a phantom key. One hoisted spy now.
const { mockSetPopupHtml } = vi.hoisted(() => ({ mockSetPopupHtml: vi.fn() }));

// Only surfaces this lane can actually reach are mocked. The nine modal /
// SpellDetailPopup / MetamagicPopup mocks previously here were dead harness
// (#1911 idiom): hasAutomation is stubbed false and the spell-flow hooks are
// stubs, so an OA-row press can never populate modalState or
// pendingMetamagic — none of those components can mount in this lane. The
// baseCombatActions mock was a byte-for-byte mirror of the two real constants
// on disk (mirror-mock purged; the picker legs now ride the REAL
// MELEE_REACH_FEET), and the formatUtils mirror mock + useSpellCastExecutor
// mock went the same way (signFormatter only runs on spell-row cells;
// castAction is unreachable from an OA press — the spells lane already runs
// the real executor).
vi.mock('../common/popup.jsx', () => ({
    default: ({ children }) => React.createElement('div', { 'data-testid': 'popup' }, children),
}));
vi.mock('../../services/ui/spellSectionUtils.js', async (importOriginal) => ({
    // The component ALSO imports applyPotentSpellcasting from this module;
    // the old getReactionSpellNames-only factory was one lazy access from
    // throwing (spells #1911 importOriginal idiom).
    ...(await importOriginal()),
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
vi.mock('../../services/combat/automation/automationService.js', () => ({
    // CharReactions.jsx:23 imports exactly these two keys.
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
    useSpellMetamagicFlow: vi.fn(),
}));
vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
    useSpellUpcastFlow: vi.fn(),
}));
vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
    useSpellPositionResolver: vi.fn(),
}));
vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
    resolveSpellDamageAtLevel: vi.fn(),
    isAutoHitSpell: vi.fn(() => false),
    resolveHealExpression: vi.fn(),
}));

import { useRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasSpeedyOpportunityDisadvantage } from '../../services/combat/automation/automationService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { addEntry } from '../../services/ui/logService.js';
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js';
import { useSpellPositionResolver } from '../../hooks/combat/useSpellPositionResolver.js';

const campaignName = 'test-campaign';
const PLAYER = 'TestFighter';

const basePlayerStats = {
    name: PLAYER,
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

// FULL-shape roll options for a damageless melee row (Longsword fixture
// carries no damage trio): the free-press contract is
// buildOpportunityAttackRollOptions(attackRoll, null) byte-for-byte. The
// damage-trio transport itself is pinned by
// CharReactions.opportunityAttackDamage.test.jsx.
const oaOptions = (weapon) => ({
    forcedMode: undefined,
    isOpportunityAttack: true,
    autoDamageFormula: null,
    autoDamageName: weapon,
    damageType: 'Slashing',
});

// Drain the click's promise chain (all-async, timer-free) so negative
// "did not roll / did not log" assertions run after the lane has finished.
async function flushClickChain() {
    await act(async () => {
        await Promise.resolve();
    });
}

// Lane map: THIS file owns the plain (no-marker) sheet-OA press — refusal
// resolver branches, weapon picker, protected/maneuvering refusals, and the
// Speedy minimal pin. The pending-TRIGGER marker lane, assertCanAct gate args
// and the chargeSlot-at-fire bucket pin live in
// CharReactions.opportunityAttackTriggered.test.jsx (its no-marker leg
// covers the economy gate for this same lane); the full Speedy face matrix
// lives in CharReactions.opportunityAttackSpeedy.test.jsx; damage transport
// in CharReactions.opportunityAttackDamage.test.jsx; SP-109 slow refusal in
// CharReactions.slow.test.jsx. Trigger DETECTION (opportunityTrigger) and
// attack-execution math (pipeline/useLoggedDiceRoll lanes) are out of scope.

describe('CharReactions - Opportunity Attack click lane', () => {
    let rollAttack;

    beforeEach(() => {
        vi.clearAllMocks();
        // Re-baseline EVERY overridable stub (clearAllMocks keeps
        // mockReturnValue — leak class):
        rollAttack = vi.fn();
        useLoggedDiceRoll.mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        useRuntimeValue.mockReturnValue([]);
        getRuntimeValue.mockReturnValue(null);
        hasSpeedyOpportunityDisadvantage.mockReturnValue(false);
        buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
        getCategories.mockReturnValue({ featuresToIgnore: [] });
        getReactionSpellNames.mockReturnValue(new Set());
        getCombatContext.mockResolvedValue(null);
        getTargetFromAttacker.mockReturnValue(null);
        addEntry.mockResolvedValue(undefined);
        useSpellMetamagicFlow.mockReturnValue({
            pendingMetamagic: null,
            gateMetamagic: vi.fn(),
            handleConfirm: vi.fn(),
            handleSkip: vi.fn(),
        });
        useSpellUpcastFlow.mockReturnValue({ buildUpcastLevels: vi.fn(() => []) });
        useSpellPositionResolver.mockReturnValue({
            resolvePositions: vi.fn(),
            cachedPosRef: { current: null },
        });
    });

    // No applicable target-side refusal: the OA must roll the melee attack
    // flagged isOpportunityAttack, with no popup and no log entry. Covers all
    // three short-circuit branches of the refusal resolver plus the
    // unprotected-target path (CLA-353: a permanent tactical_shift_no_oa
    // passive on the cs row alone never refuses — cs combatants carry no
    // passives, so only live runtime protections gate the roll).
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

        await waitFor(() => expect(rollAttack).toHaveBeenCalledTimes(1));
        expect(rollAttack).toHaveBeenCalledWith('Longsword', 6, oaOptions('Longsword'));
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    // Weapon picker: prefer the first type==='Action' attack at the REAL
    // MELEE_REACH_FEET; fall back to attacks[0] when no melee row exists.
    // Distinct hitBonuses (7 vs 6 vs 9) prove the ROLL CARRIES THE CHOSEN
    // ROW'S OWN bonus, and the non-Action melee row proves the type filter.
    // [label, attacks, expected: [name, hitBonus]]
    it.each([
        ['only a ranged attack exists', [
            { name: 'Ranged Bolt', type: 'Action', range: 120, hitBonus: 7 },
        ], ['Ranged Bolt', 7]],
        ['a melee row of another type and a ranged row outrank the melee Action', [
            { name: 'Ranged Bolt', type: 'Action', range: 120, hitBonus: 7 },
            { name: 'Longsword', type: 'Action', range: 5, hitBonus: 6 },
            { name: 'Reaction Jab', type: 'Reaction', range: 5, hitBonus: 9 },
        ], ['Longsword', 6]],
    ])('picks %s as the OA weapon', async (_label, attacks, [expectedWeapon, expectedBonus]) => {
        render(<CharReactions {...createProps({ playerStats: { ...basePlayerStats, attacks } })} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        await waitFor(() => expect(rollAttack).toHaveBeenCalledTimes(1));
        expect(rollAttack).toHaveBeenCalledWith(expectedWeapon, expectedBonus, oaOptions(expectedWeapon));
    });

    it('does nothing when the character has no attacks', async () => {
        render(<CharReactions {...createProps({ playerStats: { ...basePlayerStats, attacks: [] } })} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        await flushClickChain();
        expect(rollAttack).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    // Protected-target refusals (CLA-353): gated on the per-character
    // inspiringMovementNoOA runtime key OR a live campaign-level
    // no_opportunity_attacks te (scalar or array target; protector read from
    // te.source) — never a permanent passive. The refusal popup names the
    // protector EXACTLY (source:393 copy), is logged once with the exact
    // refused-row (source:394, em-dash), and the attack does not roll.
    // [label, protector, runtimeSetup]
    it.each([
        ['inspiringMovementNoOA', 'Inspiring Movement', () => getRuntimeValue.mockImplementation((charKey, key) =>
            key === 'inspiringMovementNoOA' ? true : null)],
        ['a campaign no_opportunity_attacks te', 'Tactical Shift', () => getRuntimeValue.mockImplementation((charKey, key) =>
            charKey === 'campaign' && key === 'targetEffects'
                ? [{ target: 'Enemy1', source: 'Tactical Shift', effect: 'no_opportunity_attacks', duration: 'until_start_of_next_turn' }]
                : null)],
        ['an array-target no_opportunity_attacks te', 'Step of the Wind', () => getRuntimeValue.mockImplementation((charKey, key) =>
            charKey === 'campaign' && key === 'targetEffects'
                ? [{ target: ['Grunt 2', 'Enemy1'], source: 'Step of the Wind', effect: 'no_opportunity_attacks', duration: 'until_start_of_next_turn' }]
                : null)],
    ])('refuses with a popup naming %label and logs it', async (_label, protector, runtimeSetup) => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Enemy1' });
        runtimeSetup();

        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        // The log fires after the popup, so waiting on it proves both ran.
        await waitFor(() => expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'automation',
            creatureName: PLAYER,
            name: 'Opportunity Attack',
            description: `Opportunity Attack refused — Enemy1 is protected by ${protector} and cannot be targeted by Opportunity Attacks.`,
            timestamp: expect.any(Number),
        }));
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
            `<b>Opportunity Attack</b><br/>Enemy1 is protected by ${protector} and cannot be targeted by Opportunity Attacks right now.`
        );
        expect(rollAttack).not.toHaveBeenCalled();
    });

    // Maneuvering Attack refusal branch (source:401-406): the grant is a
    // per-target runtime key pair, and — unlike the protected refusal — it
    // carries NO log field, so the refusal must be popup-ONLY (zero silent
    // log writes). grantSource null or === playerName both refuse with the
    // player's own name in the copy (source:405 `${grantSource || playerName}`).
    // [label, runtimeSetup]
    it.each([
        ['no recorded grant source', () => getRuntimeValue.mockImplementation((charKey, key) =>
            charKey === 'Enemy1' && key === 'maneuveringStepNoOA' ? true : null)],
        ['a grant sourced to this player', () => getRuntimeValue.mockImplementation((charKey, key) =>
            charKey === 'Enemy1' && key === 'maneuveringStepNoOA'
                ? true
                : charKey === 'Enemy1' && key === 'maneuveringStepNoOASource' ? PLAYER : null)],
    ])('refuses with the Maneuvering Attack popup and NO log row when the grant has %s', async (_label, runtimeSetup) => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Enemy1' });
        runtimeSetup();

        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        await flushClickChain();
        expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
            `<b>Opportunity Attack</b><br/>Enemy1 was granted Maneuvering Attack movement and cannot be targeted by Opportunity Attacks from ${PLAYER} right now.`
        );
        // This refusal shape has no `log` field — showOpportunityAttackRefusal
        // must stay silent, and nothing rolls.
        expect(addEntry).not.toHaveBeenCalled();
        expect(rollAttack).not.toHaveBeenCalled();
    });

    // A Maneuvering grant sourced to ANOTHER creature does not protect the
    // target from THIS player's OA (source:404) — the press rolls honestly.
    it('rolls despite a maneuveringStepNoOA flag granted by a different creature', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Enemy1' });
        getRuntimeValue.mockImplementation((charKey, key) =>
            charKey === 'Enemy1' && key === 'maneuveringStepNoOA'
                ? true
                : charKey === 'Enemy1' && key === 'maneuveringStepNoOASource' ? 'Goblin 1' : null);

        render(<CharReactions {...createProps()} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        await waitFor(() => expect(rollAttack).toHaveBeenCalledTimes(1));
        expect(rollAttack).toHaveBeenCalledWith('Longsword', 6, oaOptions('Longsword'));
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    // bug-speedy-oa-disadvantage-inert (fix): Agile Movement is NOT a refusal —
    // the pre-fix authored advisory popup blocked the roll and consulted the
    // passive off the cs row (never present), so live boards rolled silent
    // mode:'normal'. The press now ROLLS with forced Disadvantage, carrying
    // the Agile Movement attribution on the roll options + a marked ledger
    // row, consulting the defender's DERIVED stats through the characters lane
    // (the Initiative "OA Disadv" badge lookup). Full face matrix →
    // CharReactions.opportunityAttackSpeedy.test.jsx; the ledger-row wording
    // itself is builder-owned there and in pendingOpportunityAttacks.test.js.
    it('rolls with forced Disadvantage instead of refusing when the target has speedy disadvantage', async () => {
        const speedyTarget = { name: 'Enemy1', computedStats: { automation: { passives: [{ type: 'passive_rule', effect: 'opportunity_attacks_disadvantage' }] } } };
        const speedyReason = 'Enemy1 has Agile Movement (Speedy) — opportunity attacks against them have Disadvantage';
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Enemy1' });
        hasSpeedyOpportunityDisadvantage.mockReturnValue(true);

        render(<CharReactions {...createProps({ characters: [speedyTarget] })} />);
        fireEvent.click(screen.getByText('Opportunity Attack:'));

        await waitFor(() => expect(rollAttack).toHaveBeenCalledTimes(1));
        expect(rollAttack).toHaveBeenCalledWith('Longsword', 6, {
            forcedMode: 'disadvantage',
            advantageReason: speedyReason,
            isOpportunityAttack: true,
            autoDamageFormula: null,
            autoDamageName: 'Longsword',
            damageType: 'Slashing',
        });
        // The consult resolves the characters-list entry's computedStats, not
        // the cs row. No advisory-refusal popup; the fold gets its own row.
        expect(hasSpeedyOpportunityDisadvantage).toHaveBeenCalledWith(speedyTarget.computedStats);
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'automation',
            automationType: 'speedy_opportunity_disadvantage',
            creatureName: PLAYER,
            characterName: PLAYER,
            name: 'Longsword',
            targetName: 'Enemy1',
            description: `${PLAYER} has Disadvantage on Longsword: ${speedyReason}.`,
            timestamp: expect.any(Number),
        });
    });
});
