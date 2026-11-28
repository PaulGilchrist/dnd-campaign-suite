// @maintained-by-ai 2026-11-27 SP-109 slow-gate lane: every reaction click site (feature row, spell name cell, hit chip, damage chip) refuses with the byte-exact 'Reaction Blocked' popup + one full-shape Slow log, zero spend. Pre-refresh harness purged: 7 modal mocks + MetamagicPopup (gateMetamagic/hasAutomation stubs — none can ever mount here), baseCombatActions + formatUtils mirror mocks (ride the REAL constants/signFormatter), useSpellCastExecutor mock, phantom hasTacticalShift key. Un-slowed controls pin chip-arg threading incl. gateMetamagic reference identity (#1890); un-slowed OA-press positive lives in CharReactions.opportunityAttack.test.jsx #1931 (exact oaOptions, 7 observed), detail-popup-open control in CharReactions.spells.test.jsx #1911 (8 observed), Stand-row dispatch + feature-row RB-1115 denial in CharReactions.handlers.test.jsx #1910 (2 observed).
// SP-109: a slowed creature can't take Reactions. Every reaction row click
// (feature rows AND reaction-spell rows/cells) is refused with one exact
// 'Reaction Blocked' popup and one 'automation' log entry, with zero
// downstream dice/cast/selection side effects.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';

// Hoisted, render-stable spies (handlers #1910 idiom): inline factories that
// rebuild the inner vi.fn per hook call would blind the refusal censuses.
const { mockSetPopupHtml, mockGateMetamagic } = vi.hoisted(() => ({
    mockSetPopupHtml: vi.fn(),
    mockGateMetamagic: vi.fn(),
}));

// Only surfaces this lane can reach are mocked (#1931/#1911 idiom). The seven
// modal mocks + MetamagicPopup were dead harness: hasAutomation is stubbed
// false and gateMetamagic is a spy, so modalState/pendingMetamagic can never
// populate — none of them can mount here. SpellDetailPopup STAYS: the
// name-cell refusal leg proves the gate blocks setSelectedSpell by asserting
// this lazily-mounted child (#1931/#1932) never appears. The baseCombatActions
// and formatUtils mocks were byte-for-byte mirrors of the real constants /
// Intl signFormatter and were purged — the lane rides the REAL values.
vi.mock('../common/popup.jsx', () => ({
    default: ({ children }) => React.createElement('div', { 'data-testid': 'popup' }, children),
}));
vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'spell-detail-popup' }, null),
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
vi.mock('../../services/combat/automation/automationService.js', () => ({
    // CharReactions.jsx:23 imports exactly these two; hasTacticalShift was a
    // phantom exported-but-never-imported key (#1910/#1964).
    hasAutomation: vi.fn(() => false),
    hasSpeedyOpportunityDisadvantage: vi.fn(() => false),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
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
        gateMetamagic: mockGateMetamagic,
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
// useSpellCastExecutor mock purged (#1931): castAction is unreachable here —
// the damage chip's single entry point is the gateMetamagic spy.
vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
    resolveSpellDamageAtLevel: vi.fn(),
    isAutoHitSpell: vi.fn(() => false),
    resolveHealExpression: vi.fn(),
}));

import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { resolveSpellDamageAtLevel } from '../../services/rules/core/spellDamageUtils.js';

const campaignName = 'test-campaign';

const playerStats = {
    name: 'AberrantSorcerer',
    level: 20,
    reactions: [{ name: 'Opportunity Attack', description: 'Can attack creature that moves out of your reach' }],
    attacks: [{ name: 'Mace', type: 'Action', range: 5, hitBonus: 3 }],
    spellAbilities: { spells: [], toHit: 9, saveDc: 17 },
};

const shieldSpell = { name: 'Shield', level: 1, range: '1 self', dc: { value: 15, dc_type: 'Save' } };

// Byte-verified against CharReactions.jsx refuseSlowedReaction (:524-532):
// one popup, one full-shape log. If either string drifts, every refusal pin
// below FAILS (#1962).
const SLOW_POPUP = '<b>Reaction Blocked</b><br/>AberrantSorcerer is Slowed and can\'t take Reactions.';
const slowLog = (reactionName) => ({
    type: 'automation',
    creatureName: 'AberrantSorcerer',
    name: 'Slow',
    description: `${reactionName} blocked — AberrantSorcerer is Slowed and can't take Reactions.`,
    timestamp: expect.any(Number),
});

beforeEach(() => {
    vi.clearAllMocks();
    // Re-baseline EVERY per-test override (#1965): clearAllMocks keeps
    // implementations, so each mockReturnValue here is the fresh floor.
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
    getRuntimeValue.mockReturnValue(null);
    getReactionSpellNames.mockReturnValue(new Set());
    resolveSpellDamageAtLevel.mockReturnValue(null);
});

function setConditions(conditions) {
    getRuntimeValue.mockImplementation((name, key) => (key === 'activeConditions' ? conditions : null));
}

