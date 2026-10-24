// @maintained-by-ai
// GM-only initiative gate (bug-player-clients-can-hijack-initiative): live 2026-10-24 a LAN
// player tab clicked Next → and the FULL turn-turnover cascade wrote server-side
// (POST /combatSummary ×2 + /activeCreatureName + /__initiative__ +
// /lastAppliedTurnStartCreature; activeCreatureName moved). Mirrors the fog-write
// localhost gate in Map.jsx:234 and the MapToolbar `{isLocalhost && …}` strip:
// non-localhost renders NEITHER the mutating control row (Clear/+NPC/← Prev/Next →)
// NOR the loot panel (Generate/Award are XP + party-inventory writes), registers NO
// turn-admin keydown lane, and authors NO mount-time combatSummary/activeCreatureName
// POST (read-only tabs mirror via SSE, they never seed or stamp). localhost keeps
// every lane byte-identical: buttons present, mount persists the merged tracker,
// ArrowRight/+ still walk the tracker. Mock set mirrors initiative-callbacks.test.jsx
// (keydown→navigation cascade) + the zero-network spellOverlayService guard from
// initiative.test.jsx.
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { getNextCreatureName, getPreviousCreatureName, addNpc } from '../../services/encounters/initiativeService.js';
import storage from '../../services/ui/storage.js';

vi.mock('../../hooks/runtime/useSSEEqualityGuard.js', () => ({ default: (setter) => setter }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
    const syncStateStore = new Map();
    return {
        getStore: vi.fn(() => syncStateStore),
        // L5-001: TurnEconomyStrip subscribes via useRuntimeValue; null ⇒ enforcement off.
        useRuntimeValue: vi.fn(() => null),
        useSyncedState: vi.fn((key, prop, defaultValue) => {
            const storeKey = `${key}-${prop}`;
            if (!syncStateStore.has(storeKey)) {
                syncStateStore.set(storeKey, { value: defaultValue, setter: null });
            }
            const entry = syncStateStore.get(storeKey);
            if (!entry.setter) {
                entry.setter = vi.fn((newValue) => {
                    entry.value = newValue;
                });
            }
            return [entry.value, entry.setter];
        }),
        listeners: new Map(),
        getRuntimeValue: vi.fn((_key, _prop, _campaign) => {
            if (_prop === 'currentHitPoints') return 10;
            if (_prop === 'hitPoints') return 10;
            if (_prop === 'activeConditions') return [];
            if (_prop === 'activeBuffs') return [];
            if (_prop === 'inspiringMovementNoOA') return false;
            return null;
        }),
        setRuntimeValue: vi.fn((_key, _prop, _value, _campaign) => {}),
        setRuntimeObject: vi.fn(),
    };
});
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({ clearDeathSavePrompt: vi.fn() }));
vi.mock('../../services/npcs/monsterUtils.js', () => ({ getMonsterImageUrl: vi.fn(() => Promise.resolve(null)), getMonsterData: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
    CONDITIONS: [],
}));
vi.mock('../../services/npcs/npcsService.js', () => ({ loadNPCs: vi.fn(() => Promise.resolve({ npcs: [] })) }));
vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({ npcToMonsterFormat: vi.fn(() => null), npcHasStatBlock: vi.fn(() => true) }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ expireStaleEffects: vi.fn(), applyTurnStartEffects: vi.fn(), applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/encounters/combatData.js', () => {
    return {
        loadCombatSummary: vi.fn(() => Promise.resolve(null)),
        getCombatSummary: vi.fn(() => null),
        getActiveCreatureName: vi.fn(() => null),
        setCombatSummaryCache: vi.fn(),
    };
});
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({ clearPerRoundMajestyTrackers: vi.fn() }));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    setupCreatures: vi.fn((characters) => characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }))),
    addNpc: vi.fn((cs) => { cs.creatures.push({ name: 'NPC 1', type: 'npc', initiative: '', targetName: null, ac: 10, resistances: [], immunities: [], conditions: [], concentration: null, maxHp: 10, currentHp: 10, saveBonuses: {} }); return 1; }),
    removeNpc: vi.fn(),
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
    isPreviousDisabled: vi.fn(() => false),
    setInitiative: vi.fn(),
    rollNpcInitiative: vi.fn(() => ({ roll: 15, bonus: 2, total: 17 })),
    renameNpc: vi.fn(() => Promise.resolve()),
    setTarget: vi.fn(),
    clearCombat: vi.fn((characters) => ({ round: 1, creatures: characters.map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null })) })),
    mergeCombatSummaryWithCharacters: vi.fn((initialSummary, characters) => {
        const names = new Set((initialSummary?.creatures ?? []).map(c => c.name));
        const newCreatures = characters.filter(ch => !names.has(ch.name)).map((ch) => ({ name: ch.name, type: 'player', initiative: '', targetName: null, concentration: null }));
        return { round: initialSummary?.round ?? 1, creatures: [...(initialSummary?.creatures ?? []), ...newCreatures] };
    }),
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    removeCondition: vi.fn(), addCondition: vi.fn(),
    buildConditionPopup: vi.fn(() => ({ name: 'Test Creature', condition: 'Blinded', type: 'save', rolls: [15], bonus: 2, targetName: 'Test Creature', targetAc: 10, hit: false, success: true, dc: 10 })),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    breakConcentration: vi.fn(() => 'Shield'), addConcentration: vi.fn(),
    buildConcentrationPopup: vi.fn(() => ({ name: 'Test Creature', condition: null, spell: 'Shield', type: 'save', rolls: [15], bonus: 2, targetName: 'Test Creature', targetAc: 10, hit: false, success: true, dc: 10 })),
    cleanupConcentrationEffects: vi.fn(),
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logInitiativeRoll: vi.fn(), logConditionEvent: vi.fn(), logConcentrationSave: vi.fn(),
    logConditionSave: vi.fn(), logHpChange: vi.fn(), logNpcThreshold: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
