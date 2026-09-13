// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, isAntimagicFieldActive, isCreatureAffectedByAntimagicField } from './antimagicFieldHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as storage from '../../../ui/storage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestWizard',
        level: 10,
        proficiency: 4,
        spellAbilities: { saveDc: 15 },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Antimagic Field',
        automation: { type: 'antimagic_field', ...overrides },
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('antimagicFieldHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('activation', () => {
        it('returns popup with automation_info type, correct metadata, and activation description', async () => {
            const action = makeAction();
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            combatData.getCombatSummary.mockReturnValue(null);

            const result = await handle(action, ps, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Antimagic Field');
            expect(result.payload.automationType).toBe('antimagic_field');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.automation).toEqual({ type: 'antimagic_field' });
        });

        it('uses the custom action name in the activation description', async () => {
            const action = { name: 'My Custom AMF', automation: { type: 'antimagic_field' } };
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            combatData.getCombatSummary.mockReturnValue(null);

            const result = await handle(action, ps, campaignName, null);

            expect(result.payload.description).toContain('My Custom AMF');
        });

        it('calls toggleBuff and registers expiration and concentration when activating', async () => {
            const action = makeAction({ customField: 'value' });
            const ps = makePlayerStats();
            const combatSummary = { creatures: [] };

            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            combatData.getCombatSummary.mockReturnValue(combatSummary);

            await handle(action, ps, campaignName, null);

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestWizard',
                'Antimagic Field',
                expect.objectContaining({
                    type: 'antimagic_field',
                    effect: 'antimagic_field',
                    customField: 'value',
                }),
                campaignName,
            );

            expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestWizard', targetName: 'TestWizard', effects: [{ type: 'remove_active_buff', buffName: 'Antimagic Field' }], campaignName });

            expect(concentrationService.addConcentration).toHaveBeenCalledWith(
                combatSummary,
                'TestWizard',
                'Antimagic Field',
                15,
            );

            expect(storage.default.set).toHaveBeenCalledWith('combatSummary', combatSummary, campaignName);
        });

        it('applies antimagic_field target effects to selected creatures when activating', async () => {
            const action = makeAction();
            action.metaCtx = { creatures: ['Goblin', 'Orc', 'Goblin2'] };
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            combatData.getCombatSummary.mockReturnValue(null);

            useRuntimeState.getRuntimeValue.mockImplementation((scope, key) => {
                if (key === 'targetEffects') return [];
                return [];
            });

            await handle(action, ps, campaignName, null);

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ target: 'Goblin', effect: 'antimagic_field', source: 'TestWizard', duration: 'concentration' }),
                    expect.objectContaining({ target: 'Orc', effect: 'antimagic_field', source: 'TestWizard', duration: 'concentration' }),
                    expect.objectContaining({ target: 'Goblin2', effect: 'antimagic_field', source: 'TestWizard', duration: 'concentration' }),
                ]),
                campaignName,
            );

            expect(logService.addEntry).toHaveBeenCalledTimes(4);
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'automation',
                    creatureName: 'TestWizard',
                    name: 'Antimagic Field',
                }),
            );
        });

        it('registers ability_use log entry on cast', async () => {
            const action = makeAction();
            action.metaCtx = { creatures: ['Goblin', 'Orc'] };
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            combatData.getCombatSummary.mockReturnValue(null);

            useRuntimeState.getRuntimeValue.mockImplementation((scope, key) => {
                if (key === 'targetEffects') return [];
                return [];
            });

            await handle(action, ps, campaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWizard',
                    abilityName: 'Antimagic Field',
                    description: expect.stringContaining('2 creature(s) affected'),
                }),
            );
        });

        it('does not apply new target effects when no creatures selected', async () => {
            const action = makeAction();
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            combatData.getCombatSummary.mockReturnValue(null);

            useRuntimeState.getRuntimeValue.mockImplementation((scope, key) => {
                if (key === 'targetEffects') return [];
                return [];
            });

            await handle(action, ps, campaignName, null);

            // Still calls setRuntimeValue to write back existing (empty) effects
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [],
                campaignName,
            );
        });
    });

    describe('deactivation', () => {
        it('returns popup with ended description', async () => {
            const action = makeAction();
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(action, ps, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Antimagic Field ended');
        });

        it('uses the custom action name in the deactivation description', async () => {
            const action = { name: 'My Custom AMF', automation: { type: 'antimagic_field' } };
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(action, ps, campaignName, null);

            expect(result.payload.description).toBe('My Custom AMF ended');
        });

        it('does not register an expiration when deactivating', async () => {
            const action = makeAction();
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
            combatData.getCombatSummary.mockReturnValue(null);

            await handle(action, ps, campaignName, null);

            expect(expirations.addExpiration).not.toHaveBeenCalled();
        });

        it('removes antimagic_field target effects from all creatures when deactivating', async () => {
            const action = makeAction();
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            useRuntimeState.getRuntimeValue.mockImplementation((scope, key) => {
                if (key === 'targetEffects') {
                    return [
                        { target: 'Goblin', effect: 'antimagic_field', source: 'TestWizard' },
                        { target: 'Orc', effect: 'antimagic_field', source: 'TestWizard' },
                        { target: 'Goblin', effect: 'silenced', source: 'Enemy' },
                    ];
                }
                return [];
            });

            await handle(action, ps, campaignName, null);

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ effect: 'silenced' }),
                ]),
                campaignName,
            );

            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'automation',
                    creatureName: 'TestWizard',
                    name: 'Antimagic Field',
                    description: expect.stringContaining('Goblin'),
                }),
            );
        });

        it('does not log if no antimagic_field effects to remove', async () => {
            const action = makeAction();
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            useRuntimeState.getRuntimeValue.mockImplementation((scope, key) => {
                if (key === 'targetEffects') return [];
                return [];
            });

            await handle(action, ps, campaignName, null);

            expect(logService.addEntry).not.toHaveBeenCalled();
        });
    });

    describe('re-casting', () => {
        it('replaces existing antimagic_field effects from same caster', async () => {
            const action = makeAction();
            action.metaCtx = { creatures: ['Goblin', 'Orc'] };
            const ps = makePlayerStats();

            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            combatData.getCombatSummary.mockReturnValue(null);

            useRuntimeState.getRuntimeValue.mockImplementation((scope, key) => {
                if (key === 'targetEffects') {
                    return [
                        { target: 'Goblin', effect: 'antimagic_field', source: 'TestWizard' },
                        { target: 'Orc', effect: 'antimagic_field', source: 'TestWizard' },
                    ];
                }
                return [];
            });

            await handle(action, ps, campaignName, null);

            const callArgs = useRuntimeState.setRuntimeValue.mock.calls[0];
            const effects = callArgs[2];
            expect(effects.length).toBe(2);
            expect(effects.every(te => te.effect === 'antimagic_field')).toBe(true);
            expect(effects.every(te => te.source === 'TestWizard')).toBe(true);
            expect(effects.every(te => te.duration === 'concentration')).toBe(true);
        });
    });
});