function renderReactions(stats = playerStats) {
    return render(<CharReactions playerStats={stats} campaignName={campaignName} cannotAct={false} mapName={null} characters={[]} />);
}

describe('CharReactions — SP-109 slow reaction gate', () => {
    it('refuses a feature-row reaction click while slowed: one exact block popup, one exact Slow log, OA dice lane never fires', async () => {
        setConditions(['slow']);
        const rollAttack = vi.fn();
        vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        renderReactions();

        fireEvent.click(screen.getByText('Opportunity Attack:'));

        expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
        expect(mockSetPopupHtml).toHaveBeenCalledWith(SLOW_POPUP);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, slowLog('Opportunity Attack'));
        // A gate-deleted mutant would continue into the async OA dispatch
        // lane — flush microtasks so the not-called pin cannot race past it.
        await act(async () => {});
        expect(rollAttack).not.toHaveBeenCalled();
    });

    it('refuses a reaction-spell name-cell click while slowed: exact popup + Slow log naming the spell, detail popup never opens', () => {
        setConditions(['slow']);
        getReactionSpellNames.mockReturnValue(new Set([shieldSpell.name]));

        renderReactions({ ...playerStats, spellAbilities: { ...playerStats.spellAbilities, spells: [shieldSpell] } });

        fireEvent.click(screen.getByText('Shield'));

        expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
        expect(mockSetPopupHtml).toHaveBeenCalledWith(SLOW_POPUP);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, slowLog('Shield'));
        // Gate blocks setSelectedSpell: the lazily-mounted detail child stays absent.
        expect(screen.queryByTestId('spell-detail-popup')).toBeNull();
    });

    // fix#344(a): the reaction-spell HIT chip (rollAttack) and DAMAGE chip
    // (gateMetamagic) previously dispatched past the SP-109 gate. Both chips
    // now route through the SAME canonical isSlowed/refuseSlowedReaction
    // (:330, :360). One render, two presses, ordered census (no mid-test
    // mockClear): each site's refusal is pinned by index, and a gate dropped
    // at either site fires rollAttack/gateMetamagic and breaks the census.
    const REBUKE_ATK = { name: 'Hellish Rebuke', level: 1, range: '60 ft.', attack_type: 'Ranged Spell Attack', damage: '2d12', damage_type: 'fire' };

    function renderRebukeRow() {
        getReactionSpellNames.mockReturnValue(new Set([REBUKE_ATK.name]));
        resolveSpellDamageAtLevel.mockReturnValue('2d12');
        return renderReactions({ ...playerStats, spellAbilities: { ...playerStats.spellAbilities, spells: [REBUKE_ATK] } });
    }

    it('slowed: hit-chip then damage-chip presses both refused loudly — ordered 2x exact popup/log census, rollAttack and gateMetamagic never fire', () => {
        setConditions(['slow']);
        const rollAttack = vi.fn();
        vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        renderRebukeRow();

        fireEvent.click(screen.getByText('+9'));
        fireEvent.click(screen.getByText('2d12'));

        expect(mockSetPopupHtml.mock.calls).toEqual([[SLOW_POPUP], [SLOW_POPUP]]);
        expect(addEntry.mock.calls).toEqual([
            [campaignName, slowLog('Hellish Rebuke')],
            [campaignName, slowLog('Hellish Rebuke')],
        ]);
        expect(rollAttack).not.toHaveBeenCalled();
        expect(mockGateMetamagic).not.toHaveBeenCalled();
    });

    // Falsifiability pair (#1911 split): the un-slowed controls pin that the
    // SAME chips thread exact args — a mutant that always-refuses, or one that
    // swaps the option object, fails here. The un-slowed feature-row/OA
    // positive is covered stronger in CharReactions.opportunityAttack.test.jsx
    // (#1931 exact oaOptions) and the name-cell detail-open control in
    // CharReactions.spells.test.jsx (#1911), so they are not duplicated here.
    it('control: un-slowed hit-chip click rolls the spell attack with exact args — no popup at all, no log', () => {
        setConditions([]);
        const rollAttack = vi.fn();
        vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        renderRebukeRow();

        fireEvent.click(screen.getByText('+9'));

        expect(rollAttack).toHaveBeenCalledTimes(1);
        expect(rollAttack).toHaveBeenCalledWith('Hellish Rebuke', 9, { forcedMode: undefined });
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('control: un-slowed damage-chip click casts the SAME spell object via gateMetamagic — no popup at all, no log', () => {
        setConditions([]);
        renderRebukeRow();

        fireEvent.click(screen.getByText('2d12'));

        expect(mockGateMetamagic).toHaveBeenCalledTimes(1);
        // Reference identity (#1890/#1963): row assembly is a plain filter, so
        // the cast entry point must receive the exact fixture object, not a copy.
        expect(mockGateMetamagic.mock.calls[0][0]).toBe(REBUKE_ATK);
        expect(mockGateMetamagic).toHaveBeenCalledWith(REBUKE_ATK, {});
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
