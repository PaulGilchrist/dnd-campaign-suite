// @maintained-by-ai
// [2026-11-12 QR backlog] Zero-subject Initiative empty state: the boardHasSubjects
// false branch (no combatSummary, or a board with zero subjects and zero characters)
// used to render a bare void. It now renders a guidance panel (add characters /
// join via the Encounter Builder) with a GM-only deep-link wired through the
// established App.jsx callback-prop pattern (onOpenEncounters — like the
// onViewInitiative props on NPCs/Sessions). The subjects-present face must stay
// byte-unchanged (header + TV toggle + cards). Mock block mirrors
// Initiative.zero-creature-mount.test.jsx (write-capture style).
import { render, waitFor, act, fireEvent } from '@testing-library/react';
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
vi.mock('../../services/encounters/initiativeService.js', () => ({
    setupCreatures: vi.fn((characters) => characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }))),
    isBareNpcPlaceholder: (c) => c.type === 'npc' && !c.monsterIndex && /^NPC \d+$/.test(c.name || ''),
    addNpc: vi.fn(),
    removeNpc: vi.fn(),
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
    isPreviousDisabled: vi.fn(() => false),
    setInitiative: vi.fn(),
    rollNpcInitiative: vi.fn(() => ({ roll: 15, bonus: 2, total: 17 })),
    renameNpc: vi.fn(() => Promise.resolve()),
    setTarget: vi.fn(),
    clearCombat: vi.fn(() => ({ round: 1, creatures: [] })),
    mergeCombatSummaryWithCharacters: vi.fn((initialSummary) => initialSummary),
}));
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
// Zero-network guard: mount fetches spell overlays for real otherwise.
vi.mock('../../services/maps/spellOverlayService.js', () => ({
    fetchSpellOverlays: vi.fn(() => Promise.resolve([])),
    overlayTargetId: vi.fn(() => null),
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: () => <div data-testid="popup-overlay" /> }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: () => <div data-testid="dice-roll-result" /> }));
vi.mock('./CreatureCard.jsx', () => ({ default: ({ creature }) => <div data-testid={`creature-card-${creature.name}`} /> }));
vi.mock('./EffectAdder.jsx', () => ({ default: () => <div data-testid="effect-adder" /> }));

const mountProps = (overrides = {}) => ({
    characters: [],
    campaignName: 'test-campaign',
    onNpcsChange: vi.fn(),
    mapName: null,
    isLocalhost: true,
    onOpenEncounters: vi.fn(),
    ...overrides,
});

const mount = async (props) => {
    let view;
    await act(async () => {
        view = render(<Initiative {...props} />);
    });
    await waitFor(() => {
        expect(loadCombatSummary).toHaveBeenCalledWith('test-campaign');
    });
    return view;
};

describe('Initiative zero-subject empty state', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
        vi.mocked(loadCombatSummary).mockResolvedValue(null);
    });

    it('renders guidance copy (and no board) when the board has no subjects and no characters', async () => {
        const { container } = await mount(mountProps());

        const empty = container.querySelector('.ct-empty-state');
        expect(empty).not.toBeNull();
        expect(empty.textContent).toMatch(/add characters/i);
        expect(empty.textContent).toMatch(/Encounter Builder/i);
        // No board chrome on the void face.
        expect(container.querySelector('.combat-header')).toBeNull();
    });

    it('renders the same guidance for a mount-authored empty-skeleton board (zero-characters GM tab)', async () => {
        // GM mount stores {round:1,creatures:[]} locally — boardHasSubjects stays
        // false (qa-arena face), so the empty state survives the settle write.
        const { container } = await mount(mountProps({ isLocalhost: true }));
        await waitFor(() => {
            expect(container.querySelector('.ct-empty-state')).not.toBeNull();
        });
        expect(container.querySelector('.combat-header')).toBeNull();
    });

    it('does NOT render the empty state when subjects exist (normal board face)', async () => {
        const { container } = await mount(mountProps({
            characters: [{ name: 'Alice' }, { name: 'Zed' }],
        }));

        expect(container.querySelector('.ct-empty-state')).toBeNull();
        // Zero-regression lock: the normal face keeps its header + TV toggle + cards.
        expect(container.querySelector('.combat-header')).not.toBeNull();
        expect(container.querySelectorAll('[data-testid^="creature-card-"]').length).toBe(2);
    });

    it('offers the Encounter Builder deep-link on a GM tab', async () => {
        const { container } = await mount(mountProps({ isLocalhost: true }));
        const button = [...container.querySelectorAll('button')]
            .find((b) => /Encounter Builder/i.test(b.textContent));
        expect(button).toBeDefined();
    });

    it('shows the copy but no deep-link button on a non-GM (player) tab', async () => {
        const { container } = await mount(mountProps({ isLocalhost: false }));

        const empty = container.querySelector('.ct-empty-state');
        expect(empty).not.toBeNull();
        expect(empty.textContent).toMatch(/Encounter Builder/i);
        const button = [...container.querySelectorAll('button')]
            .find((b) => /Encounter Builder/i.test(b.textContent));
        expect(button).toBeUndefined();
    });

    it('invokes onOpenEncounters when the GM presses the deep-link button', async () => {
        const onOpenEncounters = vi.fn();
        const { container } = await mount(mountProps({ isLocalhost: true, onOpenEncounters }));
        const button = [...container.querySelectorAll('button')]
            .find((b) => /Encounter Builder/i.test(b.textContent));

        await act(async () => { fireEvent.click(button); });
        expect(onOpenEncounters).toHaveBeenCalledTimes(1);
    });
});
