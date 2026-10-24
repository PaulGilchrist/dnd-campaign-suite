// @maintained-by-ai
//
// Coverage ownership (per family delegation): AC totals and the acPenalty badge lane.
//   - The displayed Armor Class NUMBER (computeArmorClassValue lives ONLY in
//     CharSummary.jsx, so this file is the only place it can be verified):
//     penalty subtraction, warding-bond fold-in, buff arithmetic, barkskin pin,
//     and the mage-armor branch — every test pins the numeric total, not just
//     a label, so a broken computation fails loudly.
//   - MA-0115 acPenaltySource attribution (te-sourced penalties label themselves
//     "from Noxious Miasma"; the te-less Slow lane keeps the old label + title).
//   - Warding Bond AC badge (label + tooltip + arithmetic) — no sibling covers it.
//
// NOT owned here (delegated — do not re-add):
//   - Haste / Shield / Shield of Faith / Defensive Duelist / Barkskin / Mage Armor
//     badge text → CharSummary-BuffEffects.test.jsx
//   - Cover badges → CharSummary-Cover.test.jsx
//   - Bait and Switch badge + total → CharSummary-XPModes.test.jsx
//   - Circle Forms AC override → CharSummary-Movement.test.jsx
//   - Starry Form / Sanctuary summary badges → CharSummary-Badges.test.jsx
//   - Unmodified-fixture AC row = exactly armorClass (no noise) →
//     CharSummary-FixtureContract.test.jsx (the zero-penalty row below is the
//     distinct acPenalty:0 input boundary, not that default)
//
// Trim history: dropped the penalty:5 iteration (same path as 2), merged the
// plain-Slow and MA-0115 attribution lanes into one table, and removed the
// solo Warding Bond test — the stacked warding+slow case fully subsumes it
// (same badge, tooltip, and fold-in arithmetic, plus penalty independence).
// Badges are now located by their visible text and checked via title tooltips
// instead of querying the .stat--penalized styling class.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
// renderSummary re-pins getActiveBuffs on every call (default: no buffs).
// mockPlayerStats: armorClass 18, Dex +2.
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
// AC penalty lane (incl. MA-0115 attribution) — the badge renders with the
// exact label and attribution tooltip, the penalty is subtracted from the
// total, and acPenalty: 0 shows nothing and subtracts nothing.
// ---------------------------------------------------------------------------
describe('CharSummary - AC Penalty and Source Attribution (MA-0115)', () => {
    it.each([
        {
            name: 'te-less Slow lane keeps the default label',
            conditionEffects: { acPenalty: 2 },
            badge: '(\u22122 from Slow)',
            title: 'Slow penalty',
        },
        {
            name: 'te-sourced penalty names its source',
            conditionEffects: { acPenalty: 2, acPenaltySource: 'Noxious Miasma' },
            badge: '(\u22122 from Noxious Miasma)',
            title: 'Noxious Miasma penalty',
        },
    ])('subtracts $badge from base AC and titles it "$title" — $name', ({ conditionEffects, badge, title }) => {
        renderSummary({ conditionEffects });
        const penaltyBadge = screen.getByText(badge);
        expect(armorClassLine()).toContainElement(penaltyBadge);
        expect(penaltyBadge).toHaveAttribute('title', title);
        expect(armorClassLine()).toHaveTextContent('Armor Class: 16');
        if (conditionEffects.acPenaltySource) {
            expect(screen.queryByText(/from Slow/)).not.toBeInTheDocument();
        }
    });

    it('shows no penalty indicator and keeps base AC when acPenalty is zero', () => {
        renderSummary({ conditionEffects: { acPenalty: 0 } });
        expect(screen.queryByText(/from Slow/)).not.toBeInTheDocument();
        expect(armorClassLine()).toHaveTextContent('Armor Class: 18');
    });
});

// ---------------------------------------------------------------------------
// Warding Bond — flat AC bonus badge folds into the total alongside an
// active Slow penalty (independent +/- modifiers on one total).
// The stacked case subsumes the unstacked one: same badge, tooltip, and
// +1 fold-in arithmetic, with the penalty proving independence.
// ---------------------------------------------------------------------------
describe('CharSummary - AC Warding Bond Bonus', () => {
    it('renders (+1 from Warding Bond) and stacks it with the Slow penalty into one total', () => {
        renderSummary({ conditionEffects: { wardingBondAcBonus: 1, acPenalty: 2 } });
        const wardBadge = screen.getByText('(+1 from Warding Bond)');
        expect(armorClassLine()).toContainElement(wardBadge);
        expect(wardBadge).toHaveAttribute('title', 'From Warding Bond');
        expect(screen.getByText('(\u22122 from Slow)')).toBeInTheDocument();
        expect(armorClassLine()).toHaveTextContent('Armor Class: 17');
    });
});

// ---------------------------------------------------------------------------
// AC total calculation — buff-driven branches of computeArmorClassValue:
// multi-key bonus sum, mage-armor replace-and-stack branch, barkskin pin.
// Numbers only; the badge TEXT for these buffs is owned by
// CharSummary-BuffEffects.test.jsx.
// ---------------------------------------------------------------------------
describe('CharSummary - Armor Class Total Calculation', () => {
    it.each([
        { name: 'stacked Haste + Shield on base AC', buffs: [{ effect: 'haste' }, { effect: 'shield' }], expectedAC: 25 },
        { name: 'Mage Armor replaces base AC (13 + Dex 2)', buffs: [{ effect: 'mage_armor', baseAc: 13 }], expectedAC: 15 },
        { name: 'Mage Armor stacks with Shield', buffs: [{ effect: 'mage_armor', baseAc: 13 }, { effect: 'shield' }], expectedAC: 20 },
        { name: 'Barkskin pins AC to 17, replacing the base value', buffs: [{ effect: 'barkskin' }], expectedAC: 17 },
    ])('computes AC $expectedAC for $name', ({ buffs, expectedAC }) => {
        renderSummary({ buffs });
        expect(armorClassLine()).toHaveTextContent(`Armor Class: ${expectedAC}`);
    });
});
