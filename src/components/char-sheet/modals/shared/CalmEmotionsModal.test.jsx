// @maintained-by-ai
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CalmEmotionsModal from './CalmEmotionsModal.jsx';

// Render/UI lane only — cast orchestration, save prompts, effect application,
// careful/heightened behaviour and logging live in CalmEmotionsModal.cast-flow.test.jsx.

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../../services/automation/handlers/spells/calmEmotionsHandler.js', () => ({
    applyCalmEmotionsImmunity: vi.fn().mockResolvedValue(undefined),
    applyCalmEmotionsIndifferent: vi.fn().mockResolvedValue(undefined),
    resolveCalmEmotionsEligibility: vi.fn().mockImplementation(async ({ creatures }) => ({
        eligible: (creatures || []).map(c => c.name),
        ineligible: [],
        advisory: [],
    })),
    logCalmEmotionsEligibility: vi.fn().mockResolvedValue(undefined),
    registerCalmEmotionsExpiration: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { storeSpellLastAttack } from '../../../../services/automation/common/damageRollback.js';
import { applyCalmEmotionsImmunity, applyCalmEmotionsIndifferent, resolveCalmEmotionsEligibility, registerCalmEmotionsExpiration } from '../../../../services/automation/handlers/spells/calmEmotionsHandler.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Calm Emotions',
    automation: { type: 'calm_emotions' },
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { cha: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CHA',
        saveDc: 14,
        onClose: vi.fn(),
        ...overrides,
    };
}

function rowFor(name) {
    return [...document.querySelectorAll('.secondary-target-row')]
        .find(row => row.textContent.includes(name));
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    persistAndNotify.mockReturnValue(undefined);
    getAllyList.mockReturnValue(null);
    resolveCalmEmotionsEligibility.mockImplementation(async ({ creatures }) => ({
        eligible: (creatures || []).map(c => c.name),
        ineligible: [],
        advisory: [],
    }));
});

