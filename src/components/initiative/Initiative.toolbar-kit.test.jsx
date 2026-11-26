// @maintained-by-ai 2026-11-22
/* Lane — .ct-* design-kit convergence (QA backlog tranche 1, Initiative view):
 * the Initiative root carries .ct-container so the App.css kit (every rule
 * .ct-container-scoped) styles the GM control row and the loot panel. Pins the
 * button hierarchy: Clear on .ct-btn .ct-btn-danger (aria/title untouched),
 * + NPC / + Monster / Split Party / ← Prev on .ct-btn, Next → and End-Turn-era
 * primaries on .ct-btn-primary, Generate Loot on .ct-generate-btn; the Split
 * Party behavioral classes (.split-party-button[-active]) survive ALONGSIDE
 * the kit tier; the TV toggle keeps its pinned .tv-toggle-button contract
 * untouched; and the retired bespoke tokens (.clear-button, .end-turn-button,
 * the loot-button family) render zero. The empty-state twin stays kit-native
 * under the root scope (no inner .ct-container wrapper).
 * Mock block copied from Initiative.board-order.test.jsx (same seam). */
import { render, waitFor, act, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { loadCombatSummary } from '../../services/encounters/combatData.js';

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
    const syncStateStore = new Map();
    return {
        deleteRuntimeKey: vi.fn(),
        getStore: vi.fn(() => syncStateStore),
        useRuntimeValue: vi.fn(() => null),
        addStorageChangeListener: vi.fn(() => () => {}),
        useSyncedState: vi.fn((key, prop, defaultValue) => {
            const storeKey = `${key}-${prop}`;
            if (!syncStateStore.has(storeKey)) {
                syncStateStore.set(storeKey, { value: defaultValue, setter: null });
            }
            const entry = syncStateStore.get(storeKey);
            if (!entry.setter) {
                entry.setter = vi.fn((newValue) => {
                    entry.value = newValue;
                });
            }
            return [entry.value, entry.setter];
        }),
        listeners: new Map(),
        getRuntimeValue: vi.fn(() => null),
        setRuntimeValue: vi.fn(),
        setRuntimeObject: vi.fn(),
    };
});
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({ clearDeathSavePrompt: vi.fn() }));
vi.mock('../../services/npcs/monsterUtils.js', () => ({ getMonsterImageUrl: vi.fn(() => Promise.resolve(null)), getMonsterData: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
    CONDITIONS: [],
}));
vi.mock('../../services/npcs/npcsService.js', () => ({ loadNPCs: vi.fn(() => Promise.resolve({ npcs: [] })) }));
vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({ npcToMonsterFormat: vi.fn(() => null), npcHasStatBlock: vi.fn(() => true) }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ expireStaleEffects: vi.fn(), applyTurnStartEffects: vi.fn(), applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/encounters/combatData.js', () => {
    return {
        loadCombatSummary: vi.fn(() => Promise.resolve(null)),
        getCombatSummary: vi.fn(() => null),
        getActiveCreatureName: vi.fn(() => null),
        setCombatSummaryCache: vi.fn(),
    };
});
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({ clearPerRoundMajestyTrackers: vi.fn() }));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    removeCondition: vi.fn(), addCondition: vi.fn(),
    buildConditionPopup: vi.fn(() => null),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    breakConcentration: vi.fn(), addConcentration: vi.fn(),
    buildConcentrationPopup: vi.fn(() => null),
    cleanupConcentrationEffects: vi.fn(),
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logInitiativeRoll: vi.fn(), logConditionEvent: vi.fn(), logConcentrationSave: vi.fn(),
    logConditionSave: vi.fn(), logHpChange: vi.fn(), logNpcThreshold: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
vi.mock('../../services/maps/spellOverlayService.js', () => ({
    fetchSpellOverlays: vi.fn(() => Promise.resolve([])),
    overlayTargetId: vi.fn(() => null),
}));
vi.mock('../../hooks/ui/useMonstersData.js', () => ({
    useMonstersData: vi.fn(() => ({ monsters: [], loading: false })),
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: () => <div data-testid="popup-overlay" /> }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: () => <div data-testid="dice-roll-result" /> }));
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature, isActive }) => (
        <div data-testid={`creature-card-${creature.name}`} data-active={isActive ? 'true' : 'false'} />
    ),
}));
vi.mock('./EffectAdder.jsx', () => ({ default: () => <div data-testid="effect-adder" /> }));

const characters = [{ name: 'ElderPaladin' }];
const BOARD = {
    round: 1,
    creatures: [{ name: 'ElderPaladin', type: 'player', initiative: '15', targetName: null, concentration: null }],
};

const mount = async (props = {}) => {
    loadCombatSummary.mockResolvedValue(BOARD);
    let view;
    await act(async () => {
        view = render(
            <Initiative
                characters={characters}
                campaignName="test-campaign"
                isLocalhost
                mapName={null}
                {...props}
            />
        );
    });
    await waitFor(() => {
        expect(screen.getByTestId('creature-card-ElderPaladin')).toBeInTheDocument();
    });
    return view;
};

const btn = (name, options = {}) => screen.getByRole('button', { name, ...options });

beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
});

describe('Initiative — kit button hierarchy on the GM control row (tranche 1)', () => {
    it('root carries the kit scope (.ct-container) alongside .initiative', async () => {
        const { container } = await mount();
        const root = container.querySelector('.initiative');
        expect(root).toHaveClass('ct-container');
    });

    it('toolbar buttons render the correct kit variants with every label/aria/title intact', async () => {
        await mount();
        const clear = btn('Clear Initiative Board');
        expect(clear).toHaveClass('ct-btn', 'ct-btn-danger');
        expect(clear).toHaveAttribute('title', 'Clear Initiative Board');
        expect(clear).toHaveAttribute('aria-label', 'Clear Initiative Board');
        expect(btn('+ NPC')).toHaveClass('ct-btn');
        expect(btn('+ Monster')).toHaveClass('ct-btn');
        expect(btn('Split Party')).toHaveClass('ct-btn', 'split-party-button');
        expect(btn('← Prev')).toHaveClass('ct-btn');
        expect(btn('Next →')).toHaveClass('ct-btn', 'ct-btn-primary');
    });

    it('loot actions ride the kit tiers (generate / primary / plain / danger-sm)', async () => {
        await mount();
        expect(btn(/Generate Loot/i)).toHaveClass('ct-generate-btn');
        // No loot drafted yet: only the generate affordance shows.
        expect(screen.queryByRole('button', { name: 'Award Loot' })).toBeNull();
    });

    it('retired bespoke tokens render zero, and the pinned TV toggle contract survives', async () => {
        const { container } = await mount();
        expect(container.querySelector('.clear-button')).toBeNull();
        expect(container.querySelector('.end-turn-button')).toBeNull();
        expect(container.querySelectorAll('[class*="initiative-btn"]').length).toBe(0);
        // .tv-toggle-button is a pinned behavior/DOM contract — untouched.
        expect(container.querySelector('.tv-toggle-button')).toBeInTheDocument();
    });

    it('zero-subject board: the empty state rides the root kit scope (no inner .ct-container wrapper)', async () => {
        loadCombatSummary.mockResolvedValue(null);
        const { container } = await act(async () => render(
            <Initiative characters={[]} campaignName="test-campaign" isLocalhost={false} mapName={null} />
        ));
        await waitFor(() => {
            expect(container.querySelector('.ct-empty-state')).toBeInTheDocument();
        });
        expect(container.querySelector('.ct-empty-state .ct-container')).toBeNull();
        expect(container.querySelector('.initiative')).toHaveClass('ct-container');
    });
});
