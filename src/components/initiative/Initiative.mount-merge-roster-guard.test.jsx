// @maintained-by-ai
// bug-initiative-mount-merge-empty-roster-clobbers-board — roster-settled mount guard.
// A second GM tab that opened Initiative before its character-roster prop settled
// (async rules-engine enrichment still in flight, `characters` = []) ran the mount
// merge against the empty roster: mergeCombatSummaryWithCharacters evicted every
// type:'player' row and the UNGUARDED full-store POST silently replaced the live
// multi-row board with only its non-player rows (rows, initiatives, arms, pointer
// — table-wide data loss, 2/2 live repro at human click speed). Law pinned here:
// while the roster is UNSETTLED, a stored board that carries player rows is neither
// authored (no storage.set) nor mirrored locally; the merge fires once the roster
// settles (rosterEmpty dep flip), preserving every row. Boards with zero stored
// player rows (Arena/Starter quick-join, pure monster boards) merge normally.
// The REAL merge is used (initiativeService is deliberately NOT mocked) so the
// eviction leg is exercised end-to-end. Mock block mirrors
// Initiative.mount-active-creature.test.jsx.
import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { loadCombatSummary, getActiveCreatureName } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';

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
                entry.setter = vi.fn((newValue) => {
                    entry.value = newValue;
                });
            }
            return [entry.value, entry.setter];
        }),
        listeners: new Map(),
        getRuntimeValue: vi.fn(() => null),
        setRuntimeValue: vi.fn(),
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
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    removeCondition: vi.fn(), addCondition: vi.fn(),
    buildConditionPopup: vi.fn(() => null),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(async () => ({ roll: 15, success: true, bonus: 2, bonusDetail: '' })),
    breakConcentration: vi.fn(), addConcentration: vi.fn(),
    buildConcentrationPopup: vi.fn(() => null),
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
vi.mock('../common/Popup.jsx', () => ({ default: () => <div data-testid="popup-overlay" /> }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: () => <div data-testid="dice-roll-result" /> }));
vi.mock('./CreatureCard.jsx', () => ({
    default: ({ creature, isActive }) => (
        <div data-testid={`creature-card-${creature.name}`} data-active={isActive ? 'true' : 'false'} />
    ),
}));
vi.mock('./EffectAdder.jsx', () => ({ default: () => <div data-testid="effect-adder" /> }));

const mountProps = (characters) => ({
    characters,
    campaignName: 'test-campaign',
    onNpcsChange: vi.fn(),
    mapName: null,
    isLocalhost: true,
});

const playerByte = (name, init, targetName = null) => ({
    name,
    type: 'player',
    initiative: String(init),
    targetName,
    concentration: null,
});

const npcByte = (name, init) => ({
    name,
    type: 'npc',
    initiative: String(init),
    currentHp: 7,
    maxHp: 7,
    targetName: null,
    concentration: null,
    saveBonuses: {},
});

// The live-repro board: 3 player rows (rolled initiatives + an armed target)
// plus one NPC row, pointer on a player.
const liveBoard = () => ({
    round: 1,
    activeCreatureName: 'Ann',
    creatures: [
        playerByte('Ann', 20, 'BUG-Goblin'),
        playerByte('Bob', 15),
        playerByte('Zoe', 8),
        npcByte('BUG-Goblin', 12),
    ],
});

const boardWrites = () => storage.set.mock.calls.filter(([key]) => key === 'combatSummary');
const cardNames = () => Array.from(
    document.querySelectorAll('[data-testid^="creature-card-"]')
).map(el => el.getAttribute('data-testid').replace('creature-card-', ''));

const flush = async () => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
};

describe('Initiative mount-merge roster-settled guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
        vi.mocked(getActiveCreatureName).mockReturnValue(null);
    });

    it('authors NOTHING while an unsettled (empty) roster meets a stored board with player rows', async () => {
        vi.mocked(loadCombatSummary).mockResolvedValue(liveBoard());

        await act(async () => { render(<Initiative {...mountProps([])} />); });
        await waitFor(() => { expect(loadCombatSummary).toHaveBeenCalledWith('test-campaign'); });
        await flush();

        // The clobber fingerprint: a POST carrying only the non-player rows.
        expect(boardWrites()).toHaveLength(0);
        expect(storage.set).not.toHaveBeenCalled();
        // And no evicted board is mirrored locally either.
        expect(cardNames()).toHaveLength(0);
    });

    it('merges and POSTs the FULL board once the roster settles', async () => {
        vi.mocked(loadCombatSummary).mockResolvedValue(liveBoard());

        const { rerender } = render(<Initiative {...mountProps([])} />);
        await waitFor(() => { expect(loadCombatSummary).toHaveBeenCalledWith('test-campaign'); });
        await flush();
        expect(boardWrites()).toHaveLength(0);

        // Rules-engine enrichment resolves — the settled roster re-runs the mount merge.
        await act(async () => {
            rerender(<Initiative {...mountProps([{ name: 'Ann' }, { name: 'Bob' }, { name: 'Zoe' }])} />);
        });
        await waitFor(() => { expect(boardWrites().length).toBeGreaterThan(0); });

        const board = boardWrites()[boardWrites().length - 1][1];
        const byName = Object.fromEntries(board.creatures.map(c => [c.name, c]));
        // Every player row survives WITH its rolled initiative and armed target.
        expect(Object.keys(byName).sort()).toEqual(['Ann', 'Bob', 'BUG-Goblin', 'Zoe'].sort());
        expect(byName.Ann).toMatchObject({ type: 'player', initiative: '20', targetName: 'BUG-Goblin' });
        expect(byName.Bob).toMatchObject({ type: 'player', initiative: '15' });
        expect(byName.Zoe).toMatchObject({ type: 'player', initiative: '8' });
        // Non-player row and turn pointer intact.
        expect(byName['BUG-Goblin']).toMatchObject({ type: 'npc', initiative: '12' });
        expect(board.activeCreatureName).toBe('Ann');
        expect(cardNames().sort()).toEqual(['Ann', 'Bob', 'BUG-Goblin', 'Zoe'].sort());
    });

    it('merges immediately (no defer) for a stored board with zero player rows and an empty roster', async () => {
        // Arena/Starter quick-join face: pure monster board, zero-character campaign —
        // nothing can be evicted, so the guard must NOT gate it.
        vi.mocked(loadCombatSummary).mockResolvedValue({
            round: 1,
            creatures: [npcByte('Goblin', 12)],
        });

        await act(async () => { render(<Initiative {...mountProps([])} />); });
        await waitFor(() => {
            expect(boardWrites()).toHaveLength(1);
        });

        const board = boardWrites()[0][1];
        expect(board.creatures.map(c => c.name)).toEqual(['Goblin']);
    });

    it('settled roster at mount authors the merge exactly once (no write storm on stable props)', async () => {
        vi.mocked(loadCombatSummary).mockResolvedValue(liveBoard());

        const settled = [{ name: 'Ann' }, { name: 'Bob' }, { name: 'Zoe' }];
        const { rerender } = render(<Initiative {...mountProps(settled)} />);
        await waitFor(() => { expect(boardWrites()).toHaveLength(1); });

        // A re-render that does not flip readiness (fresh array identity, same
        // non-empty roster) must not re-run the mount merge / re-POST.
        await act(async () => {
            rerender(<Initiative {...mountProps([{ name: 'Ann' }, { name: 'Bob' }, { name: 'Zoe' }])} />);
        });
        await flush();
        expect(boardWrites()).toHaveLength(1);
    });
});
