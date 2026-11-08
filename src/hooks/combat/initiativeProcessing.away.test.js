// @maintained-by-ai
// processInitiativeRoll split-party face: an away PC's roll is shown + logged
// but NEVER stamped onto the tracker, no initiative-rolled seam fires, and
// the concentration/expiration upkeep is skipped. Base roll tail pinned in
// initiativeProcessing.test.js; only the away deltas live here.
import { describe, it, expect, vi, beforeEach, onTestFinished } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => 0),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/ui/utils.js', () => ({
    default: { getName: (n) => (typeof n === 'string' ? n.split(' ')[0] : n) },
}));
vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn() } }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async () => null),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({ clearAllExpirationEffects: vi.fn() }));
vi.mock('../../services/rules/effects/restRules.js', () => ({ clearHuntersMarkConcentration: vi.fn() }));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({ maybeGrantThiefsReflexesSecondTurn: vi.fn() }));

import { processInitiativeRoll } from './initiativeProcessing.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { addEntry } from '../../services/ui/logService.js';
import storage from '../../services/ui/storage.js';
import { clearAllExpirationEffects } from '../../services/rules/effects/expirations.js';
import { clearHuntersMarkConcentration } from '../../services/rules/effects/restRules.js';

const campaignName = 'TestCampaign';
beforeEach(() => vi.clearAllMocks());

function rollAwayInitiative() {
    const setPopupHtml = vi.fn();
    const dispatched = [];
    const listener = (e) => dispatched.push(e.detail);
    window.addEventListener('initiative-rolled', listener);
    onTestFinished(() => window.removeEventListener('initiative-rolled', listener));
    return processInitiativeRoll({
        characterName: 'Away Bob',
        campaignName,
        context: {},
        bonus: 2,
        effectiveD20Roll: 11,
        r1: 9,
        r2: 2,
        setPopupHtml,
        availableSuperiorityManeuvers: [],
        cosmicOmenAppliedBonus: 0,
        characters: [],
    }).then(() => ({ setPopupHtml, dispatched }));
}

describe('processInitiativeRoll while away (split party)', () => {
    it('does not stamp the tracker, does not dispatch, logs the hold', async () => {
        const summary = { round: 1, creatures: [{ type: 'player', name: 'Away Bob'.split(' ')[0], initiative: '', away: true }] };
        loadCombatSummary.mockResolvedValue(summary);
        const { setPopupHtml, dispatched } = await rollAwayInitiative();
        expect(summary.creatures[0].initiative).toBe('');
        expect(storage.set).not.toHaveBeenCalled();
        expect(dispatched).toHaveLength(0);
        expect(clearAllExpirationEffects).not.toHaveBeenCalled();
        expect(clearHuntersMarkConcentration).not.toHaveBeenCalled();
        const entry = addEntry.mock.calls[0][1];
        expect(entry).toMatchObject({ type: 'automation', automationType: 'initiative_while_away' });
        expect(entry.description).toContain('not applied to the tracker');
        // Player still sees their roll, plus the honest away note.
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            rollType: 'initiative',
            awayNote: expect.stringContaining('not applied'),
        }));
    });

    it('present lane untouched: stamp + dispatch still land', async () => {
        const summary = { round: 1, creatures: [{ type: 'player', name: 'Away Bob'.split(' ')[0], initiative: '' }] };
        loadCombatSummary.mockResolvedValue(summary);
        const dispatched = [];
        const listener = (e) => dispatched.push(e.detail);
        window.addEventListener('initiative-rolled', listener);
        onTestFinished(() => window.removeEventListener('initiative-rolled', listener));
        await processInitiativeRoll({
            characterName: 'Away Bob', campaignName, context: {}, bonus: 2,
            effectiveD20Roll: 11, r1: 9, r2: 2, setPopupHtml: vi.fn(),
            availableSuperiorityManeuvers: [], cosmicOmenAppliedBonus: 0, characters: [],
        });
        expect(summary.creatures[0].initiative).toBe('13');
        expect(storage.set).toHaveBeenCalledWith('combatSummary', summary, campaignName);
        expect(dispatched).toHaveLength(1);
        expect(addEntry).not.toHaveBeenCalled();
    });
});
