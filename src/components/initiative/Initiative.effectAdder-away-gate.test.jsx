// @maintained-by-ai
// LANE: Initiative.effectAdder-away-gate — owner ruling 2026-11-10
// (improve gate-away-condition-add): the GM manual door never opens for an
// AWAY row. The card itself hides the Add affordance (pinned by
// CreatureCard.away.test.jsx); this file pins the container backstops —
// openEffectAdder refuses away creatures (no open-flag state, no modal) and a
// PRESENT card opens exactly once with zero store traffic (the open flag is
// per-client local state since the 2026-11-19 demotion). The Apply-time away
// refusal for the stale-modal race (opened present, then Split Party parked
// the creature away) is exercised directly on the handler by
// createEffectAdderHandlers.test.jsx 'away target refusal'. Boundary mocks
// mirror Initiative.effectAdder-second-turn.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import * as runtime from '../../hooks/runtime/useRuntimeState.js';

const syncStateStore = new Map();
const CAMPAIGN = 'test-campaign';
const PRESENT = 'Alice';
const AWAY = 'Bo';

// Oracle: any runtime-store call aiming an effectAdder-shaped key (the retired
// synced open-flag lane). Any hit re-lives the orphan bug.
const isAdderKey = (key) => typeof key === 'string' && key.toLowerCase().includes('effectadder');
const adderStoreWrites = () => [
    ...vi.mocked(runtime.setRuntimeValue).mock.calls,
    ...vi.mocked(runtime.setRuntimeObject).mock.calls,
].filter(([, key]) => isAdderKey(key));

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

const keyWrites = () => adderStoreWrites();

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

    it('opening from an AWAY card is refused: no open-flag state, no modal, zero store traffic', async () => {
        await mount();
        await act(async () => { fireEvent.click(screen.getByTestId(`open-adder-${AWAY}`)); });
        expect(keyWrites()).toHaveLength(0);
        expect(screen.queryByTestId('effect-adder')).toBeNull();
    });

    it('control: a PRESENT card still opens the modal exactly once, with zero store traffic', async () => {
        await mount();
        await act(async () => { fireEvent.click(screen.getByTestId(`open-adder-${PRESENT}`)); });
        // 2026-11-19 demotion: the open flag is per-client local state — the
        // modal renders from React state alone, never a synced key write.
        expect(keyWrites()).toHaveLength(0);
        expect(screen.getByTestId('ea-target-name')).toHaveTextContent(PRESENT);
    });

    // The third leg of the original gate — the stale-modal Apply race (opened
    // present, Split Party parks the creature away before Apply, handler
    // refuses every write lane and closes) — no longer has a rehydrated synced
    // flag to ride: the flag is local, so the race can only come from THIS
    // client's own open modal. The handler-side presence guard is exercised
    // directly, for all three tabs, by createEffectAdderHandlers.test.jsx
    // ('away target refusal (presence gate)').
});
