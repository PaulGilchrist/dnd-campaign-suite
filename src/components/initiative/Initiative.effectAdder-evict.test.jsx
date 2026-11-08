// @maintained-by-ai
// LANE: Initiative.effectAdder-evict — locks the delete-on-close fix for the
// combat-ui-effectAdderTarget orphan (backlog EP 2026-11-08). The GM effect-adder's
// open-modal flag rides the shared campaign store (AGENTS-sanctioned combat-UI
// state), but every close path must EVICT the key (deleteRuntimeKey → server
// DELETE + null echo, the savePrompt drain-to-evict pattern), never POST null —
// a POSTed null persisted a ghost key in change-data (live-probed pre-fix:
// Cancel left `key: null`; a view-switch while open left `{name…}`) that
// rehydrated on every client + campaign re-select until the next full clear.
// Boundary mocks mirror Initiative.tv.test.jsx (REC #837 + zero-network guard).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import * as runtime from '../../hooks/runtime/useRuntimeState.js';

const syncStateStore = new Map();
const KEY = 'combat-ui-effectAdderTarget';
const CAMPAIGN = 'test-campaign';

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
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
            entry.setter = vi.fn((newValue) => { entry.value = newValue; });
        }
        return [entry.value, entry.setter];
    }),
    listeners: new Map(),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({ getMonsterImageUrl: vi.fn(() => Promise.resolve(null)), getMonsterData: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
    CONDITIONS: [{ key: 'blinded', label: 'Blinded' }],
}));
vi.mock('../../services/npcs/npcsService.js', () => ({ loadNPCs: vi.fn(() => Promise.resolve({ npcs: [] })) }));
vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({ npcToMonsterFormat: vi.fn(() => null), npcHasStatBlock: vi.fn(() => true) }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ expireStaleEffects: vi.fn(), applyTurnStartEffects: vi.fn(), applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()), clearExpirationEffects: vi.fn() }));
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({ sweepNewCombatClocks: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/maps/spellOverlayService.js', () => ({
    fetchSpellOverlays: vi.fn(() => Promise.resolve([])),
    overlayTargetId: vi.fn(() => null),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(() => null),
    getActiveCreatureName: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    setupCreatures: vi.fn((characters) => characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }))),
    isBareNpcPlaceholder: (c) => c.type === 'npc' && !c.monsterIndex && /^NPC \d+$/.test(c.name || ''),
    addNpc: vi.fn(), removeNpc: vi.fn(),
    getNextCreatureName: vi.fn(), getPreviousCreatureName: vi.fn(),
    isPreviousDisabled: vi.fn(() => false),
    setInitiative: vi.fn(), rollNpcInitiative: vi.fn(), renameNpc: vi.fn(() => Promise.resolve()), setTarget: vi.fn(),
    clearCombat: vi.fn(),
    mergeCombatSummaryWithCharacters: vi.fn((initialSummary, characters) => {
        const names = new Set((initialSummary?.creatures ?? []).map(c => c.name));
        const newCreatures = characters.filter(ch => !names.has(ch.name)).map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }));
        return { round: initialSummary?.round ?? 1, creatures: [...(initialSummary?.creatures ?? []), ...newCreatures] };
    }),
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(), removeCondition: vi.fn(), addCondition: vi.fn(), buildConditionPopup: vi.fn(),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(), breakConcentration: vi.fn(), addConcentration: vi.fn(), buildConcentrationPopup: vi.fn(), cleanupConcentrationEffects: vi.fn(),
}));
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    getEffectDefinition: vi.fn(() => null),
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logInitiativeRoll: vi.fn(), logConditionEvent: vi.fn(), logConcentrationSave: vi.fn(),
    logConditionSave: vi.fn(), logHpChange: vi.fn(), logNpcThreshold: vi.fn(),
}));
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
    clearUnbreakableMajesty: vi.fn(),
    clearPerRoundMajestyTrackers: vi.fn(),
}));
vi.mock('../../services/combat/conditions/effectDescriptions.js', () => ({
    CONDITION_DESCRIPTIONS: {}, HP_STATUS_DESCRIPTIONS: { DEAD: 'dead', BLOODIED: 'bloodied', OK: 'ok' },
}));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({ isSecondTurnEntry: vi.fn(() => false) }));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
// Card stand-in exposes the container's open seam (the real CreatureCard's Add
// button calls onOpenEffectAdder(creature, tab)).
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature, onOpenEffectAdder }) => (
        <div data-testid={`creature-card-${creature.name}`}>
            <button data-testid={`open-adder-${creature.name}`} onClick={() => onOpenEffectAdder(creature, 'effects')}>Add</button>
        </div>
    ),
}));
// EffectAdder stand-in exposes BOTH close legs the container owns: Cancel
// (onCancel — the same callback Escape wires) and a successful Apply
// (onApply → the container's handleApplyEffect closing via setEffectAdderTarget(null)).
// NOTE: the REAL useSyncedState.js hook runs on top of the mocked
// useRuntimeState primitives below (Initiative imports it from useSyncedState.js),
// so writes are observed as setRuntimeValue calls against the fake store Map.
vi.mock('./EffectAdder.jsx', () => ({
    default: ({ targetName, onCancel, onApply }) => (
        <div data-testid="effect-adder">
            <span>{targetName}</span>
            <button data-testid="ea-cancel" onClick={onCancel}>Cancel</button>
            <button data-testid="ea-apply" onClick={() => onApply('effects', { target: targetName, effectKey: 'marked' })}>Apply</button>
        </div>
    ),
}));

