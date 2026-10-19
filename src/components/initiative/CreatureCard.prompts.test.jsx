// @maintained-by-ai
// Lane: CreatureCard save-tracking prompt rendering + response dispatch (prompts).
// Owned here: prompts appear only under live save-request state (exact text bytes),
// localhost-only gate, no-request absence (falsifiable), underscore-normalised store
// keys, and Success/Failure dispatch of exact payloads to the correct savePromptService fn.
// Owned elsewhere: save roll at handler seam (#847 createRollConditionSaveHandler.test.jsx),
// save-result processing (saveResultHandlers.test.jsx), break dispatches (#850
// CreatureCard.conditions.test.jsx :121/:149), badge census (#849), badge removal (#848),
// avatar/Enter interaction gates (#851 CreatureCard.interactions.test.jsx).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
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

// Card reads all auxiliary runtime state with `|| fallback` guards, so an
// undefined-returning getRuntimeValue keeps unrelated lanes inert and hermetic.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(),
    listeners: new Map(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendFleshToStoneResult: vi.fn(),
    sendPrismaticSprayIndigoResult: vi.fn(),
    sendPrismaticSprayVioletResult: vi.fn(),
}));

const PROMPT_TYPES = [
    { key: '_fleshToStone_Alice', label: 'Flesh to Stone', service: savePromptService.sendFleshToStoneResult },
    { key: '_prismaticSprayIndigo_Alice', label: 'Prismatic Spray (Indigo)', service: savePromptService.sendPrismaticSprayIndigoResult },
    { key: '_prismaticSprayViolet_Alice', label: 'Prismatic Spray (Violet)', service: savePromptService.sendPrismaticSprayVioletResult },
];

describe('CreatureCard - save prompts', () => {
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
        runtimeState.useRuntimeValue.mockReturnValue(null);
        props = {
            creature: alice,
            isActive: false,
            isLocalhost: true,
            campaignNpcs: [],
            overlays: [],
            allCreatures: [alice],
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
    });

    function setPrompts(promptDataByKey) {
        runtimeState.useRuntimeValue.mockImplementation((_scope, key) => promptDataByKey[key] ?? null);
    }

    it('shows all three save prompts with exact counter text for localhost GMs', () => {
        setPrompts({
            '_fleshToStone_Alice': { successes: 1, failures: 2 },
            '_prismaticSprayIndigo_Alice': { successes: 0, failures: 3 },
            '_prismaticSprayViolet_Alice': { successes: 0, failures: 0 },
        });
        render(<CreatureCard {...props} />);
        expect(screen.getByText('Flesh to Stone')).toBeInTheDocument();
        expect(screen.getByText('Saves: 1/3 | Failures: 2/3')).toBeInTheDocument();
        expect(screen.getByText('Prismatic Spray (Indigo)')).toBeInTheDocument();
        expect(screen.getByText('CON Saves: 0/3 | Failures: 3/3')).toBeInTheDocument();
        expect(screen.getByText('Prismatic Spray (Violet)')).toBeInTheDocument();
        expect(screen.getByText("WIS Save (caster's next turn)")).toBeInTheDocument();
    });

    it('reads prompt state from underscore-normalised keys for multi-word creature names', () => {
        const brave = { ...alice, name: 'Alice the Brave' };
        setPrompts({ '_fleshToStone_Alice_the_Brave': { successes: 2, failures: 1 } });
        render(<CreatureCard {...props} creature={brave} allCreatures={[brave]} />);
        expect(screen.getByText('Flesh to Stone')).toBeInTheDocument();
        expect(screen.getByText('Saves: 2/3 | Failures: 1/3')).toBeInTheDocument();
    });

    it('renders no save prompts when no request is pending', () => {
        render(<CreatureCard {...props} />);
        expect(screen.queryByText('Flesh to Stone')).not.toBeInTheDocument();
        expect(screen.queryByText('Prismatic Spray (Indigo)')).not.toBeInTheDocument();
        expect(screen.queryByText('Prismatic Spray (Violet)')).not.toBeInTheDocument();
        expect(screen.queryAllByRole('button', { name: 'Success' })).toHaveLength(0);
        expect(screen.queryAllByRole('button', { name: 'Failure' })).toHaveLength(0);
    });

    it('hides save prompts from non-localhost clients even when a request is live', () => {
        setPrompts({
            '_fleshToStone_Alice': { successes: 1, failures: 2 },
            '_prismaticSprayIndigo_Alice': { successes: 0, failures: 3 },
            '_prismaticSprayViolet_Alice': { successes: 0, failures: 0 },
        });
        render(<CreatureCard {...props} isLocalhost={false} />);
        expect(screen.queryByText('Flesh to Stone')).not.toBeInTheDocument();
        expect(screen.queryByText('Prismatic Spray (Indigo)')).not.toBeInTheDocument();
        expect(screen.queryByText('Prismatic Spray (Violet)')).not.toBeInTheDocument();
        expect(screen.queryAllByRole('button', { name: 'Success' })).toHaveLength(0);
        expect(screen.queryAllByRole('button', { name: 'Failure' })).toHaveLength(0);
    });

    for (const { key, label, service } of PROMPT_TYPES) {
        it(`${label}: Success/Failure dispatch exact payload to its service only`, () => {
            setPrompts({ [key]: { successes: 1, failures: 1 } });
            render(<CreatureCard {...props} />);
            fireEvent.click(screen.getByRole('button', { name: 'Success' }));
            expect(service).toHaveBeenCalledWith('test-campaign', 'Alice', { success: true });
            fireEvent.click(screen.getByRole('button', { name: 'Failure' }));
            expect(service).toHaveBeenCalledWith('test-campaign', 'Alice', { success: false });
            expect(service).toHaveBeenCalledTimes(2);
            for (const other of PROMPT_TYPES) {
                if (other.service !== service) expect(other.service).not.toHaveBeenCalled();
            }
        });
    }
});
