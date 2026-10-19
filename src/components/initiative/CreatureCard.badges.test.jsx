// @maintained-by-ai
// CreatureCard's OWN badge render census — which badges appear, by exact label,
// with exact semantic class bytes, under each distinct card state (jsx:524-578).
// Owned here (render lane):
//   full localhost badge census (label → class map, exact set, remove-affordance count)
//   honest zero-badge state incl. gate decoys (wrong list, wrong spell, missing byte, other-target te)
//   player-only gating bytes (Majesty, Wrath of the Sea stay hidden on NPC cards)
// NOT owned here (do not duplicate):
//   removal dispatch payloads + non-localhost zero remove affordances → CreatureCard.badgeRemoval.test.jsx (#848)
//   condition-break click :126 / concentration-break click :153 dispatch → CreatureCard.conditions.test.jsx
//   ConditionEffectBadges-hosted te badges → ConditionEffectBadges.* family (#820-#832)
//   target-select / add-button / NPC-remove / HP / initiative faces → interactions + rendering + conditions siblings
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as buffToggle from '../../services/automation/common/buffToggle.js';
import * as automationPassives from '../../services/combat/automation/automationPassives.js';
import * as majesty from '../../services/combat/auras/unbreakableMajesty.js';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`avatar-${name}`} className="avatar-wrapper">{name?.charAt(0).toUpperCase() || '?'}</div>),
}));

vi.mock('../common/MonsterNameAutocomplete.jsx', () => ({
    default: vi.fn(({ value }) => <div data-testid="monster-autocomplete"><input data-testid="monster-name-input" value={value} readOnly /></div>),
}));

vi.mock('./NpcAvatar.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`npc-avatar-${name}`} className="npc-avatar">{name?.charAt(0).toUpperCase() || '?'}</div>),
}));

vi.mock('./CreatureHp.jsx', () => ({
    default: vi.fn(({ creature }) => <div data-testid={`creature-hp-${creature.name}`} className="creature-hp"><span>{creature.currentHp ?? 0}/{creature.maxHp ?? 1}</span></div>),
}));

vi.mock('./ConditionEffectBadges.jsx', () => ({
    default: vi.fn(({ conditions, targetEffects, creatureName }) => {
        const children = [];
        (conditions || []).forEach(c => children.push(<span key={c.id} data-testid={`effect-condition-${c.id}`}>{c.label}</span>));
        (targetEffects || []).forEach(te => children.push(<span key={te.id} data-testid={`effect-target-${te.id}`}>{te.effect}</span>));
        return <div data-testid={`condition-effects-${creatureName}`}>{children}</div>;
    }),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    listeners: new Map(),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(() => false),
    getResilientSphereSource: vi.fn(() => null),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
    clearUnbreakableMajesty: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js', () => ({
    cleanupWildShape: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
    revertPolymorph: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
    revertAnimalShapes: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({
    revertShapechange: vi.fn(),
}));

const CAMPAIGN = 'test-campaign';

const alice = {
    name: 'Alice',
    type: 'player',
    currentHp: 20,
    maxHp: 20,
    initiative: 14,
    targetName: '',
    conditions: [],
    concentration: null,
};

let props;

beforeEach(() => {
    vi.clearAllMocks();
    buffToggle.isBuffActive.mockReturnValue(false);
    automationPassives.isResilientSphereActive.mockReturnValue(false);
    automationPassives.getResilientSphereSource.mockReturnValue(null);
    majesty.isUnbreakableMajestyActive.mockReturnValue(false);
    majesty.getUnbreakableMajestySaveDc.mockReturnValue(0);
    props = {
        creature: alice,
        isActive: false,
        isLocalhost: true,
        campaignNpcs: [],
        overlays: [],
        allCreatures: [alice],
        campaignName: CAMPAIGN,
        onRemoveNpc: vi.fn(),
        onNpcClick: vi.fn(),
        onNameChange: vi.fn(),
        onHpChange: vi.fn(),
        onInitiativeChange: vi.fn(),
        onTargetChange: vi.fn(),
        onRollConditionSave: vi.fn(),
        onBreakCondition: vi.fn(),
        onOpenEffectAdder: vi.fn(),
        onRollConcentrationSave: vi.fn(),
        onBreakConcentration: vi.fn(),
    };
});

// Single deterministic source for both store lanes the card reads (mirrors
// badgeRemoval's exemplar): useRuntimeValue feeds rendering, getRuntimeValue
// feeds lookup helpers, so census counts stay falsifiable against one fixture.
function setState({ runtime = {}, campaignEffects = [] } = {}) {
    runtimeState.useRuntimeValue.mockImplementation((_campaign, key) =>
        key === 'targetEffects' ? campaignEffects : null);
    runtimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'targetEffects' && target === 'campaign') return campaignEffects;
        return runtime[`${target}.${key}`] ?? null;
    });
}

// label → full class string, exact-set census of the card's own CreatureBadges.
function badgeCensus() {
    return Object.fromEntries(
        [...document.querySelectorAll('.creature-badge')].map(el => [el.textContent.trim(), el.getAttribute('class')])
    );
}

