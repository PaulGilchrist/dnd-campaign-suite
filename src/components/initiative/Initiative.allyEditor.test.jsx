// @maintained-by-ai
// Phase 3.2 lane (Initiative CONTAINER ally editor): proves the GM-only
// "Allies" trigger reaches every card through the container (LAN devices get
// none), clicking it opens the shared AllySelectionModal (one allegiance model,
// D4), confirm/cancel close it, and confirm writes through the hook. Hook
// internals: useAllyEditor.test.js; modal UI: AllySelectionModal.test.jsx.
// Boundary mocks mirror initiative.test.jsx (REC #837 + zero-network guard #841).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import { setAllyList } from '../../hooks/useAllySelection.js';
import { addEntry } from '../../services/ui/logService.js';

const syncStateStore = new Map();
let lastCombatResult = null;

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    deleteRuntimeKey: vi.fn(),
    getStore: vi.fn(() => syncStateStore),
    useRuntimeValue: vi.fn((_key, prop) => (prop === 'lastCombatResult' ? lastCombatResult : null)),
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
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
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
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn((name) => [name]),
    setAllyList: vi.fn(),
}));
vi.mock('./AllyEditorModal.jsx', () => ({
    default: ({ open, modalProps, onConfirm, onCancel }) => (!open || !modalProps ? null : (
        <div data-testid="ally-modal">
            <span data-testid="ally-title">{modalProps.title}</span>
            <span data-testid="ally-current">{modalProps.currentAllies.join(',')}</span>
            <button data-testid="ally-confirm" onClick={() => onConfirm(modalProps.currentAllies)}>confirm-allies</button>
            <button data-testid="ally-cancel" onClick={onCancel}>cancel-allies</button>
        </div>
    )),
}));
// Card stands in for the real CreatureCard/HpFeedback pair: it echoes the
// container-owned hpEvent wiring (delta + animationend retirement) without
// re-testing card internals (#848-#853 lanes).
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature, tvMode, hpEvent, onHpFeedbackDone, onEditAllies, isLocalhost }) => (
        <div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type}${tvMode ? ' tv' : ''}`}>
            <span>{creature.name}</span>
            {hpEvent && (
                <span
                    data-testid={`floater-${creature.name}`}
                    onAnimationEnd={() => onHpFeedbackDone(creature.name)}
                >
                    {hpEvent.delta}
                </span>
            )}
            <button data-testid={`retire-${creature.name}`} onClick={() => onHpFeedbackDone(creature.name)}>retire</button>
            {isLocalhost
                ? <button data-testid={`allies-${creature.name}`} onClick={() => onEditAllies(creature)}>allies</button>
                : <span data-testid={`no-allies-${creature.name}`} />}
        </div>
    ),
}));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => <div data-testid="effect-adder"><span>{targetName}</span></div> }));



describe('Initiative ally editor (Phase 3.2 container wiring)', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        syncStateStore.clear();
        localStorage.clear();
        window.confirm = vi.fn(() => true);
        Element.prototype.scrollIntoView = vi.fn();
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue({ round: 1, creatures: [
            { name: 'Grim', type: 'player', initiative: '18', targetName: null, concentration: null },
            { name: 'Sera', type: 'player', initiative: '12', targetName: null, concentration: null },
            { name: 'Zombie', type: 'npc', initiative: '8', targetName: null, concentration: null, maxHp: 15, currentHp: 9 },
        ] });
        vi.mocked(combatData.getCombatSummary).mockReturnValue({ creatures: [
            { name: 'Grim', type: 'player' },
            { name: 'Sera', type: 'player' },
            { name: 'Zombie', type: 'npc', currentHp: 9, maxHp: 15 },
        ] });
        props = {
            characters: [
                { name: 'Grim', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } },
                { name: 'Sera', computedStats: { hitPoints: 15, currentHitPoints: 15, armorClass: 14 } },
            ],
            campaignName: 'test-campaign',
            onNpcsChange: vi.fn(),
            isLocalhost: true,
            mapName: 'test-map',
        };
    });

    it('GM cards receive the ally trigger; opening one mounts the shared modal; confirm closes', async () => {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument(); });

        expect(screen.getByTestId('allies-Grim')).toBeInTheDocument();
        expect(screen.getByTestId('allies-Zombie')).toBeInTheDocument();
        expect(screen.queryByTestId('ally-modal')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('allies-Grim'));
        expect(screen.getByTestId('ally-modal')).toBeInTheDocument();
        expect(screen.getByTestId('ally-title')).toHaveTextContent('Allies of Grim');
        expect(screen.getByTestId('ally-current')).toHaveTextContent('Grim');

        fireEvent.click(screen.getByTestId('ally-confirm'));
        expect(setAllyList).toHaveBeenCalledWith('Grim', ['Grim'], 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ abilityName: 'Ally Selection' }));
        expect(screen.queryByTestId('ally-modal')).not.toBeInTheDocument();
    });

    it('cancel closes without writing', async () => {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument(); });

        fireEvent.click(screen.getByTestId('allies-Zombie'));
        fireEvent.click(screen.getByTestId('ally-cancel'));
        expect(setAllyList).not.toHaveBeenCalled();
        expect(screen.queryByTestId('ally-modal')).not.toBeInTheDocument();
    });

    it('LAN devices get no ally trigger at all (authorship stays GM-side)', async () => {
        props.isLocalhost = false;
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument(); });

        expect(screen.getByTestId('no-allies-Grim')).toBeInTheDocument();
        expect(screen.queryByTestId('allies-Grim')).not.toBeInTheDocument();
    });
});
