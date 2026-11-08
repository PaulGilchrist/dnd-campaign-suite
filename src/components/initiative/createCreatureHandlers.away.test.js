// @maintained-by-ai
// Split-party handler lane (plan initiative-split-party): handleToggleAway /
// handlePartyPresenceChange — localhost gate, the single board write, and the
// per-change party_split / party_rejoined audit rows. Mutation semantics
// (initiative wipe / end-of-round landing / back-parking) are pinned in
// creaturePresence.test.js — this file proves the HANDLER wiring only.
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
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({ maybeGrantThiefsReflexesSecondTurn: vi.fn() }));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({ vanishSummonAtZeroHp: vi.fn() }));
vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({ breakHypnoticPatternOnDamage: vi.fn() }));
vi.mock('../../services/encounters/creatureControl.js', () => ({ getCreatureController: vi.fn(() => null) }));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({ sweepNewCombatClocks: vi.fn(async () => ({})) }));
vi.mock('../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => []) }));

import { createCreatureHandlers } from './createCreatureHandlers.js';
import storage from '../../services/ui/storage.js';
import { addEntry } from '../../services/ui/logService.js';

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
