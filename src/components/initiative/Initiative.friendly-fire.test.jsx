// @maintained-by-ai
// Lane: Initiative CONTAINER friendly-fire overlay wiring (backlog 2026-11-04
// CQ). Proves the end-to-end bridge WITHOUT any native dialog: an ally-target
// select change opens the FriendlyFireConfirmModal (role=dialog, verbatim copy)
// with zero writes; Cancel closes it and the controlled select RESTORES the
// previous target (React restores the DOM value when the change event ends
// with the combatedSummary untouched — no combatSummary write happens);
// Confirm arms through the factory with exactly ONE friendlyFire:true audit
// row; a newer ally selection REPLACES the pending pair (one prompt at a
// time); exempt faces (non-ally) arm silently. Handler byte-contract:
// createCreatureHandlers.friendly-fire.test.js; modal copy/chrome/convention:
// FriendlyFireConfirmModal.test.jsx. Boundary mocks mirror createCreatureHandlers.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';
import { addEntry } from '../../services/ui/logService.js';
import { setTarget } from '../../services/encounters/initiativeService.js';

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
                entry.setter = vi.fn((newValue) => { entry.value = newValue; });
            }
            return [entry.value, entry.setter];
        }),
        listeners: new Map(),
        getRuntimeValue: vi.fn((_key, prop) => {
            if (prop === 'currentHitPoints') return 10;
            if (prop === 'hitPoints') return 10;
            return null;
        }),
        setRuntimeValue: vi.fn(),
        setRuntimeObject: vi.fn(),
    };
});
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), patch: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(), sendDeathSavePrompt: vi.fn(),
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
    addNpc: vi.fn(),
    removeNpc: vi.fn(),
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
    isPreviousDisabled: vi.fn(() => false),
    setInitiative: vi.fn(),
    rollNpcInitiative: vi.fn(),
    renameNpc: vi.fn(() => Promise.resolve()),
    // Real setTarget semantics: mutate the live summary so the controlled
    // select re-renders with the armed target on the confirm path.
    setTarget: vi.fn((cs, name, target) => {
        const c = cs.creatures.find(x => x.name === name);
        if (c) c.targetName = target;
    }),
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
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    isSecondTurnEntry: vi.fn(() => false),
    maybeGrantThiefsReflexesSecondTurn: vi.fn(),
}));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({ vanishSummonAtZeroHp: vi.fn() }));
vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({ breakHypnoticPatternOnDamage: vi.fn() }));
vi.mock('../../services/ui/logService.js', () => ({ getLog: vi.fn(async () => []), addEntry: vi.fn(async () => ({})) }));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => <div data-testid="effect-adder"><span>{targetName}</span></div> }));
vi.mock('./AllyEditorModal.jsx', () => ({ default: () => null }));
// Explicit EDITED ally lists (unedited defaults would never confirm — the
// production rig needs the stored selectedAllies key too, CQ seed).
vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn((name) => (name === 'Grim' ? ['Grim', 'Sera'] : name === 'Sera' ? ['Sera', 'Grim'] : [name])),
    setAllyList: vi.fn(),
    hasExplicitAllyList: vi.fn(() => true),
}));
// Faithful stand-in for the real TargetSelect control — identical controlled
// semantics (value from the summary, change routed to the container handler).
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature, allCreatures, onTargetChange }) => (
        <div data-testid={`creature-card-${creature.name}`}>
            <select
                data-testid={`target-select-${creature.name}`}
                aria-label={`${creature.name} target`}
                value={creature.targetName || ''}
                onChange={(e) => onTargetChange(creature.name, e.target.value)}
            >
                <option value="">— No Target —</option>
                {allCreatures.filter(c => c.name !== creature.name).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                ))}
            </select>
        </div>
    ),
}));

let confirmSpy;
let loadedSummary;

async function mountInitiative() {
    await act(async () => {
        render(<Initiative
            characters={[
                { name: 'Grim', computedStats: { hitPoints: 20, currentHitPoints: 10, armorClass: 15 } },
                { name: 'Sera', computedStats: { hitPoints: 15, currentHitPoints: 10, armorClass: 14 } },
            ]}
            campaignName="test-campaign"
            onNpcsChange={vi.fn()}
            isLocalhost
            mapName="test-map"
        />);
    });
    await waitFor(() => { expect(screen.getByTestId('target-select-Grim')).toBeInTheDocument(); });
}

const FRIENDLY_COPY = "Friendly fire: Sera is on Grim's ally list. Arm them as the target anyway?";
const friendlyEntries = () => addEntry.mock.calls.filter(c => c[1]?.friendlyFire);

