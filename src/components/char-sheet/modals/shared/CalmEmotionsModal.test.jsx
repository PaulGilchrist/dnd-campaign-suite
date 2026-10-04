// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CalmEmotionsModal from './CalmEmotionsModal.jsx';

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
import { applyCalmEmotionsImmunity, applyCalmEmotionsIndifferent, resolveCalmEmotionsEligibility, logCalmEmotionsEligibility, registerCalmEmotionsExpiration } from '../../../../services/automation/handlers/spells/calmEmotionsHandler.js';

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
    logCalmEmotionsEligibility.mockResolvedValue(undefined);
});

describe('CalmEmotionsModal', () => {
    // ── Rendering ──

    describe('initial render', () => {
        it('renders the modal with title, targets, save info, and cast button', () => {
            render(<CalmEmotionsModal {...makeProps()} />);
            expect(screen.getByText('Calm Emotions')).toBeInTheDocument();
            expect(screen.getByText(/20-foot-radius sphere/)).toBeInTheDocument();
            expect(screen.getByText(/CHA/)).toBeInTheDocument();
            expect(screen.getByText(/DC 14/)).toBeInTheDocument();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Orc')).toBeInTheDocument();
            expect(screen.getByText('PlayerAlly')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Cast Calm Emotions \(3\)/ })).toBeInTheDocument();
        });

        it('disables the confirm button when no targets available', () => {
            getCombatSummary.mockReturnValue({ creatures: [] });
            render(<CalmEmotionsModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: /Cast Calm Emotions \(0\)/ })).toBeDisabled();
        });
    });

    // ── Target list behavior ──

    describe('target list rendering', () => {
        it('shows all eligible targets by default', () => {
            render(<CalmEmotionsModal {...makeProps()} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            expect(rows).toHaveLength(3);
        });

        it('does not show HP for player targets', () => {
            render(<CalmEmotionsModal {...makeProps()} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            const playerRow = [...rows].find(row => row.textContent.includes('PlayerAlly'));
            expect(playerRow.textContent).not.toContain('% HP');
        });
    });

    // ── Choice selection (immunity vs charmed) ──

    describe('choice selection', () => {
        it('shows choice radios for all targets with independent groups per target', () => {
            render(<CalmEmotionsModal {...makeProps()} />);
            const goblinRadios = document.querySelectorAll('input[name="choice-Goblin"]');
            const orcRadios = document.querySelectorAll('input[name="choice-Orc"]');
            const playerRadios = document.querySelectorAll('input[name="choice-PlayerAlly"]');
            expect(goblinRadios).toHaveLength(2);
            expect(orcRadios).toHaveLength(2);
            expect(playerRadios).toHaveLength(2);
            expect(goblinRadios[0].checked).toBe(true);
            expect(orcRadios[0].checked).toBe(true);
        });

        it('allows switching between immunity and charmed choices', async () => {
            render(<CalmEmotionsModal {...makeProps()} />);
            const goblinRadios = document.querySelectorAll('input[name="choice-Goblin"]');
            await act(async () => { fireEvent.click(goblinRadios[1]); });
            expect(goblinRadios[1].checked).toBe(true);
        });
    });

    // ── Metamagic Heighten ──

    describe('metamagic heighten rendering', () => {
        it('allows selecting a heighten target', async () => {
            render(<CalmEmotionsModal {...makeProps({ metamagicHeighten: true })} />);
            const heightenRadios = document.querySelectorAll('input[name="heightenTarget"]');
            await act(async () => { fireEvent.click(heightenRadios[1]); });
            expect(heightenRadios[1].checked).toBe(true);
        });
    });

    // ── Metamagic Careful ──

    describe('metamagic careful rendering', () => {
        it('shows careful spell protection when metamagicCareful is true and ally is in list', () => {
            getAllyList.mockReturnValue(['PlayerAlly']);
            getRuntimeValue.mockReturnValue([]);
            render(<CalmEmotionsModal {...makeProps({ metamagicCareful: true })} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            const playerRow = [...rows].find(row => row.textContent.includes('PlayerAlly'));
            expect(playerRow.textContent).toContain('Careful');
        });

        it('does not show careful spell protection for non-ally', () => {
            getAllyList.mockReturnValue(['OtherAlly']);
            getRuntimeValue.mockReturnValue([]);
            render(<CalmEmotionsModal {...makeProps({ metamagicCareful: true })} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            const playerRow = [...rows].find(row => row.textContent.includes('PlayerAlly'));
            expect(playerRow.textContent).not.toContain('Careful');
        });
    });

    // ── Close behavior ──

    describe('close behavior', () => {
        it('does not apply any effects when skipped', () => {
            const onClose = vi.fn();
            render(<CalmEmotionsModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(applyCalmEmotionsImmunity).not.toHaveBeenCalled();
            expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalled();
            expect(sendSavePrompt).not.toHaveBeenCalled();
        });
    });

    // ── Empty targets ──

    describe('empty targets', () => {
        it('renders empty target list when no creatures in combat', () => {
            getCombatSummary.mockReturnValue({ creatures: [] });
            render(<CalmEmotionsModal {...makeProps()} />);
            expect(screen.getByText('No Humanoid targets available in the sphere.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Cast Calm Emotions \(0\)/ })).toBeDisabled();
        });

        it('renders the caster as a target when caster is the only creature', () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Wizard1', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 4 } },
                ],
            });
            render(<CalmEmotionsModal {...makeProps()} />);
            expect(screen.getByText('Wizard1')).toBeInTheDocument();
        });
    });

    // ── Overlay targeting ──

    describe('overlay targeting', () => {
        it('renders empty fragment when player is overlay targeted with active overlay', () => {
            render(<CalmEmotionsModal {...makeProps({
                playerStats: { ...basePlayerStats, targetName: 'overlay-123' },
                activeOverlay: { name: 'TestOverlay' },
            })} />);
            expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
            expect(document.querySelector('.sp-modal')).not.toBeInTheDocument();
        });

        it('renders normally when player is overlay targeted but no active overlay', () => {
            render(<CalmEmotionsModal {...makeProps({
                playerStats: { ...basePlayerStats, targetName: 'overlay-123' },
            })} />);
            expect(screen.getByText('Calm Emotions')).toBeInTheDocument();
        });

        it('renders normally when player is not overlay targeted', () => {
            render(<CalmEmotionsModal {...makeProps({
                playerStats: { ...basePlayerStats, targetName: 'normal-target' },
                activeOverlay: { name: 'TestOverlay' },
            })} />);
            expect(screen.getByText('Calm Emotions')).toBeInTheDocument();
        });
    });

    // ── SP-020 fixes ──

    describe('SP-020 fixes', () => {
        it('B7: excludes and re-includes a target with a single checkbox click', async () => {
            render(<CalmEmotionsModal {...makeProps()} />);
            await waitFor(() => expect(screen.getByRole('button', { name: /Cast Calm Emotions \(3\)/ })).toBeInTheDocument());
            const goblinCheckbox = document.querySelector('.secondary-target-row input[type=checkbox]');
            await act(async () => { fireEvent.click(goblinCheckbox); });
            expect(screen.getByRole('button', { name: /Cast Calm Emotions \(2\)/ })).toBeInTheDocument();
            await act(async () => { fireEvent.click(goblinCheckbox); });
            expect(screen.getByRole('button', { name: /Cast Calm Emotions \(3\)/ })).toBeInTheDocument();
        });

        it('B3: offers Become Indifferent instead of Apply Charmed', () => {
            render(<CalmEmotionsModal {...makeProps()} />);
            expect(screen.getAllByText('Become Indifferent')).toHaveLength(3);
            expect(screen.queryByText('Apply Charmed')).not.toBeInTheDocument();
        });

        it('B2: hides ineligible (non-Humanoid) targets once the eligibility gate resolves', async () => {
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
        });

        it('B5/B2: registers the duration clock and logs ineligible creatures on cast', async () => {
            resolveCalmEmotionsEligibility.mockImplementationOnce(async () => ({
                eligible: ['Goblin'],
                ineligible: [{ name: 'Orc', reason: 'not_humanoid' }],
                advisory: [],
            }));
            render(<CalmEmotionsModal {...makeProps()} />);
            await waitFor(() => expect(screen.getByRole('button', { name: /Cast Calm Emotions \(1\)/ })).toBeInTheDocument());
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Cast Calm Emotions/ })); });
            expect(registerCalmEmotionsExpiration).toHaveBeenCalledWith({ casterName: 'Wizard1', campaignName });
            expect(logCalmEmotionsEligibility).toHaveBeenCalledWith(expect.objectContaining({
                ineligible: [{ name: 'Orc', reason: 'not_humanoid' }],
            }));
        });
    });

    // ── Null combat summary ──

    describe('null combat summary', () => {
        it('handles null combat summary gracefully - no targets shown', () => {
            getCombatSummary.mockReturnValue(null);
            render(<CalmEmotionsModal {...makeProps()} />);
            expect(screen.getByText('No Humanoid targets available in the sphere.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Cast Calm Emotions \(0\)/ })).toBeDisabled();
        });
    });

});
