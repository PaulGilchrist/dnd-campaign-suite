// @maintained-by-ai
// L5-003 §8.1 token-move seam regression (bug-steps-of-the-fey-ignores-token-moving):
// with enforcement + tokenMoving ON and the caster armed on a target token, EVERY
// committing leg of StepsOfTheFeyTauntModal must call applyTeleportTokenMove
// (30 ft, anchor = selected combat target) and, when the seam reports a move,
// carry "Token moved (x,y) → (x,y) — N ft." prose plus a teleport_token_move
// automation log entry. Off / degrade (moved:false) ⇒ every leg keeps its
// pre-seam "(GM-positioned)" / "GM positions the token." prose byte-identical
// and logs NO token-move entry. Seam call shape mirrors
// tempTeleportHandler.applyPlainTeleport; seam mock shape mirrors
// tempTeleportHandler.test.js §8.1 describe.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';
import * as teleportService from '../../../services/combat/teleportService.js';
import { getTargetFromAttacker } from '../../../services/rules/combat/damageUtils.js';

const { promptState, anchorState } = vi.hoisted(() => ({
    promptState: { n: 0 },
    // Armed combat target for getTargetFromAttacker (damageUtils is mocked
    // wholesale here, so the anchor comes through this hoisted switch).
    anchorState: { name: 'NPC 1' },
}));

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn((_campaignName, _config) => {
        const promptId = `save-guid-${++promptState.n}`;
        const promise = new Promise((resolve) => {
            const handleSaveResult = (event) => {
                if (event.detail.promptId !== promptId) return;
                window.removeEventListener('save-result', handleSaveResult);
                resolve(event.detail);
            };
            window.addEventListener('save-result', handleSaveResult);
        });
        return { promptId, promise };
    }),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
    getTargetFromAttacker: vi.fn(() => (anchorState.name ? { name: anchorState.name } : null)),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

// Seam mocked per tempTeleportHandler.test.js:37-38 — default is the OFF
// degrade shape; moved legs re-pin it per test.
vi.mock('../../../services/combat/teleportService.js', () => ({
    applyTeleportTokenMove: vi.fn(async () => ({ moved: false, reason: 'token-moving-off' })),
}));

const MOVED = { moved: true, from: { gridX: 4, gridY: 4 }, to: { gridX: 6, gridY: 4 }, distanceFeet: 20 };

const baseProps = {
    mode: 'normal',
    title: 'Steps of the Fey',
    targets: [{ name: 'Goblin1', currentHp: 5, maxHp: 7 }],
    action: { name: 'Steps of the Fey', automation: { type: 'class_feature' } },
    playerStats: { name: 'FeyTrickster' },
    campaignName: 'test-campaign',
    saveDc: 14,
    featureName: 'Steps of the Fey',
    newCount: 3,
    freeCastCountKey: 'stepsRemaining',
    onClose: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

function entryWhere(predicate) {
    return addEntry.mock.calls.map(([, e]) => e).filter(predicate);
}

function tokenMoveEntries() {
    return entryWhere((e) => e && e.automationType === 'teleport_token_move');
}

function openStep(key) {
    fireEvent.click(screen.getByText(`${{ refreshing: 'Refreshing', taunting: 'Taunting', disappearing: 'Disappearing', dreadful: 'Dreadful' }[key]} Step`));
}

async function confirmSelection() {
    fireEvent.click(screen.getByRole('checkbox', { name: /Goblin1/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Taunt|Dreadful/ })); });
}

// The first createSaveListener mint belongs to the lone selected target.
function firstPromptId() {
    return createSaveListener.mock.results[0].value.promptId;
}

