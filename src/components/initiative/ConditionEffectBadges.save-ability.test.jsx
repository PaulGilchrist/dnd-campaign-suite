// @maintained-by-ai
// Save-ability badge lane for ConditionEffectBadges: exact label/title bytes
// for the derived save/advantage counters and the ability-list suffix join
// ('Adv Save', 'Save Disadv (dex, con)', 'Check Disadv (str, dex)',
// 'Adv Check'), the component-internal ruleset gate on the Dodge→'Adv DEX
// Save' face (BA-001), and cross-creature Vow-of-Enmity→'Adv' resolution
// (accept + reject, plus the reasons-append tooltip).
// Ownership cites — generic first-wins label dedupe and mixed-kind ordering:
// ConditionEffectBadges.common.test.jsx (#822, incl. the 'Save Disadv'⇄
// 'Save Disadv (STR)' te collision at :90-92); rider-save 'Save Disadv',
// 'Disadv vs', 'No Adv vs' and base counter faces: ConditionEffectBadges
// .test.jsx; click→store removal: effect-removal / target-effect-removal
// (#825/#827); no-OA/speedy faces: no-oa-speedy (#827); empty state: base.
// Ability abbreviation map owner: MonsterCardModal.test-utils.test.js:147.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
}));

// NOTE: the legacy mock of services/ui/storage.js was deleted here
// (carried REC #823) — the component never imports storage.js.
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(),
}));

const CREATURE_NAME = 'Alice';
const CAMPAIGN_NAME = 'test-campaign';

// Minimal house shape: only the accumulator fields the BADGE_SPECS guards
// read from ctx.effects (trimmed-to-factory pattern proven in #828).
// computeConditionEffects is mocked, so conditions keys are inert here.
function baselineEffects() {
    return {
        speedReduction: 0,
        noAdvantageAgainst: false,
        attackAdvantageCount: 0,
        attackAdvantageReasons: [],
        targetAdvantageCount: 0,
        targetAdvantageReasons: [],
        targetDisadvantageCount: 0,
        targetAttackDisadvantageCount: 0,
        saveAdvantageCount: 0,
        saveAdvantageReasons: [],
        dexSaveAdvantageCount: 0,
        saveDisadvantageCount: 0,
        saveDisadvantage: [],
        riderSaveDisadvantage: false,
        riderAttackBonus: 0,
        riderCannotOpportunityAttack: false,
        abilityCheckDisadvantageAbilities: null,
        abilityCheckAdvantageAbilities: null,
        abilityCheckAdvantage: false,
        abilityCheckAdvantageReasons: [],
        hasteActive: false,
        barkskinActive: false,
    };
}

function renderWithEffects(effectsOverrides = {}, props = {}) {
    getRuntimeValue.mockImplementation((name, key, campaign) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return props.buffs || [];
        if (key === 'vowOfEnmityTarget') return campaign ? props.vowTarget ?? null : null;
        return null;
    });
    computeConditionEffects.mockReturnValue({ ...baselineEffects(), ...effectsOverrides });
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={[]}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            allCreatures={props.allCreatures}
            playerStats={props.playerStats}
            isLocalhost={props.isLocalhost ?? true}
        />
    );
}

describe('ConditionEffectBadges - Save & Ability Check Badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Each case pins one distinct observable face byte-for-byte: label plus
    // resolved title (builder tooltip, or the label itself where the spec
    // sets no tooltip and EFFECT_DESCRIPTIONS has no entry).
    it.each([
        {
            name: 'Adv Save carries its reason in the tooltip',
            effects: { saveAdvantageCount: 1, saveAdvantageReasons: ['Foresight'] },
            label: 'Adv Save',
            title: 'Advantage on saving throws (Foresight)',
        },
        {
            name: 'Adv vs carries its reason in the tooltip',
            effects: { targetAdvantageCount: 1, targetAdvantageReasons: ['Reckless Attack'] },
            label: 'Adv vs',
            title: 'Attackers have advantage on attack rolls against this creature (Reckless Attack)',
        },
        {
            name: 'ability-scoped Adv Check lowercases three-letter ability suffix',
            effects: { abilityCheckAdvantageAbilities: ['STR'] },
            label: 'Adv Check (str)',
            title: 'Adv Check (str)',
        },
        {
            name: 'all-checks Adv Check falls back from missing ability list',
            effects: { abilityCheckAdvantage: true, abilityCheckAdvantageReasons: ['Foresight'] },
            label: 'Adv Check',
            // #829 FIXED: was ' ( (Foresight))' (builder double-wrapped —
            // jsx:100 embedded parens in reasonText, then the assembler
            // wrapped again). Builder now emits bare reasons; the assembler
            // owns the parens, matching buildAttackAdvantageBadge and
            // buildSaveAdvantageBadge.
            title: 'Advantage on all ability checks (Foresight)',
        },
        {
            name: 'all-checks Adv Check joins multiple reasons comma-space',
            effects: { abilityCheckAdvantage: true, abilityCheckAdvantageReasons: ['Foresight', 'Guidance'] },
            label: 'Adv Check',
            title: 'Advantage on all ability checks (Foresight, Guidance)',
        },
        {
            name: 'all-checks Adv Check omits the paren suffix with no reasons',
            effects: { abilityCheckAdvantage: true, abilityCheckAdvantageReasons: [] },
            label: 'Adv Check',
            title: 'Advantage on all ability checks',
        },
        {
            name: 'hex save disadvantage joins the ability list in order',
            effects: { saveDisadvantageCount: 1, saveDisadvantage: ['dex', 'con'] },
            label: 'Save Disadv (dex, con)',
            title: 'Save Disadv (dex, con)',
        },
        {
            name: 'hex ability-check disadvantage lowercases and joins abilities',
            effects: { abilityCheckDisadvantageAbilities: ['STR', 'DEX'] },
            label: 'Check Disadv (str, dex)',
            title: 'Check Disadv (str, dex)',
        },
    ])('renders $name', ({ effects, label, title }) => {
        renderWithEffects(effects);
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.getByTitle(title)).toBeInTheDocument();
    });

    // BA-001 runs inside this component: applyActiveBuffs + resolveBadgeRuleset
    // gate the Dodge→dex-save clause on the resolved ruleset.
    it.each([
        { rules: '5e', present: true },
        { rules: '2024', present: false },
    ])('Dodge buff under $rules ruleset renders Adv DEX Save: $present', ({ rules, present }) => {
        renderWithEffects({}, { buffs: [{ name: 'Dodge', effect: 'dodge' }], playerStats: { rules } });
        if (present) {
            expect(screen.getByText('Adv DEX Save')).toBeInTheDocument();
            expect(screen.getByTitle('Advantage on Dexterity saving throws')).toBeInTheDocument();
        } else {
            expect(screen.queryByText('Adv DEX Save')).not.toBeInTheDocument();
        }
    });

    it('renders Adv from another creature Vow of Enmity only while it targets this creature', () => {
        const allCreatures = [{ name: 'Paladin' }];
        const { unmount } = renderWithEffects({}, { allCreatures, vowTarget: CREATURE_NAME });
        expect(screen.getByText('Adv')).toBeInTheDocument();
        expect(screen.getByTitle('Advantage on attack rolls (Vow of Enmity)')).toBeInTheDocument();
        unmount();
        renderWithEffects({}, { allCreatures, vowTarget: 'Bob' });
        expect(screen.queryByText('Adv')).not.toBeInTheDocument();
    });
});