beforeEach(() => {
    vi.clearAllMocks();
    // The lane must never touch a native dialog — the spy returns TRUE so an
    // accidental confirm would also silently arm, making the not-called
    // assertion the decisive one (criterion 1).
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loadedSummary = { round: 1, creatures: [
        { name: 'Grim', type: 'player', initiative: '18', targetName: null, concentration: null },
        { name: 'Sera', type: 'player', initiative: '12', targetName: null, concentration: null },
        { name: 'Zombie', type: 'npc', initiative: '8', targetName: null, concentration: null, maxHp: 15, currentHp: 9 },
    ] };
    vi.mocked(combatData.loadCombatSummary).mockResolvedValue(loadedSummary);
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe('Initiative friendly-fire overlay (container wiring)', () => {
    it('ally select opens the role=dialog overlay with the verbatim copy; native confirm never fires; zero writes', async () => {
        await mountInitiative();

        fireEvent.change(screen.getByTestId('target-select-Grim'), { target: { value: 'Sera' } });

        const dialog = screen.getByRole('dialog', { name: 'Friendly Fire' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(document.querySelector('.modal-shell p').textContent).toBe(FRIENDLY_COPY);
        expect(confirmSpy).not.toHaveBeenCalled();
        // Fully inert pre-decision: no arm, no friendly log row.
        expect(setTarget).not.toHaveBeenCalled();
        expect(friendlyEntries()).toHaveLength(0);
    });

    it('Cancel closes the prompt and the controlled select restores the PREVIOUS target — no log, summary unchanged', async () => {
        await mountInitiative();
        const select = screen.getByTestId('target-select-Grim');

        fireEvent.change(select, { target: { value: 'Sera' } });
        // React restores the controlled select the moment the change event ends
        // with combatSummary untouched — even while the prompt waits (the DOM
        // value moved but never sticks).
        expect(select.value).toBe('');

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog', { name: 'Friendly Fire' })).not.toBeInTheDocument();
        expect(select.value).toBe('');
        expect(setTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(combatData.loadCombatSummary).toHaveBeenCalledTimes(1);
        const summary = await vi.mocked(combatData.loadCombatSummary).mock.results[0].value;
        expect(summary.targetName ?? null).toBeUndefined;
        expect(summary.creatures.find(c => c.name === 'Grim').targetName).toBeNull();
    });

    it('Confirm arms the ally (setTarget + board POST) and lands exactly ONE friendlyFire:true audit row', async () => {
        await mountInitiative();
        const select = screen.getByTestId('target-select-Grim');

        fireEvent.change(select, { target: { value: 'Sera' } });
        fireEvent.click(screen.getByRole('button', { name: 'Yes, Arm Target' }));

        expect(screen.queryByRole('dialog', { name: 'Friendly Fire' })).not.toBeInTheDocument();
        expect(select.value).toBe('Sera');
        expect(setTarget).toHaveBeenCalledTimes(1);
        expect(setTarget.mock.calls[0].slice(1)).toEqual(['Grim', 'Sera']);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({
            creatures: expect.arrayContaining([
                expect.objectContaining({ name: 'Grim', targetName: 'Sera' }),
            ]),
        }), 'test-campaign');
        expect(friendlyEntries()).toHaveLength(1);
        expect(friendlyEntries()[0][1]).toMatchObject({
            type: 'ability_use',
            characterName: 'Grim',
            abilityName: 'Target Selection',
            friendlyFire: true,
            description: 'Grim armed Sera as a target — Sera is on Grim\'s ally list (friendly fire confirmed).',
        });
    });

    it('one prompt at a time: a newer ally-target selection replaces the pending pair', async () => {
        await mountInitiative();

        fireEvent.change(screen.getByTestId('target-select-Grim'), { target: { value: 'Sera' } });
        expect(document.querySelector('.modal-shell p').textContent).toBe(FRIENDLY_COPY);

        // Second attacker's ally selection replaces the pair (single dialog).
        fireEvent.change(screen.getByTestId('target-select-Sera'), { target: { value: 'Grim' } });
        const dialogs = screen.getAllByRole('dialog', { name: 'Friendly Fire' });
        expect(dialogs).toHaveLength(1);
        expect(document.querySelector('.modal-shell p').textContent)
            .toBe("Friendly fire: Grim is on Sera's ally list. Arm them as the target anyway?");

        fireEvent.click(screen.getByRole('button', { name: 'Yes, Arm Target' }));
        // Only the REPLACED pair arms — the superseded Grim→Sera prompt is gone.
        expect(setTarget).toHaveBeenCalledTimes(1);
        expect(setTarget.mock.calls[0].slice(1)).toEqual(['Sera', 'Grim']);
        expect(friendlyEntries()).toHaveLength(1);
    });

    it('exempt face: a non-ally target arms silently (zero prompt, zero confirm log)', async () => {
        await mountInitiative();
        const select = screen.getByTestId('target-select-Grim');

        fireEvent.change(select, { target: { value: 'Zombie' } });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(select.value).toBe('Zombie');
        expect(setTarget).toHaveBeenCalledWith(expect.anything(), 'Grim', 'Zombie');
    });
});
