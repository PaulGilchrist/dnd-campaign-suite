// @maintained-by-ai
// Split-party handler lane (plan initiative-split-party): handleToggleAway /
// handlePartyPresenceChange — localhost gate, the single board write, and the
// per-change party_split / party_rejoined audit rows. Mutation semantics
// (initiative wipe / end-of-round landing / back-parking) are pinned in
// creaturePresence.test.js — this file proves the HANDLER wiring only, plus
// the away-refusal of the initiative-stamp lane (bug-away-card-initiative-
// input-resurrects-slot; the real initiativeService is unmocked here).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), patch: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: n => n, guid: () => 'x' } }));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(), sendDeathSavePrompt: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async () => null), setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(async () => ({})) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(async () => ({})) }));
// creaturePresence.js imports the REAL isSecondTurnEntry predicate (second-turn
// rejoin anchoring) — spread the original module so only the grant stays mocked.
vi.mock('../../services/combat/thiefsReflexesService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    maybeGrantThiefsReflexesSecondTurn: vi.fn(),
}));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({ vanishSummonAtZeroHp: vi.fn() }));
vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({ breakHypnoticPatternOnDamage: vi.fn() }));
vi.mock('../../services/encounters/creatureControl.js', () => ({ getCreatureController: vi.fn(() => null) }));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({ sweepNewCombatClocks: vi.fn(async () => ({})) }));
vi.mock('../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => []) }));

import { createCreatureHandlers } from './createCreatureHandlers.js';
import storage from '../../services/ui/storage.js';
import { addEntry } from '../../services/ui/logService.js';
import { setSessionPhase } from '../../services/combat/sessionService.js';
import { maybeGrantThiefsReflexesSecondTurn } from '../../services/combat/thiefsReflexesService.js';

const board = () => ({
    round: 2,
    creatures: [
        { name: 'Ann', type: 'player', initiative: '17' },
        { name: 'Bo', type: 'player', initiative: '', away: true },
        { name: 'Goblin', type: 'npc', initiative: '6' },
    ],
});

function wire({ isLocalhost = true, combatSummary = board() } = {}) {
    const setCombatSummary = vi.fn();
    const handlers = createCreatureHandlers({
        combatSummary, campaignName: 'test-campaign', campaignNpcs: [],
        setNpcImages: vi.fn(), overlays: [], setCombatSummary,
        setActiveCreatureName: vi.fn(), characters: [], numOfNpc: 0, isLocalhost,
    });
    return { handlers, combatSummary, setCombatSummary };
}

beforeEach(() => vi.clearAllMocks());

describe('handlePartyPresenceChange', () => {
    it('non-localhost is inert (tracker authorship is GM-only)', () => {
        const { handlers, combatSummary, setCombatSummary } = wire({ isLocalhost: false });
        handlers.handlePartyPresenceChange({ Ann: true });
        expect(combatSummary.creatures[0].away).toBeUndefined();
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('split writes the board ONCE and logs a party_split row', () => {
        const { handlers, combatSummary } = wire();
        handlers.handlePartyPresenceChange({ Ann: true });
        expect(combatSummary.creatures.find(c => c.name === 'Ann')).toMatchObject({ away: true, initiative: '' });
        expect(storage.set).toHaveBeenCalledTimes(1);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, 'test-campaign');
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls[0][1]).toMatchObject({
            type: 'automation', automationType: 'party_split', characterName: 'Ann',
        });
        expect(addEntry.mock.calls[0][1].description).toContain('removed from the initiative tracker');
    });

    it('rejoin logs party_rejoined naming the end-of-round slot', () => {
        const { handlers } = wire();
        handlers.handlePartyPresenceChange({ Bo: false });
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls[0][1]).toMatchObject({
            type: 'automation', automationType: 'party_rejoined', characterName: 'Bo',
        });
        // Only present rolled row is Goblin 6 → Bo lands there.
        expect(addEntry.mock.calls[0][1].description).toContain('initiative set to 6');
    });

    it('rejoin before anyone rolled logs the awaiting-initiative face', () => {
        const { handlers } = wire({
            combatSummary: { round: 1, creatures: [{ name: 'Bo', type: 'player', initiative: '', away: true }] },
        });
        handlers.handlePartyPresenceChange({ Bo: false });
        expect(addEntry.mock.calls[0][1].description).toContain('initiative not yet rolled');
    });

    // FU 2026-11-09: a second-turn twin rejoins at holder−10 and the audit row
    // must say so honestly — no "(end of the round)" claim on an anchored slot.
    it('second-turn twin rejoin logs the holder-anchored slot, PC copy unchanged', () => {
        const { handlers, combatSummary } = wire({
            combatSummary: { round: 1, creatures: [
                { name: 'Ann', type: 'player', initiative: '25' },
                { name: 'Ann (Second Turn)', type: 'player', initiative: '', away: true, secondTurn: true, holderName: 'Ann' },
                { name: 'Bo', type: 'player', initiative: '', away: true },
                { name: 'Goblin', type: 'npc', initiative: '6' },
            ] },
        });
        handlers.handlePartyPresenceChange({ 'Ann (Second Turn)': false, Bo: false });
        expect(addEntry).toHaveBeenCalledTimes(2);
        const twinRow = addEntry.mock.calls.find(c => c[1].characterName === 'Ann (Second Turn)')[1];
        expect(twinRow.automationType).toBe('party_rejoined');
        expect(twinRow.description).toContain("re-anchored to Ann's second-turn slot (initiative 15)");
        expect(combatSummary.creatures.find(c => c.name === 'Ann (Second Turn)').initiative).toBe('15');
        // PC row keeps the byte-identical end-of-round copy (Goblin 6 lowest present).
        const pcRow = addEntry.mock.calls.find(c => c[1].characterName === 'Bo')[1];
        expect(pcRow.description).toBe('Bo rejoined the party — initiative set to 6 (end of the round).');
    });

    it('unchanged/unknown names write nothing', () => {
        const { handlers, setCombatSummary } = wire();
        handlers.handlePartyPresenceChange({ Ghost: true, Ann: false, Bo: true });
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});

describe('handleToggleAway', () => {
    it('flips a player row away and back through the shared write lane', () => {
        const { handlers, combatSummary } = wire();
        handlers.handleToggleAway('Ann');
        expect(combatSummary.creatures.find(c => c.name === 'Ann').away).toBe(true);
        handlers.handleToggleAway('Ann');
        // Rejoins at the lowest present roll (Goblin 6).
        expect(combatSummary.creatures.find(c => c.name === 'Ann').away).toBeUndefined();
        expect(combatSummary.creatures.find(c => c.name === 'Ann').initiative).toBe('6');
        expect(addEntry).toHaveBeenCalledTimes(2);
    });

    it('never targets NPC rows', () => {
        const { handlers, combatSummary } = wire();
        handlers.handleToggleAway('Goblin');
        expect(storage.set).not.toHaveBeenCalled();
        expect(combatSummary.creatures).toHaveLength(3);
    });
});

// bug-away-card-initiative-input-resurrects-slot: the away card's initiative
// input is disabled, but the HANDLER lane is the data-integrity law — a typing
// blur must never resurrect the wiped slot, un-park the card, flip the session
// phase, or arm the Thief's-Reflexes grant. Real initiativeService in this file
// (unmocked), so the sort law is exercised end to end.
describe('initiative stamp on an away row (presence gate)', () => {
    let errorSpy;
    beforeEach(() => { errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });

    it('away player: refused — no initiative write, no board write, no phase flip', () => {
        const { handlers, combatSummary, setCombatSummary } = wire();
        handlers.handleInitiativeChange('Bo', '12');
        expect(combatSummary.creatures.find(c => c.name === 'Bo')).toMatchObject({ away: true, initiative: '' });
        expect(combatSummary.creatures.map(c => c.name)).toEqual(['Ann', 'Bo', 'Goblin']);
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
        expect(setSessionPhase).not.toHaveBeenCalled();
        expect(maybeGrantThiefsReflexesSecondTurn).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('away from the party'));
    });

    it('present player still stamps through the guarded lane (adjacent behavior)', () => {
        const { handlers, combatSummary } = wire();
        handlers.handleInitiativeChange('Ann', '4');
        expect(combatSummary.creatures.find(c => c.name === 'Ann').initiative).toBe('4');
        // sortCreaturesForBoard: Goblin 6 now outranks Ann 4; away Bo stays parked last.
        expect(combatSummary.creatures.map(c => c.name)).toEqual(['Goblin', 'Ann', 'Bo']);
        expect(storage.set).toHaveBeenCalledTimes(1);
    });
});
