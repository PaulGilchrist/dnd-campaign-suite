// @improved-by-ai
//
// Coverage ownership (CharSummary family delegation): runtime-store-driven damage
// types on the "Resistances:" row (charSummaryCalc.js computeResistances) —
// the ONLY owner of these four runtime keys across the family:
//   - '_Fiendish_Resilience_chosenType'   (single value)
//   - 'epitomeResistanceType'             (single value)
//   - '_Energy_Resistances_chosenTypes'   (array, Boon of Energy Resistance)
//   - '_Elemental_Adept_chosenType'       (array of passives via collectElementalAdeptTypes)
// plus deduplication of these runtime inputs against other sources.
//
// NOT owned here (delegated to siblings — do not re-add):
//   - buff-derived resistanceTypes / Feign Death / Stone Skin buffs → CharSummary-BuffResistances.test.jsx
//   - auraComboEffects resistances + asterisk markers → CharSummary-AuraAndInitiative.test.jsx
//   - Stormborn gated on wrathOfTheSeaActive → CharSummary-AdditionalCoverage.test.jsx
//   - base playerStats.resistances verbatim row → CharSummary-OtherEffects.test.jsx
//   - rest persistence of the chosen keys → services/rules/effects/restRules-*.test.js
//
// Quality improvements over previous revision (8 tests / 17 runs → 10 tests / 19 runs):
//   - All assertions are scoped to the "Resistances:" row and pin the FULL row
//     text (label + capitalization + join order). The previous page-wide
//     getByText(/Fire/) regex passed if "Fire" appeared in any element anywhere
//     (badges, tooltips, sibling rows) and proved nothing about the resistance row.
//   - Negatives now assert the ENTIRE row is absent (queryByText('Resistances:')),
//     not just absence of one type name scattered across the page.
//   - Added missing edge/negative paths: elemental_adept effect filter (a
//     damage_type_choice passive with a different effect must not contribute),
//     the typeof-string filter in ResistanceImmunityLines (null entries in the
//     boon array must not render), and dedup ACROSS two runtime sources
//     (fiendish + boon energy granting the same type) — previously only
//     runtime-vs-base dedup was tested.
//   - One module-level beforeEach replaces five identical blocks; a mockRuntime()
//     helper replaces repeated if-chain mockImplementations.
//   - Pins the runtime wiring (player name + campaign) once, so a key looked up
//     against the wrong character store fails here.

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
vi.mock('../ShortRestButton.jsx', () => ({ default: () => <div data-testid="short-rest-btn">Short Rest</div> }));
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

function renderSummary(stats = mockPlayerStats) {
    render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
}

// Serve the given runtime keys; every other key returns undefined, mirroring
// the real store's missing-key behavior.
function mockRuntime(values) {
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) => values[key]);
}

// Exact (not substring) row match so duplicates or wrong join order fail.
function expectResistancesRow(expectedRowText) {
    const row = screen.getByText('Resistances:').closest('div');
    expect(row.textContent.replace(/\s+/g, ' ').trim()).toBe(expectedRowText);
}

function expectNoResistancesRow() {
    expect(screen.queryByText('Resistances:')).not.toBeInTheDocument();
}

// ---------------------------------------------------------------------------
// Fiendish Resilience — single runtime value folded into the Resistances row
// ---------------------------------------------------------------------------
describe('CharSummary - Fiendish Resilience', () => {
    it.each(['fire', 'poison', 'cold'])(
        'shows capitalized %s as the only resistance when chosenType is set',
        (type) => {
            mockRuntime({ '_Fiendish_Resilience_chosenType': type });
            renderSummary();
            expectResistancesRow(`Resistances: ${type.charAt(0).toUpperCase()}${type.slice(1)}`);
            // Runtime lookups must be scoped to this character and campaign.
            expect(getRuntimeValue).toHaveBeenCalledWith('Thorin', '_Fiendish_Resilience_chosenType', mockCampaignName);
        }
    );

    it.each([['not set (undefined)', undefined], ['null', null]])(
        'shows no Resistances row when chosenType is %s',
        (_label, value) => {
            mockRuntime({ '_Fiendish_Resilience_chosenType': value });
            renderSummary();
            expectNoResistancesRow();
        }
    );
});

// ---------------------------------------------------------------------------
// Elemental Epitome — single runtime value folded into the Resistances row
// ---------------------------------------------------------------------------
describe('CharSummary - Elemental Epitome', () => {
    it.each(['lightning', 'acid'])(
        'shows capitalized %s as the only resistance when epitomeResistanceType is set',
        (type) => {
            mockRuntime({ epitomeResistanceType: type });
            renderSummary();
            expectResistancesRow(`Resistances: ${type.charAt(0).toUpperCase()}${type.slice(1)}`);
        }
    );

    it('shows no Resistances row when epitomeResistanceType is not set', () => {
        mockRuntime({});
        renderSummary();
        expectNoResistancesRow();
    });
});

