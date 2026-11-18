// @maintained-by-ai
// Regression (bug-round-reuse-after-clear-drops-once-per-turn-riders): the
// once-per-turn latches stamp the BARE combatSummary.round number, and the
// round-wrap re-arm only ever expires a stamp via the `currentRound > stamp`
// comparison — the stamp itself survives. Initiative "Clear" RESETS the round
// to 1 (CLA-100 new-combat seam), so a leftover `{round:1}` stamp ALIASES the
// new combat's first round and checkOncePerTurnWithSkip silently drops the
// rider (Shield Bash prompt / Charge chooser never arm, zero rows). These pins
// replay that exact fingerprint against an in-memory store fake, and lock the
// clearCombatLatches eviction that fixes it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory runtime-store fake so the REAL latch functions (setSkipFlag →
// checkOncePerTurnWithSkip → clearCombatLatches) run end-to-end.
const { stores } = vi.hoisted(() => ({ stores: new Map() }));
function storeOf(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
}

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key) => {
        const value = storeOf(name).get(key);
        return value === undefined ? null : value;
    }),
    setRuntimeValue: vi.fn((name, key, value) => { storeOf(name).set(key, value); }),
    // Real-behavior fake of the merged-write lane clearCombatLatches uses:
    // one call mirrors ALL properties of one creature in a single write.
    setRuntimeBatch: vi.fn((name, properties) => {
        for (const [key, value] of Object.entries(properties)) storeOf(name).set(key, value);
    }),
    getRuntimeKeysByPrefix: vi.fn((name, prefix) =>
        Array.from(storeOf(name).keys()).filter((key) => key.startsWith(prefix))),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

import {
    checkOncePerTurn,
    checkOncePerTurnWithSkip,
    markOncePerTurn,
    setSkipFlag,
    clearCombatLatches,
} from './oncePerTurn.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'test-campaign';
const HOLDER = { name: 'EvasiveFighter' };

function mockRound(round) {
    damageUtils.getCombatContext.mockResolvedValue({ round, activeCreatureName: HOLDER.name });
}

beforeEach(() => {
    vi.clearAllMocks();
    stores.clear();
});

