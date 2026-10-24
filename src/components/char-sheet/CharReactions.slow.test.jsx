// @maintained-by-ai
// SP-109: a slowed creature can't take Reactions — every reaction row click
// (feature rows AND reaction-spell rows) is refused with a 'Reaction Blocked'
// popup and a single 'automation' log entry, with no downstream dice/selection
// side effects. Control lane: unslowed clicks fire normally and log nothing.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';

const mockSetPopupHtml = vi.fn();
const mockGateMetamagic = vi.fn();

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
    default: () => null,
}));
vi.mock('./modals/divine/BastionOfLawSpendModal.jsx', () => ({
    default: () => null,
}));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
    default: () => null,
}));
vi.mock('./modals/BendFateModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/BoonFateModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({ default: () => null }));
vi.mock('./modals/SearingVengeanceModal.jsx', () => ({ default: () => null }));
vi.mock('../../services/ui/spellSectionUtils.js', () => ({
    getReactionSpellNames: vi.fn(() => new Set()),
    applyPotentSpellcasting: vi.fn((resolved) => resolved),
}));
vi.mock('../../services/character/featureCategories.js', () => ({
    getCategories: vi.fn(() => ({ featuresToIgnore: [] })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: (html) => html }));
vi.mock('../../hooks/combat/useActionPopup.js', () => ({
    buildFeatureDetailHtml: vi.fn((reaction) => `<div>${reaction.name}</div>`),
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ rollAttack: vi.fn(), rollDamage: vi.fn() })),
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
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(() => []),
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

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
    getRuntimeValue.mockReturnValue(null);
    getReactionSpellNames.mockReturnValue(new Set());
});

function setConditions(conditions) {
    getRuntimeValue.mockImplementation((name, key) => (key === 'activeConditions' ? conditions : null));
}

function renderReactions(stats = playerStats) {
    return render(<CharReactions playerStats={stats} campaignName={campaignName} cannotAct={false} mapName={null} characters={[]} />);
}

describe('CharReactions — SP-109 slow reaction gate', () => {
    it('refuses a feature reaction click while slowed: block popup + Slow automation log, OA dice lane never fires', () => {
        setConditions(['slow']);
        const rollAttack = vi.fn();
        vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        renderReactions();

        fireEvent.click(screen.getByText('Opportunity Attack:'));

        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Reaction Blocked'));
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Slowed'));
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'automation',
            creatureName: 'AberrantSorcerer',
            name: 'Slow',
            description: expect.stringContaining('Opportunity Attack'),
        }));
        // Gate short-circuits before the OA lane — no dice, no detail popup.
        expect(rollAttack).not.toHaveBeenCalled();
    });

    it('refuses a reaction-spell row click while slowed: block popup + Slow log names the spell', () => {
        setConditions(['slow']);
        getReactionSpellNames.mockReturnValue(new Set([shieldSpell.name]));

        renderReactions({ ...playerStats, spellAbilities: { ...playerStats.spellAbilities, spells: [shieldSpell] } });

        fireEvent.click(screen.getByText('Shield'));

        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Reaction Blocked'));
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Slowed'));
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'automation',
            creatureName: 'AberrantSorcerer',
            name: 'Slow',
            description: expect.stringContaining('Shield'),
        }));
    });

    it('control: unslowed, the same click fires the OA dice lane — no block popup, no log', async () => {
        setConditions([]);
        const rollAttack = vi.fn();
        vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        renderReactions();

        fireEvent.click(screen.getByText('Opportunity Attack:'));

        await waitFor(() => expect(rollAttack).toHaveBeenCalledWith('Mace', 3, expect.objectContaining({ isOpportunityAttack: true })));
        expect(mockSetPopupHtml).not.toHaveBeenCalledWith(expect.stringContaining('Slowed'));
        expect(addEntry).not.toHaveBeenCalled();
    });

    // fix#344(a): the reaction-spell HIT chip (rollAttack) and DAMAGE chip
    // (gateMetamagic) previously dispatched past the SP-109 gate — only the name
    // cell and feature rows were guarded. Both chips now route through the SAME
    // canonical isSlowed/refuseSlowedReaction (CharReactions.jsx:456-469):
    // slowed clicks refuse loudly, unslowed clicks proceed (falsifiability pair).
    const REBUKE_ATK = { name: 'Hellish Rebuke', level: 1, range: '60 ft.', attack_type: 'Ranged Spell Attack', damage: '2d12', damage_type: 'fire' };

    function renderRebukeRow() {
        getReactionSpellNames.mockReturnValue(new Set([REBUKE_ATK.name]));
        resolveSpellDamageAtLevel.mockReturnValue('2d12');
        return renderReactions({ ...playerStats, spellAbilities: { ...playerStats.spellAbilities, spells: [REBUKE_ATK] } });
    }

    it('slowed: hit-chip click refused loudly — block popup + Slow log, rollAttack never fires', () => {
        setConditions(['slow']);
        const rollAttack = vi.fn();
        vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        renderRebukeRow();

        fireEvent.click(screen.getByText('+9'));

        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Reaction Blocked'));
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Slowed'));
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'automation',
            creatureName: 'AberrantSorcerer',
            name: 'Slow',
            description: expect.stringContaining('Hellish Rebuke'),
        }));
        expect(rollAttack).not.toHaveBeenCalled();
    });

    it('slowed: damage-chip click refused loudly — block popup + Slow log, gateMetamagic never fires', () => {
        setConditions(['slow']);
        renderRebukeRow();

        fireEvent.click(screen.getByText('2d12'));

        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Reaction Blocked'));
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Slowed'));
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'automation',
            creatureName: 'AberrantSorcerer',
            name: 'Slow',
            description: expect.stringContaining('Hellish Rebuke'),
        }));
        expect(mockGateMetamagic).not.toHaveBeenCalled();
    });

    it('control: unslowed, the same hit-chip click rolls the spell attack — no block popup, no log', () => {
        setConditions([]);
        const rollAttack = vi.fn();
        vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollAttack, rollDamage: vi.fn() });
        renderRebukeRow();

        fireEvent.click(screen.getByText('+9'));

        expect(rollAttack).toHaveBeenCalledWith('Hellish Rebuke', 9, { forcedMode: undefined });
        expect(mockSetPopupHtml).not.toHaveBeenCalledWith(expect.stringContaining('Slowed'));
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('control: unslowed, the same damage-chip click casts via gateMetamagic — no block popup, no log', () => {
        setConditions([]);
        renderRebukeRow();

        fireEvent.click(screen.getByText('2d12'));

        expect(mockGateMetamagic).toHaveBeenCalledWith(REBUKE_ATK, {});
        expect(mockSetPopupHtml).not.toHaveBeenCalledWith(expect.stringContaining('Slowed'));
        expect(addEntry).not.toHaveBeenCalled();
    });
});