// ---------------------------------------------------------------------------
// Boon of Energy Resistance — array runtime value
// ---------------------------------------------------------------------------
describe('CharSummary - Boon of Energy Resistance', () => {
    it('lists every chosen type, capitalized, in stored order', () => {
        mockRuntime({ '_Energy_Resistances_chosenTypes': ['fire', 'cold'] });
        renderSummary();
        expectResistancesRow('Resistances: Fire, Cold');
    });

    it.each([['null', null], ['an empty array', []]])(
        'shows no Resistances row when the chosen types value is %s',
        (_label, value) => {
            mockRuntime({ '_Energy_Resistances_chosenTypes': value });
            renderSummary();
            expectNoResistancesRow();
        }
    );

    it('filters non-string entries out of the chosen types array', () => {
        mockRuntime({ '_Energy_Resistances_chosenTypes': ['fire', null, undefined] });
        renderSummary();
        expectResistancesRow('Resistances: Fire');
    });
});

// ---------------------------------------------------------------------------
// Elemental Adept — types collected from damage_type_choice passives, keyed
// by passive name ('_Elemental_Adept_chosenType')
// ---------------------------------------------------------------------------
describe('CharSummary - Elemental Adept', () => {
    const elementalAdeptPassives = [
        { type: 'damage_type_choice', effect: 'elemental_adept', name: 'Elemental Adept' },
    ];

    function statsWithPassives(passives) {
        return {
            ...mockPlayerStats,
            automation: { ...mockPlayerStats.automation, passives },
        };
    }

    it.each(['fire', 'cold'])(
        'shows capitalized %s chosen via the elemental_adept passive',
        (type) => {
            mockRuntime({ '_Elemental_Adept_chosenType': type });
            renderSummary(statsWithPassives(elementalAdeptPassives));
            expectResistancesRow(`Resistances: ${type.charAt(0).toUpperCase()}${type.slice(1)}`);
        }
    );

    it('shows no Resistances row when the passive exists but no type is chosen', () => {
        mockRuntime({});
        renderSummary(statsWithPassives(elementalAdeptPassives));
        expectNoResistancesRow();
    });

    it('ignores damage_type_choice passives whose effect is not elemental_adept', () => {
        mockRuntime({ '_Energy_Weapons_chosenType': 'fire' });
        renderSummary(statsWithPassives([
            { type: 'damage_type_choice', effect: 'energy_weapons', name: 'Energy Weapons' },
        ]));
        expectNoResistancesRow();
    });
});

// ---------------------------------------------------------------------------
// Deduplication: runtime-set types already present via another source are
// listed exactly once
// ---------------------------------------------------------------------------
describe('CharSummary - Resistance deduplication', () => {
    it('does not repeat a runtime fiendish type already in base resistances', () => {
        mockRuntime({ '_Fiendish_Resilience_chosenType': 'fire' });
        renderSummary({ ...mockPlayerStats, resistances: ['fire'] });
        expectResistancesRow('Resistances: Fire');
    });

    it('does not repeat a runtime epitome type already in base resistances', () => {
        mockRuntime({ epitomeResistanceType: 'lightning' });
        renderSummary({ ...mockPlayerStats, resistances: ['lightning'] });
        expectResistancesRow('Resistances: Lightning');
    });

    it('does not repeat a type granted by two different runtime sources', () => {
        mockRuntime({
            '_Fiendish_Resilience_chosenType': 'fire',
            '_Energy_Resistances_chosenTypes': ['fire', 'cold'],
        });
        renderSummary();
        expectResistancesRow('Resistances: Fire, Cold');
    });
});

// ---------------------------------------------------------------------------
// Multiple runtime sources active together — pins join order
// (epitome → fiendish → boon energy, per computeResistances insertion order)
// ---------------------------------------------------------------------------
describe('CharSummary - Multiple runtime resistance sources together', () => {
    it('renders all three sources once, in computed order', () => {
        mockRuntime({
            epitomeResistanceType: 'lightning',
            '_Fiendish_Resilience_chosenType': 'fire',
            '_Energy_Resistances_chosenTypes': ['poison', 'radiant'],
        });
        renderSummary();
        expectResistancesRow('Resistances: Lightning, Fire, Poison, Radiant');
    });
});
