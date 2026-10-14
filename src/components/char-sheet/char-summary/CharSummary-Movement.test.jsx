// @improved-by-ai
//
// Coverage ownership (per family delegation):
//   - Class-based unarmored movement in the Speed row: Barbarian (fixture-driven
//     class_levels lookup, incl. level-index and shield-only blocking) and Monk
//     (rulesFactory classRules lane — the only place that seam is verified).
//   - Circle Forms AC override (delegated here by CharSummary-BadgesAndAC).
//
// NOT owned here (delegated — do not re-add):
//   - Exhaustion / condition speed / fly / ice walk → CharSummary-SpeedCalculations.test.jsx
//   - Passive speed_bonus passives (Fast Movement etc.) → CharSummary-PassiveEffects.test.jsx
//   - AC totals, penalties, barkskin/mage-armor numbers → CharSummary-BadgesAndAC.test.jsx
//   - Climb/swim stat overrides → CharSummary-AdditionalCoverage.test.jsx
//
// Quality improvements over previous revision (9 tests → 15 runs):
//   - AC assertions now scope to the Armor Class row (armorClassLine helper,
//     family convention) instead of a document-wide /\bNN\b/ that could match
//     any unrelated "16"/"18" text and pass on broken AC rendering.
//   - Speed assertions now assert the full speed span text AND that the bonus
//     value is absent on negative paths — the old getByText(/25 ft/) passed
//     even if the +10 bonus leaked in elsewhere on the line.
//   - Added Monk unarmored movement lane (was zero-coverage): rulesFactory mock
//     now exposes a shared getUnarmoredMovementIncrease fn so tests can pin a
//     non-zero bonus; armored Monk asserting 25 ft fails loudly if the
//     armor/no-shield guard breaks.
//   - Added Barbarian level-index test (class_levels[level - 1]): catches
//     off-by-one class level lookups, which the old single level-1 case could not.
//   - Added shield-only blocking (computeHasArmorOrShield shield branch) and
//     large_form as a second shape-shift trigger for Circle Forms.
//   - Dropped window.location.hostname mutations (jsdom default is already
//     localhost) and over-mocks of auraOfLife/circleOfPower/deathWard handlers
//     (real guards read the already-mocked runtime store and return false —
//     same mock set as CharSummary-BadgesAndAC.test.jsx).

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import rulesFactory from '../../../services/rules/rulesFactory.js';
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

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

// Shared mock fn so Monk tests can pin the unarmored movement bonus the sheet
// should apply; default 0 keeps non-Monk fixtures unaffected.
vi.mock('../../../services/rules/rulesFactory.js', () => {
    const getUnarmoredMovementIncrease = vi.fn(() => 0);
    const getRules = vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease } }));
    return { default: { getRules }, getRules };
});

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

// ---------------------------------------------------------------------------
// Helpers — speed row span is <b>Speed: </b><span>{n} ft.{suffix}</span>;
// AC row is <div class="clickable"><b>Armor Class: </b>{value}{badges}</div>
// mockPlayerStats base: Hill Dwarf, 25 ft walk, AC 18.
// ---------------------------------------------------------------------------
const renderSummary = (stats, buffs = []) => {
    getActiveBuffs.mockReturnValue(buffs);
    render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
};

const speedSpan = () => screen.getByText(/^\d+ ft\./);
const armorClassLine = () => screen.getByText(/^Armor Class:/).parentElement;

