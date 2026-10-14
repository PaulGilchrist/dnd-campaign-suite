// @maintained-by-ai
//
// Coverage ownership: the `auraComboEffects` prop — the ONLY owner of this prop across the
// CharSummary-* family (verified by grep over all siblings).
//   - Resistances/Immunities rows (ResistanceImmunityLines + the Set-merge in
//     charSummaryCalc.computeResistances): aura types merged with base types and listed
//     exactly once; aura-provided types carry an .aura-source attribution marker with the
//     exact "From <source>'s Aura of Warding" tooltip; no source → no markers.
//   - Speed row (Aura of Alacrity): the aura speedBonus is added to the displayed speed
//     total and attributed by a marker; a bonus without a speedSource is applied silently.
//   - null-prop crash-safety for the whole summary.
//
// NOT owned here (delegated to siblings — do not re-add):
//   - Initiative click-to-roll / advantage / exhaustion penalty → CharSummary-Ally-Initiative.test.jsx
//   - initiative-rolled event clearing surge effects → CharSummary-EventHandlers.test.jsx
//   - Aura/buff BADGES (Aura of Life, Heroes' Feast, Rage resistances) → CharSummary-BuffResistances.test.jsx
//   - AC-row buff badges (.aura-source on Armor Class) → CharSummary-BuffEffects.test.jsx
//   - Speed CSS classes / speed calculation recipes → CharSummary-SpeedCalculations.test.jsx

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CharSummary from './CharSummary.jsx';
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

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfLifeHandler.js', () => ({
    isAuraOfLifeActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(() => false),
    handle: vi.fn(),
}));

const SOURCE = 'Aelar';

function renderSummary(props) {
    return render(
        <CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            {...props}
        />
    );
}

describe('CharSummary - auraComboEffects', () => {
    // One shared path: computeResistances Set-merges auraFx into the base list and
    // ResistanceImmunityLines attributes aura-provided types via .aura-source markers.
    // A broken merge would render the shared type twice; a removed source guard would
    // render "From undefined's ..." markers.
    it.each([
        {
            row: 'Resistances:',
            base: { resistances: ['fire'] },
            aura: { resistances: ['fire', 'cold'], resistanceSource: SOURCE },
            expected: ['Fire', 'Cold'],
            markers: 2,
        },
        {
            row: 'Resistances:',
            base: { resistances: ['fire'] },
            aura: { resistances: ['fire', 'cold'] },
            expected: ['Fire', 'Cold'],
            markers: 0,
        },
        {
            row: 'Immunities:',
            base: { immunities: ['poison'] },
            aura: { immunities: ['poison', 'cold'] },
            expected: ['Poison', 'Cold'],
            markers: 0,
        },
    ])('$row lists the shared type once and carries $markers attribution marker(s)', ({ row, base, aura, expected, markers }) => {
        renderSummary({
            playerStats: { ...mockPlayerStats, ...base },
            auraComboEffects: aura,
        });

        const statRow = screen.getByText(row).closest('div');
        for (const type of expected) {
            expect(within(statRow).getAllByText(new RegExp(type))).toHaveLength(1);
        }
        const found = statRow.querySelectorAll('.aura-source');
        expect(found).toHaveLength(markers);
        for (const marker of found) {
            expect(marker).toHaveAttribute('title', `From ${SOURCE}'s Aura of Warding`);
        }
    });

    // The speedBonus reaches the displayed total through ctx.totalSpeedWithBuff regardless
    // of attribution; the marker only renders when a speedSource names the caster.
    it.each([
        { aura: { speedBonus: 10, speedSource: SOURCE }, marker: true },
        { aura: { speedBonus: 10 }, marker: false },
    ])('speed row totals $aura.speedBonus ft. applied, attributed: $marker', ({ aura, marker }) => {
        renderSummary({ auraComboEffects: aura });

        expect(screen.getByText(`${mockPlayerStats.race.subrace.speed + aura.speedBonus} ft.`)).toBeInTheDocument();
        const speedMarker = screen.queryByTitle(`From ${SOURCE}'s Aura of Alacrity`);
        if (marker) {
            expect(speedMarker).toHaveClass('aura-source');
            expect(speedMarker).toHaveTextContent(`(+${aura.speedBonus})`);
        } else {
            expect(speedMarker).not.toBeInTheDocument();
        }
    });

    // null is the crash-prone value; production guards it via `?.` and `|| {}`.
    it('renders a plain summary with no aura rows or markers when auraComboEffects is null', () => {
        renderSummary({
            playerStats: { ...mockPlayerStats, resistances: [], immunities: [] },
            auraComboEffects: null,
        });

        expect(screen.getByText(mockPlayerStats.name)).toBeInTheDocument();
        expect(screen.queryByText('Resistances:')).not.toBeInTheDocument();
        expect(screen.queryByText('Immunities:')).not.toBeInTheDocument();
        expect(document.querySelectorAll('.aura-source')).toHaveLength(0);
    });
});
