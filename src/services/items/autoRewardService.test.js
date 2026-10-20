// @maintained-by-ai
// P4-c (§10.3) auto-rewards lane — owns ONLY the Clear-Combat contract:
// enforcement gate, kills-only refusals, floor(total/party) XP split through
// the runtime 'xp' lane, exact audit logs. Loot GENERATION is owned by the
// sibling lanes below — cited here, never re-driven (#1072 engine-cite).
//
// items-family split map (#976 adjudication):
//   lootGenerator.test.js        — pure helpers (currency, XP sum, tiers)
//   lootFromCombatSummary.test.js— base lane: generator over a roster (summons, XP agg)
//   lootSuggestions.test.js      — CR-tier suggestion generator ticket
//   autoRewardService.test.js    — THIS: gate + refusals + awarding + audit
//
// old->new map:
//   OFF zero-writes            -> refusals table rows "autoRewards off" (STRENGTHENED:
//                                  real enforcement shapes via resolveEnforcement merge;
//                                  old { mode:'off' } never exercised the gate — `mode`
//                                  is not consumed; also covers default-OFF, #959)
//   kills pay split XP         -> flagship award (STRENGTHENED: floor 55/2=27,
//                                  store-miss `|| 0`, exact logs #app-mandate,
//                                  campaign tuples #932/#1010)
//   retreat silence            -> refusals table row "npc survives"
//   generator sees fallen only -> flagship award mixed roster (STRENGTHENED: adds
//                  alive npc + no-hp npc; `currentHp ?? maxHp ?? 1` reaches branch #1035)
//   no campaign no-op          -> refusals table row "missing campaign/combat"
//   NEW: party-less degenerate #945, "No loot" sentinel branch, log transport failure.
// No timers: rewards are gesture-fired, never clock-driven (#app MANDATORY).
const store = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((who, key) => store[`${who}::${key}`] ?? null),
    setRuntimeValue: vi.fn(async (who, key, value) => { store[`${who}::${key}`] = value; }),
}));
const logs = [];
vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn(async (_campaign, entry) => { logs.push(entry); }),
}));
// Faithful to the real generator's shape ({ lootEntries, totalEncounterXp },
// real sentinel 'No loot for these monsters' — lootGenerator.js:327). XP per
// kill is 55 so the split exercises floor() rather than clean division.
const LOOT = (summary) => {
    const n = (summary.creatures || []).length;
    return {
        lootEntries: n > 0 ? ['a pouch of 25 gp'] : ['No loot for these monsters'],
        totalEncounterXp: n * 55,
    };
};
const lootCalls = [];
vi.mock('./lootGenerator.js', () => ({
    generateLootFromCombatSummary: vi.fn(async (summary) => {
        lootCalls.push(summary);
        return LOOT(summary);
    }),
}));

import { autoAwardCombatRewards } from './autoRewardService.js';
import { generateLootFromCombatSummary } from './lootGenerator.js';
import { addEntry } from '../ui/logService.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const CN = 'test-campaign';
const PARTY = [{ name: 'FeyRanger' }, { name: 'HexWarlock' }];
const npc = (name, hp) => ({ name, type: 'npc', monsterIndex: 'goblin', ...(hp === undefined ? {} : { currentHp: hp, maxHp: 7 }) });
const SUMMARY = (creatures) => ({ round: 3, creatures: [{ name: 'FeyRanger', type: 'player' }, { name: 'HexWarlock', type: 'player' }, ...creatures] });

beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    logs.length = 0;
    lootCalls.length = 0;
    vi.mocked(generateLootFromCombatSummary).mockClear().mockImplementation(async (s) => { lootCalls.push(s); return LOOT(s); });
    vi.mocked(addEntry).mockClear().mockImplementation(async (_c, e) => { logs.push(e); });
    vi.mocked(setRuntimeValue).mockClear();
});
afterEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    logs.length = 0;
    lootCalls.length = 0;
    vi.clearAllMocks(); // keep factory impls; scrub calls only (#1007 intent)
});

describe('refusals — zero loot-gen, zero writes, zero logs (#1026/#1095 census)', () => {
    it.each([
        ['missing campaign', null, SUMMARY([npc('Goblin 1', 0)]), { autoRewards: true }, 'no campaign/combat'],
        ['missing combat', CN, null, { autoRewards: true }, 'no campaign/combat'],
        ['enforcement absent — default OFF is the mandate', CN, SUMMARY([npc('Goblin 1', 0)]), undefined, 'autoRewards off'],
        ['autoRewards explicitly off', CN, SUMMARY([npc('Goblin 1', 0)]), { autoRewards: false }, 'autoRewards off'],
        ['autoEncounters on but autoRewards untouched — still OFF', CN, SUMMARY([npc('Goblin 1', 0)]), { autoEncounters: true }, 'autoRewards off'],
        ['retreat — npc survives ⇒ the party is paid nothing', CN, SUMMARY([npc('Goblin 1', 5)]), { autoRewards: true }, 'no defeated npcs on the tracker'],
        ['players-only tracker has no kills', CN, SUMMARY([]), { autoRewards: true }, 'no defeated npcs on the tracker'],
        ['npc with no HP fields defaults to alive, not a kill', CN, SUMMARY([npc('Mystery', undefined)]), { autoRewards: true }, 'no defeated npcs on the tracker'],
    ])('%# — %s', async (_title, campaignName, combatSummary, enforcement, reason) => {
        if (enforcement !== undefined) store['campaign::enforcement'] = enforcement;
        const r = await autoAwardCombatRewards({ campaignName, combatSummary, characters: PARTY });
        expect(r).toEqual({ awarded: false, reason });
        expect(generateLootFromCombatSummary).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(lootCalls).toHaveLength(0);
    });
});

