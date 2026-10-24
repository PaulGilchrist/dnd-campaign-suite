// @maintained-by-ai
// CreatureCard's OWN feature badges (jsx:566-578) — removal dispatch per kind.
// Owned here (de-facto badge-mechanics owner; CreatureBadge leaf has no direct tests):
//   card-badge × remove → exact dispatch payload per removal lane.
// NOT owned here (do not duplicate):
//   condition break + concentration break removal → CreatureCard.conditions.test.jsx:121/:149
//   badge rendering faces → CreatureCard.badges.test.jsx
//   generic ConditionEffectBadges te removal → ConditionEffectBadges.target-effect-removal.test.jsx
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as buffToggle from '../../services/automation/common/buffToggle.js';
import * as automationPassives from '../../services/combat/automation/automationPassives.js';
import { cleanupWildShape } from '../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js';
import { revertPolymorph } from '../../services/automation/handlers/spells/polymorphService.js';
import { revertAnimalShapes } from '../../services/automation/handlers/spells/animalShapesService.js';
import { revertShapechange } from '../../services/automation/handlers/spells/shapechangeService.js';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name, imagePath }) => {
        return <div data-testid={`avatar-${name}`} className="avatar-wrapper">{imagePath ? <img src={imagePath} alt={name} /> : <span>{name?.charAt(0).toUpperCase() || '?'}</span>}</div>;
    }),
}));

vi.mock('../common/MonsterNameAutocomplete.jsx', () => ({
    default: vi.fn(({ value, onChange, showBadge }) => {
        return <div data-testid="monster-autocomplete"><input data-testid="monster-name-input" value={value} onChange={(e) => onChange(e.target.value)} />{showBadge && <span data-testid="npc-match-badge">NPC Match</span>}</div>;
    }),
}));

vi.mock('./NpcAvatar.jsx', () => ({
    default: vi.fn(({ name, imageUrl, imagePath, onClick }) => {
        const src = imagePath || imageUrl;
        return <div data-testid={`npc-avatar-${name}`} className="npc-avatar" onClick={onClick}>{src ? <img src={src} alt={name} /> : <span>{name?.charAt(0).toUpperCase() || '?'}</span>}</div>;
    }),
}));

vi.mock('./CreatureHp.jsx', () => ({
    default: vi.fn(({ creature }) => {
        return <div data-testid={`creature-hp-${creature.name}`} className="creature-hp"><span>{creature.currentHp ?? 0}/{creature.maxHp ?? 1}</span></div>;
    }),
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
    useRuntimeValue: vi.fn((_campaignName, key) => (key === 'targetEffects' ? [] : null)),
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

// Single deterministic source for both store lanes the card reads:
// useRuntimeValue feeds rendering, getRuntimeValue feeds removal handlers.
function setState({ runtime = {}, campaignEffects = [] } = {}) {
    runtimeState.useRuntimeValue.mockImplementation((_campaign, key) =>
        key === 'targetEffects' ? campaignEffects : null);
    runtimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'targetEffects' && target === 'campaign') return campaignEffects;
        return runtime[`${target}.${key}`] ?? null;
    });
}

// Locate the CreatureBadge remove button ('Remove effect' title contract)
// belonging to the badge with the given label.
function removeBtnFor(label) {
    const badge = screen.getByText(label, { selector: '.creature-badge' });
    return within(badge.parentElement).getByTitle('Remove effect');
}

