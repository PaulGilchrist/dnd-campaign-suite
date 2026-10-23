// @maintained-by-ai
// LANE: createNpcClickHandler.js :22-28 campaign-NPC hit + :22 lookup-miss skips —
// the plain-NPC popup path (no monster twin, no form) and its fall-INTO-fallback seam.
// The chain under test is NOT mocked (#791/#841 discipline): NPC_FORM_HANDLERS runs its
// real matchers against an absent runtimeCreature; dataLoader/monsterUtils are stubbed
// only as a zero-network guard.
// Cite map (siblings own the rest — do not duplicate here):
//   localhost guard truth table (blocked + obeyed)    → createNpcClickHandler-early-return.test.jsx
//   fallback hit + no-statblock no-op                 → createNpcClickHandler-fallback.test.jsx
//   runtime monsterIndex merge bytes + retention      → createNpcClickHandler-monster-path.test.jsx
//   wildshape / polymorph / shapechange form handlers → createNpcClickHandler-{wildshape,polymorph,shapechange}.test.jsx
//   npcToMonsterFormat output bytes                   → src/services/encounters/npcStatBlockUtils.test.js
// Old -> new map:
//   'should format NPC via npcToMonsterFormat and set viewing monster when NPC is found'
//     + 'should perform case-insensitive NPC name matching'
//     → test 1 (consolidated; strengthened: verbatim popup-object identity, exact-once
//        counts, and early-return-before-chain attribution — getCombatSummary/getMonsterData
//       /loadMonsters all untouched on a hit)
//   'should fall through to getMonsterData when npcToMonsterFormat returns null for a found NPC'
//     → test 2 (strengthened: click-name differs in case from the matched npc's name, so
//        the fallback lookup is pinned to the CLICKED bytes, not npc.name; exact-once;
//        real-chain-ran / bestiary-merge-not-taken attribution)
//   'should skip npcToMonsterFormat and fall to getMonsterData when NPC lookup fails
//    (empty list, null name, missing name)' + 'should skip npcToMonsterFormat when
//    creature name is null'
//     → test 3 (consolidated: all four miss shapes assert one fallback-lookup byte
//        sequence; no mid-test clearAllMocks — determinism, #827)
//   #843 (post-map): presence-law hardening at :22/:33 — nameless roster entry must
//     never bind a null/undefined/'' click (pre-fix undefined === undefined HIT).
//     → test 4 (armed: truthy npcToMonsterFormat mock detonates the wrong-NPC popup;
//        RED pre-fix captured 3 calls/null-click+lightweight-row+empty-string corners)
//     → test 5 (positive control: case-folded named match byte-intact beside the guard)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { loadMonsters } from '../../services/ui/dataLoader.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import { npcToMonsterFormat } from '../../services/encounters/npcStatBlockUtils.js';

// Zero-network guard: dataLoader and monsterUtils are stubbed. The real NPC_FORM_HANDLERS
// are NOT mocked (~#841) — they run unharmed here only to prove none of them intercepts
// a plain-NPC click (all matches() are false without a runtimeCreature).
vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(() => Promise.resolve([])),
    fetchRaceData: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(() => Promise.resolve(null)),
}));
// Routing seam only — the formatter's output bytes are pinned in npcStatBlockUtils.test.js.
vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({
    npcToMonsterFormat: vi.fn(() => null),
}));

