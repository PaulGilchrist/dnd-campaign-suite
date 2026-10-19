// @maintained-by-ai
// Spell-effect badge lane for ConditionEffectBadges: the te-driven spell
// badges this file owns (taunting_step, compelled_duel, sanctuary, silenced,
// bane_penalty, ray_of_enfeeble_debuff, resistance_damage_reduction,
// bless_bonus, beacon_of_hope) render their exact label + tooltip bytes in
// one golden coexistence render with an exact count (#744), the bane
// self/other polarity flip, displayLabel passthrough, and the find+guard
// suppression. Buff-driven faces (haste/barkskin) are proven to flow through
// the component-internal applyActiveBuffs mapping (compute guards stay falsy).
// Owned elsewhere, not repeated here: control-spell faces, click→escape-save
// callback shape, and the generic wrong-target exclusion — control-spells
// #823; first-wins dedupe / mixed-kind order — common #822; generic ×
// removal dispatch and Taunted/haste/barkskin removal payloads —
// target-effect-removal / effect-removal #825; isLocalhost remove-gating —
// auras #820; per-ability save faces — save-ability #829; empty state —
// base test.jsx. Dead storage.js mock deleted here (carried REC #823 — the
// component never imports storage.js); mocks trimmed to the two functions
// the component imports (#828 pattern).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';

// Trimmed to the two functions the component imports (#828); no storage.js
// mock (dead, REC #823).
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

// Neutral base for this lane, built in the factory (hoisting-safe): every
// guard falsy, so each badge appears only when a test opts its own guard in.
// Counters are unnecessary — no accumulator spec fires with these fixtures.
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        banePenalty: false,
        rayOfEnfeebleDamageReduction: false,
        resistanceDamageReduction: false,
        blessBonus: false,
        beaconOfHope: false,
        hasteActive: false,
        barkskinActive: false,
    })),
}));

const CREATURE_NAME = 'Alice';
const CAMPAIGN_NAME = 'test-campaign';

function laneGuardOverrides(guards) {
    return {
        banePenalty: false,
        rayOfEnfeebleDamageReduction: false,
        resistanceDamageReduction: false,
        blessBonus: false,
        beaconOfHope: false,
        hasteActive: false,
        barkskinActive: false,
        ...guards,
    };
}

// Determinism (#827): defaults re-armed before every test so no prior
// mockImplementation leaks across cases.
beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation(
        (name, key) => (name === CREATURE_NAME && key === 'activeBuffs' ? [] : null)
    );
    computeConditionEffects.mockImplementation(() => laneGuardOverrides({}));
});

function renderBadges({ targetEffects = [], buffs = [], guards = {}, ...props } = {}) {
    getRuntimeValue.mockImplementation(
        (name, key) => (name === CREATURE_NAME && key === 'activeBuffs' ? buffs : null)
    );
    computeConditionEffects.mockReturnValue(laneGuardOverrides(guards));
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={targetEffects}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            isLocalhost={true}
            {...props}
        />
    );
}

