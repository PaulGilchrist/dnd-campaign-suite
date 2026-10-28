// @maintained-by-ai
//
// Fix#36-queue: character delete double-confirm (CharSummary.jsx leaf +
// useCharacterManagement.js hook stacked two dialogs per single click).
// This lane is the REAL component + REAL hook integration: it mounts the
// genuine CharSummary and the genuine useCharacterManagement through the
// same wrapper shape App.jsx uses (App :598 try/catch dispatcher, no
// confirm), with only the HTTP boundary (campaignService) stubbed.
//
// Ownership verdict (leaf owns, per 8-sibling house canon: Notes, Factions,
// Sessions, Quests, Settlements, NPCs, PartyInventory, CharSummary):
//   - CharSummary.jsx :626 is the single delete prompt owner (byte-intact).
//   - useCharacterManagement.handleDeleteCharacter is a straight dispatcher.
// Consumer map proof: handleDeleteCharacter's only production caller is
// App.jsx :600 (wrapper) <- :655 onDeleteCharacter <- CharSheet <-
// CharSheetContent <- CharSummary leaf (confirms first). No unconfirmed
// production caller exists, so the hook guard goes.
//
// Coverage ownership vs siblings: the leaf-internal accept/cancel contract
// with a mocked onDeleteCharacter stays in CharSummary-Display.test.jsx;
// this lane owns ONLY the cross-layer count contract (exactly one dialog
// end-to-end) and the hook dispatch/state effects behind it.

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import useCharacterManagement from '../../../hooks/management/useCharacterManagement.js';
import * as campaignService from '../../../services/campaign/campaignService.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

// --- CharSummary render surface: same minimal mock block as the Display
// lane (proven sufficient to mount CharSummary without network/store). ---
vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(({ maxGetter }) => ({ current: maxGetter(), update: vi.fn() })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    getStore: vi.fn(() => new Map()),
}));

vi.mock('../../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: vi.fn((_name, _key, defaultValue) => [defaultValue, vi.fn()]),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn(), rollInitiative: vi.fn() })),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfLifeHandler.js', () => ({
    isAuraOfLifeActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

// HTTP boundary only — the hook itself stays REAL so both confirm layers
// are the genuine code paths.
vi.mock('../../../services/campaign/campaignService.js', () => ({
    deleteCharacter: vi.fn(async () => {}),
}));

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

// ---------------------------------------------------------------------------
// Harness: mirrors the App.jsx wiring exactly —
//   App :363  useCharacterManagement(campaignName)
//   App :672  async wrapper: try { await raw(name) } catch { alert(msg) }
//             (service owns the console.error AND the message prefix)
//   App :740  onDeleteCharacter={wrapper} -> CharSheet -> CharSummary leaf
// ---------------------------------------------------------------------------
const _mgmt = { current: null };

function DeleteWiringHarness({ campaignName }) {
    const mgmt = useCharacterManagement(campaignName);
    _mgmt.current = mgmt;

    // App.jsx :672 wrapper — verbatim shape (no confirm here, no prefixing:
    // the service Error already carries "Failed to delete character: ").
    const handleDeleteCharacter = async (characterName) => {
        try {
            await mgmt.handleDeleteCharacter(characterName);
        } catch (error) {
            alert(error.message);
        }
    };

    return (
        <CharSummary
            playerStats={mockPlayerStats}
            campaignName={campaignName}
            exhaustionLevel={0}
            characters={[mockPlayerStats]}
            onDeleteCharacter={handleDeleteCharacter}
        />
    );
}

// Named-confirm copy (2026-10-28-P): house NAMED pattern per Notes/NPCs/
// Factions/Sessions canon — the target is named; irreversibility clause
// retained from the campaign-delete sibling.
const LEAF_MESSAGE = `Delete character "${mockPlayerStats.name}"? This action is irreversible.`;
const HOOK_MESSAGE = `Are you sure you want to delete '${mockPlayerStats.name}'? This cannot be undone.`;

async function renderHarness() {
    await act(async () => {
        render(<DeleteWiringHarness campaignName={mockCampaignName} />);
    });
    act(() => {
        _mgmt.current.setCharacters([{ name: mockPlayerStats.name }, { name: 'Sam' }]);
    });
}

describe('CharSummary delete confirm — real component + real hook (fix#36 queue)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        campaignService.deleteCharacter.mockImplementation(async () => {});
        window.confirm = vi.fn(() => true);
        window.alert = vi.fn();
    });

    afterEach(() => {
        delete window.confirm;
        delete window.alert;
    });

    it('single click raises exactly ONE dialog — the leaf message — and dispatches once', async () => {
        await renderHarness();

        fireEvent.click(screen.getByRole('button', { name: `Delete "${mockPlayerStats.name}"` }));

        // One dialog, exact owner bytes, no second stacked hook dialog.
        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(window.confirm).toHaveBeenCalledWith(LEAF_MESSAGE);
        expect(window.confirm).not.toHaveBeenCalledWith(HOOK_MESSAGE);
        // Named confirm (2026-10-28-P): the prompt names the VIEWED character
        // and never a roster sibling — the roster contains 'Sam', whose
        // delete must not be what this click confirms.
        expect(LEAF_MESSAGE).toContain(mockPlayerStats.name);
        expect(window.confirm.mock.calls[0][0]).not.toContain('Sam');

        await waitFor(() => {
            expect(campaignService.deleteCharacter).toHaveBeenCalledTimes(1);
        });
        // 'Thorin' → case-preserved 'Thorin.json' (canonical create recipe). The
        // old lowercased 'thorin.json' guess caused bug-character-delete-sanitizer-mismatch.
        expect(campaignService.deleteCharacter).toHaveBeenCalledWith(mockCampaignName, 'Thorin.json');
        expect(window.alert).not.toHaveBeenCalled();

        await waitFor(() => {
            expect(_mgmt.current.characters.map(c => c.name)).toEqual(['Sam']);
        });
    });

    it('cancel at the leaf: one dialog, no dispatch, roster intact', async () => {
        window.confirm = vi.fn(() => false);
        await renderHarness();

        fireEvent.click(screen.getByRole('button', { name: `Delete "${mockPlayerStats.name}"` }));

        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(window.confirm).toHaveBeenCalledWith(LEAF_MESSAGE);
        expect(window.confirm.mock.calls[0][0]).toContain(mockPlayerStats.name);
        expect(window.confirm.mock.calls[0][0]).not.toContain('Sam');
        expect(campaignService.deleteCharacter).not.toHaveBeenCalled();
        expect(_mgmt.current.characters.map(c => c.name)).toEqual([mockPlayerStats.name, 'Sam']);
    });
});