describe('CalmEmotionsModal - rendering', () => {
    it('renders title, spell description, save info, and every combat creature as a target', () => {
        render(<CalmEmotionsModal {...makeProps()} />);
        expect(screen.getByText('Calm Emotions')).toBeInTheDocument();
        expect(screen.getByText(/20-foot-radius sphere/)).toBeInTheDocument();
        expect(screen.getByText(/CHA/)).toBeInTheDocument();
        expect(screen.getByText(/DC 14/)).toBeInTheDocument();
        expect(document.querySelectorAll('.secondary-target-row')).toHaveLength(3);
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
        expect(screen.getByText('PlayerAlly')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cast Calm Emotions \(3\)/ })).toBeEnabled();
        // Heighten radios only appear when the metamagic is active.
        expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(0);
    });

    it('shows HP percentage for NPCs but hides HP for players', () => {
        render(<CalmEmotionsModal {...makeProps()} />);
        expect(rowFor('Goblin').textContent).toContain('71% HP');
        expect(rowFor('Orc').textContent).toContain('68% HP');
        expect(rowFor('PlayerAlly').textContent).not.toContain('% HP');
    });

    it('shows the empty state with a disabled cast button for empty or null combat summary', () => {
        getCombatSummary.mockReturnValue({ creatures: [] });
        const { unmount } = render(<CalmEmotionsModal {...makeProps()} />);
        expect(screen.getByText('No Humanoid targets available in the sphere.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cast Calm Emotions \(0\)/ })).toBeDisabled();
        unmount();
        getCombatSummary.mockReturnValue(null);
        render(<CalmEmotionsModal {...makeProps()} />);
        expect(screen.getByText('No Humanoid targets available in the sphere.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cast Calm Emotions \(0\)/ })).toBeDisabled();
    });

    it('renders nothing when overlay-targeted with an active overlay, and the full modal otherwise', () => {
        const { unmount } = render(<CalmEmotionsModal {...makeProps({
            playerStats: { ...basePlayerStats, targetName: 'overlay-123' },
            activeOverlay: { name: 'TestOverlay' },
        })} />);
        expect(document.querySelector('.sp-modal')).not.toBeInTheDocument();
        unmount();

        // Overlay-targeted but no overlay active — target list lane renders.
        const second = render(<CalmEmotionsModal {...makeProps({
            playerStats: { ...basePlayerStats, targetName: 'overlay-123' },
        })} />);
        expect(screen.getByText('Calm Emotions')).toBeInTheDocument();
        second.unmount();

        // Active overlay but not overlay-targeted — target list lane still renders.
        render(<CalmEmotionsModal {...makeProps({
            playerStats: { ...basePlayerStats, targetName: 'normal-target' },
            activeOverlay: { name: 'TestOverlay' },
        })} />);
        expect(screen.getByText('Calm Emotions')).toBeInTheDocument();
    });
});

describe('CalmEmotionsModal - target interactions', () => {
    it('toggling a target checkbox excludes and re-includes it, updating the cast count', async () => {
        render(<CalmEmotionsModal {...makeProps()} />);
        const goblinCheckbox = rowFor('Goblin').querySelector('input[type=checkbox]');
        await act(async () => { fireEvent.click(goblinCheckbox); });
        expect(screen.getByRole('button', { name: /Cast Calm Emotions \(2\)/ })).toBeInTheDocument();
        await act(async () => { fireEvent.click(goblinCheckbox); });
        expect(screen.getByRole('button', { name: /Cast Calm Emotions \(3\)/ })).toBeInTheDocument();
    });

    it('offers per-target Grant Immunity / Become Indifferent radios defaulting to immunity, never Charmed', async () => {
        render(<CalmEmotionsModal {...makeProps()} />);
        expect(screen.getAllByText('Become Indifferent')).toHaveLength(3);
        expect(screen.queryByText('Apply Charmed')).not.toBeInTheDocument();

        const goblinRadios = document.querySelectorAll('input[name="choice-Goblin"]');
        const orcRadios = document.querySelectorAll('input[name="choice-Orc"]');
        expect(goblinRadios).toHaveLength(2);
        expect(orcRadios).toHaveLength(2);
        expect(goblinRadios[0].checked).toBe(true);
        expect(orcRadios[0].checked).toBe(true);

        await act(async () => { fireEvent.click(goblinRadios[1]); });
        expect(goblinRadios[1].checked).toBe(true);
        // Independent groups: Orc keeps its own default choice.
        expect(orcRadios[0].checked).toBe(true);
    });

    it('renders a Heighten radio per target when metamagicHeighten is active and allows selecting one', async () => {
        render(<CalmEmotionsModal {...makeProps({ metamagicHeighten: true })} />);
        const heightenRadios = document.querySelectorAll('input[name="heightenTarget"]');
        expect(heightenRadios).toHaveLength(3);
        expect([...heightenRadios].every(r => !r.checked)).toBe(true);
        await act(async () => { fireEvent.click(heightenRadios[1]); });
        expect(heightenRadios[1].checked).toBe(true);
    });

    it('badges Careful Spell protection only on allies when metamagicCareful is active', () => {
        getAllyList.mockReturnValue(['PlayerAlly']);
        const { unmount } = render(<CalmEmotionsModal {...makeProps({ metamagicCareful: true })} />);
        expect(rowFor('PlayerAlly').textContent).toContain('Careful');
        expect(rowFor('Goblin').textContent).not.toContain('Careful');
        unmount();

        getAllyList.mockReturnValue(['OtherAlly']);
        render(<CalmEmotionsModal {...makeProps({ metamagicCareful: true })} />);
        expect(document.querySelector('.secondary-target-row').textContent).not.toContain('Careful');
        expect(screen.queryByText(/Careful/)).not.toBeInTheDocument();
    });

    it('hides ineligible creatures once the eligibility gate resolves', async () => {
        resolveCalmEmotionsEligibility.mockImplementationOnce(async () => ({
            eligible: ['Goblin', 'PlayerAlly'],
            ineligible: [{ name: 'Orc', reason: 'not_humanoid' }],
            advisory: ['no_map_lenient'],
        }));
        render(<CalmEmotionsModal {...makeProps()} />);
        await waitFor(() => {
            expect(document.querySelectorAll('.secondary-target-row')).toHaveLength(2);
        });
        expect(screen.queryByText('Orc')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cast Calm Emotions \(2\)/ })).toBeEnabled();
    });

    it('Skip closes the modal without touching the cast pipeline', () => {
        const onClose = vi.fn();
        render(<CalmEmotionsModal {...makeProps({ onClose })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(applyCalmEmotionsImmunity).not.toHaveBeenCalled();
        expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalled();
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(storeSpellLastAttack).not.toHaveBeenCalled();
        expect(registerCalmEmotionsExpiration).not.toHaveBeenCalled();
        expect(persistAndNotify).not.toHaveBeenCalled();
    });
});
