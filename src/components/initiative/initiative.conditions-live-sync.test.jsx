// @maintained-by-ai
// LANE: initiative.conditions-live-sync — regression for the cross-tab condition-badge staleness
// (bug-initiative-condition-badges-stale-cross-tab). The displayCreatures memo merges
// activeConditions/activeConditionMeta via the imperative getRuntimeValue; a passive tab's
// change-{campaign}-{char} SSE echo bumps runtimeStateTick (sseHandlers.js catch-all), and the
// memo MUST depend on that tick or its snapshot freezes: remote adds never appear and remote
// removes keep displaying until a view remount. These tests drive the real Subscriber→handleEvent
// lane and assert both directions re-derive badges without a remount. Card internals are stubbed
// (owner: CreatureCard lanes); container census is pinned in initiative.test.jsx.
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';

const syncStateStore = new Map();
// Mutable stand-in for the client-side runtime store that App.jsx's SSE mirror
// (applyStoreUpdate → setRuntimeObject, skipSync=true) fills synchronously before
// Initiative's own SSE handler bumps the tick — same dispatch, store first.
const runtimeStore = { Alice: { activeConditions: [], activeConditionMeta: {} } };
let sseHandler = null;

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => syncStateStore),
    useRuntimeValue: vi.fn(() => null),
    // useLootHandlers subscribes to cross-tab loot-draft echoes via addStorageChangeListener.
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
    getRuntimeValue: vi.fn((key, prop) => {
        const bucket = runtimeStore[key];
        if (bucket && bucket[prop] !== undefined) return bucket[prop];
        if (prop === 'currentHitPoints') return 10;
        if (prop === 'hitPoints') return 10;
        if (prop === 'activeConditions') return [];
        if (prop === 'activeConditionMeta') return {};
        if (prop === 'activeBuffs') return [];
        return null;
    }),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));
// Capture the ONE shared SSE handler Initiative registers, so tests can fire
// remote change-{campaign}-{char} echoes exactly like the server does.
vi.mock('../common/Subscriber.jsx', () => ({
    default: ({ handleEvent }) => {
        sseHandler = handleEvent;
        return <div data-testid="subscriber" />;
    },
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({ clearDeathSavePrompt: vi.fn() }));
vi.mock('../../services/npcs/monsterUtils.js', () => ({ getMonsterImageUrl: vi.fn(() => Promise.resolve(null)), getMonsterData: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
    CONDITIONS: [
        { key: 'poisoned', label: 'Poisoned' }, { key: 'prone', label: 'Prone' },
    ],
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
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({ clearPerRoundMajestyTrackers: vi.fn() }));
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
    rollConditionSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    removeCondition: vi.fn(), addCondition: vi.fn(), buildConditionPopup: vi.fn(),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    breakConcentration: vi.fn(), addConcentration: vi.fn(), buildConcentrationPopup: vi.fn(), cleanupConcentrationEffects: vi.fn(),
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logInitiativeRoll: vi.fn(), logConditionEvent: vi.fn(), logConcentrationSave: vi.fn(),
    logConditionSave: vi.fn(), logHpChange: vi.fn(), logNpcThreshold: vi.fn(),
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
// Card stub EXPOSES the container's merged conditions — the exact prop the staleness bug froze.
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature }) => (
        <div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type}`}>
            {(creature.conditions || []).map(cond => (
                <span key={cond.id} data-testid={`condition-badge-${creature.name}`}>{cond.label} DC {cond.dc}</span>
            ))}
        </div>
    ),
}));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => (<div data-testid="effect-adder"><span>{targetName}</span></div>) }));

const campaignName = 'test-campaign';

// Mirror of the server echo: App's lane fills the store synchronously during the
// SAME SSE dispatch, then Initiative's handler bumps runtimeStateTick.
function remoteCharWrite(charName, activeConditions, activeConditionMeta = {}) {
    runtimeStore[charName] = { ...runtimeStore[charName], activeConditions, activeConditionMeta };
}

describe('Initiative — live cross-tab condition badges (displayCreatures memo)', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        syncStateStore.clear();
        for (const key of Object.keys(runtimeStore)) delete runtimeStore[key];
        runtimeStore.Alice = { activeConditions: [], activeConditionMeta: {} };
        sseHandler = null;
        Element.prototype.scrollIntoView = vi.fn();
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue({ round: 1, creatures: [
            { name: 'Alice', type: 'player', initiative: '18', targetName: null, concentration: null },
        ] });
        vi.mocked(combatData.getCombatSummary).mockReturnValue(null);
        props = {
            characters: [{ name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } }],
            campaignName,
            onNpcsChange: vi.fn(),
            isLocalhost: true,
            mapName: 'test-map',
        };
    });

    async function mountInitiative() {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument(); });
        expect(sseHandler).toBeTypeOf('function');
    }

    const fireCharEcho = (charName) => act(async () => {
        await sseHandler({ key: `change-${campaignName}-${charName}`, data: { activeConditions: runtimeStore[charName].activeConditions } });
    });

    it('remote condition ADD on another tab renders the badge on the mounted view without a remount', async () => {
        await mountInitiative();
        expect(screen.queryByTestId('condition-badge-Alice')).not.toBeInTheDocument();

        remoteCharWrite('Alice', ['poisoned'], { poisoned: { dc: 10, ability: 'con' } });
        await fireCharEcho('Alice');

        await waitFor(() => {
            expect(screen.getByTestId('condition-badge-Alice')).toHaveTextContent('Poisoned DC 10');
        });
    });

    it('remote condition REMOVE on another tab clears the badge on the mounted view without a remount', async () => {
        remoteCharWrite('Alice', ['prone'], { prone: { dc: 10, ability: 'con' } });
        await mountInitiative();
        expect(screen.getByTestId('condition-badge-Alice')).toHaveTextContent('Prone DC 10');

        remoteCharWrite('Alice', [], {});
        await fireCharEcho('Alice');

        await waitFor(() => {
            expect(screen.queryByTestId('condition-badge-Alice')).not.toBeInTheDocument();
        });
    });
});
