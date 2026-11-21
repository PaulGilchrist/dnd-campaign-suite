// @maintained-by-ai
// createCreatureHandlers.handleQuickSpawnMonster (roadmap Item 4) — the
// tracker-side mirror of an ACCEPTED quick spawn. The board bytes themselves
// are the shared join lane's contract (quickMonsterSpawn.test.js + the
// encounterToInitiative suite), so this file mocks that service at its
// boundary and owns only what THIS handler can prove: ack-then-publish (the
// local board/pointer state adopt the RETURNED summary, never a pre-ack
// guess), per-row art resolution for freshly joined monsters, honest toasts
// both ways, and a failed spawn leaving the local mirror pristine.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { quickSpawnMonster } from '../../services/encounters/quickMonsterSpawn.js';
import { getMonsterImageUrl } from '../../services/npcs/monsterUtils.js';

vi.mock('../../services/ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(),
    sendDeathSavePrompt: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(() => null),
    getActiveCreatureName: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/encounters/quickMonsterSpawn.js', () => ({
    quickSpawnMonster: vi.fn(),
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({
    getMonsterImageUrl: vi.fn(async (name) => (name.startsWith('Goblin') ? `art/${name}.jpg` : null)),
    getMonsterData: vi.fn(async () => null),
}));
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    maybeGrantThiefsReflexesSecondTurn: vi.fn(),
}));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({
    vanishSummonAtZeroHp: vi.fn(),
}));
vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({
    breakHypnoticPatternOnDamage: vi.fn(() => false),
}));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({
    sweepNewCombatClocks: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const GOBLIN = { index: 'goblin', name: 'Goblin' };

const alice = () => ({ name: 'Alice', type: 'player', initiative: '', targetName: null, concentration: null });

function makeTab(over = {}) {
    const setCombatSummary = vi.fn();
    const setActiveCreatureName = vi.fn();
    const setNpcImages = vi.fn();
    const showToast = vi.fn();
    const handlers = createCreatureHandlers({
        combatSummary: { round: 1, creatures: [alice()] },
        campaignName,
        campaignNpcs: [{ name: 'Custom Beast' }],
        setNpcImages,
        overlays: [],
        setCombatSummary,
        setActiveCreatureName,
        characters: [{ name: 'Alice' }],
        isLocalhost: true,
        showToast,
        ...over,
    });
    return { handlers, setCombatSummary, setActiveCreatureName, setNpcImages, showToast };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('handleQuickSpawnMonster', () => {
    it('publishes the accepted board + top-row pointer, resolves art per joined row, and reports success', async () => {
        const spawned = { round: 1, creatures: [
            { name: 'Goblin 1', type: 'npc', initiative: '16', ac: 15, maxHp: 7, currentHp: 7 },
            alice(),
            { name: 'Goblin 2', type: 'npc', initiative: '8', ac: 15, maxHp: 7, currentHp: 7 },
        ] };
        quickSpawnMonster.mockResolvedValue(spawned);
        const tab = makeTab();

        const ok = await tab.handlers.handleQuickSpawnMonster(GOBLIN, 2);

        expect(ok).toBe(true);
        expect(quickSpawnMonster).toHaveBeenCalledWith(GOBLIN, 2, [{ name: 'Alice' }], campaignName, { placeToken: false });
        // Ack-then-publish: the RETURNED board is mirrored (cloned, not aliased).
        expect(tab.setCombatSummary).toHaveBeenCalledWith(spawned);
        expect(tab.setCombatSummary.mock.calls[0][0]).not.toBe(spawned);
        expect(tab.setActiveCreatureName).toHaveBeenCalledWith('Goblin 1');
        // Art census: exactly the freshly joined rows, through the shared
        // bestiary-image lane (campaign NPCs passed for the local-avatar override).
        expect(getMonsterImageUrl).toHaveBeenCalledTimes(2);
        expect(getMonsterImageUrl).toHaveBeenCalledWith('Goblin 1', [{ name: 'Custom Beast' }], campaignName);
        expect(tab.setNpcImages).toHaveBeenCalledWith(expect.any(Function));
        const images = tab.setNpcImages.mock.calls[0][0]({ 'Old': 'keep.jpg' });
        expect(images).toEqual({ 'Old': 'keep.jpg', 'Goblin 1': 'art/Goblin 1.jpg', 'Goblin 2': 'art/Goblin 2.jpg' });
        expect(tab.showToast).toHaveBeenCalledWith('2× Goblin joined initiative');
    });

    it('a rejected/failed spawn toasts honestly, returns false, and touches no local state', async () => {
        quickSpawnMonster.mockRejectedValue(new Error('board write failed'));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const tab = makeTab();

        const ok = await tab.handlers.handleQuickSpawnMonster(GOBLIN, 3);

        expect(ok).toBe(false);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('quick monster spawn failed'), expect.any(Error));
        expect(tab.showToast).toHaveBeenCalledWith('Failed to spawn 3× Goblin', true);
        expect(tab.setCombatSummary).not.toHaveBeenCalled();
        expect(tab.setActiveCreatureName).not.toHaveBeenCalled();
        expect(tab.setNpcImages).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('sanitizes the quantity (floor 1, non-numeric ⇒ 1) before crossing the service boundary', async () => {
        quickSpawnMonster.mockResolvedValue({ round: 1, creatures: [alice()] });
        const tab = makeTab();

        await tab.handlers.handleQuickSpawnMonster(GOBLIN, '0');
        expect(quickSpawnMonster).toHaveBeenLastCalledWith(GOBLIN, 1, [{ name: 'Alice' }], campaignName, { placeToken: false });

        await tab.handlers.handleQuickSpawnMonster(GOBLIN, 'seven');
        expect(quickSpawnMonster).toHaveBeenLastCalledWith(GOBLIN, 1, [{ name: 'Alice' }], campaignName, { placeToken: false });

        await tab.handlers.handleQuickSpawnMonster(GOBLIN, 5);
        expect(quickSpawnMonster).toHaveBeenLastCalledWith(GOBLIN, 5, [{ name: 'Alice' }], campaignName, { placeToken: false });
    });

    it('forwards the picker\'s map-token opt-in to the service (normalized to a boolean)', async () => {
        quickSpawnMonster.mockResolvedValue({ round: 1, creatures: [alice()] });
        const tab = makeTab();

        await tab.handlers.handleQuickSpawnMonster(GOBLIN, 1, { placeToken: true });
        expect(quickSpawnMonster).toHaveBeenLastCalledWith(GOBLIN, 1, [{ name: 'Alice' }], campaignName, { placeToken: true });

        await tab.handlers.handleQuickSpawnMonster(GOBLIN, 1, { placeToken: 'truthy' });
        expect(quickSpawnMonster).toHaveBeenLastCalledWith(GOBLIN, 1, [{ name: 'Alice' }], campaignName, { placeToken: true });

        await tab.handlers.handleQuickSpawnMonster(GOBLIN, 1, {});
        expect(quickSpawnMonster).toHaveBeenLastCalledWith(GOBLIN, 1, [{ name: 'Alice' }], campaignName, { placeToken: false });
    });

    it('with no mounted board it never calls the lane (same guard family as +NPC)', async () => {
        const tab = makeTab({ combatSummary: null });

        const ok = await tab.handlers.handleQuickSpawnMonster(GOBLIN, 1);

        expect(ok).toBe(false);
        expect(quickSpawnMonster).not.toHaveBeenCalled();
    });

    it('survives an art-resolution failure — the accepted spawn is still published', async () => {
        quickSpawnMonster.mockResolvedValue({ round: 1, creatures: [
            { name: 'Goblin 1', type: 'npc', initiative: '12', maxHp: 7, currentHp: 7 },
            alice(),
        ] });
        getMonsterImageUrl.mockRejectedValue(new Error('image fetch failed'));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const tab = makeTab();

        const ok = await tab.handlers.handleQuickSpawnMonster(GOBLIN, 1);

        expect(ok).toBe(true);
        expect(tab.setCombatSummary).toHaveBeenCalled();
        expect(tab.setNpcImages).not.toHaveBeenCalled();
        expect(tab.showToast).toHaveBeenCalledWith('1× Goblin joined initiative');
        errorSpy.mockRestore();
    });

    it('clone-at-ack: the prop mirror is never mutated before the service returns', async () => {
        const mirror = { round: 1, creatures: [alice()] };
        const snapshot = cloneDeep(mirror);
        quickSpawnMonster.mockImplementation(async () => {
            // While the write is in flight the local mirror is byte-pristine.
            expect(mirror).toEqual(snapshot);
            return { round: 1, creatures: [
                alice(),
                { name: 'Goblin 1', type: 'npc', initiative: '9', maxHp: 7, currentHp: 7 },
            ] };
        });
        const tab = makeTab({ combatSummary: mirror });

        await tab.handlers.handleQuickSpawnMonster(GOBLIN, 1);

        expect(mirror).toEqual(snapshot);
    });
});
