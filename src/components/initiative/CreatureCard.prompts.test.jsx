import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as buffToggle from '../../services/automation/common/buffToggle.js';
import * as savePromptService from '../../services/combat/conditions/savePromptService.js';

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
    default: vi.fn(({ creature, isLocalhost, onChange }) => {
        return <div data-testid={`creature-hp-${creature.name}`} className="creature-hp"><input data-testid={`hp-input-${creature.name}`} type="number" defaultValue={creature.currentHp ?? 0} onBlur={(e) => onChange(creature.name, parseInt(e.target.value) || 0)} disabled={!isLocalhost && creature.type === 'player'} /><span>{creature.currentHp ?? 0}/{creature.maxHp ?? 1}</span></div>;
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
    const useRuntimeValue = vi.fn();
    const getRuntimeValue = vi.fn((target, key, _campaignName) => {
        if (key === 'naturesSanctuaryActive') return sanctuaryMocks.naturesSanctuaryActive?.[target];
        if (key === 'naturesSanctuaryCreatures') return sanctuaryMocks.naturesSanctuaryCreatures?.[target];
        if (key === 'naturesSanctuaryResistance') return sanctuaryMocks.naturesSanctuaryResistance?.[target];
        if (key === 'wrathOfTheSeaActive') return wrathOfTheSeaMocks[target];
        if (key === 'concentration') return { spell: "Hunter's Mark" };
        if (key === 'targetEffects') return runtimeTargetEffects;
        if (key === 'activeBuffs') return runtimeActiveBuffs?.[target];
        return undefined;
    });
    return {
        getStore: vi.fn(() => new Map()),
        useSyncedState: vi.fn(() => [null, vi.fn()]),
        useRuntimeValue,
        getRuntimeValue,
        setRuntimeValue: vi.fn(),
        listeners: new Map(),
    };
});

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendFleshToStoneResult: vi.fn(),
    sendPrismaticSprayIndigoResult: vi.fn(),
    sendPrismaticSprayVioletResult: vi.fn(),
}));

let sanctuaryMocks = {};
let wrathOfTheSeaMocks = {};
let runtimeTargetEffects = [];
let runtimeActiveBuffs = {};

const PROMPT_TYPES = [
    { key: '_fleshToStone_Alice', label: 'Flesh to Stone', service: savePromptService.sendFleshToStoneResult },
    { key: '_prismaticSprayIndigo_Alice', label: 'Prismatic Spray (Indigo)', service: savePromptService.sendPrismaticSprayIndigoResult },
    { key: '_prismaticSprayViolet_Alice', label: 'Prismatic Spray (Violet)', service: savePromptService.sendPrismaticSprayVioletResult },
];

describe('CreatureCard - save prompts', () => {
    let props;

    const defaultPlayerCreature = {
        name: 'Alice',
        type: 'player',
        currentHp: 20,
        maxHp: 20,
        initiative: 14,
        targetName: '',
        conditions: [],
        concentration: null,
    };

    beforeEach(() => {
        props = {
            creature: defaultPlayerCreature,
            isActive: false,
            isLocalhost: true,
            campaignNpcs: [],
            overlays: [],
            allCreatures: [defaultPlayerCreature],
            campaignName: 'test-campaign',
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
        wrathOfTheSeaMocks = {};
        sanctuaryMocks = {};
        runtimeTargetEffects = [];
        runtimeActiveBuffs = {};
        buffToggle.isBuffActive.mockReturnValue(false);
        savePromptService.sendFleshToStoneResult.mockClear();
        savePromptService.sendPrismaticSprayIndigoResult.mockClear();
        savePromptService.sendPrismaticSprayVioletResult.mockClear();
        runtimeState.useRuntimeValue.mockReset();
        runtimeState.useRuntimeValue.mockReturnValue(null);
        runtimeState.getRuntimeValue.mockReset();
    });

    function createPromptMock(promptKey, promptData) {
        runtimeState.useRuntimeValue.mockImplementation((_campaignName, key) => {
            if (key === 'targetEffects') return [];
            if (key === promptKey) return promptData;
            return null;
        });
    }

    describe('Prompt rendering and interaction', () => {
        for (const { key, label, service } of PROMPT_TYPES) {
            describe(label, () => {
                it('should render prompt with data for localhost', () => {
                    createPromptMock(key, { successes: 1, failures: 1 });
                    render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" isLocalhost={true} />);
                    expect(screen.getByText(label)).toBeInTheDocument();
                });

                it('should not render prompt for non-localhost', () => {
                    createPromptMock(key, { successes: 1, failures: 1 });
                    render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" isLocalhost={false} />);
                    expect(screen.queryByText(label)).not.toBeInTheDocument();
                });

                it('should call the correct service on success button click', () => {
                    createPromptMock(key, { successes: 0, failures: 0 });
                    render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" isLocalhost={true} />);
                    fireEvent.click(screen.getByRole('button', { name: 'Success' }));
                    expect(service).toHaveBeenCalledWith('test-campaign', 'Alice', { success: true });
                });

                it('should call the correct service on failure button click', () => {
                    createPromptMock(key, { successes: 0, failures: 0 });
                    render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" isLocalhost={true} />);
                    fireEvent.click(screen.getByRole('button', { name: 'Failure' }));
                    expect(service).toHaveBeenCalledWith('test-campaign', 'Alice', { success: false });
                });
            });
        }
    });

    describe('Display format', () => {
        const fleshToStoneKey = '_fleshToStone_Alice';
        const indigoKey = '_prismaticSprayIndigo_Alice';

        const testCases = [
            { successes: 0, failures: 0, expected: /Saves:\s+0\/3\s+\|\s+Failures:\s+0\/3/ },
            { successes: 0, failures: 3, expected: /Saves:\s+0\/3\s+\|\s+Failures:\s+3\/3/ },
            { successes: 1, failures: 2, expected: /Saves:\s+1\/3\s+\|\s+Failures:\s+2\/3/ },
        ];

        for (const { successes, failures, expected } of testCases) {
            it(`Flesh to Stone - displays saves/failures correctly (${successes}/${failures})`, () => {
                createPromptMock(fleshToStoneKey, { successes, failures });
                render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" isLocalhost={true} />);
                expect(screen.getByText('Flesh to Stone')).toBeInTheDocument();
                expect(screen.getByText(expected)).toBeInTheDocument();
            });

            it(`Prismatic Spray (Indigo) - displays saves/failures correctly (${successes}/${failures})`, () => {
                createPromptMock(indigoKey, { successes, failures });
                render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" isLocalhost={true} />);
                expect(screen.getByText('Prismatic Spray (Indigo)')).toBeInTheDocument();
                expect(screen.getByText(new RegExp(`CON Saves:\\s+${successes}\\/3\\s+\\|\\s+Failures:\\s+${failures}\\/3`))).toBeInTheDocument();
            });
        }
    });
});
