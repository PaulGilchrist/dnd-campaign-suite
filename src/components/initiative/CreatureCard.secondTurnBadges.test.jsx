// @maintained-by-ai
// CLA-360 ST-row display parity (FU 2026-11-09): a structural second-turn row
// DISPLAYS the holder's targetEffects and concentration (the Add modal remaps
// writes to the holder — c5883e4a4 — so the old self-name filter left the row
// card blind) and its badge × acts on the HOLDER's row, auditing the holder —
// never the synthetic "(Second Turn)" name (same law as 583d078ff/930393775).
// Owned here (display derivations in CreatureCard.jsx):
//   te filter + ConditionEffectBadges creatureName → effectSubjectName
//   concentration badge → holder row lookup for ST rows only
// NOT owned here:
//   REMOVE_HANDLERS payload shapes → ConditionEffectBadges.target-effect-removal
//   condition-badge × holder routing → createAutoBreakConditionHandler.second-turn
//   Add-modal remap → Initiative.effectAdder-second-turn
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as buffToggle from '../../services/automation/common/buffToggle.js';
import * as automationPassives from '../../services/combat/automation/automationPassives.js';
import * as majesty from '../../services/combat/auras/unbreakableMajesty.js';
import * as combatLogging from '../../services/encounters/combatLoggingService.js';

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

// Real ConditionEffectBadges (badge face, removal lanes) — the audit seam must
// be observable, so only the log side is mocked.
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConditionEvent: vi.fn(),
    logConcentrationSave: vi.fn(),
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
const SLASHER_LABEL = 'Slasher Crit: Attacks Disadv';
const SYNTHETIC = 'Alice (Second Turn)';

const alice = {
    name: 'Alice',
    type: 'player',
    currentHp: 20,
    maxHp: 20,
    initiative: 14,
    conditions: [],
    concentration: null,
};

const aliceSt = {
    ...alice,
    name: SYNTHETIC,
    initiative: 12,
    secondTurn: true,
    holderName: 'Alice',
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

function setState({ campaignEffects = [] } = {}) {
    runtimeState.useRuntimeValue.mockImplementation((_campaign, key) =>
        key === 'targetEffects' ? campaignEffects : null);
    runtimeState.getRuntimeValue.mockImplementation((target, key) => {
        if (key === 'targetEffects' && target === 'campaign') return campaignEffects;
        return null;
    });
}

describe('CreatureCard - second-turn badge display parity (CLA-360)', () => {
    it('renders the holder-targeted te badge on the ST row card and its × removes/audits under the HOLDER name', () => {
        const slasherTe = { id: 'te-slash', target: 'Alice', effect: 'slasher_enhanced_critical', source: 'Zed' };
        setState({ campaignEffects: [slasherTe] });
        render(<CreatureCard {...props} creature={aliceSt} allCreatures={[alice, aliceSt]} />);

        // Parity: the badge the holder card shows now also shows on the ST card.
        expect(screen.getByText(SLASHER_LABEL, { selector: '.creature-badge' })).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Remove effect'));
        // Holder subject: the filter drops the 'Alice'-targeted row (survivors
        // empty). A synthetic-name subject would have found nothing to remove
        // and written the te back unchanged.
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], CAMPAIGN);
        expect(combatLogging.logConditionEvent).toHaveBeenCalledTimes(1);
        expect(combatLogging.logConditionEvent).toHaveBeenCalledWith({
            campaignName: CAMPAIGN,
            action: 'target-effect-removed',
            creatureName: 'Alice',
            conditionLabel: SLASHER_LABEL,
        });
    });

    it('renders the holder cs row concentration badge on the ST card and breaks the HOLDER on ×', () => {
        const holder = { ...alice, concentration: { spell: 'Barkskin', dc: 15 } };
        setState();
        render(<CreatureCard {...props} creature={aliceSt} allCreatures={[holder, aliceSt]} />);

        expect(screen.getByText('Barkskin DC 15', { selector: '.creature-badge' })).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Remove effect'));
        expect(props.onBreakConcentration).toHaveBeenCalledTimes(1);
        expect(props.onBreakConcentration).toHaveBeenCalledWith('Alice');
        expect(props.onBreakConcentration).not.toHaveBeenCalledWith(SYNTHETIC);
    });

    it('shows no parity badges on a NON-second-turn row whose name matches nothing (decoy card)', () => {
        const bob = { ...alice, name: 'Bob', concentration: null };
        const holder = { ...alice, concentration: { spell: 'Barkskin', dc: 15 } };
        setState({ campaignEffects: [{ id: 'te-slash', target: 'Alice', effect: 'slasher_enhanced_critical', source: 'Zed' }] });
        render(<CreatureCard {...props} creature={bob} allCreatures={[alice, holder, bob]} />);

        expect(screen.queryByText(SLASHER_LABEL, { selector: '.creature-badge' })).not.toBeInTheDocument();
        expect(screen.queryByText('Barkskin DC 15', { selector: '.creature-badge' })).not.toBeInTheDocument();
        expect(screen.queryByTitle('Remove effect')).not.toBeInTheDocument();
    });

    it('regression: a normal (non-ST) row still renders its own te + concentration badges and dispatches its own name', () => {
        const own = { ...alice, concentration: { spell: 'Fly', dc: 12 } };
        setState({ campaignEffects: [{ id: 'te-slash', target: 'Alice', effect: 'slasher_enhanced_critical', source: 'Zed' }] });
        render(<CreatureCard {...props} creature={own} allCreatures={[own]} />);

        expect(screen.getByText(SLASHER_LABEL, { selector: '.creature-badge' })).toBeInTheDocument();
        expect(screen.getByText('Fly DC 12', { selector: '.creature-badge' })).toBeInTheDocument();

        const removeBtns = screen.getAllByTitle('Remove effect');
        expect(removeBtns).toHaveLength(2);
        fireEvent.click(removeBtns[1]);
        expect(props.onBreakConcentration).toHaveBeenCalledWith('Alice');
    });
});
