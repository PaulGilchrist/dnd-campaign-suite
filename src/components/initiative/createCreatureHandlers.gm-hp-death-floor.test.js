// @maintained-by-ai
// Regression lane for bug-gm-hp-input-negative-player-hp: the GM HP input on a PLAYER
// card used to (a) persist negative commits straight into the canonical runtime key
// currentHitPoints (e.g. −50), (b) log a self-contradicting hp_change row — threshold
// 'dead' but isUnconscious:false (the !isPlayer exclusion) — and (c) skip the death-save
// adjudication the whole combat pipeline depends on (no prompt on a drop to 0).
// Pins the fixed contract, mirroring the damage lane (applyDamage :473/:491 death floor,
// logDamageApplication isUnconscious:isDead, handlePlayerZeroHpAndConcentration prompt):
//   - player commits floor at 0 (the ceiling stays unclamped — temp-HP overshoot is
//     legitimate sheet state; the ceiling pins live in hp-clamp.test.js)
//   - player rows carry isUnconscious:true whenever currentHp <= 0
//   - an alive→down GM override engages the death-save lane: fresh counter reset +
//     sendDeathSavePrompt keyed to the target
//   - down→down (floor no-op) never re-prompts; revival across 0 still clears the prompt
//   - monster lane controls: clamp + dead row unchanged, and monsters never get a
//     death-save prompt (currentHp <= 0 IS the monster death model)
// Mock set mirrors createCreatureHandlers.hp-clamp.test.js (+ sendDeathSavePrompt).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { addEntry } from '../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { clearDeathSavePrompt, sendDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js';

vi.mock('../../services/ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(),
    sendDeathSavePrompt: vi.fn(),
}));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    clearCombat: vi.fn(),
    setInitiative: vi.fn(),
    renameNpc: vi.fn(),
    setTarget: vi.fn(),
    removeNpc: vi.fn(),
    addNpc: vi.fn(),
    // createCreatureHandlers imports the shared PC-merge used by the guarded
    // +NPC lane (bug-initiative-concurrent-npc-spawn-lost-update) — the death-floor
    // lanes below never reach it, but the module mock must carry the export.
    mergeCombatSummaryWithCharacters: vi.fn((summary) => summary),
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
const CLEARED = [false, false, false];

function makeHandlers(creatures) {
    const combatSummary = { round: 1, creatures };
    const handlers = createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [],
        setCombatSummary: vi.fn(),
        setActiveCreatureName: vi.fn(),
        characters: [],
        numOfNpc: 0,
        isLocalhost: true,
    });
    return { handlers, combatSummary };
}

const hpEntry = () => addEntry.mock.calls.find((c) => c[1]?.type === 'hp_change')?.[1];
const hpWrites = () => setRuntimeValue.mock.calls.filter((c) => c[1] === 'currentHitPoints').map((c) => c[2]);

// AasimarTest-sized PC: runtime 143/143.
function playerAt(hp) {
    getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return hp;
        if (prop === 'hitPoints') return 143;
        return null;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    playerAt(143);
});

describe('handleCreatureHpChange — player death floor (bug-gm-hp-input-negative-player-hp)', () => {
    it('negative commit floors at 0 — the canonical key never sees a negative', () => {
        const { handlers } = makeHandlers([{ name: 'AasimarTest', type: 'player', currentHp: 143, maxHp: 143 }]);

        handlers.handleCreatureHpChange('AasimarTest', -50);

        expect(setRuntimeValue).toHaveBeenCalledWith('AasimarTest', 'currentHitPoints', 0, campaignName);
        expect(hpWrites()).toEqual([0]);
    });

    it('the flopped row is coherent: dead threshold AND isUnconscious:true (damage-lane byte)', () => {
        const { handlers } = makeHandlers([{ name: 'AasimarTest', type: 'player', currentHp: 143, maxHp: 143 }]);

        handlers.handleCreatureHpChange('AasimarTest', -50);

        expect(hpEntry()).toMatchObject({
            type: 'hp_change',
            targetName: 'AasimarTest',
            sourceName: 'GM HP override',
            delta: -143,
            currentHp: 0,
            maxHp: 143,
            isHealing: false,
            isUnconscious: true,
            threshold: 'dead',
        });
    });

    it('alive→down override engages the death-save lane: counter reset + prompt', () => {
        const { handlers } = makeHandlers([{ name: 'AasimarTest', type: 'player', currentHp: 143, maxHp: 143 }]);

        handlers.handleCreatureHpChange('AasimarTest', 0);

        expect(setRuntimeValue).toHaveBeenCalledWith('AasimarTest', 'deathSaves', CLEARED, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('AasimarTest', 'deathFailures', CLEARED, campaignName);
        expect(sendDeathSavePrompt).toHaveBeenCalledWith(campaignName, {
            promptId: expect.any(String),
            targetName: 'AasimarTest',
        });
    });

    it('exactly-0 commit from a healthy state behaves identically to the floored negative', () => {
        const { handlers } = makeHandlers([{ name: 'AasimarTest', type: 'player', currentHp: 143, maxHp: 143 }]);

        handlers.handleCreatureHpChange('AasimarTest', 0);

        expect(hpWrites()).toEqual([0]);
        expect(hpEntry()).toMatchObject({ delta: -143, currentHp: 0, threshold: 'dead', isUnconscious: true });
        expect(sendDeathSavePrompt).toHaveBeenCalledTimes(1);
    });

    it('already-down PC: negative floors to a delta-0 silent no-op — never re-prompts', () => {
        playerAt(0);
        const { handlers, combatSummary } = makeHandlers([{ name: 'AasimarTest', type: 'player', currentHp: 0, maxHp: 143 }]);

        handlers.handleCreatureHpChange('AasimarTest', -50);

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(sendDeathSavePrompt).not.toHaveBeenCalled();
        expect(combatSummary.creatures[0].currentHp).toBe(0);
    });

    it('revival across 0 still clears death-save state and the pending prompt, no new prompt', () => {
        playerAt(0);
        const { handlers } = makeHandlers([{ name: 'AasimarTest', type: 'player', currentHp: 0, maxHp: 143 }]);

        handlers.handleCreatureHpChange('AasimarTest', 143);

        expect(setRuntimeValue).toHaveBeenCalledWith('AasimarTest', 'currentHitPoints', 143, campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('AasimarTest', 'isDead', 0, campaignName);
        expect(clearDeathSavePrompt).toHaveBeenCalledWith(campaignName, 'AasimarTest');
        expect(sendDeathSavePrompt).not.toHaveBeenCalled();
        expect(hpEntry()).toMatchObject({ delta: 143, currentHp: 143, isHealing: true, isUnconscious: false });
    });
});

describe('handleCreatureHpChange — monster lane controls (unchanged by this fix)', () => {
    it('monster negative clamps to 0, logs the dead row, and never pays a death-save prompt', () => {
        const { handlers, combatSummary } = makeHandlers([{ name: 'Goblin', type: 'npc', currentHp: 7, maxHp: 7 }]);

        handlers.handleCreatureHpChange('Goblin', -3);

        expect(combatSummary.creatures[0].currentHp).toBe(0);
        expect(hpEntry()).toMatchObject({ delta: -7, currentHp: 0, threshold: 'dead', isUnconscious: true });
        expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    });
});