describe('autoRewards ON — award lane', () => {
    beforeEach(() => { store['campaign::enforcement'] = { autoRewards: true }; });

    it('mixed roster: only kills reach the generator; floor split lands on runtime xp with exact logs', async () => {
        store['FeyRanger::xp'] = 100; // accumulate; HexWarlock store-miss covers `|| 0`
        const summary = SUMMARY([npc('Goblin 1', 0), npc('Orc 1', 5), npc('Mystery', undefined)]);

        const r = await autoAwardCombatRewards({ campaignName: CN, combatSummary: summary, characters: PARTY });

        expect(r).toEqual({ awarded: true, xpPerChar: 27 }); // floor(55 / 2), manual-Award semantics
        // kills-only roster forwarded verbatim: 1 fallen goblin, round preserved
        expect(lootCalls).toEqual([{ round: 3, creatures: [summary.creatures[2]] }]);
        // campaign-keyed store tuples (#932/#1010), consumed-in-order (#1076)
        expect(setRuntimeValue.mock.calls).toEqual([
            ['FeyRanger', 'xp', 127, CN],
            ['HexWarlock', 'xp', 27, CN],
        ]);
        expect(addEntry.mock.calls.every(([c]) => c === CN)).toBe(true);
        // exact toBe-log payloads (#app mandate): loot, encounter, audit
        expect(logs).toEqual([
            { type: 'loot', encounterName: 'Combat', lootItems: ['a pouch of 25 gp'], xpPerChar: 27, totalEncounterXp: 55 },
            { type: 'encounter', action: 'loot_awarded', encounterName: 'Combat', xpPerChar: 27, totalEncounterXp: 55, lootItems: ['a pouch of 25 gp'], auto: true },
            { type: 'automation', automationType: 'auto_rewards_awarded', description: 'Auto-rewards at combat close: 27 XP each to 2 characters (encounter 55 XP, 1 loot item).' },
        ]);
    });

    it('kills with an empty party: full XP per-char guard, zero character writes (#945 honest degenerate)', async () => {
        const r = await autoAwardCombatRewards({ campaignName: CN, combatSummary: SUMMARY([npc('Goblin 1', 0)]), characters: [] });

        expect(r).toEqual({ awarded: true, xpPerChar: 55 }); // numChars guard: 55 / 1
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(logs).toHaveLength(3);
        expect(logs[2].description).toBe('Auto-rewards at combat close: 55 XP each to 0 characters (encounter 55 XP, 1 loot item).');
    });

    it('lootless kill: "No loot" sentinel is never logged as a drop, XP still pays', async () => {
        vi.mocked(generateLootFromCombatSummary).mockImplementation(async (s) => {
            lootCalls.push(s);
            return { lootEntries: ['No loot for these monsters'], totalEncounterXp: 55 };
        });

        const r = await autoAwardCombatRewards({ campaignName: CN, combatSummary: SUMMARY([npc('Goblin 1', 0)]), characters: PARTY });

        expect(r).toEqual({ awarded: true, xpPerChar: 27 });
        expect(logs.some((l) => l.type === 'loot')).toBe(false); // sentinel filtered pre-log
        expect(logs).toHaveLength(2);
        expect(logs[0]).toEqual({ type: 'encounter', action: 'loot_awarded', encounterName: 'Combat', xpPerChar: 27, totalEncounterXp: 55, lootItems: [], auto: true });
        expect(logs[1].description).toBe('Auto-rewards at combat close: 27 XP each to 2 characters (encounter 55 XP, 0 loot items).');
    });

    it('log transport down: all three addEntry failures are caught — XP still awarded', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(addEntry).mockRejectedValue(new Error('log transport down'));

        const r = await autoAwardCombatRewards({ campaignName: CN, combatSummary: SUMMARY([npc('Goblin 1', 0)]), characters: PARTY });

        expect(r).toEqual({ awarded: true, xpPerChar: 27 });
        expect(setRuntimeValue.mock.calls).toEqual([['FeyRanger', 'xp', 27, CN], ['HexWarlock', 'xp', 27, CN]]);
        expect(errSpy).toHaveBeenCalledTimes(3); // loot, encounter, audit all loud
    });
});
