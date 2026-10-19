// @maintained-by-ai
// CLA-315 falling te chip producer lane (createEffectAdderHandlers, effects tab).
// Contract pinned here: 'falling' is a ONE-SHOT chip — the chip IS the event.
// It delegates once to produceFallDamage with the exact payload and performs ZERO
// persistence or handler-side logging; the modal still closes.
//
// Lane split (owners cited, not duplicated here):
// - Registry definition of te 'falling' → targetEffectDefinitions.test.js
//   (getEffectDefinition golden-once, #820); definition lives at
//   targetEffectDefinitions.js:1375.
// - Producer internals (2d10/10ft dice, trigger:'falling' stamp, applyDamageToTarget
//   write, fall_damage log) → services/combat/fallDamage.test.js.
// - Generic base lane (early-return no-combatSummary guard above tab dispatch,
//   conditions/concentration tabs, te field builder incl. optional fields, filtered
//   append with pre-existing entries, target-effect-applied log shape) →
//   createEffectAdderHandlers.test.jsx. The guard covers the falling chip too:
//   it returns before applyEffectTabEntry, so the producer is unreachable without
//   a combatSummary.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEffectAdderHandlers } from './createEffectAdderHandlers.js';
import * as fallDamage from '../../services/combat/fallDamage.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import * as combatLoggingService from '../../services/encounters/combatLoggingService.js';
import storage from '../../services/ui/storage.js';

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
    let handlers, setEffectAdderTarget, setCombatSummary, combatSummary, characters;

    beforeEach(() => {
        vi.clearAllMocks(); // does NOT reset mockReturnValue (getRuntimeValue below, fallDamage in factory)
        combatSummary = { round: 1, creatures: [{ name: 'Disciplined_Monk', type: 'player' }] };
        characters = [{ name: 'Disciplined_Monk', computedStats: {} }];
        setEffectAdderTarget = vi.fn();
        setCombatSummary = vi.fn();
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        handlers = createEffectAdderHandlers({
            campaignName: 'test-campaign',
            characters,
            combatSummary,
            setEffectAdderTarget,
            setCombatSummary,
        });
    });

    it('falling chip delegates once to produceFallDamage with the exact payload, persists nothing, and closes the modal', async () => {
        await handlers.handleApplyEffect('effects', { target: 'Disciplined_Monk', effectKey: 'falling', value: 60 });

        expect(fallDamage.produceFallDamage).toHaveBeenCalledTimes(1);
        expect(fallDamage.produceFallDamage).toHaveBeenCalledWith({
            combatSummary,
            targetName: 'Disciplined_Monk',
            feet: 60,
            campaignName: 'test-campaign',
            characters,
        });
        // the chip IS the event: no te read, no te write, no summary write,
        // no handler-side log (the producer owns the fall_damage log entry)
        expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
        expect(combatLoggingService.logConditionEvent).not.toHaveBeenCalled();
        expect(setEffectAdderTarget).toHaveBeenCalledWith(null);
    });

    it('non-falling chips take the normal te persist lane, not the producer', async () => {
        await handlers.handleApplyEffect('effects', { target: 'Disciplined_Monk', effectKey: 'dodge' });

        expect(fallDamage.produceFallDamage).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign', 'targetEffects',
            [{ target: 'Disciplined_Monk', effect: 'dodge' }],
            'test-campaign',
        );
    });
});