describe('clearCombatLatches — round-reuse-after-Clear regression', () => {
    it('replays the bug fingerprint: a skip stamp from the old combat suppresses in the NEW combat round 1 until the seam evicts it', async () => {
        // Old combat, round 1: Charge chooser Cancel stamps the skip latch…
        mockRound(1);
        await setSkipFlag('_Charge_Attack_skippedRound', HOLDER, CAMPAIGN);

        // …and suppression WITHIN the stamped round is correct by design.
        const inRound = await checkOncePerTurnWithSkip('Charge Attack', '_Charge_Attack_usedRound', '_Charge_Attack_skippedRound', HOLDER, CAMPAIGN);
        expect(inRound?.payload?.description).toContain('was not used this turn');

        // Clear resets combatSummary.round back to 1 — the collision that
        // SILENTLY dropped the rider pre-fix (still blocks with the stamp left).
        mockRound(1);
        const collided = await checkOncePerTurnWithSkip('Charge Attack', '_Charge_Attack_usedRound', '_Charge_Attack_skippedRound', HOLDER, CAMPAIGN);
        expect(collided).not.toBeNull();

        // The Clear seam evicts the closing board's latches → round-1 re-arms.
        expect(clearCombatLatches(CAMPAIGN, [HOLDER.name])).toBe(1);
        const rearmed = await checkOncePerTurnWithSkip('Charge Attack', '_Charge_Attack_usedRound', '_Charge_Attack_skippedRound', HOLDER, CAMPAIGN);
        expect(rearmed).toBeNull();
    });

    it('evicts a usedRound stamp so the Shield Bash-style gate re-arms in the new combat round 1', async () => {
        mockRound(1);
        await markOncePerTurn('Shield Bash', '_Shield_Bash_usedRound', HOLDER, CAMPAIGN);
        expect(await checkOncePerTurn('Shield Bash', '_Shield_Bash_usedRound', HOLDER.name, CAMPAIGN)).not.toBeNull();

        clearCombatLatches(CAMPAIGN, [HOLDER.name]);

        expect(storeOf(HOLDER.name).get('_Shield_Bash_usedRound')).toBeNull();
        expect(await checkOncePerTurn('Shield Bash', '_Shield_Bash_usedRound', HOLDER.name, CAMPAIGN)).toBeNull();
    });

    it('evicts the whole round-stamp family across players AND monster names, case-insensitively', () => {
        storeOf('EvasiveFighter').set('_Shield_Bash_usedRound', { round: 3, activeCreature: 'EvasiveFighter' });
        storeOf('EvasiveFighter').set('_Charge_Attack_skippedRound', { round: 3, activeCreature: 'EvasiveFighter' });
        storeOf('EvasiveFighter').set('_Cleave_UsedRound', 3);
        storeOf('EvasiveFighter').set('_cunningStrikeSkippedRound', { round: 3, activeCreature: 'EvasiveFighter' });
        storeOf('EvasiveFighter').set('actionSurgeUsedThisRound', 3);
        storeOf('EvasiveFighter').set('_PsychicBlade_attack_round', 3);
        // Dynamically named rider latch on a MONSTER name (re-joined same-named
        // monster re-collides on the reset round).
        storeOf('Goblin').set('_Shield_Bash_usedRound', { round: 1, activeCreature: 'Goblin' });

        const cleared = clearCombatLatches(CAMPAIGN, ['EvasiveFighter', 'Goblin']);

        expect(cleared).toBe(7);
        for (const key of ['_Shield_Bash_usedRound', '_Charge_Attack_skippedRound', '_Cleave_UsedRound', '_cunningStrikeSkippedRound', 'actionSurgeUsedThisRound', '_PsychicBlade_attack_round']) {
            expect(storeOf('EvasiveFighter').get(key)).toBeNull();
        }
        expect(storeOf('Goblin').get('_Shield_Bash_usedRound')).toBeNull();
        // One merged write per creature — Goblin's single latch travels in ONE
        // batch body (never a per-key POST lane that could self-interleave).
        expect(runtimeState.setRuntimeBatch).toHaveBeenCalledTimes(2);
        expect(runtimeState.setRuntimeBatch).toHaveBeenCalledWith('Goblin', { _Shield_Bash_usedRound: null }, CAMPAIGN);
        expect(runtimeState.setRuntimeBatch).toHaveBeenCalledWith('EvasiveFighter', {
            _Shield_Bash_usedRound: null,
            _Charge_Attack_skippedRound: null,
            _Cleave_UsedRound: null,
            _cunningStrikeSkippedRound: null,
            actionSurgeUsedThisRound: null,
            _PsychicBlade_attack_round: null,
        }, CAMPAIGN);
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('leaves non-round-stamp keys byte-untouched (booleans and markers re-arm on their own seams)', () => {
        const keep = {
            currentHitPoints: 10,
            activeConditions: ['prone'],
            dreadAmbushSpeedActive: true,
            _radiantSoul_EvasiveFighter_oncePerTurn: true,
            _shieldBashBaseAttack: { attackerName: 'EvasiveFighter' },
            _recklessAttack_offeredThisTurn: { round: 1, activeCreature: 'EvasiveFighter' },
        };
        for (const [key, value] of Object.entries(keep)) storeOf('EvasiveFighter').set(key, value);
        storeOf('EvasiveFighter').set('_SneakAttack_usedRound', 1);

        expect(clearCombatLatches(CAMPAIGN, ['EvasiveFighter'])).toBe(1);

        for (const [key, value] of Object.entries(keep)) {
            expect(storeOf('EvasiveFighter').get(key)).toEqual(value);
        }
    });

    it('logs one audit row only when latches were actually evicted', async () => {
        // Nothing stamped ⇒ zero writes, zero rows (byte-identical Clear).
        expect(clearCombatLatches(CAMPAIGN, ['EvasiveFighter', 'Goblin'])).toBe(0);
        expect(runtimeState.setRuntimeBatch).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();

        storeOf('EvasiveFighter').set('_Shield_Bash_usedRound', { round: 1, activeCreature: 'EvasiveFighter' });
        storeOf('EvasiveFighter').set('_Charge_Attack_skippedRound', { round: 1, activeCreature: 'EvasiveFighter' });
        expect(clearCombatLatches(CAMPAIGN, ['EvasiveFighter'])).toBe(2);

        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls[0][0]).toBe(CAMPAIGN);
        expect(addEntry.mock.calls[0][1]).toMatchObject({
            type: 'automation',
            automationType: 'new_combat_latch_reset',
            description: 'Combat board cleared: 2 once-per-turn latches from the previous combat evicted.',
        });
    });

    it('tolerates empty/invalid rosters without writing', () => {
        expect(clearCombatLatches(CAMPAIGN, undefined)).toBe(0);
        expect(clearCombatLatches(CAMPAIGN, [null, ''])).toBe(0);
        expect(clearCombatLatches(null, ['EvasiveFighter'])).toBe(0);
        expect(runtimeState.setRuntimeBatch).not.toHaveBeenCalled();
    });
});