// ---------------------------------------------------------------------------
// Barbarian unarmored movement — fixture class_levels[level - 1] adds a flat
// speed bonus when nothing armor-like is equipped.
// ---------------------------------------------------------------------------
describe('CharSummary - Barbarian Unarmored Movement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    const barbarian = (level, over = {}) => ({
        ...mockPlayerStats,
        level,
        class: {
            name: 'Barbarian',
            major: { name: 'Barbarian' },
            class_levels: [{ class_specific: { unarmored_movement: 10 } }],
        },
        inventory: { equipped: [] },
        equipment: [],
        ...over,
    });

    it('shows 35 ft for an unarmored Barbarian (25 base + 10 feature)', () => {
        renderSummary(barbarian(1));
        expect(speedSpan()).toHaveTextContent(/^35 ft\.$/);
    });

    it('reads the bonus for the current level, not just the first class_levels entry', () => {
        const stats = barbarian(2);
        stats.class.class_levels = [
            { class_specific: { unarmored_movement: 35 } },
            { class_specific: { unarmored_movement: 10 } },
        ];
        renderSummary(stats);
        expect(speedSpan()).toHaveTextContent(/^35 ft\.$/);
    });

    it.each([
        { name: 'armor equipped', inventory: { equipped: ['Scale Mail'] }, equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }] },
        { name: 'shield equipped', inventory: { equipped: ['Shield'] }, equipment: [] },
    ])('blocks the bonus when $name — speed stays at base 25 ft', ({ inventory, equipment }) => {
        renderSummary(barbarian(1, { inventory, equipment }));
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
        expect(screen.queryByText(/35 ft/)).not.toBeInTheDocument();
    });

    it('keeps base speed for a non-Barbarian even when its data carries unarmored_movement', () => {
        const stats = barbarian(1);
        stats.class = { ...stats.class, name: 'Cleric', major: { name: 'Cleric' } };
        renderSummary(stats);
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
        expect(screen.queryByText(/35 ft/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Monk unarmored movement — the only lane that consumes rulesFactory's
// classRules.getUnarmoredMovementIncrease for the Speed row.
// ---------------------------------------------------------------------------
describe('CharSummary - Monk Unarmored Movement (rulesFactory lane)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
        rulesFactory.getRules().classRules.getUnarmoredMovementIncrease.mockReturnValue(10);
    });

    const monk = (over = {}) => ({
        ...mockPlayerStats,
        level: 5,
        class: { name: 'Monk', major: { name: 'Monk' } },
        inventory: { equipped: [] },
        equipment: [],
        ...over,
    });

    it('adds the class-rule bonus to an unarmored, unshielded Monk', () => {
        renderSummary(monk());
        expect(speedSpan()).toHaveTextContent(/^35 ft\.$/);
    });

    it.each([
        { name: 'armor equipped', inventory: { equipped: ['Scale Mail'] }, equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }] },
        { name: 'shield equipped', inventory: { equipped: ['Shield'] }, equipment: [] },
    ])('applies no class-rule bonus when $name', ({ inventory, equipment }) => {
        renderSummary(monk({ inventory, equipment }));
        expect(speedSpan()).toHaveTextContent(/^25 ft\.$/);
        expect(screen.queryByText(/35 ft/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Circle Forms AC override — 13 + WIS modifier while shape_shift/large_form
// is active for Circle of the Moon; every other case keeps base AC 18.
// ---------------------------------------------------------------------------
describe('CharSummary - Circle Forms AC Override', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    const druid = (classInfo, over = {}) => ({
        ...mockPlayerStats,
        class: classInfo,
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        inventory: { equipped: [] },
        equipment: [],
        ...over,
    });

    it.each([
        { name: 'subclass field identifies Moon Druid', class: { name: 'Druid', subclass: { name: 'Circle of the Moon' }, major: { name: 'Circle of the Moon' } }, abilities: [{ name: 'Wisdom', bonus: 3 }], buffs: [{ effect: 'shape_shift' }], expectedAC: 16 },
        { name: 'major field identifies Moon Druid when subclass is absent', class: { name: 'Druid', subclass: null, major: { name: 'Circle of the Moon' } }, abilities: [{ name: 'Wisdom', bonus: 3 }], buffs: [{ effect: 'shape_shift' }], expectedAC: 16 },
        { name: 'large_form triggers the override like shape_shift', class: { name: 'Druid', subclass: { name: 'Circle of the Moon' }, major: { name: 'Circle of the Moon' } }, abilities: [{ name: 'Wisdom', bonus: 3 }], buffs: [{ effect: 'large_form' }], expectedAC: 16 },
        { name: 'missing Wisdom scores the override at flat 13', class: { name: 'Druid', subclass: { name: 'Circle of the Moon' }, major: { name: 'Circle of the Moon' } }, abilities: [], buffs: [{ effect: 'shape_shift' }], expectedAC: 13 },
        { name: 'non-Moon Druid keeps base AC', class: { name: 'Druid', subclass: { name: 'Land' }, major: { name: 'Druid' } }, abilities: [{ name: 'Wisdom', bonus: 3 }], buffs: [{ effect: 'shape_shift' }], expectedAC: 18 },
        { name: 'short-name subclass is not app-canonical and gets no override', class: { name: 'Druid', subclass: { name: 'Moon' }, major: null }, abilities: [{ name: 'Wisdom', bonus: 3 }], buffs: [{ effect: 'shape_shift' }], expectedAC: 18 },
        { name: 'Moon Druid out of beast form keeps base AC', class: { name: 'Druid', subclass: { name: 'Circle of the Moon' }, major: { name: 'Circle of the Moon' } }, abilities: [{ name: 'Wisdom', bonus: 3 }], buffs: [], expectedAC: 18 },
    ])('renders Armor Class $expectedAC when $name', ({ class: classInfo, abilities, buffs, expectedAC }) => {
        renderSummary(druid(classInfo, { abilities }), buffs);
        expect(armorClassLine()).toHaveTextContent(`Armor Class: ${expectedAC}`);
    });
});
