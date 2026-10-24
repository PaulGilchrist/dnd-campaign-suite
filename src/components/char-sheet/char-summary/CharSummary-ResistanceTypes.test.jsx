// @maintained-by-ai
//
// Coverage ownership (CharSummary family delegation): runtime-store-driven damage
// types on the "Resistances:" row (charSummaryCalc.js computeResistances) —
// the ONLY owner of these four runtime keys across the family:
//   - '_Fiendish_Resilience_chosenType'   (single value)
//   - 'epitomeResistanceType'             (single value)
//   - '_Energy_Resistances_chosenTypes'   (array, Boon of Energy Resistance)
//   - '_Elemental_Adept_chosenType'       (collected from damage_type_choice
//                                            passives via collectElementalAdeptTypes)
//
// This file is ALSO the single owner of the Resistances-row row-text contract
// (lowercase→capitalized values, ", " separator, join order) per the
// CharSummary-OtherEffects delegation — sibling row pins are lane-local only.
//
// NOT owned here (delegated to siblings — do not re-add):
//   - buff-derived resistanceTypes / Feign Death / Stone Skin buffs → CharSummary-BuffResistances.test.jsx
//   - auraComboEffects resistances + asterisk markers → CharSummary-AuraAndInitiative.test.jsx
//   - Stormborn gated on wrathOfTheSeaActive → CharSummary-AdditionalCoverage.test.jsx
//   - empty-fixture row omission baseline → CharSummary-FixtureContract.test.jsx
//   - rest persistence of the chosen keys → services/rules/effects/restRules-*.test.js
//
// Trimmed vs previous revision (10 tests / 19 runs → 4 tests / 4 runs): every
// it.each over multiple damage types and every per-key falsy negative re-exercised
// the SAME paths (render-time charAt(0).toUpperCase(), singleToArray()/|| [] on any
// falsy, one Set for dedup) — one representative per path pins them equally well.
// The two-source and three-source dedup tests plus the multi-source join-order test
// collapse into one all-sources merge test. Each of the four runtime keys still has
// a UNIQUE-contribution detection: fiendish via test 1, epitome/boon/adept via the
// merge test (removing any getRuntimeValue read in computeResistances fails there).
// Runtime-vs-empty-store negatives are kept exactly once, runtime-lane only
// (BuffResistances' allow-list negative covers the buff lane).

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarImage.jsx', () => ({ default: () => <div data-testid="avatar-image">Avatar</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: ({ onClick }) => <button data-testid="short-rest-btn" onClick={onClick}>Short Rest</button> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(({ maxGetter }) => ({ current: maxGetter(), update: vi.fn() })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    getStore: vi.fn(() => new Map()),
}));

vi.mock('../../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: vi.fn((_name, _key, defaultValue) => [defaultValue, vi.fn()]),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn(), rollInitiative: vi.fn() })),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    default: {
        getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
    },
    getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfLifeHandler.js', () => ({
    isAuraOfLifeActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/protectionFromEnergyHandler.js', () => ({
    getProtectionFromEnergyDamageType: vi.fn(() => null),
}));

vi.mock('../../../services/automation/handlers/buffs/resistanceHandler.js', () => ({
    getResistanceDamageType: vi.fn(() => null),
}));

vi.mock('../../../services/automation/handlers/buffs/stoneSkinHandler.js', () => ({
    getStoneSkinDamageTypes: vi.fn(() => []),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

beforeEach(() => {
    vi.resetAllMocks();
    getActiveBuffs.mockReturnValue([]);
});

const elementalAdeptPassives = [
    { type: 'damage_type_choice', effect: 'elemental_adept', name: 'Elemental Adept' },
];

function statsWithPassives(passives) {
    return {
        ...mockPlayerStats,
        automation: { ...mockPlayerStats.automation, passives },
    };
}

function renderSummary(stats = mockPlayerStats) {
    render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
}

// Serve the given runtime keys; every other key returns undefined, mirroring
// the real store's missing-key behavior.
function mockRuntime(values) {
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) => values[key]);
}

// Exact (not substring) row match so duplicates, wrong capitalization, or
// wrong join order fail — this is the family's row-text contract pin.
function expectResistancesRow(expectedRowText) {
    const row = screen.getByText('Resistances:').closest('div');
    expect(row.textContent.replace(/\s+/g, ' ').trim()).toBe(expectedRowText);
}

function expectNoResistancesRow() {
    expect(screen.queryByText('Resistances:')).not.toBeInTheDocument();
}

describe('CharSummary - runtime resistance sources on the Resistances row', () => {
    it('shows the Fiendish Resilience chosen type capitalized, looked up on this character and campaign', () => {
        mockRuntime({ '_Fiendish_Resilience_chosenType': 'fire' });
        renderSummary();
        expectResistancesRow('Resistances: Fire');
        // Runtime lookups must be scoped to this character and campaign; a read
        // against the wrong store fails here (single-value + capitalization lane).
        expect(getRuntimeValue).toHaveBeenCalledWith('Thorin', '_Fiendish_Resilience_chosenType', mockCampaignName);
    });

    it('omits the Resistances row when no runtime choice exists, even with an Elemental Adept passive present', () => {
        mockRuntime({});
        renderSummary(statsWithPassives(elementalAdeptPassives));
        expectNoResistancesRow();
    });

    it('ignores a damage_type_choice passive whose effect is not elemental_adept, even when its chosen type is stored', () => {
        mockRuntime({ '_Energy_Weapons_chosenType': 'fire' });
        renderSummary(statsWithPassives([
            { type: 'damage_type_choice', effect: 'energy_weapons', name: 'Energy Weapons' },
        ]));
        expectNoResistancesRow();
    });

    it('merges epitome, fiendish, boon, and Elemental Adept types with base resistances — deduped, non-strings dropped, in computed order', () => {
        mockRuntime({
            epitomeResistanceType: 'lightning',                                    // unique, joins after base
            '_Fiendish_Resilience_chosenType': 'fire',                           // deduped vs base
            '_Energy_Resistances_chosenTypes': ['poison', 'cold', null, 'fire'], // order kept; null filtered at render; fire deduped across sources
            '_Elemental_Adept_chosenType': 'acid',                               // key derived from passive name
        });
        renderSummary({
            ...statsWithPassives([
                ...elementalAdeptPassives,
                { type: 'damage_type_choice', effect: 'energy_weapons', name: 'Energy Weapons' },
            ]),
            resistances: ['fire'],
        });
        // Pins base→epitome→fiendish→boon→adept join order: dropping or
        // reordering any getRuntimeValue read in computeResistances fails here.
        expectResistancesRow('Resistances: Fire, Lightning, Poison, Cold, Acid');
    });
});
