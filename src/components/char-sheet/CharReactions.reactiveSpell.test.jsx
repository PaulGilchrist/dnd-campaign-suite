// FT-099: Reactive Spell picker must render clickable rows (not be swallowed
// by the generic automation_info popup), the cast leg must route through the
// real reaction cast machinery (gateMetamagic), and refusals must spend nothing.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharReactions from './CharReactions.jsx';

vi.mock('../common/popup.jsx', () => ({
    default: ({ children }) => React.createElement('div', { 'data-testid': 'popup' }, children),
}));
vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
    default: ({ spell, onCast }) =>
        React.createElement('div', { 'data-testid': 'spell-detail-popup' },
            React.createElement('span', null, spell.name),
            React.createElement('button', { 'data-testid': 'detail-cast-btn', onClick: () => onCast(spell, {}) }, 'Cast'),
        ),
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
    default: () => React.createElement('div', { 'data-testid': 'bend-fate-modal' }, null),
}));
vi.mock('./modals/BoonFateModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'boon-fate-modal' }, null),
}));
vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'steps-of-fey-modal' }, null),
}));
vi.mock('./modals/SearingVengeanceModal.jsx', () => ({
    default: () => React.createElement('div', { 'data-testid': 'searing-vengeance-modal' }, null),
}));
vi.mock('../../services/ui/spellSectionUtils.js', () => ({
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
    useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));
vi.mock('../../services/combat/baseCombatActions.js', () => ({
    OPPORTUNITY_ATTACK: { name: 'Opportunity Attack', description: 'Can attack creature that moves out of your reach' },
    MELEE_REACH_FEET: 5,
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasAutomation: vi.fn((r) => !!r.automation),
    hasSpeedyOpportunityDisadvantage: vi.fn(() => false),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ round: 1, creatures: [{ name: 'DivinationWizard', targetName: 'Thug 1' }] }),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Thug 1' })),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(() => []),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
const mockExecuteHandler = vi.fn();
vi.mock('../../services/automation/index.js', () => ({
    executeHandler: (...args) => mockExecuteHandler(...args),
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
const mockApplyWarCasterReaction = vi.fn();
vi.mock('../../services/automation/handlers/reactions/reactionSpellHandler.js', () => ({
    applyWarCasterReaction: (...args) => mockApplyWarCasterReaction(...args),
}));
vi.mock('../../services/automation/handlers/reactions/reactionBonusHandler.js', () => ({
    applyInspiringMovement: vi.fn(),
}));
vi.mock('./useAttackDamageResolution.js', () => ({
    normalizeAutoDamage: vi.fn(),
    resolveAttackDamageStandalone: vi.fn(),
}));
const mockGateMetamagic = vi.fn();
vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
    useSpellMetamagicFlow: vi.fn(() => ({
        pendingMetamagic: null,
        gateMetamagic: (...args) => mockGateMetamagic(...args),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
    })),
}));
vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
    useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));
vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
    useSpellPositionResolver: vi.fn(() => ({
        resolvePositions: vi.fn().mockResolvedValue(null),
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

import { addEntry } from '../../services/ui/logService.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';

const campaignName = 'test-campaign';

const eligibleSpells = [
    { name: 'Fire Bolt', level: 0, casting_time: '1 action', range: '120 feet', prepared: 'Always' },
    { name: 'Magic Missile', level: 1, casting_time: '1 action', range: '120 feet', prepared: 'Always' },
];

const basePlayerStats = {
    name: 'DivinationWizard',
    level: 20,
    class: { name: 'Wizard' },
    reactions: [
        { name: 'Reactive Spell', description: 'Cast a spell when a creature leaves your reach', automation: { type: 'reaction_spell' } },
    ],
    attacks: [],
    spellAbilities: { modifier: 5, toHit: 12, saveDc: 19, spells: [] },
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    _trackedResources: {},
};

function renderSheet() {
    return render(<CharReactions
        playerStats={basePlayerStats}
        campaignName={campaignName}
        cannotAct={false}
        mapName={null}
        characters={[]}
    />);
}

async function openPicker() {
    fireEvent.click(screen.getByText('Reactive Spell:'));
    await waitFor(() => expect(mockExecuteHandler).toHaveBeenCalled());
}

describe('CharReactions — Reactive Spell picker (FT-099)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useLoggedDiceRoll.mockReturnValue({ rollAttack: vi.fn(), rollDamage: vi.fn() });
        useDiceRollPopup.mockReturnValue({ setPopupHtml: vi.fn() });
        mockExecuteHandler.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Reactive Spell',
                description: 'info',
                eligibleSpells,
            },
        });
        mockApplyWarCasterReaction.mockResolvedValue({ ok: true });
    });

    it('picker branch is taken despite automation_info payload — clickable spell rows render', async () => {
        renderSheet();
        await openPicker();

        expect(screen.getByText('Reactive Spell')).toBeTruthy();
        expect(screen.getByText('Select a single target spell with casting time of 1 action to cast as a reaction:')).toBeTruthy();
        const rows = document.querySelectorAll('.reactive-spell-list .clickable');
        expect(rows).toHaveLength(2);
        expect(screen.getByText('Fire Bolt')).toBeTruthy();
        expect(screen.getByText('Magic Missile')).toBeTruthy();
    });

    it('falls back to the read-only info popup when no spells are eligible', async () => {
        mockExecuteHandler.mockResolvedValue({
            type: 'popup',
            payload: { type: 'automation_info', name: 'Reactive Spell', description: 'No spells available.', eligibleSpells: [] },
        });
        renderSheet();
        await openPicker();

        expect(document.querySelectorAll('.reactive-spell-list')).toHaveLength(0);
        expect(useDiceRollPopup().setPopupHtml).toHaveBeenCalled();
    });

    it('picking a spell commits via applyWarCasterReaction and casts through gateMetamagic', async () => {
        const { setPopupHtml } = useDiceRollPopup();
        renderSheet();
        await openPicker();

        fireEvent.click(screen.getByText('Fire Bolt'));
        fireEvent.click(await screen.findByTestId('detail-cast-btn'));

        await waitFor(() => expect(mockGateMetamagic).toHaveBeenCalled());
        expect(mockApplyWarCasterReaction).toHaveBeenCalledWith('Thug 1', 'Fire Bolt', expect.objectContaining({ name: 'Fire Bolt' }), basePlayerStats, campaignName);
        expect(mockGateMetamagic.mock.calls[0][0].name).toBe('Fire Bolt');
        expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('refusal from applyWarCasterReaction skips the cast leg — no gateMetamagic, popup explains', async () => {
        const { setPopupHtml } = useDiceRollPopup();
        mockApplyWarCasterReaction.mockResolvedValue({ ok: false, refused: 'Once per round — Reactive Spell already used this round.' });
        renderSheet();
        await openPicker();

        fireEvent.click(screen.getByText('Fire Bolt'));
        fireEvent.click(await screen.findByTestId('detail-cast-btn'));

        await waitFor(() => expect(mockApplyWarCasterReaction).toHaveBeenCalled());
        expect(mockGateMetamagic).not.toHaveBeenCalled();
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            description: expect.stringContaining('No spell slot consumed'),
        }));
    });

    it('no armed target at cast time logs reactive_spell_refused and spends nothing', async () => {
        getTargetFromAttacker.mockReturnValueOnce(null);
        renderSheet();
        await openPicker();

        fireEvent.click(screen.getByText('Fire Bolt'));
        fireEvent.click(await screen.findByTestId('detail-cast-btn'));

        await waitFor(() => expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            automationType: 'reactive_spell_refused',
        })));
        expect(mockApplyWarCasterReaction).not.toHaveBeenCalled();
        expect(mockGateMetamagic).not.toHaveBeenCalled();
    });
});