describe('CreatureCard - badge removal dispatch', () => {
    it('routes transformation badge removals to their revert services (never the store)', () => {
        buffToggle.isBuffActive.mockReturnValue(true);
        setState({
            campaignEffects: [
                { id: 'te-poly', target: 'Alice', effect: 'polymorph' },
                { id: 'te-animal', target: 'Alice', effect: 'animal_shapes' },
                { id: 'te-shape', target: 'Alice', effect: 'shapechange' },
            ],
        });
        render(<CreatureCard {...props} />);

        fireEvent.click(removeBtnFor('Wild Shape'));
        fireEvent.click(removeBtnFor('Polymorph'));
        fireEvent.click(removeBtnFor('Animal Shapes'));
        fireEvent.click(removeBtnFor('Shapechange'));

        expect(cleanupWildShape).toHaveBeenCalledWith('Alice', CAMPAIGN);
        expect(revertPolymorph).toHaveBeenCalledWith('Alice', CAMPAIGN);
        expect(revertAnimalShapes).toHaveBeenCalledWith('Alice', CAMPAIGN);
        expect(revertShapechange).toHaveBeenCalledWith('Alice', CAMPAIGN);
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('filters only its own targetEffect when each campaign-effect badge is removed', () => {
        const reckless = { id: 'te-reckless', target: 'Alice', effect: 'reckless_attack' };
        const sphere = { id: 'te-sphere', target: 'Alice', effect: 'resilient_sphere' };
        const summonBob = { id: 'te-summon-bob', target: 'Alice', effect: 'summoned', source: 'Bob' };
        const summonCarol = { id: 'te-summon-carol', target: 'Alice', effect: 'summoned', source: 'Carol' };
        automationPassives.isResilientSphereActive.mockReturnValue(true);
        automationPassives.getResilientSphereSource.mockReturnValue('Wizard');
        setState({ campaignEffects: [reckless, sphere, summonBob, summonCarol] });
        render(<CreatureCard {...props} />);

        fireEvent.click(removeBtnFor('Reckless Attack'));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [sphere, summonBob, summonCarol], CAMPAIGN);
        fireEvent.click(removeBtnFor('Resilient Sphere'));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [reckless, summonBob, summonCarol], CAMPAIGN);
        fireEvent.click(removeBtnFor('Summoned (Bob)'));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [reckless, sphere, summonCarol], CAMPAIGN);
        fireEvent.click(removeBtnFor('Summoned (Carol)'));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [reckless, sphere, summonBob], CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(4);
    });

    it('routes per-owner store removals to the exact key with filtered value retained around it', () => {
        const bless = { name: 'Bless' };
        const deathWard = { name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Bob' };
        setState({
            runtime: {
                'Alice.wrathOfTheSeaActive': true,
                'Alice.activeBuffs': [deathWard, bless],
                'Druid.naturesSanctuaryActive': true,
                'Druid.naturesSanctuaryCreatures': ['Alice', 'Bob'],
                'Druid.naturesSanctuaryResistance': 'Fire',
                'Ranger.concentration': { spell: "Hunter's Mark", target: 'Alice' },
            },
        });
        render(<CreatureCard {...props} allCreatures={[
            alice,
            { name: 'Ranger', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Alice' } },
            { name: 'Druid', type: 'player' },
        ]} />);

        fireEvent.click(removeBtnFor("Hunter's Mark"));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ranger', 'concentration', null, CAMPAIGN);
        fireEvent.click(removeBtnFor('Wrath of the Sea'));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Alice', 'wrathOfTheSeaActive', false, CAMPAIGN);
        fireEvent.click(removeBtnFor('Sanctuary'));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Druid', 'naturesSanctuaryCreatures', ['Bob'], CAMPAIGN);
        fireEvent.click(removeBtnFor('Death Ward'));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeBuffs', [bless], CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(4);
    });

    it('clears Starry Form via activeBuffs filter plus targetEffects filter posted with skipSync=true', () => {
        const bless = { name: 'Bless' };
        const starryTe = { id: 'te-starry', target: 'Alice', effect: 'starry_form', source: 'Alice' };
        const hexTe = { id: 'te-hex', target: 'Alice', effect: 'hex', source: 'Zed' };
        setState({
            runtime: { 'Alice.activeBuffs': [{ name: 'Starry Form', constellation: 'Chalice' }, bless] },
            campaignEffects: [starryTe, hexTe],
        });
        render(<CreatureCard {...props} />);

        fireEvent.click(removeBtnFor('Starry Form - Chalice'));

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeBuffs', [bless], CAMPAIGN);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [hexTe], CAMPAIGN, true);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
    });

    it("does not clobber the caster's concentration when Hunter's Mark is no longer on the stack", () => {
        setState({ runtime: { 'Ranger.concentration': { spell: 'Hex', target: 'Alice' } } });
        render(<CreatureCard {...props} allCreatures={[
            alice,
            { name: 'Ranger', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Alice' } },
        ]} />);

        fireEvent.click(removeBtnFor("Hunter's Mark"));

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('renders feature badges with zero remove affordances for non-localhost clients', () => {
        setState({
            runtime: {
                'Alice.wrathOfTheSeaActive': true,
                'Alice.activeBuffs': [{ name: 'Death Ward', effect: 'death_ward' }],
                'Ranger.concentration': { spell: "Hunter's Mark", target: 'Alice' },
            },
            campaignEffects: [{ id: 'te-reckless', target: 'Alice', effect: 'reckless_attack' }],
        });
        render(<CreatureCard {...props} isLocalhost={false} allCreatures={[
            alice,
            { name: 'Ranger', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Alice' } },
        ]} />);

        expect(screen.getByText("Hunter's Mark", { selector: '.creature-badge' })).toBeInTheDocument();
        expect(screen.getByText('Wrath of the Sea', { selector: '.creature-badge' })).toBeInTheDocument();
        expect(screen.getByText('Reckless Attack', { selector: '.creature-badge' })).toBeInTheDocument();
        expect(screen.getByText('Death Ward', { selector: '.creature-badge' })).toBeInTheDocument();
        expect(document.querySelectorAll('.creature-badge-remove')).toHaveLength(0);
    });
});