describe('antimagicFieldHandler.isAntimagicFieldActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when antimagic_field buff with correct effect is active', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { name: 'Antimagic Field', effect: 'antimagic_field' },
            { name: 'Shield', effect: 'shield' },
        ]);

        const result = isAntimagicFieldActive('TestWizard', campaignName);

        expect(result).toBe(true);
    });

    it('returns false when no buffs are active or activeBuffs is null', () => {
        isAntimagicFieldActive('TestWizard', campaignName);
        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
            'TestWizard',
            'activeBuffs',
            campaignName,
        );
        vi.clearAllMocks();

        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        expect(isAntimagicFieldActive('TestWizard', campaignName)).toBe(false);

        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        expect(isAntimagicFieldActive('TestWizard', campaignName)).toBe(false);
    });
});

describe('antimagicFieldHandler.isCreatureAffectedByAntimagicField', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when creature has antimagic_field effect', () => {
        useRuntimeState.getRuntimeValue.mockImplementation((scope, key) => {
            if (key === 'targetEffects') {
                return [
                    { target: 'Goblin', effect: 'antimagic_field', source: 'TestWizard' },
                    { target: 'Orc', effect: 'silenced', source: 'Enemy' },
                ];
            }
            return [];
        });

        const result = isCreatureAffectedByAntimagicField('Goblin', campaignName);
        expect(result).toBe(true);

        const orcResult = isCreatureAffectedByAntimagicField('Orc', campaignName);
        expect(orcResult).toBe(false);
    });

    it('returns false when no target effects exist', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(null);

        const result = isCreatureAffectedByAntimagicField('Goblin', campaignName);
        expect(result).toBe(false);
    });

    it('returns false when target effects is empty array', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        const result = isCreatureAffectedByAntimagicField('Goblin', campaignName);
        expect(result).toBe(false);
    });
});
