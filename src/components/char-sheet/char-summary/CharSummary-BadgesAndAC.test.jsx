// @improved-by-ai
//
// Coverage ownership (per family delegation): AC totals and the acPenalty badge lane.
//   - The displayed Armor Class NUMBER (computeArmorClassValue lives ONLY in
//     CharSummary.jsx, so this file is the only place it can be verified).
//     Before this revision no CharSummary-* sibling asserted the AC number at all —
//     the old tests checked the "(−N from Slow)" label but passed even if the
//     penalty was never subtracted from the total.
//   - MA-0115 acPenaltySource attribution (te-sourced penalties label themselves
//     "from Noxious Miasma"; the te-less Slow lane keeps the old label + title).
//   - Warding Bond AC badge + bonus fold-in (zero coverage in any sibling).
//   - Barkskin fixed-17 override and mage-armor 13 + Dex arithmetic (BuffEffects
//     owns only the badge TEXT of these buffs, never the number).
//
// NOT owned here (delegated — do not re-add):
//   - Haste / Shield / Shield of Faith / Defensive Duelist / Barkskin / Mage Armor
//     badge text → CharSummary-BuffEffects.test.jsx
//   - Cover badges → CharSummary-Cover.test.jsx
//   - Bait and Switch badge → CharSummary-XPModes.test.jsx
//   - Circle Forms AC override → CharSummary-Movement.test.jsx
//   - Starry Form / Sanctuary summary badges → CharSummary-Badges.test.jsx
//
// Quality improvements over previous revision (4 tests → 7 tests / 9 runs):
//   - Each penalty test now asserts BOTH the indicator label AND the corrected
//     AC total (arithmetic), and the badge's semantic stat--penalized class +
//     title — behavior, not just "some element has this text".
//   - Added MA-0115 attribution parameterization (default 'Slow' vs te-sourced).
//   - Added Warding Bond badge/arithmetic and warding+slow stacking.
//   - Added barkskin override and mage-armor numeric lanes.
//   - Deterministic beforeEach re-pins getActiveBuffs (mockReturnValue would
//     otherwise leak across tests under clearAllMocks).
//   - Dropped the third penalty iteration (penalty 10 — same code path as 2/5,
//     no behavioral difference); freed slots used for genuinely new paths.
//   - conditionEffects prop is the only input seam needed for the penalty lane;
//     buffs (the other AC inputs) flow through the existing getActiveBuffs mock.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
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

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    default: {
        getRules: () => ({ classRules: { getUnarmoredMovementIncrease: () => 0 } }),
    },
    getRules: () => ({ classRules: { getUnarmoredMovementIncrease: () => 0 } }),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

// ---------------------------------------------------------------------------
// Helpers — the AC row is <div class="clickable"><b>Armor Class: </b>{value}{badges}</div>
// ---------------------------------------------------------------------------
const renderSummary = ({ buffs = [], conditionEffects } = {}) => {
    getActiveBuffs.mockReturnValue(buffs);
    render(
        <CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={conditionEffects}
        />
    );
};

const armorClassLine = () => screen.getByText(/^Armor Class:/).parentElement;

// ---------------------------------------------------------------------------
// AC slow penalty — indicator renders, penalty is subtracted from the total,
// and it is absent when no penalty applies.
// mockPlayerStats: armorClass 18.
// ---------------------------------------------------------------------------
describe('CharSummary - AC Slow Penalty', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        { penalty: 2, expectedAC: 16 },
        { penalty: 5, expectedAC: 13 },
    ])('shows (−$penalty from Slow) and reduces the AC total to $expectedAC', ({ penalty, expectedAC }) => {
        renderSummary({ conditionEffects: { acPenalty: penalty } });
        expect(screen.getByText(`(\u2212${penalty} from Slow)`)).toBeInTheDocument();
        expect(armorClassLine()).toHaveTextContent(`Armor Class: ${expectedAC}`);
    });

    it('keeps the base AC and shows no penalty indicator when acPenalty is zero', () => {
        renderSummary({ conditionEffects: { acPenalty: 0 } });
        expect(screen.queryByText(/from Slow/)).not.toBeInTheDocument();
        expect(armorClassLine()).toHaveTextContent('Armor Class: 18');
    });
});

// ---------------------------------------------------------------------------
// MA-0115 attribution — te-sourced penalties name their source (Noxious
// Miasma); the te-less Slow condition lane keeps the old "Slow" label/title.
// ---------------------------------------------------------------------------
describe('CharSummary - AC Penalty Source Attribution (MA-0115)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        { source: undefined, expectedLabel: '(\u22122 from Slow)', expectedTitle: 'Slow penalty' },
        { source: 'Noxious Miasma', expectedLabel: '(\u22122 from Noxious Miasma)', expectedTitle: 'Noxious Miasma penalty' },
    ])('attributes the penalty to $expectedTitle', ({ source, expectedLabel, expectedTitle }) => {
        renderSummary({ conditionEffects: { acPenalty: 2, ...(source ? { acPenaltySource: source } : {}) } });
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
        const badge = armorClassLine().querySelector('.stat--penalized');
        expect(badge).not.toBeNull();
        expect(badge).toHaveAttribute('title', expectedTitle);
        if (source) {
            expect(screen.queryByText(/from Slow/)).not.toBeInTheDocument();
        }
    });
});

// ---------------------------------------------------------------------------
// Warding Bond — flat AC bonus badge + arithmetic (no sibling covers this).
// ---------------------------------------------------------------------------
describe('CharSummary - AC Warding Bond Bonus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders (+1 from Warding Bond) and adds the bonus to the AC total', () => {
        renderSummary({ conditionEffects: { wardingBondAcBonus: 1 } });
        expect(screen.getByText('(+1 from Warding Bond)')).toBeInTheDocument();
        expect(armorClassLine()).toHaveTextContent('Armor Class: 19');
    });

    it('stacks the Warding Bond bonus with the Slow penalty into one total', () => {
        renderSummary({ conditionEffects: { wardingBondAcBonus: 1, acPenalty: 2 } });
        expect(screen.getByText('(+1 from Warding Bond)')).toBeInTheDocument();
        expect(screen.getByText('(\u22122 from Slow)')).toBeInTheDocument();
        expect(armorClassLine()).toHaveTextContent('Armor Class: 17');
    });
});

// ---------------------------------------------------------------------------
// AC total calculation — buff-driven branches of computeArmorClassValue.
// Numbers only; the badge TEXT for these buffs is owned by
// CharSummary-BuffEffects.test.jsx.
// ---------------------------------------------------------------------------
describe('CharSummary - Armor Class Total Calculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        { name: 'stacked Haste + Shield on base AC', buffs: [{ effect: 'haste' }, { effect: 'shield' }], expectedAC: 25 },
        { name: 'Mage Armor replaces base AC (13 + Dex 2)', buffs: [{ effect: 'mage_armor', baseAc: 13 }], expectedAC: 15 },
        { name: 'Mage Armor stacks with Shield', buffs: [{ effect: 'mage_armor', baseAc: 13 }, { effect: 'shield' }], expectedAC: 20 },
    ])('computes AC $expectedAC for $name', ({ buffs, expectedAC }) => {
        renderSummary({ buffs });
        expect(armorClassLine()).toHaveTextContent(`Armor Class: ${expectedAC}`);
    });

    it('pins AC to 17 when Barkskin is active, replacing the base value', () => {
        renderSummary({ buffs: [{ effect: 'barkskin' }] });
        expect(armorClassLine()).toHaveTextContent('Armor Class: 17');
    });
});
