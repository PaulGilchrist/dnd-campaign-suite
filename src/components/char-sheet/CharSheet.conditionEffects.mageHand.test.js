// @maintained-by-ai
// CLA-218 lane — Mage Hand Legerdemain advantage GATE at the char-sheet compute
// level. The conditional_advantage saveModifier (target ability_check, abilities
// DEX, condition mage_hand_legerdemain) must only reach the rules engine while
// the spectral hand is being controlled (runtime flag mageHandControlled, set
// by mageHandControlHandler, cleared at next-turn start). Without the flag the
// modifier falls through saveModifierApplies to an unconditional pass, so the
// drop happens in buildAllSaveModifiers — this file pins that via the REAL
// computeConditionEffects pipeline (nothing here mocks conditionEffects.js).
//
// Lane split (do not duplicate across these files):
//   - this file ................. mageHandControlled gating of saveModifiers
//   - .stinkingBlock.test.js .... SP-111 cannotActActions / cannotAct split
//   - .test.jsx (canonical) ..... CharSheet render prop-flow (compute mocked)
//   - mageHandControlHandler.test.js + turnStartEffects_additional.test.js
//     ............................. flag set/clear lifecycle (not re-asserted here)
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/rangeCheck.js', () => ({
    isDistanceInRange: vi.fn(() => true),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
    isCreatureWarded: vi.fn(() => false),
    handle: vi.fn(),
    applyProtectionFromEvilAndGood: vi.fn(),
    isProtectionFromEvilAndGoodActive: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(() => []),
    handle: vi.fn(),
    applyHolyAura: vi.fn(),
}));

import { computeCharConditionEffects } from './CharSheet.conditionEffects.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const CHAR = 'ArcaneTricksterTest';

const LEGERDEMAIN_MOD = {
    source: 'Mage Hand Legerdemain',
    target: 'ability_check',
    condition: 'mage_hand_legerdemain',
    effect: 'advantage',
    abilities: ['DEX'],
    skills: [],
};

// Unconditional ability_check advantage: must SURVIVE the legerdemain gate in
// both states, proving the filter drops only the mage_hand_legerdemain row.
const OTHER_CHECK_MOD = {
    source: 'Remarkable Athlete',
    target: 'ability_check',
    effect: 'advantage',
    abilities: ['CHA'],
};

function computeWithHandControlled(controlled) {
    getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'mageHandControlled') return controlled;
        return null;
    });
    const { conditionEffects } = computeCharConditionEffects(
        { name: CHAR },
        { name: CHAR, level: 3, saveModifiers: [LEGERDEMAIN_MOD, OTHER_CHECK_MOD] },
        CAMPAIGN,
        []
    );
    return conditionEffects.abilityCheckAdvantageAbilities || [];
}

describe('CLA-218 — Mage Hand Legerdemain DEX check advantage gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('drops the legerdemain DEX advantage while the hand is not controlled, without touching other check advantages', () => {
        const abilities = computeWithHandControlled(false);

        expect(abilities).not.toContain('DEX');
        expect(abilities).toContain('CHA');
    });

    it('grants the legerdemain DEX ability check advantage while the hand is controlled', () => {
        const abilities = computeWithHandControlled(true);

        expect(abilities).toContain('DEX');
        expect(abilities).toContain('CHA');
    });
});
