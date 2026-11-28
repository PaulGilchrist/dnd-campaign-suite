// @maintained-by-ai 2026-11-27
// LANE: initiative.overlays — Initiative's spell-overlay SURFACE composition:
// mount fetch (Initiative.jsx:573-585) → overlay state → exact `overlays` prop
// handed to every CreatureCard (Initiative.jsx:1203), including the merge that
// dedupes ids already added via SSE before the mount fetch resolves.
// Owned elsewhere: createOverlayHandler add/update/remove/clear semantics
// (sseHandlers-overlay.test.jsx); per-card overlay filtering/badge rendering
// (CreatureCard.overlay-options.test.jsx); fetch transport + overlayTargetId
// (services/maps/spellOverlayService.test.js).
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchSpellOverlays = vi.fn();

vi.mock('../../services/maps/spellOverlayService.js', () => ({
    fetchSpellOverlays: (...args) => mockFetchSpellOverlays(...args),
    overlayTargetId: vi.fn(() => null),
}));

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));

// Captured so the race test can drive the real createSseEventHandler exactly
// the way the shared sseClient subscription would.
const sseHarness = { handleEvent: null };

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    deleteRuntimeKey: vi.fn(),
    getStore: vi.fn(() => new Map()),
    // L5-001: TurnEconomyStrip subscribes via useRuntimeValue; null ⇒ enforcement off.
    useRuntimeValue: vi.fn(() => null),
    // useLootHandlers subscribes to cross-tab loot-draft echoes via addStorageChangeListener.
    addStorageChangeListener: vi.fn(() => () => {}),
    listeners: new Map(),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));
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
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(() => Promise.resolve(null)),
    getCombatSummary: vi.fn(() => null),
    getActiveCreatureName: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({ clearPerRoundMajestyTrackers: vi.fn() }));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    setupCreatures: vi.fn((characters) => characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }))),
    addNpc: vi.fn((cs) => { cs.creatures.push({ name: 'NPC 1', type: 'npc', initiative: '', targetName: null }); return 1; }),
    removeNpc: vi.fn(),
    getNextCreatureName: vi.fn(() => ({ newActiveName: 'Alice', roundIncrement: false })),
    getPreviousCreatureName: vi.fn(() => ({ newActiveName: 'Alice', roundDecrement: false })),
    isPreviousDisabled: vi.fn(() => false),
    setInitiative: vi.fn(),
    rollNpcInitiative: vi.fn(() => ({ roll: 15, bonus: 2, total: 17 })),
    renameNpc: vi.fn(() => Promise.resolve()),
    setTarget: vi.fn(),
    clearCombat: vi.fn((characters) => ({ round: 1, creatures: characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null })) })),
    mergeCombatSummaryWithCharacters: vi.fn((initialSummary, characters) => {
        const names = new Set((initialSummary?.creatures ?? []).map(c => c.name));
        const newCreatures = characters.filter(ch => !names.has(ch.name)).map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }));
        return { round: initialSummary?.round ?? 1, creatures: [...(initialSummary?.creatures ?? []), ...newCreatures] };
    }),
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    removeCondition: vi.fn(), addCondition: vi.fn(),
    buildConditionPopup: vi.fn(() => ({ name: 'Test Creature', condition: 'Blinded', type: 'save', rolls: [15], bonus: 2, targetName: 'Test Creature', targetAc: 10, hit: false, success: true, dc: 10 })),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    breakConcentration: vi.fn(() => 'Shield'), addConcentration: vi.fn(),
    buildConcentrationPopup: vi.fn(() => ({ name: 'Test Creature', condition: null, spell: 'Shield', type: 'save', rolls: [15], bonus: 2, targetName: 'Test Creature', targetAc: 10, hit: false, success: true, dc: 10 })),
    cleanupConcentrationEffects: vi.fn(),
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logInitiativeRoll: vi.fn(), logConditionEvent: vi.fn(), logConcentrationSave: vi.fn(),
    logConditionSave: vi.fn(), logHpChange: vi.fn(), logNpcThreshold: vi.fn(),
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({
    default: ({ handleEvent }) => {
        sseHarness.handleEvent = handleEvent;
        return <div data-testid="subscriber" />;
    },
}));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children }) => <div data-testid="popup-overlay">{children}</div> }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
vi.mock('./CreatureCard.jsx', () => ({
    // Serializes the WHOLE overlays prop (null distinguishes a missing prop
    // from an empty list) so assertions pin the exact rows Initiative hands down.
    default: ({ creature, overlays }) => (
        <div data-testid={`creature-card-${creature.name}`}>
            <span data-testid={`overlays-${creature.name}`}>{JSON.stringify(overlays ?? null)}</span>
        </div>
    ),
}));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => <div data-testid="effect-adder">{targetName}</div> }));

