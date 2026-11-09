// @maintained-by-ai
// FW 2026-11-09 improve — mount-time turn-pointer resolution. A fresh campaign-select +
// Initiative mount used to (a) let mergeCombatSummaryWithCharacters DISCARD the seeded
// combatSummary.activeCreatureName (the mount POST then wiped it from the server mirror)
// and (b) resolve the highlight from the per-client cached fallback (getActiveCreatureName)
// BEFORE any cs-derived value. Law pinned here: the mount prefers the MERGED summary's own
// surviving pointer; the cached fallback → first-creature chain stays intact when the
// pointer is absent or dangles. The REAL merge is used (initiativeService is deliberately
// NOT mocked) so the eviction legs are exercised end-to-end. Mock block mirrors
// Initiative.zero-creature-mount.test.jsx.
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

const characters = [{ name: 'Ann' }, { name: 'Bob' }, { name: 'Zoe' }];

const playerByte = (name, init) => ({
    name,
    type: 'player',
    initiative: String(init),
    targetName: null,
    concentration: null,
});

const mountProps = () => ({
    characters,
    campaignName: 'test-campaign',
    onNpcsChange: vi.fn(),
    mapName: null,
    isLocalhost: true,
});

const activeCards = () => Array.from(
    document.querySelectorAll('[data-testid^="creature-card-"][data-active="true"]')
).map(el => el.getAttribute('data-testid').replace('creature-card-', ''));

describe('Initiative mount turn-pointer resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
        vi.mocked(getActiveCreatureName).mockReturnValue(null);
    });

    const mountWith = async (summary) => {
        vi.mocked(loadCombatSummary).mockResolvedValue(summary);
        await act(async () => {
            render(<Initiative {...mountProps()} />);
        });
        await waitFor(() => {
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.anything(), 'test-campaign');
        });
    };

    it('prefers the merged summary surviving activeCreatureName over a stale cached fallback', async () => {
        // Seeded board: Bob (init 10) is NOT the first row (Ann init 20 sorts first) and
        // the per-client fallback (getActiveCreatureName cache) still holds 'Ann'.
        vi.mocked(getActiveCreatureName).mockReturnValue('Ann');
        await mountWith({
            round: 1,
            activeCreatureName: 'Bob',
            creatures: [playerByte('Ann', 20), playerByte('Bob', 10)],
        });

        expect(activeCards()).toEqual(['Bob']);
        // Server-first: the GM mount POST carries the preserved pointer, so the mirror
        // is no longer wiped by the merge.
        const boardWrites = storage.set.mock.calls.filter(([key]) => key === 'combatSummary');
        expect(boardWrites[boardWrites.length - 1][1]).toMatchObject({ activeCreatureName: 'Bob' });
    });

    it('keeps a surviving (Second Turn) pointer row highlighted through the mount merge', async () => {
        vi.mocked(getActiveCreatureName).mockReturnValue('Ann');
        await mountWith({
            round: 1,
            activeCreatureName: 'Ann (Second Turn)',
            creatures: [
                playerByte('Ann', 20),
                { ...playerByte('Ann (Second Turn)', 10), secondTurn: true, holderName: 'Ann' },
            ],
        });

        expect(activeCards()).toEqual(['Ann (Second Turn)']);
    });

    it('falls back to the cached getActiveCreatureName when the merged pointer is absent', async () => {
        // Current behavior preserved: no baked pointer on the cs → the per-client value wins.
        vi.mocked(getActiveCreatureName).mockReturnValue('Bob');
        await mountWith({
            round: 1,
            creatures: [playerByte('Ann', 20), playerByte('Bob', 10)],
        });

        expect(activeCards()).toEqual(['Bob']);
    });

    it('falls back to the cached value (then first creature) when the pointer dangles (row evicted)', async () => {
        // 'OldPlayer' names a ghost row the REAL merge evicts; the chain continues.
        await mountWith({
            round: 1,
            activeCreatureName: 'OldPlayer',
            creatures: [playerByte('Ann', 20), playerByte('OldPlayer', 8)],
        });

        // No cached fallback (mock returns null) → first surviving creature wins.
        expect(activeCards()).toEqual(['Ann']);
        const boardWrites = storage.set.mock.calls.filter(([key]) => key === 'combatSummary');
        expect(boardWrites[boardWrites.length - 1][1]).not.toHaveProperty('activeCreatureName');
    });

    it('evicted dangling pointer with a cached fallback highlights the cached name', async () => {
        vi.mocked(getActiveCreatureName).mockReturnValue('Zoe');
        await mountWith({
            round: 1,
            activeCreatureName: 'OldPlayer',
            creatures: [playerByte('Ann', 20), playerByte('OldPlayer', 8)],
        });

        expect(activeCards()).toEqual(['Zoe']);
    });
});