// Zero-network guard: mount fetches spell overlays for real otherwise.
vi.mock('../../services/maps/spellOverlayService.js', () => ({
    fetchSpellOverlays: vi.fn(() => Promise.resolve([])),
    overlayTargetId: vi.fn(() => null),
}));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));
vi.mock('../common/Subscriber.jsx', () => ({ default: () => <div data-testid="subscriber" /> }));
vi.mock('../common/Popup.jsx', () => ({ default: ({ children, onClickOrKeyDown }) => (<div data-testid="popup-overlay" onClick={onClickOrKeyDown}><div data-testid="popup-modal">{children}</div></div>) }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: ({ name }) => <div data-testid="dice-roll-result">{name}</div> }));
vi.mock('./CreatureCard.jsx', () => ({ default: ({ creature }) => (
    <div data-testid={`creature-card-${creature.name}`} className={`creature-card ${creature.type}`}>
        <span>{creature.name}</span>
    </div>
) }));
vi.mock('./EffectAdder.jsx', () => ({ default: ({ targetName }) => (<div data-testid="effect-adder"><span>{targetName}</span></div>) }));

describe('Initiative GM-only gate (player LAN lane)', () => {
    const baseProps = () => ({
        characters: [
            { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } },
            { name: 'Bob', computedStats: { hitPoints: 15, currentHitPoints: 15, armorClass: 14 } },
        ],
        campaignName: 'test-campaign',
        onNpcsChange: vi.fn(),
        mapName: 'test-map',
    });
    const summary = () => ({
        round: 1,
        creatures: [
            { name: 'Alice', type: 'player' },
            { name: 'Bob', type: 'player' },
        ],
    });

    const mount = async (isLocalhost) => {
        vi.mocked(loadCombatSummary).mockResolvedValue(summary());
        await act(async () => { render(<Initiative {...baseProps()} isLocalhost={isLocalhost} />); });
        await waitFor(() => { expect(screen.getByText('Initiative (round 1)')).toBeInTheDocument(); });
    };

    const pressKey = async (key) => {
        await act(async () => { fireEvent.keyDown(window, { key }); });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
    });

    describe('non-localhost (LAN player view)', () => {
        it('renders the read-only board but NO mutating control row and NO loot panel', async () => {
            await mount(false);

            // Board still mirrors (read view intact): cards + round heading render.
            expect(screen.getByTestId('creature-card-Alice')).toBeInTheDocument();
            expect(screen.getByTestId('creature-card-Bob')).toBeInTheDocument();
            expect(screen.getAllByTestId('subscriber')).toHaveLength(1);

            // Mutating controls are gone entirely — not merely enabled (the fingerprint).
            expect(document.querySelector('.combat-controls')).toBeNull();
            expect(screen.queryByText('Clear')).not.toBeInTheDocument();
            expect(screen.queryByText('+ NPC')).not.toBeInTheDocument();
            expect(screen.queryByText('← Prev')).not.toBeInTheDocument();
            expect(screen.queryByText('Next →')).not.toBeInTheDocument();
            // Loot generate/award are XP + party-inventory writes — panel absent for players.
            expect(screen.queryByText('Generate Loot')).not.toBeInTheDocument();
            expect(document.querySelector('.initiative-loot-section')).toBeNull();
        });

        it('mount authors ZERO server writes (no combatSummary/activeCreatureName POST)', async () => {
            await mount(false);

            expect(storage.set).not.toHaveBeenCalled();
        });

        it('turn-admin keydowns stay inert: no tracker walk, no NPC spawn, zero writes', async () => {
            await mount(false);
            vi.mocked(getNextCreatureName).mockReturnValue({ newActiveName: 'Bob', roundIncrement: false });
            vi.mocked(getPreviousCreatureName).mockReturnValue({ newActiveName: 'Alice', roundDecrement: false });

            await pressKey('ArrowRight');
            await pressKey('ArrowLeft');
            await pressKey('+');

            expect(getNextCreatureName).not.toHaveBeenCalled();
            expect(getPreviousCreatureName).not.toHaveBeenCalled();
            expect(addNpc).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
        });
    });

    describe('localhost (GM lane preserved)', () => {
        it('renders the full control row and loot panel', async () => {
            await mount(true);

            expect(screen.getByText('Clear')).toBeInTheDocument();
            expect(screen.getByText('+ NPC')).toBeInTheDocument();
            expect(screen.getByText('← Prev')).toBeInTheDocument();
            expect(screen.getByText('Next →')).toBeInTheDocument();
            expect(screen.getByText('Generate Loot')).toBeInTheDocument();
        });

        it('mount persists the merged tracker (GM is the author)', async () => {
            await mount(true);

            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 1 }), 'test-campaign');
        });

        it('ArrowRight still walks the tracker: the active-creature stamp persists', async () => {
            await mount(true);
            vi.mocked(getNextCreatureName).mockReturnValue({ newActiveName: 'Bob', roundIncrement: false });
            const before = storage.set.mock.calls.filter(([key]) => key === 'activeCreatureName').length;

            await pressKey('ArrowRight');

            expect(getNextCreatureName).toHaveBeenCalledWith(expect.objectContaining({ round: 1 }), 'Alice');
            const activeWrites = storage.set.mock.calls.filter(([key]) => key === 'activeCreatureName');
            expect(activeWrites.slice(before)).toEqual([['activeCreatureName', 'Bob', 'test-campaign']]);
        });
    });
});