describe('CreatureCard - badge render census', () => {
    it('lights every feature badge with exact label and semantic class when every lane is active (localhost player)', () => {
        buffToggle.isBuffActive.mockReturnValue(true);
        automationPassives.isResilientSphereActive.mockReturnValue(true);
        automationPassives.getResilientSphereSource.mockReturnValue('Zed');
        majesty.isUnbreakableMajestyActive.mockReturnValue(true);
        majesty.getUnbreakableMajestySaveDc.mockReturnValue(18);
        setState({
            runtime: {
                'Alice.wrathOfTheSeaActive': true,
                'Alice.activeBuffs': [
                    { name: 'Starry Form', constellation: 'Archer' },
                    { name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Bob' },
                ],
                'Druid.naturesSanctuaryActive': true,
                'Druid.naturesSanctuaryCreatures': ['Alice'],
                'Druid.naturesSanctuaryResistance': 'Fire',
            },
            campaignEffects: [
                { id: 'te-poly', target: 'Alice', effect: 'polymorph' },
                { id: 'te-animal', target: 'Alice', effect: 'animal_shapes' },
                { id: 'te-shape', target: 'Alice', effect: 'shapechange' },
                { id: 'te-reckless', target: 'Alice', effect: 'reckless_attack' },
                { id: 'te-summon-alice', target: 'Alice', effect: 'summoned', source: 'Alice' },
                { id: 'te-summon-void', target: 'Alice', effect: 'summoned', source: null },
            ],
        });
        render(<CreatureCard {...props} creature={{
            ...alice,
            conditions: [
                { id: 'c1', key: 'prone', label: 'Prone', dc: 10, ability: 'str' },
                { id: 'c2', key: 'invisible', label: 'Invisible' },
            ],
            concentration: { spell: 'Fly', dc: 12 },
        }} allCreatures={[
            { ...alice, conditions: [
                { id: 'c1', key: 'prone', label: 'Prone', dc: 10, ability: 'str' },
                { id: 'c2', key: 'invisible', label: 'Invisible' },
            ], concentration: { spell: 'Fly', dc: 12 } },
            { name: 'Ranger', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Alice' } },
            { name: 'Druid', type: 'player' },
        ]} />);

        expect(badgeCensus()).toEqual({
            'Prone DC 10': 'creature-badge effect-condition',
            'Invisible': 'creature-badge effect-buff',
            'Fly DC 12': 'creature-badge effect-neutral',
            "Hunter's Mark": 'creature-badge effect-neutral',
            'Majesty DC 18': 'creature-badge effect-buff',
            'Wild Shape': 'creature-badge effect-buff',
            'Polymorph': 'creature-badge effect-buff',
            'Animal Shapes': 'creature-badge effect-buff',
            'Shapechange': 'creature-badge effect-buff',
            'Starry Form - Archer': 'creature-badge effect-buff',
            'Wrath of the Sea': 'creature-badge effect-buff',
            'Sanctuary': 'creature-badge effect-buff',
            'Reckless Attack': 'creature-badge effect-debuff',
            'Summoned (Alice)': 'creature-badge effect-summoned',
            'Summoned': 'creature-badge effect-summoned',
            'Death Ward': 'creature-badge effect-buff',
            'Resilient Sphere': 'creature-badge effect-debuff',
        });
        // Every badge on a localhost card carries exactly one remove affordance
        // (dispatch payloads owned by badgeRemoval; here only presence is pinned).
        expect(screen.getAllByTitle('Remove effect')).toHaveLength(17);
        // Dynamic tooltip bytes carry lane data shown nowhere else on the card.
        expect(screen.getByText("Hunter's Mark", { selector: '.creature-badge' }).getAttribute('title')).toBe('Marked by Ranger');
        const sanctuaryTip = screen.getByText('Sanctuary', { selector: '.creature-badge' }).getAttribute('title');
        expect(sanctuaryTip).toContain('Fire resistance');
        expect(sanctuaryTip).toContain('Protected by Druid');
    });

    it('renders zero badges for gate decoys — wrong sanctuary list, wrong concentration spell, buffs missing their gate byte, targetEffects owned by another creature', () => {
        setState({
            runtime: {
                'Druid.naturesSanctuaryActive': true,
                'Druid.naturesSanctuaryCreatures': ['Bob'],
                'Alice.activeBuffs': [
                    { name: 'Death Ward' },
                    { name: 'Starry Form' },
                ],
            },
            campaignEffects: [
                { id: 'te-summon-bob', target: 'Bob', effect: 'summoned', source: 'Alice' },
                { id: 'te-reckless-bob', target: 'Bob', effect: 'reckless_attack' },
                { id: 'te-poly-bob', target: 'Bob', effect: 'polymorph' },
            ],
        });
        render(<CreatureCard {...props} allCreatures={[
            alice,
            { name: 'Ranger', type: 'player', concentration: { spell: 'Hex', target: 'Alice' } },
            { name: 'Druid', type: 'player' },
            { name: 'Bob', type: 'npc' },
        ]} />);

        expect(document.querySelectorAll('.creature-badge')).toHaveLength(0);
        expect(screen.queryByTitle('Remove effect')).not.toBeInTheDocument();
    });

    it('keeps player-gated badges (Majesty, Wrath of the Sea) hidden on NPC cards even when their state is live', () => {
        majesty.isUnbreakableMajestyActive.mockReturnValue(true);
        setState({ runtime: { 'Goblin.wrathOfTheSeaActive': true } });
        const goblin = { ...props.creature, name: 'Goblin', type: 'npc' };
        render(<CreatureCard {...props} creature={goblin} allCreatures={[goblin]} />);

        expect(document.querySelectorAll('.creature-badge')).toHaveLength(0);
    });
});
