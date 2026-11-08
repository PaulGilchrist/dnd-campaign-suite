// @maintained-by-ai
// Zero-creature Initiative mount (bug-zero-creature-initiative-null-name): a freshly
// quick-created campaign (Arena/Starter — zero characters, no server combatSummary)
// mounts the Initiative board with an EMPTY roster. The no-server-cs branch used to
// store `creatures[0]?.name` — undefined for [] — which collapses JSON.stringify({value})
// to a bare {} POST, persisting a malformed activeCreatureName key whose SSE echo then
// crashes expireStaleEffects and poisons the round gate with "1:[object Object]".
// Fix mirrors the createCreatureHandlers CLEAR-path guard (2036625ff): ?? null.
// Mock block mirrors initiative.localhost-gate.test.jsx (write-capture style).
import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';

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

describe('Initiative zero-creature mount (no server combatSummary)', () => {
    const mountProps = (characters) => ({
        characters,
        campaignName: 'test-campaign',
        onNpcsChange: vi.fn(),
        mapName: null,
        isLocalhost: true,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
        // No server combatSummary — the corrupting precondition (fresh arena).
        vi.mocked(loadCombatSummary).mockResolvedValue(null);
    });

    const waitForMountWrites = async () => {
        await waitFor(() => {
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.anything(), 'test-campaign');
        });
    };

    it('stores null (never undefined) for activeCreatureName on a zero-character mount', async () => {
        await act(async () => { render(<Initiative {...mountProps([])} />); });
        await waitForMountWrites();

        // The fingerprint: undefined would collapse the POST body to a bare {}.
        const activeWrites = storage.set.mock.calls.filter(([key]) => key === 'activeCreatureName');
        expect(activeWrites).toEqual([['activeCreatureName', null, 'test-campaign']]);
        expect(storage.set).not.toHaveBeenCalledWith('activeCreatureName', undefined, 'test-campaign');
        expect(storage.set).toHaveBeenCalledWith('combatSummary', { round: 1, creatures: [] }, 'test-campaign');
    });

    it('still arms the first creature on a normal (characters present) mount', async () => {
        await act(async () => {
            render(<Initiative {...mountProps([{ name: 'Alice' }, { name: 'Zed' }])} />);
        });
        await waitForMountWrites();

        const activeWrites = storage.set.mock.calls.filter(([key]) => key === 'activeCreatureName');
        expect(activeWrites).toEqual([['activeCreatureName', 'Alice', 'test-campaign']]);
    });

    it('authors no activeCreatureName write from a non-localhost zero-creature tab', async () => {
        await act(async () => { render(<Initiative {...mountProps([])} isLocalhost={false} />); });
        await waitFor(() => { expect(loadCombatSummary).toHaveBeenCalledWith('test-campaign'); });

        expect(storage.set).not.toHaveBeenCalled();
    });
});
