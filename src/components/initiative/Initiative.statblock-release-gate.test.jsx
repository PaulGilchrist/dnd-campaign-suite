// @maintained-by-ai
// Live-control gate on the LAN visitor's ALREADY-OPEN monster stat block
// (bug-released-delegation-stale-open-card-keeps-rolling): the avatar-click open
// gate (CreatureCard CardAvatar ⇒ getCreatureController !== null) is only
// evaluated at OPEN time, so before the fix a card opened mid-delegation
// survived the GM's release echo and its mc-dice-link chips kept rolling real
// damage. The container's GmStatBlockModal now re-checks the SAME controller
// predicate against the LIVE combatSummary row on every render — release
// unmounts the overlay, derived lanes (summoned te) keep it, and the GM tab is
// unchanged. Boundary mocks mirror Initiative.tv.test.jsx (REC #837 +
// zero-network guard #841 doctrine); the combat-summary-updated adoption seam
// simulates the release SSE echo (owned inline in Initiative.jsx).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import * as monsterUtils from '../../services/npcs/monsterUtils.js';

const syncStateStore = new Map();
let targetEffectsValue = null;

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
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
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
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
// Avatar-click seam: delegate-controlled cards dispatch the real handleNpcClick
// with { allowNonLocalhost: true } — the exact options CreatureCard CardAvatar
// passes when getCreatureController resolves a controller (open-time gate is
// CreatureCard's lane; this file pins the RENDER-time gate).
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature, onNpcClick }) => (
        <div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type}`}>
            <span>{creature.name}</span>
            <button data-testid={`npc-click-${creature.name}`} onClick={() => onNpcClick(creature, { allowNonLocalhost: true })}>avatar</button>
        </div>
    ),
}));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => <div data-testid="effect-adder"><span>{targetName}</span></div> }));

const GOBLIN_CARD = { name: 'Goblin', type: 'monster', actions: [] };
// Delegated board: Goblin carries the GM-assigned controller on Alice.
const delegatedBoard = () => ({ round: 3, creatures: [
    { name: 'Alice', type: 'player', initiative: '18', targetName: null, concentration: null },
    { name: 'Bob', type: 'player', initiative: '12', targetName: null, concentration: null },
    { name: 'Goblin', type: 'npc', initiative: '8', targetName: 'Alice', concentration: null, maxHp: 7, currentHp: 7, controller: 'Alice' },
] });
// Release echo: the GM's control-select deletes creature.controller (verbatim
// handleControllerChange bytes) — everything else identical.
const releasedBoard = () => {
    const board = cloneDeep(delegatedBoard());
    delete board.creatures[2].controller;
    return board;
};

describe('Initiative stat-block live-control gate (released-delegation stale-open card)', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        syncStateStore.clear();
        targetEffectsValue = null;
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
            isLocalhost: false,
            mapName: 'test-map',
        };
    });

    const openGoblinCard = async () => {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });
        await act(async () => { fireEvent.click(screen.getByTestId('npc-click-Goblin')); });
        await waitFor(() => { expect(screen.getByTestId('monster-card-modal')).toBeInTheDocument(); });
    };

    const adoptBoard = async (board) => {
        vi.mocked(combatData.getCombatSummary).mockReturnValue(board);
        await act(async () => { window.dispatchEvent(new Event('combat-summary-updated')); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 3)')).toBeInTheDocument(); });
    };

    it('visitor keeps the open card while the live row still carries the controller (delegated open + roll lane intact)', async () => {
        await openGoblinCard();
        // An unrelated live echo (HP tick) must NOT disturb the open card.
        const board = delegatedBoard();
        board.creatures[2].currentHp = 5;
        await adoptBoard(board);
        expect(screen.getByTestId('monster-card-modal')).toBeInTheDocument();
    });

    it('REGRESSION: release mid-open unmounts the visitor’s stale overlay — the echo re-gates, not just the avatar click', async () => {
        await openGoblinCard();

        await adoptBoard(releasedBoard());

        // The card must be gone (zero roll chips reachable), while the rest of
        // the view survives: the tracker itself stays mounted.
        await waitFor(() => { expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument(); });
        expect(screen.getByTestId('creature-card-Goblin')).toBeInTheDocument();
    });

    it('derived summoned lane keeps the card open across a controller release (auto-controlled fallback)', async () => {
        targetEffectsValue = [{ effect: 'summoned', source: 'Alice', target: 'Goblin' }];
        await openGoblinCard();

        await adoptBoard(releasedBoard());

        expect(screen.getByTestId('monster-card-modal')).toBeInTheDocument();
    });

    it('GM (localhost) tab is untouched by the gate — its open card survives the release echo', async () => {
        props.isLocalhost = true;
        await openGoblinCard();

        await adoptBoard(releasedBoard());

        expect(screen.getByTestId('monster-card-modal')).toBeInTheDocument();
    });

    it('removing the creature row entirely also unmounts a visitor’s open card', async () => {
        await openGoblinCard();

        const board = delegatedBoard();
        board.creatures = board.creatures.filter(c => c.name !== 'Goblin');
        await adoptBoard(board);

        await waitFor(() => { expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument(); });
    });
});