describe('ConditionEffectBadges - Spell Effect Badges', () => {
    it('renders the full spell-effect te lane in one coexistence render: exact count, labels, and tooltip bytes', () => {
        renderBadges({
            targetEffects: [
                { target: CREATURE_NAME, effect: 'taunting_step', source: 'Rogue' },
                { target: CREATURE_NAME, effect: 'compelled_duel', source: 'Paladin' },
                { target: CREATURE_NAME, effect: 'sanctuary', source: 'Cleric' },
                { target: CREATURE_NAME, effect: 'bane_penalty', source: 'Cleric' },
                { target: CREATURE_NAME, effect: 'ray_of_enfeeble_debuff', source: 'Wizard', dc: 17 },
                { target: CREATURE_NAME, effect: 'resistance_damage_reduction', source: 'Druid', chosenType: 'Fire' },
                { target: CREATURE_NAME, effect: 'bless_bonus', source: 'Cleric' },
                { target: CREATURE_NAME, effect: 'beacon_of_hope', source: 'Cleric' },
                { target: CREATURE_NAME, effect: 'silenced', source: 'Bard' },
            ],
            guards: {
                banePenalty: true,
                rayOfEnfeebleDamageReduction: true,
                resistanceDamageReduction: true,
                blessBonus: true,
                beaconOfHope: true,
            },
        });

        // Exact count (#744): one badge per te, no dedupe collisions in-lane.
        expect(screen.getAllByTestId('creature-badge')).toHaveLength(9);

        // Distinct tooltip payload bytes per spec (#829 lesson: exact bytes,
        // never regex).
        expect(screen.getByTitle('Disadvantage on attack rolls vs creatures other than Rogue')).toBeInTheDocument();
        expect(screen.getByTitle('Disadvantage on attack rolls vs creatures other than Paladin (Concentration, up to 1 minute)')).toBeInTheDocument();
        expect(screen.getByTitle('Sanctuary from Cleric: Creatures targeting this creature with attack rolls or damaging spells must succeed on a WIS save or lose the attack/spell. Does not protect from areas of effect. Spell ends if the warded creature attacks, casts a spell, or deals damage.')).toBeInTheDocument();
        expect(screen.getByTitle('Bane from Cleric: -1d4 on attack rolls and saving throws')).toBeInTheDocument();
        expect(screen.getByTitle('Ray of Enfeeblement from Wizard: -1d8 to damage rolls, Disadvantage on STR checks. Click to reroll the CON save (DC 17); a success ends the spell.')).toBeInTheDocument();
        expect(screen.getByTitle('Resistance from Druid: reduces Fire damage by 1d4 (once per turn)')).toBeInTheDocument();
        expect(screen.getByTitle('Bless from Cleric: +1d4 on attack rolls and saving throws')).toBeInTheDocument();
        expect(screen.getByTitle('Beacon of Hope from Cleric: Advantage on WIS saves, death saves, and maximized healing')).toBeInTheDocument();
        expect(screen.getByTitle('Silenced by Bard — Deafened, cannot cast spells with Verbal components')).toBeInTheDocument();
    });

    // find+guard suppression is pinned once here via bane; enfeeble/resistance/
    // bless/beacon share the identical guard shape (jsx:346-379).
    it('suppresses guarded spell badges when the compute guard is falsy despite the targetEffect', () => {
        renderBadges({
            targetEffects: [
                { target: CREATURE_NAME, effect: 'bane_penalty', source: 'Cleric' },
                { target: CREATURE_NAME, effect: 'bless_bonus', source: 'Cleric' },
            ],
        });
        expect(screen.queryByText('Bane')).not.toBeInTheDocument();
        expect(screen.queryByText('Bless')).not.toBeInTheDocument();
        expect(screen.queryByTestId('creature-badge')).not.toBeInTheDocument();
    });

    it.each([
        { source: CREATURE_NAME, cls: 'effect-buff' },
        { source: 'Cleric', cls: 'effect-debuff' },
    ])('renders Bane as $cls when the caster is $source', ({ source, cls }) => {
        renderBadges({
            targetEffects: [{ target: CREATURE_NAME, effect: 'bane_penalty', source }],
            guards: { banePenalty: true },
        });
        expect(screen.getByTitle(`Bane from ${source}: -1d4 on attack rolls and saving throws`)).toHaveClass(cls);
    });

    it('passes a custom displayLabel through to the Bane badge label and tooltip', () => {
        renderBadges({
            targetEffects: [{ target: CREATURE_NAME, effect: 'bane_penalty', source: 'Cleric', displayLabel: 'My Bane' }],
            guards: { banePenalty: true },
        });
        expect(screen.getByText('My Bane')).toBeInTheDocument();
        expect(screen.getByTitle('My Bane from Cleric: -1d4 on attack rolls and saving throws')).toBeInTheDocument();
    });

    it('rolls the CON repeat save with the te dc when the Enfeeblement badge is clicked', () => {
        const onRollConditionSave = vi.fn();
        renderBadges({
            targetEffects: [{ target: CREATURE_NAME, effect: 'ray_of_enfeeble_debuff', source: 'Wizard', dc: 17 }],
            guards: { rayOfEnfeebleDamageReduction: true },
            onRollConditionSave,
        });
        fireEvent.click(screen.getByText('Enfeeblement'));
        expect(onRollConditionSave).toHaveBeenCalledTimes(1);
        expect(onRollConditionSave).toHaveBeenCalledWith(CREATURE_NAME, { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: 17, ability: 'con' });
    });

    // Buff-driven faces: guards stay falsy so the badges can only arrive via
    // the component's BUFF_EFFECT_HANDLERS mapping of activeBuffs.
    it('maps haste and barkskin activeBuffs to their badges through applyActiveBuffs', () => {
        renderBadges({
            buffs: [
                { name: 'Haste', effect: 'haste' },
                { name: 'Barkskin', effect: 'barkskin' },
            ],
        });
        expect(screen.getAllByTestId('creature-badge')).toHaveLength(2);
        expect(screen.getByText('Hasted')).toBeInTheDocument();
        expect(screen.getByText('Barkskin')).toBeInTheDocument();
        expect(screen.getByTitle('Haste: Speed doubled, +2 AC, Advantage on DEX saves, Extra action (Attack, Dash, Disengage, Hide, Use Object)')).toBeInTheDocument();
        expect(screen.getByTitle('Barkskin: AC set to 17')).toBeInTheDocument();
    });
});
