// @maintained-by-ai 2026-11-27 CharReactions reaction-SPELL dispatch faces: damage/hit-chip cast lanes incl. RB-1115 cannotAct zero-write denial (exact CANNOT_ACT_REASON popup), detail-popup open/close + default onCast→handleReactionSpellCast metaCtx threading, hit-cell branch census (attack/auto-hit/save-DC/empty). Phantom hasTacticalShift mock key purged; dead modal mocks removed (unreachable in this lane). SP-109 slow refusal lives in CharReactions.slow.test.jsx; Stand-row dispatch + feature-row RB-1115 denial in CharReactions.handlers.test.jsx (#1910); row assembly/dedup in CharReactions.edgeCases.test.jsx; section-omission in CharReactions.rendering.test.jsx; picker→handleReactiveSpellCast in CharReactions.reactiveSpell.test.jsx. Spell-reaction service math lives in src/services/automation lanes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';

// setPopupHtml / resolvePositions must be inspectable AND stable across renders:
// inline `vi.fn(() => ({ setPopupHtml: vi.fn() }))` created a fresh inner mock per
// render, so denial legs could never see the popup the gate fired (handlers #1910 idiom).
const { mockSetPopupHtml, mockResolvePositions, QUICKEN_META } = vi.hoisted(() => ({
    mockSetPopupHtml: vi.fn(),
    mockResolvePositions: vi.fn(),
    // Distinctive metaCtx the detail-cast button threads through
    // handleReactionSpellCast into gateMetamagic — kills `{}`-hardcoded mutants.
    QUICKEN_META: { spellMeta: 'quickened' },
}));

