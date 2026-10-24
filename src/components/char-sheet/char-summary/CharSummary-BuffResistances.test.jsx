// @maintained-by-ai
//
// Coverage ownership (CharSummary family delegation): BUFF-derived resistances on the
// "Resistances:"/"Immunities:" rows (charSummaryCalc.js computeResistances) — one test
// per DISTINCT filter path, not per whitelist member:
//   - RAGE_RESISTANCE_BUFF_NAMES lane ('Rage' representative; Superior Defense / Rage of
//     the Gods / Rage of the Wilds share the identical b => b.name === name matcher)
//   - LATER_RESISTANCE_BUFF_NAMES lane ('Aura of Life' representative; Aura of Purity /
//     Protection from Poison share it — Stone Skin and Feign Death have dedicated tests)
//   - effect-based lane (warding_bond) and the Starry Form name matcher
//   - allow-list NEGATIVE: a non-whitelisted buff carrying resistanceTypes contributes
//     nothing (this also subsumes the empty-getActiveBuffs negative — a broken
//     filter passes on [] but fails here) AND the getActiveBuffs player/campaign wiring
//   - Feign Death dual-lane (same buff feeds Resistances AND Immunities rows)
//   - Stone Skin runtime 'stoneSkinDamageTypes' through the REAL stoneSkinHandler
//     (additive types + buff-vs-buff AND buff-vs-runtime dedup, pinned in one render)
//   - delegated badge lane: Aura of Life / Heroes' Feast badges + the dynamic Heroes'
//     Feast tooltip derivation (all three sibling files delegate badges here; previously
//     owned by nobody)
//
// NOT owned here (delegated to siblings — do not re-add):
//   - runtime-store chosen-type keys (Fiendish/Epitome/Boon/Elemental Adept) and their
//     dedup → CharSummary-ResistanceTypes.test.jsx
//   - Immunities-row base/automation/Rage-gate sources and allow-list → CharSummary-ConditionImmunities.test.jsx
//   - auraComboEffects resistances + asterisk markers → CharSummary-AuraAndInitiative.test.jsx
//   - AC attribution badges → CharSummary-BuffEffects.test.jsx
//   - Starry Form / Nature's Sanctuary badge details → CharSummary-Badges.test.jsx
//   - Stormborn gating → CharSummary-AdditionalCoverage.test.jsx
//   - rest persistence of chosen keys → services/rules/effects/restRules-*.test.js

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isAuraOfLifeActive } from '../../../services/automation/handlers/buffs/auraOfLifeHandler.js';
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
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn(() => null),
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

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

// The badge lane gates on this handler; every other buff/aura handler resolves through
// the mocked runtime store (falsy by default) and needs no module mock.
vi.mock('../../../services/automation/handlers/buffs/auraOfLifeHandler.js', () => ({
    isAuraOfLifeActive: vi.fn(() => false),
    handle: vi.fn(),
}));

beforeEach(() => {
    vi.resetAllMocks();
    getActiveBuffs.mockReturnValue([]);
});

function renderSummary(buffs = []) {
    getActiveBuffs.mockReturnValue(buffs);
    render(
        <CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
        />
    );
}

// Serve the given runtime keys; every other key returns undefined, mirroring
// the real store's missing-key behavior (also feeds the real stoneSkinHandler).
function mockRuntime(values) {
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) => values[key]);
}

// Exact (not substring) row match so duplicates, wrong capitalization, or wrong
// join order fail.
function expectResistancesRow(expectedRowText) {
    const row = screen.getByText('Resistances:').closest('div');
    expect(row.textContent.replace(/\s+/g, ' ').trim()).toBe(expectedRowText);
}

function expectNoResistancesRow() {
    expect(screen.queryByText('Resistances:')).not.toBeInTheDocument();
}

