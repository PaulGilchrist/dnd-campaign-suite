// @maintained-by-ai
// XD-1116 improvement (2026-11-16): the .mc-overlay stat modal mirrors the card's
// target-arm select into its header so the full GM attack flow completes inside
// the modal. Host wiring pin: Initiative hands GmStatBlockModal (and through it
// MonsterCardModal) the SAME handleTargetChange instance the card's select uses,
// the modal-armed change rides the card's scoped combatSummary PATCH lane
// byte-identically, the delegation picker handler (onControllerChange) stays
// card-only, and isLocalhost/isPlayerSummoned propagate for the shared
// TargetSelect visitor gate. Component-level face (aria-label, option parity,
// picker absence) is pinned by MonsterCardModal.target-arm.test.jsx.
// Boundary mocks copied from Initiative.statblock-release-gate.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import * as monsterUtils from '../../services/npcs/monsterUtils.js';
import storage from '../../services/ui/storage.js';


const syncStateStore = new Map();
let targetEffectsValue = null;
// Captured render props of the two stubbed surfaces (the last render wins —
// both stubs re-capture on every Initiative render, so their handlers are the
// SAME instances Initiative handed down that pass).
let modalProps = null;
let cardProps = {};

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    deleteRuntimeKey: vi.fn(),
    getStore: vi.fn(() => syncStateStore),
    // Reactive targetEffects mirror (the gate's summoned lane) is test-controlled;
    // everything else (enforcement, lastCombatResult, …) reads null.
    useRuntimeValue: vi.fn((_key, prop) => (prop === 'targetEffects' ? targetEffectsValue : null)),
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
    getRuntimeValue: vi.fn((_key, _prop, _campaign) => {
        if (_prop === 'currentHitPoints') return 10;
        if (_prop === 'hitPoints') return 10;
        if (_prop === 'activeConditions') return [];
        if (_prop === 'activeBuffs') return [];
        return null;
    }),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), patch: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({ clearDeathSavePrompt: vi.fn() }));
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
    rollNpcInitiative: vi.fn(),
    renameNpc: vi.fn(() => Promise.resolve()),
    setTarget: vi.fn(),
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
vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(() => false),
    getResilientSphereSource: vi.fn(() => null),
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({ isBuffActive: vi.fn(() => false) }));
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
    clearUnbreakableMajesty: vi.fn(),
    clearPerRoundMajestyTrackers: vi.fn(),
}));
vi.mock('../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js', () => ({ cleanupWildShape: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({ revertPolymorph: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({ revertAnimalShapes: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({ revertShapechange: vi.fn() }));
vi.mock('../../services/combat/conditions/effectDescriptions.js', () => ({
    CONDITION_DESCRIPTIONS: {}, HP_STATUS_DESCRIPTIONS: { DEAD: 'dead', BLOODIED: 'bloodied', OK: 'ok' },
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(),
    sendFleshToStoneResult: vi.fn(), sendPrismaticSprayIndigoResult: vi.fn(), sendPrismaticSprayVioletResult: vi.fn(),
}));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({ isSecondTurnEntry: vi.fn(() => false) }));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({
    default: (props) => {
        modalProps = props;
        return (
            <div data-testid="monster-card-modal">
                <button data-testid="modal-arm-change" onClick={() => props.onTargetChange(props.creatureName, 'Alice')}>arm</button>
            </div>
        );
    },
}));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
// Avatar-click seam: delegate-controlled cards dispatch the real handleNpcClick
// with { allowNonLocalhost: true } — the exact options CreatureCard CardAvatar
// passes when getCreatureController resolves a controller (open-time gate is
// CreatureCard's lane; this file pins the RENDER-time gate).
vi.mock('./CreatureCard.jsx', () => ({
    default: (props) => {
        cardProps[props.creature.name] = props;
        return (
            <div data-testid={`creature-card-${props.creature.name}`} className={`creature-card ${props.creature.type}`}>
                <span>{props.creature.name}</span>
                <button data-testid={`npc-click-${props.creature.name}`} onClick={() => props.onNpcClick(props.creature, { allowNonLocalhost: true })}>avatar</button>
            </div>
        );
    },
}));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => <div data-testid="effect-adder"><span>{targetName}</span></div> }));

const GOBLIN_CARD = { name: 'Goblin', type: 'monster', actions: [] };
// Delegated board: Goblin carries the GM-assigned controller on Alice.
const delegatedBoard = () => ({ round: 3, creatures: [
    { name: 'Alice', type: 'player', initiative: '18', targetName: null, concentration: null },
    { name: 'Bob', type: 'player', initiative: '12', targetName: null, concentration: null },
    { name: 'Goblin', type: 'npc', initiative: '8', targetName: 'Alice', concentration: null, maxHp: 7, currentHp: 7, controller: 'Alice' },
] });

describe('Initiative modal target-arm wiring (XD-1116 improve)', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        syncStateStore.clear();
        targetEffectsValue = null;
        modalProps = null;
        cardProps = {};
        localStorage.clear();
        Element.prototype.scrollIntoView = vi.fn();
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue(delegatedBoard());
        vi.mocked(combatData.getCombatSummary).mockReturnValue(null);
        vi.mocked(monsterUtils.getMonsterData).mockResolvedValue(cloneDeep(GOBLIN_CARD));
        props = {
            characters: [
                { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } },
                { name: 'Bob', computedStats: { hitPoints: 15, currentHitPoints: 15, armorClass: 14 } },
            ],
            campaignName: 'test-campaign',
            onNpcsChange: vi.fn(),
            isLocalhost: true,
            mapName: 'test-map',
        };
    });

    const openGoblinCard = async () => {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });
        await act(async () => { fireEvent.click(screen.getByTestId('npc-click-Goblin')); });
        await waitFor(() => { expect(screen.getByTestId('monster-card-modal')).toBeInTheDocument(); });
    };

    it('hands the modal the EXACT handler instance the card select uses — a modal-side arm rides the scoped combatSummary PATCH lane bytes', async () => {
        await openGoblinCard();

        expect(typeof modalProps.onTargetChange).toBe('function');
        // Reference-equal to the card's own prop: one lane, one handler (the
        // card and the modal-arm cannot drift by construction).
        expect(modalProps.onTargetChange).toBe(cardProps.Goblin.onTargetChange);
        // The delegation picker stays card-only — its handler never rides the
        // modal props (ControlRow lives inside CreatureCard alone).
        expect(modalProps.onControllerChange).toBeUndefined();
        expect(typeof cardProps.Goblin.onControllerChange).toBe('function');

        // Arm through the stub modal's header control (exactly what the real
        // shared TargetSelect calls): the write is createCreatureHandlers'
        // applyTargetSelection scoped PATCH, including the delegated row's
        // seenController race-guard (bug-race-arm-patch-beats-swap-clear-post).
        fireEvent.click(screen.getByTestId('modal-arm-change'));
        expect(storage.patch).toHaveBeenCalledWith('combatSummary', {
            creatures: [{ name: 'Goblin', targetName: 'Alice', seenController: 'Alice' }],
        }, 'test-campaign');
    });

    it('GM host propagates isLocalhost + derived isPlayerSummoned for the shared TargetSelect gate', async () => {
        await openGoblinCard();

        expect(modalProps.isLocalhost).toBe(true);
        // Delegated row (controller Alice) — getCreatureController resolves, so
        // the visitor-parity flag is derived with the SAME predicate as the card.
        expect(modalProps.isPlayerSummoned).toBe(true);
        expect(modalProps.creatureName).toBe('Goblin');
    });

    it('visitor controller lane keeps the mirrored arm (delegated open card → isPlayerSummoned true)', async () => {
        props.isLocalhost = false;
        await openGoblinCard();

        expect(modalProps.isLocalhost).toBe(false);
        expect(modalProps.isPlayerSummoned).toBe(true);
    });

    it('REGRESSION: the released visitor still loses the overlay (hoisted controller computation gates identically)', async () => {
        props.isLocalhost = false;
        await openGoblinCard();

        const board = cloneDeep(delegatedBoard());
        delete board.creatures[2].controller;
        board.creatures[2].targetName = undefined;
        vi.mocked(combatData.getCombatSummary).mockReturnValue(board);
        await act(async () => { window.dispatchEvent(new Event('combat-summary-updated')); });

        await waitFor(() => { expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument(); });
    });
});
