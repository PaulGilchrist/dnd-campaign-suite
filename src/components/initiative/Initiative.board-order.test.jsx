// @maintained-by-ai
// FW 2026-11-09 improve — BOARD ORDER LAW at the mount seam (component face of
// sseHandlers.board-order.test.js): a fresh mount hydration must RENDER the card
// row in the exact array order the Next-walk steps through (sortCreaturesForBoard:
// present-first, initiative DESC, blank = −1, ties name-asc; away parked last).
// The mount merge already sorts via initiativeService; this pins the full loop:
// shuffled seeded board → DOM order == the mirror POSTed to the server == the
// REAL getNextCreatureName visit sequence. initiativeService is deliberately
// UNMOCKED (real merge + real walker, per Initiative.mount-active-creature.test.jsx
// harness recipe); mock block mirrors that file.
import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './Initiative.jsx';
import { loadCombatSummary, getActiveCreatureName } from '../../services/encounters/combatData.js';
import { getNextCreatureName } from '../../services/encounters/initiativeService.js';
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

const characters = [{ name: 'EvasiveFighter' }, { name: 'ElderPaladin' }, { name: 'Bo' }];

const player = (name, initiative, extra = {}) => ({
    name, type: 'player', initiative: String(initiative), targetName: null, concentration: null, ...extra,
});
const twin = (holder, initiative) => ({
    ...player(`${holder} (Second Turn)`, initiative), secondTurn: true, holderName: holder,
});
const npc = (name, initiative) => ({ name, type: 'npc', initiative, targetName: null, concentration: null });

// Shuffled seed: walk order must be EF(20) → EP(15) → twin(10) → Goblin(−1) →
// away Bo parked last (its 25 never outranks a present row).
const SHUFFLED = [
    player('EvasiveFighter', 20),
    twin('EvasiveFighter', 10),
    npc('Goblin', ''),
    player('ElderPaladin', 15),
    player('Bo', 25, { away: true }),
];
const WALK_ORDER = ['EvasiveFighter', 'ElderPaladin', 'EvasiveFighter (Second Turn)', 'Goblin'];
const RENDER_ORDER = [...WALK_ORDER, 'Bo'];

const mountProps = () => ({
    characters,
    campaignName: 'test-campaign',
    onNpcsChange: vi.fn(),
    mapName: null,
    isLocalhost: true,
});

// Cards as drawn, left-to-right in the carousel.
const drawnCards = () => Array.from(
    document.querySelectorAll('[data-testid^="creature-card-"]')
).map(el => el.getAttribute('data-testid').replace('creature-card-', ''));

describe('Initiative mount — rendered row == walker order', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
        vi.mocked(getActiveCreatureName).mockReturnValue(null);
    });

    it('shuffled seeded board renders present-first initiative-DESC and the POSTed mirror walks in that same order', async () => {
        vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: SHUFFLED });
        await act(async () => {
            render(<Initiative {...mountProps()} />);
        });
        await waitFor(() => {
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.anything(), 'test-campaign');
        });

        // 1. The card row draws in the board-law order (away Bo LAST despite init 25).
        expect(drawnCards()).toEqual(RENDER_ORDER);

        // 2. The mirror POSTed to the server is the SAME array order (the adoption-
        //    side echo and every later walker read see one order, not two).
        const boardWrites = storage.set.mock.calls.filter(([key]) => key === 'combatSummary');
        const mirror = boardWrites[boardWrites.length - 1][1];
        expect(mirror.creatures.map(c => c.name)).toEqual(RENDER_ORDER);

        // 3. The REAL Next-walk over that mirror visits exactly the drawn order,
        //    left-to-right, wrap included (away Bo never visited).
        const visits = [];
        let active = 'EvasiveFighter';
        for (let i = 0; i < WALK_ORDER.length; i++) {
            const step = getNextCreatureName(mirror, active);
            visits.push(step.newActiveName);
            active = step.newActiveName;
        }
        expect(visits).toEqual([...WALK_ORDER.slice(1), 'EvasiveFighter']);
    });
});