import Initiative from './Initiative.jsx';

const overlaysFor = (creatureName) => JSON.parse(screen.getByTestId(`overlays-${creatureName}`).textContent);

describe('Initiative overlay loading', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        sseHarness.handleEvent = null;
        Element.prototype.scrollIntoView = vi.fn();
        mockFetchSpellOverlays.mockResolvedValue([]);
        props = {
            characters: [{ name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } }],
            campaignName: 'test-campaign',
            onNpcsChange: vi.fn(),
            isLocalhost: true,
            mapName: 'test-map',
        };
    });

    it('fetches spell overlays once on mount and hands every card the exact server rows', async () => {
        const serverRows = [
            { id: 'o1', shape: 'sphere', radiusFt: 20 },
            { id: 'o2', shape: 'cylinder', radiusFt: 10 },
        ];
        mockFetchSpellOverlays.mockResolvedValue(serverRows);

        render(<Initiative {...props} />);

        // Deterministic flush instead of polling waitFor: the mount effect
        // invokes the fetch synchronously and its pre-resolved fake settles
        // in microtasks, so act() drains the whole chain (fetch .then →
        // setOverlays, loadCombatSummary → setCombatSummary → card render)
        // without jsdom timer ticks — which starve past waitFor's 1000ms
        // window under full-suite parallel load (batch-run flake, 2026-10).
        await act(async () => {});

        expect(mockFetchSpellOverlays).toHaveBeenCalledTimes(1);
        expect(mockFetchSpellOverlays).toHaveBeenCalledWith('test-campaign');
        // Full-shape: order, ids, and geometry propagate untouched (the card
        // itself decides targeting — Initiative only threads the raw rows).
        expect(overlaysFor('Alice')).toEqual(serverRows);
    });

    it('keeps every card on an empty overlay list when the server has none', async () => {
        render(<Initiative {...props} />);

        // See note above — fetch fires synchronously in the mount effect and
        // the beforeEach fake (mockResolvedValue([])) resolves in microtasks.
        // Flushing deterministically still fails loudly if any row leaks into
        // the prop (parse ≠ []) or the card never renders (getBy throws).
        await act(async () => {});

        expect(mockFetchSpellOverlays).toHaveBeenCalledWith('test-campaign');
        expect(overlaysFor('Alice')).toEqual([]);
    });

    it('merges the mount fetch with SSE-added overlays without duplicating ids', async () => {
        // Real-world race: another tab casts while this board mounts, so the
        // SSE add lands before the mount fetch resolves. The mount merge must
        // dedupe by id (Initiative.jsx:579-581) and append only new rows.
        let resolveFetch;
        mockFetchSpellOverlays.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));

        render(<Initiative {...props} />);

        const sseRow = { id: 'o1', shape: 'cube', radiusFt: 5 };
        await act(async () => {
            sseHarness.handleEvent({
                key: 'spell-overlay-test-campaign',
                data: { action: 'add', overlays: [sseRow] },
            });
        });
        expect(overlaysFor('Alice')).toEqual([sseRow]);

        // Late fetch echoes the same row back plus one genuinely new row.
        await act(async () => {
            resolveFetch([sseRow, { id: 'o2', shape: 'sphere', radiusFt: 20 }]);
        });

        expect(overlaysFor('Alice')).toEqual([sseRow, { id: 'o2', shape: 'sphere', radiusFt: 20 }]);
        expect(mockFetchSpellOverlays).toHaveBeenCalledTimes(1);
    });
});
