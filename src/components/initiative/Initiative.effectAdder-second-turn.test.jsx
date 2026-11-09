// @maintained-by-ai
// LANE: Initiative.effectAdder-second-turn — locks the phantom-bucket fix
// (bug-effectadder-secondturn-phantom-bucket). A Thief's-Reflexes `(Second Turn)`
// row is synthetic transport: it is retired at the round wrap and no component ever
// reads a change-data bucket keyed by its suffixed name. Opening the GM effect
// adder from that row must REMAP the target to the holder (CLA-360 law — the same
// holderName resolution buildDisplayCreature uses), so conditions/targetEffects/
// concentration writes AND the audit rows land on the holder's real, visible,
// removable state instead of orphaning under the doomed key.
// Boundary mocks mirror Initiative.effectAdder-evict.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import * as runtime from '../../hooks/runtime/useRuntimeState.js';

const syncStateStore = new Map();
const KEY = 'combat-ui-effectAdderTarget';
const CAMPAIGN = 'test-campaign';
const HOLDER = 'Alice';
const ST_ROW = 'Alice (Second Turn)';

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
vi.mock('../../services/npcs/npcStatBlockUtils.js', () => ({ npcToMonsterFormat: vi.fn(() => null), npcHasStatBlock: vi.fn(() => true) }));
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
// Real structural semantics (mirrors thiefsReflexesService.isSecondTurnEntry) —
// the sibling evict test stubs this FALSE; here it must flag the synthetic row.
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    isSecondTurnEntry: vi.fn((creature) => !!creature?.secondTurn),
}));
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
// EffectAdder stand-in echoes the targetName it was handed and rides it on Apply
// (the real modal dispatches every tab through data.target = targetName).
vi.mock('./EffectAdder.jsx', () => ({
    default: ({ targetName, onCancel, onApply }) => (
        <div data-testid="effect-adder">
            <span data-testid="ea-target-name">{targetName}</span>
            <button data-testid="ea-cancel" onClick={onCancel}>Cancel</button>
            <button data-testid="ea-apply" onClick={() => onApply('effects', { target: targetName, effectKey: 'marked' })}>Apply</button>
        </div>
    ),
}));

const ROSTER = { round: 1, creatures: [
    { name: HOLDER, type: 'player', initiative: '20', targetName: null, concentration: null },
    { name: ST_ROW, type: 'player', initiative: '10', targetName: null, concentration: null, secondTurn: true, holderName: HOLDER },
] };

const keyWrites = () => vi.mocked(runtime.setRuntimeValue).mock.calls.filter(([, key]) => key === KEY);

describe('Initiative effectAdder target remap for (Second Turn) rows (phantom-bucket fix)', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        syncStateStore.clear();
        localStorage.clear();
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue(cloneDeep(ROSTER));
        vi.mocked(combatData.getCombatSummary).mockReturnValue(null);
        props = {
            characters: [{ name: HOLDER, computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } }],
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

    it('opening from the (Second Turn) card routes the target to the HOLDER — the synced flag and the modal never carry the synthetic name', async () => {
        await mount();
        await act(async () => { fireEvent.click(screen.getByTestId(`open-adder-${ST_ROW}`)); });
        // The write seam EffectAdder/addCondition/audit rows all key off this name:
        // it must be the holder, never the doomed suffixed row.
        expect(keyWrites()).toHaveLength(1);
        expect(keyWrites()[0]).toEqual(['campaign', KEY, expect.objectContaining({ name: HOLDER }), CAMPAIGN]);
        expect(screen.getByTestId('ea-target-name')).toHaveTextContent(HOLDER);
        expect(screen.getByTestId('ea-target-name')).not.toHaveTextContent(ST_ROW);
    });

    it('Apply from the (Second Turn)-opened modal writes state under the holder, leaving no row keyed by the synthetic name', async () => {
        await mount();
        await act(async () => { fireEvent.click(screen.getByTestId(`open-adder-${ST_ROW}`)); });
        vi.mocked(runtime.setRuntimeValue).mockClear();
        await act(async () => {
            fireEvent.click(screen.getByTestId('ea-apply'));
        });
        const teWrites = vi.mocked(runtime.setRuntimeValue).mock.calls.filter(([, key]) => key === 'targetEffects');
        expect(teWrites).toHaveLength(1);
        expect(teWrites[0][2]).toEqual([{ target: HOLDER, effect: 'marked' }]);
        // Audit truth: the applied row names the real creature, not the phantom key.
        expect(vi.mocked(runtime.setRuntimeValue).mock.calls.some(([, key]) => key === ST_ROW)).toBe(false);
        // Close leg still EVICTS the open flag (deleteRuntimeKey — the mocked
        // primitive cannot echo null back into the fake sync store, so the
        // eviction call, like the sibling evict test, is the unmount witness).
        expect(runtime.deleteRuntimeKey).toHaveBeenCalledWith('campaign', KEY, CAMPAIGN);
    });

    it('control: opening from the holder card keeps its own name (no remap for real creatures)', async () => {
        await mount();
        await act(async () => { fireEvent.click(screen.getByTestId(`open-adder-${HOLDER}`)); });
        expect(keyWrites()).toHaveLength(1);
        expect(keyWrites()[0]).toEqual(['campaign', KEY, expect.objectContaining({ name: HOLDER }), CAMPAIGN]);
        expect(screen.getByTestId('ea-target-name')).toHaveTextContent(HOLDER);
    });
});
