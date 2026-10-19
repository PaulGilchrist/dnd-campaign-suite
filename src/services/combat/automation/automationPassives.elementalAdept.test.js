// @maintained-by-ai
// Lane: automationPassives elementalAdept ticket slice (#867) — the unmocked
// damage_type_choice/elemental_adept predicate branch of hasIgnoreResistance /
// hasMinDamage (per-passive chosen-type resolution, minDamage consumption).
// Family map: automationPassives.test.js (base lane) owns generic passive
// dispatch/collection and single-passive elemental_adept happy/absence paths
// for both predicates — cited, never duplicated here. fortifiedHealth /
// landResistance / stormbornResistance / wm008-kindgate lanes own their
// effects. Popup seam: handlePlainDamage.popupData.test.js #942 pins the
// elementalAdeptBonus display byte (0/2) with hasIgnoreResistance MOCKED —
// this lane tests the real predicate computation, not popup display.
// Old -> new: 17 -> 5. Removed 10 base-lane verbatim duplicates (no-chosen,
// CI match, null automation, minDamage unset/false/mismatch, foreign-effect
// for hasMinDamage, no-passives) + 1 order-dependent implementation-detail
// test ("first match per passive"). Rewrote mis-titled "empty damageTypes"
// row: the adept branch never re-checks the declared damageTypes list — the
// store byte governs (#910 honest titles). Folded falsifiable guard legs
// (#936); foreign-effect and passive_rule-minDamage controls kept here.
// Pure predicates: no logging, no timers, zero network.

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
    getChosenRuntimeValue: vi.fn(),
}));

import { hasIgnoreResistance, hasMinDamage } from './automationPassives.js';
import { getChosenRuntimeValue } from '../../../services/automation/common/choiceStorage.js';

const BASE_PS = {
    name: 'TestChar',
    campaignName: 'test-campaign',
    automation: { passives: [] },
};

function withPassives(passives) {
    return { ...BASE_PS, automation: { passives } };
}

// Faithful Elemental Adept shape (feat byte + declared damage types, #829).
function elementAdept(name, extra = {}) {
    return {
        type: 'damage_type_choice',
        effect: 'elemental_adept',
        name,
        damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
        ...extra,
    };
}

// Faithful store: each adept passive resolves its OWN chosenType, keyed by
// passive name — results below are falsifiable proof the branch queries by name.
function chosenByPassive(map) {
    getChosenRuntimeValue.mockImplementation((_ps, passiveName) => map[passiveName]);
}

beforeEach(() => {
    vi.clearAllMocks();
    chosenByPassive({}); // explicit falsy default (#940)
});

// ── hasIgnoreResistance – elemental_adept branch ─────────────────────

describe('hasIgnoreResistance – elemental_adept chosen type', () => {
    it('resolves each Elemental Adept passive by its own name across multiple passives', () => {
        const ps = withPassives([
            elementAdept('Elemental Adept (Fire)'),
            elementAdept('Elemental Adept (Cold)'),
        ]);
        chosenByPassive({ 'Elemental Adept (Cold)': 'Cold' });

        expect(hasIgnoreResistance(ps, 'Cold')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
        expect(getChosenRuntimeValue).toHaveBeenCalledWith(ps, 'Elemental Adept (Fire)', 'chosenType');
        expect(getChosenRuntimeValue).toHaveBeenCalledWith(ps, 'Elemental Adept (Cold)', 'chosenType');
    });

    it('honours the stored chosen type even outside the declared damageTypes, case-insensitively', () => {
        const ps = withPassives([elementAdept('Elemental Adept (Fire)', { damageTypes: ['Fire'] })]);
        chosenByPassive({ 'Elemental Adept (Fire)': 'poison' });

        // The store byte governs; the declared damageTypes list is not re-checked.
        expect(hasIgnoreResistance(ps, 'POISON')).toBe(true);
        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('ignores foreign damage_type_choice effects — only elemental_adept qualifies', () => {
        const ps = withPassives([{
            type: 'damage_type_choice',
            effect: 'elemental_affinity',
            name: 'Elemental Affinity',
            damageTypes: ['Fire'],
        }]);
        chosenByPassive({ 'Elemental Affinity': 'Fire' });

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(false);
    });

    it('unions the elemental_adept arm with the passive_rule arm in one passives array', () => {
        const ps = withPassives([
            { type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['Fire'] },
            elementAdept('Elemental Adept (Cold)'),
        ]);
        chosenByPassive({ 'Elemental Adept (Cold)': 'Cold' });

        expect(hasIgnoreResistance(ps, 'Fire')).toBe(true);    // rule arm alone
        expect(hasIgnoreResistance(ps, 'Cold')).toBe(true);     // adept arm alone
        expect(hasIgnoreResistance(ps, 'Thunder')).toBe(false); // neither arm
    });
});

// ── hasMinDamage – elemental_adept minDamage consumption ──────────────

describe('hasMinDamage – elemental_adept minDamage consumption', () => {
    it('supplies minDamage only from elemental_adept, on the chosen type, case-insensitively', () => {
        const ps = withPassives([elementAdept('Energy Mastery', { minDamage: true, damageTypes: ['Fire'] })]);
        chosenByPassive({ 'Energy Mastery': 'fire' });

        expect(hasMinDamage(ps, 'FIRE')).toBe(true);

        // passive_rule never supplies minDamage, even armed with the flag + matching types.
        const ruleMin = withPassives([{
            type: 'passive_rule',
            effect: 'ignore_resistance',
            damageTypes: ['Fire'],
            minDamage: true,
        }]);
        expect(hasMinDamage(ruleMin, 'Fire')).toBe(false);
    });
});
