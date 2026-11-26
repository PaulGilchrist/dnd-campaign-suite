// @maintained-by-ai 2026-11-19
// Mapless quick-spawn end-to-end at the Initiative CONTAINER face (roadmap
// Item 4): mounts with mapName={null} — no active map anywhere — and walks
// "5 goblins at the door": + Monster → real QuickMonsterSpawn picker (only the
// bestiary loader is mocked) → search → row → qty → Spawn. The join lane is
// mocked at the quickMonsterSpawn boundary (its board bytes are owned by
// quickMonsterSpawn.test.js); this file proves the CONTAINER completes the
// whole flow with zero errors and no map: the accepted cards re-render, the
// freshly joined monster is armable through the card's Target select (the
// mapless fallback-target lane — scoped combatSummary PATCH, no token, no
// overlay, no navigation), and the picker closes on success. One threading
// leg mounts WITH a mapName to pin the 2026-11-20 CCC token opt-in reaching
// the service. Boundary mocks mirror initiative.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import * as combatData from '../../services/encounters/combatData.js';
import * as mapsService from '../../services/maps/mapsService.js';
import storage from '../../services/ui/storage.js';
import { quickSpawnMonster } from '../../services/encounters/quickMonsterSpawn.js';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';

const syncStateStore = new Map();

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
    getRuntimeValue: vi.fn((_key, _prop, _campaign) => {
        if (_prop === 'currentHitPoints') return 10;
        if (_prop === 'hitPoints') return 10;
        if (_prop === 'activeConditions') return [];
        if (_prop === 'activeBuffs') return [];
        return null;
    }),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
    getRuntimeKeysByPrefix: vi.fn(() => []),
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
    addNpc: vi.fn(),
    removeNpc: vi.fn(),
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
    isPreviousDisabled: vi.fn(() => false),
    setInitiative: vi.fn(),
    rollNpcInitiative: vi.fn(),
    renameNpc: vi.fn(() => Promise.resolve()),
    setTarget: vi.fn((summary, name, target) => {
        const row = summary.creatures.find(c => c.name === name);
        if (row) row.targetName = target || null;
    }),
    clearCombat: vi.fn(),
    mergeCombatSummaryWithCharacters: vi.fn((initialSummary, characters) => {
        const names = new Set((initialSummary?.creatures ?? []).map(c => c.name));
        const newCreatures = characters.filter(ch => !names.has(ch.name)).map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }));
        return { round: initialSummary?.round ?? 1, creatures: [...(initialSummary?.creatures ?? []), ...newCreatures] };
    }),
}));
vi.mock('../../services/encounters/quickMonsterSpawn.js', () => ({
    quickSpawnMonster: vi.fn(),
    QUICK_SPAWN_ENCOUNTER_NAME: 'Quick spawn',
}));
vi.mock('../../hooks/ui/useMonstersData.js', () => ({ useMonstersData: vi.fn() }));
// The picker's active-map TYPE probe (DDD outdoor-hide): keep every other
// mapsService export real, stub only the list lane the probe reads.
vi.mock('../../services/maps/mapsService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    loadMaps: vi.fn(),
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(), removeCondition: vi.fn(), addCondition: vi.fn(), buildConditionPopup: vi.fn(),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(), breakConcentration: vi.fn(), addConcentration: vi.fn(), buildConcentrationPopup: vi.fn(), cleanupConcentrationEffects: vi.fn(),
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logInitiativeRoll: vi.fn(), logConditionEvent: vi.fn(), logConcentrationSave: vi.fn(),
    logConditionSave: vi.fn(), logHpChange: vi.fn(), logNpcThreshold: vi.fn(),
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children }) => <div data-testid="popup-overlay">{children}</div> }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: () => <div data-testid="dice-roll-result" /> }));
// Faithful stand-in for the real card's Target select (Initiative.friendly-fire
// precedent): identical controlled-change contract, data-testid per creature.
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature, allCreatures, onTargetChange }) => (
        <div data-testid={`creature-card-${creature.name}`}>
            <span>{creature.name}</span>
            <select
                data-testid={`target-select-${creature.name}`}
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
vi.mock('./EffectAdder.jsx', () => ({ default: () => <div data-testid="effect-adder" /> }));

const GOBLIN_ROW = { index: 'goblin', name: 'Goblin', type: 'humanoid', size: 'Small', challenge_rating: 0.25, xp: 50, hit_points: 7, armor_class: 15, initiative_details: '+2' };

const goblinRow = (n, initiative) => ({
    name: `Goblin ${n}`, type: 'npc', initiative: String(initiative), targetName: null,
    ac: 15, maxHp: 7, currentHp: 7, concentration: null,
});
const playerRow = (name, initiative) => ({ name, type: 'player', initiative, targetName: null, concentration: null });

describe('Initiative — quick monster spawn (mapless law + token opt-in threading)', () => {
    let props;
    let errorSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        syncStateStore.clear();
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        Element.prototype.scrollIntoView = vi.fn();
        useMonstersData.mockReturnValue({ monsters: [GOBLIN_ROW], loading: false });
        mapsService.loadMaps.mockResolvedValue({
            maps: [{ name: 'qa-sandbox', slug: 'qa-sandbox', type: 'indoor', isActive: true }],
        });
        vi.mocked(combatData.loadCombatSummary).mockResolvedValue({ round: 1, creatures: [
            playerRow('Alice', '12'),
            playerRow('Bob', '9'),
        ] });
        props = {
            characters: [
                { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } },
                { name: 'Bob', computedStats: { hitPoints: 15, currentHitPoints: 15, armorClass: 14 } },
            ],
            campaignName: 'test-campaign',
            onNpcsChange: vi.fn(),
            isLocalhost: true,
            mapName: null, // ← the mapless face: no active map at all
            onViewCharacter: vi.fn(),
            onOpenEncounters: vi.fn(),
        };
    });

    async function mountTracker() {
        await act(async () => { render(<Initiative {...props} />); });
        await waitFor(() => expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument());
    }

    /** "5 goblins at the door": open picker → search → row → qty → Spawn. */
    async function spawnFiveGoblins() {
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '+ Monster' })); });
        const search = await waitFor(() => screen.getByLabelText('Search monsters'));
        fireEvent.change(search, { target: { value: 'gob' } });
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '5' } });
        // Mapless contract (2026-11-20 CCC opt-in): with mapName null the
        // token affordance never renders while the picker is OPEN.
        expect(screen.queryByLabelText('Place a token near the party on the map')).not.toBeInTheDocument();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Spawn 5× Goblin' })); });
    }

    it('completes + Monster → search → qty → Spawn with zero errors and zero map requests, rendering the joined cards', async () => {
        quickSpawnMonster.mockResolvedValue({ round: 1, creatures: [
            goblinRow(1, 16), playerRow('Alice', '12'), goblinRow(2, 11),
            playerRow('Bob', '9'), goblinRow(3, 8), goblinRow(4, 5), goblinRow(5, 3),
        ] });
        await mountTracker();

        await spawnFiveGoblins();

        // The lane ran through the shared spawn service with the full bestiary
        // row + the exact typed quantity + the roster for the party fan-out.
        // No active map ⇒ no token affordance ever rendered ⇒ placeToken false.
        expect(quickSpawnMonster).toHaveBeenCalledWith(
            expect.objectContaining({ index: 'goblin', name: 'Goblin' }), 5, props.characters, 'test-campaign', { placeToken: false });
        expect(screen.queryByLabelText('Place a token near the party on the map')).not.toBeInTheDocument();
        // Accepted board mirrored: all five cards render beside the party.
        for (let n = 1; n <= 5; n++) {
            expect(screen.getByTestId(`creature-card-Goblin ${n}`)).toBeInTheDocument();
        }
        // Picker closed on success + honest disclosure toast.
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(screen.getByText('5× Goblin joined initiative')).toBeInTheDocument();
        // Mapless contract: nothing anywhere asked for a map (not even the
        // picker's type probe) and nothing errored.
        expect(mapsService.loadMaps).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('a freshly spawned monster arms its target through the card Target select — no token, no map (scoped PATCH lane)', async () => {
        quickSpawnMonster.mockResolvedValue({ round: 1, creatures: [
            goblinRow(1, 16), playerRow('Alice', '12'), playerRow('Bob', '9'),
        ] });
        await mountTracker();
        await spawnFiveGoblins();
        await waitFor(() => expect(screen.getByTestId('target-select-Goblin 1')).toBeInTheDocument());

        fireEvent.change(screen.getByTestId('target-select-Goblin 1'), { target: { value: 'Alice' } });

        // The same scoped combatSummary PATCH lane an established board uses —
        // arming works with mapName null.
        expect(storage.patch).toHaveBeenCalledWith('combatSummary',
            { creatures: [{ name: 'Goblin 1', targetName: 'Alice' }] }, 'test-campaign');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('a rejected spawn keeps the picker open with visible copy and never mutates the board', async () => {
        quickSpawnMonster.mockRejectedValue(new Error('combatSummary board write failed'));
        await mountTracker();

        await spawnFiveGoblins();

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent(/never reached the board/);
        expect(screen.queryByTestId('creature-card-Goblin 1')).not.toBeInTheDocument();
        expect(screen.getByText('Failed to spawn 5× Goblin')).toBeInTheDocument();
    });

    it('with an ACTIVE map the container threads mapName into the picker: the opt-in renders unchecked and a tick rides { placeToken: true }', async () => {
        quickSpawnMonster.mockResolvedValue({ round: 1, creatures: [
            goblinRow(1, 16), playerRow('Alice', '12'), playerRow('Bob', '9'),
        ] });
        await act(async () => { render(<Initiative {...props} mapName="qa-sandbox" />); });
        await waitFor(() => expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument());

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '+ Monster' })); });
        await waitFor(() => screen.getByLabelText('Search monsters'));
        // The indoor type lands through the list probe (DDD: outdoor would
        // stay absent — pinned by QuickMonsterSpawn.test.jsx).
        const box = await waitFor(() => screen.getByLabelText('Place a token near the party on the map'));
        expect(box).not.toBeChecked();
        fireEvent.click(box);
        fireEvent.click(screen.getByText('Goblin'));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Spawn 1× Goblin' })); });

        expect(quickSpawnMonster).toHaveBeenCalledWith(
            expect.objectContaining({ index: 'goblin', name: 'Goblin' }), 1, props.characters, 'test-campaign', { placeToken: true });
    });
});
