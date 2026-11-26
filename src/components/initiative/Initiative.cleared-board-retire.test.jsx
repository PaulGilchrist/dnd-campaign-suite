// @maintained-by-ai 2026-11-23
// Regression pin (component face) — bug-admin-clear-leaves-mounted-boards-
// stale-resurrects-data. Admin clear-change-data publishes
// change-<c>-combatSummary with a null payload so mounted tabs retire; the
// Initiative SSE dispatcher used to drop nulls, so a mounted board kept
// rendering the cleared board (stale HP/target) and one Next/Prev click
// re-POSTed the whole cleared combatSummary back to disk. This pins the full
// loop on the real component: mount on a seeded board → dispatch the null
// cleared-key echo through the Subscriber's real handleEvent → the card row
// and toolbar are gone, the "No one is on the initiative board yet" empty
// state renders, and the retirement writes nothing back (no resurrection).
// Handler-lane internals are pinned in sseHandlers.cleared-board-retire.test.js.
// Mock block mirrors Initiative.board-order.test.jsx; Subscriber is captured
// (instead of stubbed inert) to reach the component's real SSE wiring.
import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { loadCombatSummary, getActiveCreatureName, setCombatSummaryCache } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

const sse = vi.hoisted(() => ({ handleEvent: null }));

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
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
// Capture the component's REAL SSE handler (Initiative.jsx wires
// createSseEventHandler into <Subscriber handleEvent=...>) so the test can
// dispatch the exact cleared-key broadcast the admin route publishes.
vi.mock('../common/Subscriber.jsx', () => ({
    default: ({ handleEvent }) => {
        sse.handleEvent = handleEvent;
        return <div data-testid="subscriber" />;
    },
}));
vi.mock('../common/Popup.jsx', () => ({ default: () => <div data-testid="popup-overlay" /> }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: () => <div data-testid="dice-roll-result" /> }));
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature, isActive }) => (
        <div data-testid={`creature-card-${creature.name}`} data-active={isActive ? 'true' : 'false'} />
    ),
}));
vi.mock('./EffectAdder.jsx', () => ({ default: () => <div data-testid="effect-adder" /> }));

const characters = [{ name: 'EvasiveFighter' }, { name: 'ElderPaladin' }];

const SEEDED_BOARD = {
    round: 2,
    creatures: [
        { name: 'EvasiveFighter', type: 'player', initiative: '20', currentHp: 111, targetName: 'ElderPaladin', concentration: null },
        { name: 'ElderPaladin', type: 'player', initiative: '15', currentHp: 224, concentration: null, targetName: null },
    ],
};

const mountProps = () => ({
    characters,
    campaignName: 'test-campaign',
    onNpcsChange: vi.fn(),
    mapName: null,
    isLocalhost: true,
});

const drawnCards = () => document.querySelectorAll('[data-testid^="creature-card-"]').length;
const toolbarButton = (label) => Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim().startsWith(label)) || null;

describe('Initiative mount — cleared-key null echo retires the board', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
        vi.mocked(getActiveCreatureName).mockReturnValue(null);
        vi.mocked(loadCombatSummary).mockResolvedValue(SEEDED_BOARD);
        sse.handleEvent = null;
    });

    it('dispatching change-<c>-combatSummary null empties the mounted board with zero re-writes', async () => {
        await act(async () => {
            render(<Initiative {...mountProps()} />);
        });
        // Mounted board: cards + the GM turn-walk toolbar are live.
        await waitFor(() => expect(drawnCards()).toBe(2));
        expect(toolbarButton('Next')).toBeTruthy();
        const boardWritesBefore = storage.set.mock.calls.filter(([key]) => key === 'combatSummary').length;

        await act(async () => {
            await sse.handleEvent({ key: 'change-test-campaign-combatSummary', data: null });
        });

        // The board retired: no cards, no walk toolbar, honest empty state.
        expect(drawnCards()).toBe(0);
        expect(toolbarButton('Next')).toBeNull();
        expect(toolbarButton('Clear')).toBeNull();
        expect(document.querySelector('.ct-empty-state')?.textContent)
            .toContain('No one is on the initiative board yet');

        // The stale board is un-POSTable: cache evicted, nothing written back.
        expect(setCombatSummaryCache).toHaveBeenCalledWith(null, 'test-campaign');
        const boardWritesAfter = storage.set.mock.calls.filter(([key]) => key === 'combatSummary').length;
        expect(boardWritesAfter).toBe(boardWritesBefore);
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
});