// ---------------------------------------------------------------------------
// One case per DISTINCT buff→resistance filter path, pinning row order.
// Rage-lane and later-lane share one render (rage joins before later);
// effect-based lanes (warding_bond, Starry Form) share the other.
// ---------------------------------------------------------------------------
describe('CharSummary - buff resistance lanes', () => {
    it.each([
        {
            desc: 'rage lane joins before later-name lane',
            buffs: [
                { name: 'Aura of Life', resistanceTypes: ['necrotic'] },
                { name: 'Rage', resistanceTypes: ['bludgeoning'] },
            ],
            expected: 'Resistances: Bludgeoning, Necrotic',
        },
        {
            desc: 'warding_bond effect and Starry Form name matcher',
            buffs: [
                { effect: 'warding_bond', resistanceTypes: ['cold'] },
                { name: 'Starry Form', resistanceTypes: ['fire'] },
            ],
            expected: 'Resistances: Cold, Fire',
        },
    ])('$desc', ({ buffs, expected }) => {
        renderSummary(buffs);
        expectResistancesRow(expected);
    });
});

// ---------------------------------------------------------------------------
// Allow-list guard: resistanceTypes on a buff outside every name/effect matcher
// contributes nothing. Also pins the getActiveBuffs player/campaign wiring.
// ---------------------------------------------------------------------------
describe('CharSummary - buffs outside the resistance allow-list', () => {
    it('ignores resistanceTypes on a non-whitelisted buff and queries the right character store', () => {
        renderSummary([{ name: 'Bless', resistanceTypes: ['poison'] }]);

        expectNoResistancesRow();
        expect(getActiveBuffs).toHaveBeenCalledWith('Thorin', mockCampaignName);
    });
});

// ---------------------------------------------------------------------------
// Feign Death is in BOTH the resistance and condition-immunity buff lists —
// one buff drives both rows.
// ---------------------------------------------------------------------------
describe('CharSummary - Feign Death dual lane', () => {
    it('feeds the Resistances row (poison) and the Immunities row (Poisoned) from one buff', () => {
        renderSummary([{
            name: 'Feign Death',
            resistanceTypes: ['poison'],
            conditionImmunity: ['Poisoned'],
        }]);

        expectResistancesRow('Resistances: Poison');
        expect(screen.getByText('Immunities:').closest('div')
            .textContent.replace(/\s+/g, ' ').trim()).toBe('Immunities: Poisoned');
    });
});

// ---------------------------------------------------------------------------
// Stone Skin: named buff + runtime 'stoneSkinDamageTypes' (read via the REAL
// stoneSkinHandler). Pins buff-vs-buff dedup, buff-vs-runtime dedup, and
// additive runtime-only types in one row.
// ---------------------------------------------------------------------------
describe('CharSummary - Stone Skin runtime types + deduplication', () => {
    it('merges runtime stoneSkinDamageTypes with buff resistances, each type listed once', () => {
        mockRuntime({ stoneSkinDamageTypes: ['bludgeoning', 'piercing'] });
        renderSummary([
            { name: 'Aura of Purity', resistanceTypes: ['poison'] },
            { name: 'Feign Death', resistanceTypes: ['poison'] },
            { name: 'Stone Skin', resistanceTypes: ['bludgeoning'] },
        ]);

        expectResistancesRow('Resistances: Poison, Bludgeoning, Piercing');
    });
});

// ---------------------------------------------------------------------------
// Badge lane (delegated here by CharSummary-Badges / -ConditionImmunities /
// -AuraAndInitiative): gated Aura of Life badge + dynamic Heroes' Feast badge
// whose tooltip is derived from the buff's resistance and immunity lists.
// ---------------------------------------------------------------------------
describe('CharSummary - aura and Heroes\' Feast badges', () => {
    it('renders the gated Aura of Life badge and the Heroes\' Feast badge with derived tooltip', () => {
        vi.mocked(isAuraOfLifeActive).mockReturnValue(true);
        renderSummary([{
            name: "Heroes' Feast",
            resistanceTypes: ['poison'],
            conditionImmunity: ['poisoned', 'frightened'],
        }]);

        const auraBadge = screen.getByText('Aura of Life');
        expect(auraBadge).toHaveAttribute('title', expect.stringContaining('Necrotic'));

        const feastBadge = screen.getByText("Heroes' Feast");
        expect(feastBadge).toHaveAttribute(
            'title',
            "Heroes' Feast: Resistance to poison, Immune to Poisoned, Frightened, HP maximum increased by 2d10. Lasts 24 hours."
        );
    });

    it('shows no Heroes\' Feast badge when no Heroes\' Feast buff is active', () => {
        renderSummary([{ name: 'Rage', resistanceTypes: ['bludgeoning'] }]);

        expect(screen.queryByText("Heroes' Feast")).not.toBeInTheDocument();
    });
});