describe('createNpcClickHandler - NPC stat block path', () => {
    let setViewingMonster;
    let setViewingMonsterCreatureName;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
        vi.mocked(loadMonsters).mockResolvedValue([]);
        vi.mocked(getCombatSummary).mockReturnValue(null);
        vi.mocked(getMonsterData).mockResolvedValue(null);
        vi.mocked(npcToMonsterFormat).mockReturnValue(null);
    });

    const makeHandler = (campaignNpcs) => createNpcClickHandler({
        isLocalhost: true,
        campaignNpcs,
        campaignName: 'test-campaign',
        characters: [], // inert in this lane: no form handler run() executes (#841 discipline)
        setViewingMonster,
        setViewingMonsterCreatureName,
    });

    it('opens the popup with the formatted campaign NPC verbatim, exactly once, and never reaches the chain', async () => {
        const goblinNpc = {
            name: 'Goblin Warrior',
            armorClass: 15,
            hitPoints: 7,
            abilityScores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 8 },
        };
        const formatted = { name: 'Goblin Warrior', armor_class: 15 };
        vi.mocked(npcToMonsterFormat).mockReturnValue(formatted);

        // Click differs in case from the roster entry: pins the case-insensitive find (:22).
        const result = await makeHandler([goblinNpc])({ name: 'GOBLIN WARRIOR' });

        expect(result).toBeUndefined();
        expect(npcToMonsterFormat).toHaveBeenCalledTimes(1);
        expect(npcToMonsterFormat).toHaveBeenCalledWith(goblinNpc);
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        // Verbatim object identity — no merge, no clone, no re-format (#829).
        expect(setViewingMonster.mock.calls[0][0]).toBe(formatted);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        // The popup label is the CLICKED bytes, not the roster's casing.
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('GOBLIN WARRIOR');
        // Early-return attribution (:28): a hit never falls through to the chain or the
        // bestiary fallback — bisect: delete lines 26-28 → red.
        expect(getCombatSummary).not.toHaveBeenCalled();
        expect(loadMonsters).not.toHaveBeenCalled();
        expect(getMonsterData).not.toHaveBeenCalled();
    });

    it('falls INTO the fallback via the real form chain when a matched NPC formats to null, looking up the clicked name', async () => {
        const goblinNpc = { name: 'Goblin Warrior', armorClass: 15 };
        const fallbackMonster = { index: 'goblin', name: 'Goblin' };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        // Click bytes differ in case from the roster: the fallback must be keyed on
        // creature.name (:41/:44), not the matched npc's casing.
        await makeHandler([goblinNpc])({ name: 'goblin warrior' });

        expect(npcToMonsterFormat).toHaveBeenCalledTimes(1);
        expect(npcToMonsterFormat).toHaveBeenCalledWith(goblinNpc);
        // Reached attribution: format-null did NOT early-return (bisect: return at :29
        // unconditionally → red); the click fell through the unmocked matcher loop.
        expect(getCombatSummary).toHaveBeenCalledTimes(1);
        expect(loadMonsters).not.toHaveBeenCalled(); // real matchers: none matched, none ran
        expect(getMonsterData).toHaveBeenCalledTimes(1);
        expect(getMonsterData).toHaveBeenCalledWith('goblin warrior');
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        expect(setViewingMonster.mock.calls[0][0]).toBe(fallbackMonster);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('goblin warrior');
    });

    it('skips npcToMonsterFormat for every lookup miss (empty, nameless, null-named, null-clicked) and reaches the fallback with the clicked bytes', async () => {
        // Every miss shape must: skip the format call, skip form-handler runs, and reach
        // getMonsterData exactly once with the raw click bytes (stub resolves null → silence).
        const misses = [
            [[], 'Goblin'],
            [[{ armorClass: 15, hitPoints: 7 }], 'Goblin'], // NPC with no name property
            [[{ name: null, armorClass: 15 }], 'Goblin'],    // NPC with null name
            [[{ name: 'Goblin', armorClass: 15 }], null],     // null clicked name
        ];
        for (const [campaignNpcs, clickName] of misses) {
            await makeHandler(campaignNpcs)({ name: clickName });
        }

        expect(npcToMonsterFormat).not.toHaveBeenCalled();
        expect(loadMonsters).not.toHaveBeenCalled();
        expect(getCombatSummary).toHaveBeenCalledTimes(misses.length);
        expect(setViewingMonster).not.toHaveBeenCalled();
        expect(setViewingMonsterCreatureName).not.toHaveBeenCalled();
        // One fallback lookup per miss, in order, with the exact clicked bytes (:41).
        expect(getMonsterData.mock.calls.map(call => call[0])).toEqual(['Goblin', 'Goblin', 'Goblin', null]);
    });

    it('refuses undefined===undefined identity: nameless clicks never bind nameless roster entries (#843 presence law)', async () => {
        // fix#39 strict-presence / fix#124 guard-first mirror: identity match requires
        // BOTH sides present. Pre-fix :22 (`n.name?.toLowerCase() === creature.name?.
        // toLowerCase()`) made a nameless roster entry match null/undefined/'' clicks
        // (undefined === undefined hit) — the truthy-format mock below detonates that
        // wrong-NPC popup: RED pre-fix, GREEN post-fix. Skip-at-seam, not short-circuit:
        // the chain still runs and the raw clicked bytes still reach the fallback.
        const namelessNpc = { armorClass: 15, hitPoints: 7 };
        const blankNameNpc = { name: '', armorClass: 15 };
        vi.mocked(npcToMonsterFormat).mockReturnValue({ name: 'WRONG-NPC POPUP' });

        await makeHandler([namelessNpc])({ name: null });
        await makeHandler([namelessNpc])({});          // lightweight row, no name key
        await makeHandler([blankNameNpc])({ name: '' }); // empty-string is not identity

        expect(npcToMonsterFormat).not.toHaveBeenCalled();
        expect(setViewingMonster).not.toHaveBeenCalled();
        expect(setViewingMonsterCreatureName).not.toHaveBeenCalled();
        expect(getMonsterData.mock.calls.map(call => call[0])).toEqual([null, undefined, '']);
    });

    it('named-match lane stays byte-intact beside the presence guard (case-folded exact, both sides present)', async () => {
        // Positive control: the guard must not break the real hit path.
        const namedNpc = { name: 'Marta Copperkettle', armorClass: 15 };
        const formatted = { name: 'Marta Copperkettle' };
        vi.mocked(npcToMonsterFormat).mockReturnValue(formatted);

        await makeHandler([namedNpc, { armorClass: 12 }])({ name: 'marta copperkettle' });

        expect(npcToMonsterFormat).toHaveBeenCalledTimes(1);
        expect(npcToMonsterFormat).toHaveBeenCalledWith(namedNpc); // nameless sibling skipped, not bound
        expect(setViewingMonster.mock.calls[0][0]).toBe(formatted);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('marta copperkettle');
    });
});