// Only the two surfaces this lane actually renders are mocked. The nine modal /
// MetamagicPopup mocks previously here were dead harness: gateMetamagic is a stub,
// so pendingMetamagic stays null and modalState is never populated from a
// spell-row press — none of those components can mount in this lane.
vi.mock('../common/popup.jsx', () => ({
    default: ({ children, onClickOrKeyDown }) =>
        React.createElement('div', { 'data-testid': 'popup', onClick: onClickOrKeyDown }, children),
}));
vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
    default: ({ spell, playerLevel, upcastLevels, onCast }) =>
        React.createElement('div', { 'data-testid': 'spell-detail-popup' },
            React.createElement('span', { 'data-testid': 'popup-spell-name' }, spell?.name),
            React.createElement('span', { 'data-testid': 'popup-player-level' }, String(playerLevel)),
            React.createElement('span', { 'data-testid': 'popup-upcast-count' }, String(upcastLevels?.length)),
            React.createElement('button', {
                'data-testid': 'detail-cast-btn',
                onClick: () => onCast(spell, QUICKEN_META),
            }, 'Cast'),
        ),
}));
vi.mock('../../services/ui/spellSectionUtils.js', async (importOriginal) => ({
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
vi.mock('../../services/combat/baseCombatActions.js', () => ({
    OPPORTUNITY_ATTACK: { name: 'Opportunity Attack', description: 'Can attack creature that moves out of your reach' },
    MELEE_REACH_FEET: 5,
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({
    // CharReactions.jsx:23 imports exactly these two; hasTacticalShift was a
    // phantom key (on disk, never imported by this component) — purged #1910-style.
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

import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { resolveSpellDamageAtLevel, isAutoHitSpell, resolveHealExpression } from '../../services/rules/core/spellDamageUtils.js';
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js';
import { useSpellPositionResolver } from '../../hooks/combat/useSpellPositionResolver.js';
import { applyWarCasterReaction } from '../../services/automation/handlers/reactions/reactionSpellHandler.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
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
        spells: [
            { name: 'Shield', casting_time: '1 reaction', level: 1, range: 'Self', prepared: 'Always', damage: null, heal_at_slot_level: false },
            { name: 'Hellish Rebuke', casting_time: '1 reaction', level: 1, range: '60 ft.', prepared: 'Always', damage: { expression: '1d10', damage_type: 'fire' }, heal_at_slot_level: false },
        ],
    },
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Wisdom', bonus: 2 },
    ],
    _trackedResources: {},
};

const HELLISH_REBUKE = basePlayerStats.spellAbilities.spells[1];

const HEALING_SPELL = {
    name: 'Lesser Restoration',
    casting_time: '1 reaction',
    level: 2,
    range: 'Touch',
    prepared: 'Always',
    damage: null,
    heal_at_slot_level: true,
};

// Distinctive toHit 5 (fixture default is 6) so a hardcoded-bonus mutant is visible.
const THORN_WHIP = {
    name: 'Thorn Whip',
    casting_time: '1 reaction',
    level: 0,
    range: '30 ft.',
    prepared: 'Always',
    attack_type: 'melee',
    damage: '1d8 thunder',
    damage_type: 'thunder',
};

// Carries attack_type ON PURPOSE: the auto-hit branch must short-circuit BEFORE
// the spell-attack-cell branch, so even an attack-flavored spell shows no bonus.
const AUTO_HIT_SPELL = {
    name: 'Magic Missile',
    casting_time: '1 reaction',
    level: 1,
    range: '120 ft.',
    prepared: 'Always',
    attack_type: 'Ranged Spell Attack',
    damage: { expression: '1d4+1', damage_type: 'force' },
    heal_at_slot_level: false,
};

// Save variant: hit cell becomes the static `DC <saveDc> <dc_type>` display.
const SAVE_DC_SPELL = {
    name: 'Burning Hands',
    casting_time: '1 reaction',
    level: 1,
    range: 'Self',
    prepared: 'Always',
    dc: { value: 13, dc_type: 'DEX' },
    damage: { expression: '3d6', damage_type: 'fire' },
    heal_at_slot_level: false,
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

// Single-spell reaction table so getByText stays unambiguous per scenario.
function propsWithSpell(spell, overrides = {}) {
    return createProps({
        ...overrides,
        playerStats: {
            ...basePlayerStats,
            spellAbilities: { ...basePlayerStats.spellAbilities, spells: [spell] },
        },
    });
}

let gateMetamagic;
let buildUpcastLevels;
let rollAttack;

beforeEach(() => {
    // clearAllMocks keeps mockReturnValue/mockImplementation (leak class) —
    // re-baseline EVERY overridable stub.
    vi.clearAllMocks();
    useRuntimeValue.mockReturnValue([]);
    getRuntimeValue.mockReturnValue(null);
    setRuntimeValue.mockReturnValue(undefined);
    hasAutomation.mockReturnValue(false);
    buildFeatureDetailHtml.mockImplementation((r) => `<div>${r.name}</div>`);
    getCategories.mockReturnValue({ featuresToIgnore: [] });
    getReactionSpellNames.mockReturnValue(new Set(['Shield', 'Hellish Rebuke']));
    resolveSpellDamageAtLevel.mockReturnValue('1d10');
    resolveHealExpression.mockReturnValue('2d8+3');
    isAutoHitSpell.mockReturnValue(false);
    addEntry.mockResolvedValue(undefined);
    gateMetamagic = vi.fn();
    useSpellMetamagicFlow.mockReturnValue({
        pendingMetamagic: null,
        gateMetamagic,
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
    });
    buildUpcastLevels = vi.fn(() => []);
    useSpellUpcastFlow.mockReturnValue({ buildUpcastLevels });
    useSpellPositionResolver.mockReturnValue({
        resolvePositions: mockResolvePositions,
        cachedPosRef: { current: null },
    });
    rollAttack = vi.fn();
    useLoggedDiceRoll.mockReturnValue({ rollAttack, rollDamage: vi.fn() });
});

// Full zero-silence denial contract for a cannotAct spell-cell press (RB-1115):
// the gate folds through assertCanAct's shared popup lane — exactly ONE popup
// with the shared canTakeAction copy and ZERO spend/write/log channels.
function expectCannotActDenial() {
    expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
    expect(mockSetPopupHtml).toHaveBeenCalledWith(CANNOT_ACT_REASON);
    expect(gateMetamagic).not.toHaveBeenCalled();
    expect(rollAttack).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
}

// Damage chip is the SINGLE cast entry point (gateMetamagic → prepareSpellCast
// pays slots/concentration; CharReactions.jsx:354-365). Heal spells ride the
// same lane via resolveHealExpression. The un-slowed positive legs' SP-109
// control pair lives in CharReactions.slow.test.jsx; here the positives pin the
// exact dispatch args + silent-success, and the cannotAct leg pins the loud
// RB-1115 denial owned by this lane for spell cells.
describe('CharReactions - reaction-spell damage chip', () => {
    it.each([
        { label: 'damage spell', spell: HELLISH_REBUKE, display: '1d10', cannotAct: false },
        { label: 'healing spell', spell: HEALING_SPELL, display: '3d8+4', cannotAct: false },
        { label: 'damage spell', spell: HELLISH_REBUKE, display: '1d10', cannotAct: true },
    ])('clicking the $label damage cell casts via gateMetamagic(spell, {}) iff able to act (cannotAct: $cannotAct)', ({ spell, display, cannotAct }) => {
        getReactionSpellNames.mockReturnValue(new Set([spell.name]));
        resolveSpellDamageAtLevel.mockReturnValue(display);
        resolveHealExpression.mockReturnValue(display);
        render(<CharReactions {...propsWithSpell(spell, { cannotAct })} />);

        fireEvent.click(screen.getByText(display));

        if (!cannotAct) {
            // Byte-exact cast args: gateMetamagic receives the spell identity and
            // the literal empty metaCtx the source passes (CharReactions.jsx:364).
            expect(gateMetamagic).toHaveBeenCalledTimes(1);
            expect(gateMetamagic).toHaveBeenCalledWith(spell, {});
            expect(mockSetPopupHtml).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        } else {
            expectCannotActDenial();
        }
    });

    it('heal spell labels its type cell Healing', () => {
        getReactionSpellNames.mockReturnValue(new Set([HEALING_SPELL.name]));
        resolveHealExpression.mockReturnValue('3d8+4');
        render(<CharReactions {...propsWithSpell(HEALING_SPELL)} />);
        expect(screen.getByText('Healing')).toBeInTheDocument();
    });
});

// Spell-attack hit chip (renderReactionSpellHitCell isSpellAtk+hasAttackType
// branch): rolls rollAttack with the exact { forcedMode: undefined } options,
// never casts, and refuses cannotAct presses loudly with zero rolls.
describe('CharReactions - reaction-spell hit chip', () => {
    it('clicking the spell-attack bonus cell rolls the spell attack once with exact options', () => {
        getReactionSpellNames.mockReturnValue(new Set([THORN_WHIP.name]));
        resolveSpellDamageAtLevel.mockReturnValue('1d8+3 thunder');
        render(<CharReactions {...createProps({
            playerStats: {
                ...basePlayerStats,
                spellAbilities: { ...basePlayerStats.spellAbilities, toHit: 5, spells: [THORN_WHIP] },
            },
        })} />);

        const attackCell = screen.getByText('+5');
        expect(attackCell).toHaveClass('clickable');
        expect(attackCell).not.toHaveClass('disabled-attack');

        fireEvent.click(attackCell);

        expect(rollAttack).toHaveBeenCalledTimes(1);
        expect(rollAttack).toHaveBeenCalledWith('Thorn Whip', 5, { forcedMode: undefined });
        expect(gateMetamagic).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('cannotAct renders the bonus cell disabled-attack and denies the press with zero rolls (RB-1115)', () => {
        getReactionSpellNames.mockReturnValue(new Set([THORN_WHIP.name]));
        resolveSpellDamageAtLevel.mockReturnValue('1d8+3 thunder');
        render(<CharReactions {...createProps({
            cannotAct: true,
            playerStats: {
                ...basePlayerStats,
                spellAbilities: { ...basePlayerStats.spellAbilities, toHit: 5, spells: [THORN_WHIP] },
            },
        })} />);

        const attackCell = screen.getByText('+5');
        // Visual disabled affordance is load-bearing (it is the row's only
        // cannotAct signal before a press) — behavior alone would not prove it.
        expect(attackCell).toHaveClass('clickable', 'disabled-attack');

        fireEvent.click(attackCell);

        expectCannotActDenial();
    });
});

// Name-cell lane: the cross-lane castable-row testid stamp, the detail-popup
// open/close (props contract: spell identity, playerLevel, upcastLevels), and —
// in the same fixture — the hit-cell branch census for non-attack, non-DC
// spells (Shield/Hellish Rebuke carry neither attack_type nor dc, so both hit
// cells must be EMPTY, never a stray bonus or DC readout).
describe('CharReactions - reaction-spell name cell + detail popup', () => {
    it('stamps castable-row-<slug>, opens the clicked spell detail popup, and closes on backdrop press', () => {
        const { container } = render(<CharReactions {...createProps()} />);
        // Empty-hit-cell branch census: base toHit is 6, yet neither spell may
        // surface it (isSpellAtk && !hasAttackType → <div></div>) and neither
        // carries a dc, so no DC readout either.
        expect(within(container).queryByText('+6')).not.toBeInTheDocument();
        expect(container.textContent).not.toMatch(/DC \d/);

        const nameCell = screen.getByText('Hellish Rebuke');
        expect(nameCell).toHaveAttribute('data-testid', 'castable-row-hellish-rebuke');

        expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
        fireEvent.click(nameCell);

        const popup = screen.getByTestId('popup');
        const detail = screen.getByTestId('spell-detail-popup');
        // The popup composes the CLICKED spell, at the sheet's level, with the
        // upcast ladder built from it (buildUpcastLevels mock returns []).
        expect(within(detail).getByTestId('popup-spell-name').textContent).toBe('Hellish Rebuke');
        expect(within(detail).getByTestId('popup-player-level').textContent).toBe('5');
        expect(within(detail).getByTestId('popup-upcast-count').textContent).toBe('0');
        expect(buildUpcastLevels).toHaveBeenCalledWith(HELLISH_REBUKE);

        // Popup onClickOrKeyDown dismiss clears the selection (section unmounts).
        fireEvent.click(popup);
        expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
        expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });

    // Default (non-reactive) cast face: SpellDetailPopup onCast is wired to
    // handleReactionSpellCast (CharReactions.jsx:1013), which closes the popup,
    // resolves positions, then gateMetamagic THREADS metaCtx unchanged. The
    // reactive-flow onCast (handleReactiveSpellCast: combat-context target lookup
    // + applyWarCasterReaction) is owned by CharReactions.reactiveSpell.test.jsx
    // — the zero-calls below also prove the default lane never dips into it.
    it('detail-popup Cast closes the popup, resolves positions once, and threads metaCtx to gateMetamagic', async () => {
        getReactionSpellNames.mockReturnValue(new Set([HELLISH_REBUKE.name]));
        render(<CharReactions {...propsWithSpell(HELLISH_REBUKE)} />);
        fireEvent.click(screen.getByText('Hellish Rebuke'));

        fireEvent.click(screen.getByTestId('detail-cast-btn'));

        // handleReactionSpellCast awaits resolvePositions BEFORE casting, so the
        // gate call lands a microtask later (positions themselves are sync).
        expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
        expect(mockResolvePositions).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(gateMetamagic).toHaveBeenCalledTimes(1));
        expect(gateMetamagic).toHaveBeenCalledWith(HELLISH_REBUKE, QUICKEN_META);
        // No reactive-lane / spend traffic on the default cast face.
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(applyWarCasterReaction).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

// Remaining renderReactionSpellHitCell branches: auto-hit spells hide the bonus
// even when attack_type is present (branch order), save spells render the static
// DC readout that must not dispatch anything.
describe('CharReactions - reaction-spell hit-cell variants', () => {
    it('auto-hit spell shows no attack bonus despite attack_type and casts from the damage chip', () => {
        isAutoHitSpell.mockReturnValue(true);
        getReactionSpellNames.mockReturnValue(new Set([AUTO_HIT_SPELL.name]));
        resolveSpellDamageAtLevel.mockReturnValue('1d4+1 force');
        render(<CharReactions {...propsWithSpell(AUTO_HIT_SPELL)} />);

        expect(screen.queryByText('+6')).not.toBeInTheDocument();
        const damageCell = screen.getByText('1d4+1 force');
        expect(damageCell).toHaveClass('clickable');

        fireEvent.click(damageCell);
        expect(gateMetamagic).toHaveBeenCalledTimes(1);
        expect(gateMetamagic).toHaveBeenCalledWith(AUTO_HIT_SPELL, {});
    });

    it('save-DC spell renders a static DC readout that dispatches nothing', () => {
        getReactionSpellNames.mockReturnValue(new Set([SAVE_DC_SPELL.name]));
        resolveSpellDamageAtLevel.mockReturnValue('3d6');
        render(<CharReactions {...propsWithSpell(SAVE_DC_SPELL)} />);

        const dcCell = screen.getByText('DC 13 DEX');
        expect(screen.queryByText('+6')).not.toBeInTheDocument();

        fireEvent.click(dcCell);
        expect(rollAttack).not.toHaveBeenCalled();
        expect(gateMetamagic).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
