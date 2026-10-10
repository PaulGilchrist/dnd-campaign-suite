// CLA-315 falling te chip producer: one-shot apply — produceFallDamage is
// called with feet from the chip value, no persisted targetEffects entry, and
// the modal closes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEffectAdderHandlers } from './createEffectAdderHandlers.js';
import * as fallDamage from '../../services/combat/fallDamage.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));
vi.mock('../../services/combat/auras/auraConditionImmunity.js', () => ({
    getAuraConditionImmunities: vi.fn().mockResolvedValue({ immunities: [], immunitySources: {} }),
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConditionEvent: vi.fn(),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/combat/fallDamage.js', () => ({
    produceFallDamage: vi.fn().mockResolvedValue(null),
}));

describe('createEffectAdderHandlers — CLA-315 falling chip', () => {
    let handlers, setEffectAdderTarget, combatSummary, characters;

    beforeEach(() => {
        vi.clearAllMocks();
        combatSummary = { round: 1, creatures: [{ name: 'Disciplined_Monk', type: 'player' }] };
        characters = [{ name: 'Disciplined_Monk', computedStats: {} }];
        setEffectAdderTarget = vi.fn();
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        handlers = createEffectAdderHandlers({
            campaignName: 'test-campaign',
            characters,
            combatSummary,
            setEffectAdderTarget,
            setCombatSummary: vi.fn(),
        });
    });

    it('delegates falling apply to produceFallDamage and writes no persisted te', async () => {
        await handlers.handleApplyEffect('effects', { target: 'Disciplined_Monk', effectKey: 'falling', value: 60 });
        expect(fallDamage.produceFallDamage).toHaveBeenCalledWith(expect.objectContaining({
            targetName: 'Disciplined_Monk',
            feet: 60,
            campaignName: 'test-campaign',
        }));
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.anything(), 'test-campaign');
        expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
    });

    it('non-falling chips still persist as targetEffects and never call the producer', async () => {
        await handlers.handleApplyEffect('effects', { target: 'Disciplined_Monk', effectKey: 'dodge' });
        expect(fallDamage.produceFallDamage).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects',
            expect.arrayContaining([expect.objectContaining({ target: 'Disciplined_Monk', effect: 'dodge' })]), 'test-campaign');
    });

    it('no combatSummary: producer never fires', async () => {
        const h = createEffectAdderHandlers({ campaignName: 'test-campaign', characters, combatSummary: null, setEffectAdderTarget, setCombatSummary: vi.fn() });
        await h.handleApplyEffect('effects', { target: 'Disciplined_Monk', effectKey: 'falling', value: 30 });
        expect(fallDamage.produceFallDamage).not.toHaveBeenCalled();
    });
});
