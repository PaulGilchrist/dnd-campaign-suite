// @maintained-by-ai
// LANE: Initiative.effectAdder-away-gate — owner ruling 2026-11-10
// (improve gate-away-condition-add): the GM manual door never opens for an
// AWAY row. The card itself hides the Add affordance (pinned by
// CreatureCard.away.test.jsx); this file pins the container backstops —
// openEffectAdder refuses away creatures (no synced flag, no modal), and a
// stale rehydrated flag aimed at an away row (modal opened while present,
// then Split Party parked the creature away) writes NOTHING on Apply and
// evicts the flag. Present-card control keeps its byte-exact open/apply
// semantics (automated lanes untouched). Boundary mocks mirror
// Initiative.effectAdder-second-turn.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import * as combatLoggingService from '../../services/encounters/combatLoggingService.js';
import * as runtime from '../../hooks/runtime/useRuntimeState.js';

const syncStateStore = new Map();
const KEY = 'combat-ui-effectAdderTarget';
const CAMPAIGN = 'test-campaign';
const PRESENT = 'Alice';
const AWAY = 'Bo';

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
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    isSecondTurnEntry: vi.fn(() => false),
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
// Card stand-in exposes the container's open seam (the real CreatureCard's Add
// button calls onOpenEffectAdder(creature, tab)) — it deliberately BYPASSES the
// card-level hidden-affordance gate so the container backstop is what's tested.
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature, onOpenEffectAdder }) => (
        <div data-testid={`creature-card-${creature.name}`}>
            <button data-testid={`open-adder-${creature.name}`} onClick={() => onOpenEffectAdder(creature, 'effects')}>Add</button>
        </div>
    ),
}));
// EffectAdder stand-in echoes the targetName and rides it on Apply (the real
// modal dispatches every tab through data.target = targetName).
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
    { name: PRESENT, type: 'player', initiative: '20', targetName: null, concentration: null },
    { name: AWAY, type: 'player', initiative: '', away: true, targetName: null, concentration: null },
] };

const keyWrites = () => vi.mocked(runtime.setRuntimeValue).mock.calls.filter(([, key]) => key === KEY);

describe('Initiative effectAdder away gate (owner ruling 2026-11-10)', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        syncStateStore.clear();
        localStorage.clear();
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue(cloneDeep(ROSTER));
        vi.mocked(combatData.getCombatSummary).mockReturnValue(null);
        props = {
            characters: [{ name: PRESENT, computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } }],
            campaignName: CAMPAIGN,
            onNpcsChange: vi.fn(),
            isLocalhost: true,
            mapName: 'test-map',
        };
    });

    const mount = async () => {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument(); });
    };

    it('opening from an AWAY card is refused: no synced flag write, no modal', async () => {
        await mount();
        await act(async () => { fireEvent.click(screen.getByTestId(`open-adder-${AWAY}`)); });
        expect(keyWrites()).toHaveLength(0);
        expect(vi.mocked(runtime.setRuntimeObject).mock.calls.filter(([, key]) => key === KEY)).toHaveLength(0);
        expect(screen.queryByTestId('effect-adder')).toBeNull();
    });

    it('control: a PRESENT card still opens the modal exactly once', async () => {
        await mount();
        await act(async () => { fireEvent.click(screen.getByTestId(`open-adder-${PRESENT}`)); });
        expect(keyWrites()).toHaveLength(1);
        expect(keyWrites()[0]).toEqual([
            'campaign', KEY, expect.objectContaining({ name: PRESENT }), CAMPAIGN,
        ]);
        expect(screen.getByTestId('ea-target-name')).toHaveTextContent(PRESENT);
    });

    it('stale rehydrated flag aimed at an away row: Apply writes nothing and evicts', async () => {
        // The modal was opened while Bo was present; a Split Party parked Bo
        // away before Apply. The synced flag rehydrated the open modal against
        // the now-away row — the handler guard must refuse every write lane.
        syncStateStore.set(KEY, { name: AWAY, type: 'player', initiative: '', away: true });
        await mount();
        expect(screen.getByTestId('ea-target-name')).toHaveTextContent(AWAY);

        await act(async () => { fireEvent.click(screen.getByTestId('ea-apply')); });
        // Zero effect writes, zero audit rows… (mount legitimately reads
        // many runtime values, so reads are not the oracle here).
        expect(vi.mocked(runtime.setRuntimeValue).mock.calls.filter(([, key]) => key === 'targetEffects')).toHaveLength(0);
        expect(combatLoggingService.logConditionEvent).not.toHaveBeenCalled();
        // …and the open flag EVICTS (deleteRuntimeKey — the mocked primitive
        // cannot echo null back into the fake sync store, same witness as the
        // sibling evict test).
        expect(runtime.deleteRuntimeKey).toHaveBeenCalledWith('campaign', KEY, CAMPAIGN);
    });
});
