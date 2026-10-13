// P4-c (§10.3): auto-rewards — kills-only XP/loot at combat close, gated
// on enforcement.autoRewards; off ⇒ byte-identical silence.
const store = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((who, key) => store[`${who}::${key}`] ?? null),
    setRuntimeValue: vi.fn(async (who, key, value) => { store[`${who}::${key}`] = value; }),
}));
const logs = [];
vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn(async (c, e) => { logs.push(e); }),
}));
const lootCalls = [];
vi.mock('./lootGenerator.js', () => ({
    generateLootFromCombatSummary: vi.fn(async (summary) => {
        lootCalls.push(summary);
        const n = (summary.creatures || []).length;
        return { lootEntries: n > 0 ? ['a pouch of 25 gp'] : ['No loot for these monsters'], totalEncounterXp: n * 50 };
    }),
}));

import { autoAwardCombatRewards } from './autoRewardService.js';
import { generateLootFromCombatSummary } from './lootGenerator.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const CN = 'test-campaign';
const PARTY = [{ name: 'FeyRanger' }, { name: 'HexWarlock' }];
const SUMMARY = (goblinHp) => ({
    round: 3,
    creatures: [
        { name: 'FeyRanger', type: 'player' },
        { name: 'HexWarlock', type: 'player' },
        { name: 'Goblin 1', type: 'npc', monsterIndex: 'goblin', currentHp: goblinHp, maxHp: 7 },
    ],
});

beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    logs.length = 0;
    lootCalls.length = 0;
    vi.mocked(generateLootFromCombatSummary).mockClear();
    vi.mocked(setRuntimeValue).mockClear();
});

describe('autoRewards OFF (byte parity)', () => {
    it('zero writes at combat close', async () => {
        store['campaign::enforcement'] = { mode: 'off' };
        const r = await autoAwardCombatRewards({ campaignName: CN, combatSummary: SUMMARY(0), characters: PARTY });
        expect(r).toEqual({ awarded: false, reason: 'autoRewards off' });
        expect(generateLootFromCombatSummary).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(logs).toHaveLength(0);
    });
});

describe('autoRewards ON', () => {
    beforeEach(() => { store['campaign::enforcement'] = { mode: 'on', autoRewards: true }; });

    it('defeated NPCs only: kills pay split XP through the runtime xp lane', async () => {
        store['FeyRanger::xp'] = 100;
        store['HexWarlock::xp'] = 0;
        const r = await autoAwardCombatRewards({ campaignName: CN, combatSummary: SUMMARY(0), characters: PARTY });
        expect(r).toEqual({ awarded: true, xpPerChar: 25 }); // 50 encounter / 2 chars
        expect(store['FeyRanger::xp']).toBe(125);
        expect(store['HexWarlock::xp']).toBe(25);
        const audit = logs.find((l) => l.automationType === 'auto_rewards_awarded');
        expect(audit.description).toContain('25 XP each to 2 characters');
        expect(logs.some((l) => l.type === 'encounter' && l.action === 'loot_awarded' && l.auto === true)).toBe(true);
    });

    it('retreat (npc survives) ⇒ silence, no XP, no loot', async () => {
        const r = await autoAwardCombatRewards({ campaignName: CN, combatSummary: SUMMARY(5), characters: PARTY });
        expect(r).toEqual({ awarded: false, reason: 'no defeated npcs on the tracker' });
        expect(generateLootFromCombatSummary).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(logs).toHaveLength(0);
    });

    it('the loot generator sees ONLY the fallen roster', async () => {
        await autoAwardCombatRewards({ campaignName: CN, combatSummary: SUMMARY(0), characters: PARTY });
        expect(lootCalls).toHaveLength(1);
        expect(lootCalls[0].creatures.map((c) => c.name)).toEqual(['Goblin 1']);
    });

    it('no campaign ⇒ no-op', async () => {
        const r = await autoAwardCombatRewards({ campaignName: null, combatSummary: SUMMARY(0), characters: PARTY });
        expect(r.awarded).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