const ROSTER = { round: 1, creatures: [
    { name: 'Alice', type: 'player', initiative: '18', targetName: null, concentration: null },
] };

const keyWrites = () => vi.mocked(runtime.setRuntimeValue).mock.calls.filter(([, key]) => key === KEY);

describe('Initiative effectAdderTarget delete-on-close (EP 2026-11-08 orphan fix)', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        syncStateStore.clear();
        localStorage.clear();
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue(cloneDeep(ROSTER));
        vi.mocked(combatData.getCombatSummary).mockReturnValue(null);
        props = {
            characters: [{ name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } }],
            campaignName: CAMPAIGN,
            onNpcsChange: vi.fn(),
            isLocalhost: true,
            mapName: 'test-map',
        };
    });

    const mount = async () => {
        let view;
        await act(async () => { view = render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument(); });
        return view;
    };

    const openAdder = async () => {
        await act(async () => { fireEvent.click(screen.getByTestId('open-adder-Alice')); });
        expect(screen.getByTestId('effect-adder')).toBeInTheDocument();
    };

    const evictCalls = () => vi.mocked(runtime.deleteRuntimeKey).mock.calls.filter(([, key]) => key === KEY);

    it('open writes the synced key with the creature and evicts nothing', async () => {
        await mount();
        await openAdder();
        expect(keyWrites()).toHaveLength(1);
        expect(keyWrites()[0]).toEqual(['campaign', KEY, expect.objectContaining({ name: 'Alice' }), CAMPAIGN]);
        expect(evictCalls()).toHaveLength(0);
    });

    it('Cancel EVICTS the key (deleteRuntimeKey) instead of POSTing a null ghost', async () => {
        await mount();
        await openAdder();
        vi.mocked(runtime.deleteRuntimeKey).mockClear();
        vi.mocked(runtime.setRuntimeValue).mockClear();
        await act(async () => { fireEvent.click(screen.getByTestId('ea-cancel')); });
        expect(runtime.deleteRuntimeKey).toHaveBeenCalledWith('campaign', KEY, CAMPAIGN);
        // The old close leg POSTed null — change-data then kept `key: null` forever.
        expect(keyWrites()).toHaveLength(0);
    });

    it('Apply-close leg also EVICTS (handleApplyEffect setEffectAdderTarget(null) → DELETE)', async () => {
        await mount();
        await openAdder();
        vi.mocked(runtime.deleteRuntimeKey).mockClear();
        await act(async () => { fireEvent.click(screen.getByTestId('ea-apply')); });
        expect(runtime.deleteRuntimeKey).toHaveBeenCalledWith('campaign', KEY, CAMPAIGN);
    });

    it('view-switch (unmount) while the adder is open EVICTS the open-modal flag', async () => {
        const view = await mount();
        await openAdder();
        vi.mocked(runtime.deleteRuntimeKey).mockClear();
        act(() => { view.unmount(); });
        expect(runtime.deleteRuntimeKey).toHaveBeenCalledWith('campaign', KEY, CAMPAIGN);
    });
});
