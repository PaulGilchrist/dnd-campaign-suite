// @maintained-by-ai
// MA-0016 heal-block owner lane: healingBlock.js gate truth table + the REAL
// refusal shapes of both consumer helpers (applyHealingToTarget +
// applyHealingDirectly — the only place these run the un-mocked gate).
// Keyed `${name}.${key}` store stubs (#1057/#1186); guard-falsifier
// discipline (#1187): every miss passes before the guard fires.
// Unblocked heals + delta>0 infernal-wound/death-save wiring → applyHealing.test.js (#1210);
// applyHealingDirectly unblocked arithmetic → healingRoll.test.js (gate mocked there).
// Registry golden census (no_healing label/group bytes) → targetEffectDefinitions.test.js
// (#820); Defensive label sort is delegated HERE by that file's header.
// Aberrant Spirit (Slaad) Claw data row → handlePlainDamage.hitClause.test.js:226.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { TARGET_EFFECT_DEFINITIONS, getEffectDefinition } from '../../combat/conditions/targetEffectDefinitions.js';
import { getHealingBlockEffect, isHealingBlocked } from './healingBlock.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { applyHealingToTarget } from './applyHealing.js';
import { applyHealingDirectly } from '../../automation/common/healingRoll.js';

const CAMPAIGN = 'test-campaign';
const TARGET = 'AasimarTest';
const OTHER = 'FeyRanger';
const SOURCE = 'Aberrant Spirit (Slaad) 1';
// Production te shape as the hit-clause lane grants it (handlePlainDamage.hitClause.test.js:340-342).
const HEAL_BLOCK_TE = { target: TARGET, effect: 'no_healing', source: SOURCE, duration: 'until_start_of_next_turn' };

let store;

beforeEach(() => {
    vi.clearAllMocks();
    store = {};
    getRuntimeValue.mockImplementation((key, prop) => store[`${key}.${prop}`] ?? null);
});

describe('MA-0016 healingBlock gate', () => {
    it('refuses >0 heals for the named target with one refusal log; every miss passes silently', () => {
        // Falsifier arms first (all null, zero logs, zero writes):
        expect(getHealingBlockEffect(TARGET, CAMPAIGN)).toBeNull(); // no te at all
        store['campaign.targetEffects'] = 'not-an-array';
        expect(getHealingBlockEffect(TARGET, CAMPAIGN)).toBeNull(); // non-array store guard
        store['campaign.targetEffects'] = [{ ...HEAL_BLOCK_TE, target: OTHER }];
        expect(isHealingBlocked(TARGET, CAMPAIGN, 9)).toBeNull(); // te names another target
        expect(isHealingBlocked(TARGET, CAMPAIGN, 0)).toBeNull(); // zero heal never spams refusal
        expect(isHealingBlocked(TARGET, CAMPAIGN, -3)).toBeNull(); // negative never refuses
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();

        // Guard fires: te names the target, amount > 0 → refusal returned + logged once, no writes.
        store['campaign.targetEffects'] = [HEAL_BLOCK_TE];
        expect(getHealingBlockEffect(TARGET, CAMPAIGN)).toMatchObject({ effect: 'no_healing', source: SOURCE });
        expect(getHealingBlockEffect(OTHER, CAMPAIGN)).toBeNull(); // keyed lookup: other target untouched
        expect(isHealingBlocked(TARGET, CAMPAIGN, 9)).toMatchObject({ effect: 'no_healing' });
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'automation',
            automationType: 'healing_blocked',
            characterName: TARGET,
            abilityName: 'no_healing',
            description: expect.stringMatching(/can't regain Hit Points.*9 healing refused.*Aberrant Spirit \(Slaad\)/),
        }));
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('MA-0016 registry contract (census owned by targetEffectDefinitions.test.js)', () => {
    it('no_healing stays registered and Defensive labels stay sorted (sort delegated here)', () => {
        expect(getEffectDefinition('no_healing')).toBeTruthy();
        const labels = TARGET_EFFECT_DEFINITIONS.filter(d => d.group === 'Defensive').map(d => d.label);
        expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    });
});

describe('MA-0016 consumers refuse at the heal choke point', () => {
    beforeEach(() => {
        store['campaign.targetEffects'] = [HEAL_BLOCK_TE];
        store[`${TARGET}.currentHitPoints`] = 100;
    });

    it('applyHealingToTarget refuses: golden zero-heal shape, no HP write, one refusal log', () => {
        const cs = { creatures: [{ name: TARGET, type: 'player', maxHp: 143 }] };
        expect(applyHealingToTarget(cs, TARGET, 20, CAMPAIGN)).toEqual({
            actualHeal: 0, oldHp: 100, newHp: 100, maxHp: 143,
        });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            automationType: 'healing_blocked',
            characterName: TARGET,
        }));
    });

    it('applyHealingDirectly refuses (Second Wind / hit dice): golden zero-heal shape, no HP write, one refusal log', () => {
        expect(applyHealingDirectly({ name: TARGET, hitPoints: 143 }, TARGET, 15, CAMPAIGN)).toEqual({
            maxHp: 143, newHp: 100, actualHeal: 0,
        });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            automationType: 'healing_blocked',
            characterName: TARGET,
        }));
    });
});