describe('StepsOfTheFeyTauntModal - §8.1 teleport token-move seam', () => {
    let randomSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        // Deterministic d10 → 1 so the off-branch log bytes are pin-able.
        randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
        anchorState.name = 'NPC 1';
        teleportService.applyTeleportTokenMove.mockReset();
        teleportService.applyTeleportTokenMove.mockResolvedValue({ moved: false, reason: 'token-moving-off' });
    });

    afterEach(() => {
        randomSpy.mockRestore();
    });

    describe('each committing leg calls the seam with the armed-target anchor', () => {
        it('Refreshing Step: seam called with anchorName + 30 ft; moved ⇒ log + result carry the Token moved clause and a teleport_token_move entry fires', async () => {
            teleportService.applyTeleportTokenMove.mockResolvedValue(MOVED);
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            openStep('refreshing');
            fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
            await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument(); });

            expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledWith(
                expect.objectContaining({ campaignName: 'test-campaign', mapName: null, creatureName: 'FeyTrickster', anchorName: 'NPC 1', maxFeet: 30 }),
            );
            const [abilityUse] = entryWhere((e) => e.type === 'ability_use');
            expect(abilityUse.description).toContain('Token moved (4,4) → (6,4) — 20 ft.');
            expect(abilityUse.description).not.toContain('(GM-positioned)');
            const moveLog = tokenMoveEntries();
            expect(moveLog).toHaveLength(1);
            expect(moveLog[0]).toMatchObject({ type: 'automation', characterName: 'FeyTrickster', automationType: 'teleport_token_move', name: 'Refreshing Step' });
            expect(moveLog[0].description).toContain('(4,4) → (6,4)');
            expect(document.querySelector('.sp-body').textContent).toContain('Token moved (4,4) → (6,4) — 20 ft.');
        });

        it('Disappearing Step: moved ⇒ same seam shape and token-move clause', async () => {
            teleportService.applyTeleportTokenMove.mockResolvedValue(MOVED);
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            openStep('disappearing');
            fireEvent.click(screen.getByRole('button', { name: 'Disappear' }));
            await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument(); });

            expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledWith(
                expect.objectContaining({ creatureName: 'FeyTrickster', anchorName: 'NPC 1', maxFeet: 30 }),
            );
            const [abilityUse] = entryWhere((e) => e.type === 'ability_use');
            expect(abilityUse.description).toContain('Token moved (4,4) → (6,4) — 20 ft.');
            expect(tokenMoveEntries()[0].name).toBe('Disappearing Step');
            expect(document.querySelector('.sp-body').textContent).toContain('Token moved (4,4) → (6,4)');
        });

        it('Taunting Step: seam fires at cast time (before saves resolve); moved ⇒ result copy appends the clause', async () => {
            teleportService.applyTeleportTokenMove.mockResolvedValue(MOVED);
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            openStep('taunting');
            await confirmSelection();

            expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledWith(
                expect.objectContaining({ creatureName: 'FeyTrickster', anchorName: 'NPC 1', maxFeet: 30 }),
            );

            // Resolve the lone save (success — effect lane stays inert, only the
            // teleport moves) and pin the result copy.
            const promptId = firstPromptId();
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success: true } }));
            });
            await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument(); });

            expect(document.querySelector('.sp-body').textContent).toContain('Token moved (4,4) → (6,4) — 20 ft.');
            expect(tokenMoveEntries()[0].name).toBe('Taunting Step');
        });

        it('Dreadful Step: seam fires at cast time; moved ⇒ result copy carries the clause', async () => {
            teleportService.applyTeleportTokenMove.mockResolvedValue(MOVED);
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            openStep('dreadful');
            await confirmSelection();

            expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledWith(
                expect.objectContaining({ creatureName: 'FeyTrickster', anchorName: 'NPC 1', maxFeet: 30 }),
            );

            const promptId = firstPromptId();
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success: true } }));
            });
            await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument(); });

            expect(document.querySelector('.sp-body').textContent).toContain('Token moved (4,4) → (6,4) — 20 ft.');
            expect(tokenMoveEntries()[0].name).toBe('Dreadful Step');
        });

        it('Bewitching Magic free cast: moved ⇒ confirm-result replaces the GM-positions prose with the clause', async () => {
            teleportService.applyTeleportTokenMove.mockResolvedValue(MOVED);
            render(<StepsOfTheFeyTauntModal {...makeProps({ mode: 'bewitchingMagic', unlimited: true, featureName: 'Bewitching Magic' })} />);
            fireEvent.click(screen.getByTestId('bewitching-free-cast-btn'));
            await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument(); });

            expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledWith(
                expect.objectContaining({ creatureName: 'FeyTrickster', anchorName: 'NPC 1', maxFeet: 30 }),
            );
            const body = document.querySelector('.sp-body').textContent;
            expect(body).toContain('Token moved (4,4) → (6,4) — 20 ft.');
            expect(body).not.toContain('GM positions the token');
            const [abilityUse] = entryWhere((e) => e.type === 'ability_use');
            expect(abilityUse.description).toContain('Token moved (4,4) → (6,4) — 20 ft.');
            expect(tokenMoveEntries()).toHaveLength(1);
        });

        it('Misty-Step-only skip: moved ⇒ free-cast log carries the clause', async () => {
            teleportService.applyTeleportTokenMove.mockResolvedValue(MOVED);
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
            await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument(); });

            expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledWith(
                expect.objectContaining({ creatureName: 'FeyTrickster', anchorName: 'NPC 1', maxFeet: 30 }),
            );
            const [abilityUse] = entryWhere((e) => e.type === 'ability_use');
            expect(abilityUse.description).toContain('Token moved (4,4) → (6,4) — 20 ft.');
            expect(document.querySelector('.sp-body').textContent).toContain('Token moved (4,4) → (6,4)');
        });
    });

    describe('OFF / degrade keeps pre-seam prose byte-identical', () => {
        it('Refreshing Step with moved:false ⇒ "(GM-positioned)" retained, no Token moved clause, no teleport_token_move entry', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 3, featureName: 'Steps of the Fey', freeCastCountKey: 'stepsRemaining' })} />);
            openStep('refreshing');
            fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
            await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument(); });

            // The seam is still invoked (it self-gates on enforcement itself);
            // the moved:false return must degrade every string.
            expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledTimes(1);
            const [abilityUse] = entryWhere((e) => e.type === 'ability_use');
            expect(abilityUse.description).toBe('FeyTrickster cast Misty Step for free via Steps of the Fey — no spell slot consumed — teleporting up to 30 feet to an unoccupied space they can see (GM-positioned). Refreshing Step: FeyTrickster gained 1 Temporary Hit Points.');
            expect(abilityUse.description).not.toContain('Token moved');
            expect(tokenMoveEntries()).toHaveLength(0);
            expect(document.querySelector('.sp-body').innerHTML).toBe(
                'Steps of the Fey: Cast Misty Step without expending a spell slot (2 remaining).<br><br><b>Refreshing Step:</b> Gained 1 Temporary Hit Points.'
            );
        });

        it('no armed target ⇒ seam receives anchorName:null (off-branch prose unchanged)', async () => {
            anchorState.name = null;
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            openStep('disappearing');
            fireEvent.click(screen.getByRole('button', { name: 'Disappear' }));
            await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument(); });

            expect(teleportService.applyTeleportTokenMove).toHaveBeenCalledWith(
                expect.objectContaining({ anchorName: null, maxFeet: 30 }),
            );
            expect(getTargetFromAttacker).toHaveBeenCalled();
            const [abilityUse] = entryWhere((e) => e.type === 'ability_use');
            expect(abilityUse.description).toContain('(GM-positioned)');
            expect(tokenMoveEntries()).toHaveLength(0);
        });

        it('Bewitching Magic with moved:false ⇒ "GM positions the token." prose retained byte-identical', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ mode: 'bewitchingMagic', unlimited: true, featureName: 'Bewitching Magic' })} />);
            fireEvent.click(screen.getByTestId('bewitching-free-cast-btn'));
            await waitFor(() => { expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument(); });

            const body = document.querySelector('.sp-body').textContent;
            expect(body).toContain('Teleport up to 30 feet — GM positions the token.');
            expect(body).not.toContain('Token moved');
            expect(tokenMoveEntries()).toHaveLength(0);
        });
    });
});
