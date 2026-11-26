// @maintained-by-ai 2026-11-22
//
// .ct-* design-kit convergence (tranche 2): the character-sheet view rides the
// shared App.css kit. OWNED HERE (unique): the class-contract layer —
//   - the CharSheet view root carries .ct-container (every kit rule in App.css
//     is descendant-scoped under it — the tranche-1 dead-kit lesson), and
//     CharSheet.css re-anchors its own gutters as two-class compounds;
//   - the sheet toolbar (Edit / Delete / Upload / Download) and the rest
//     buttons ride .ct-btn tiers (Delete = .ct-btn-danger) ALONGSIDE the
//     pinned .char-btn locator token (titles/aria-labels untouched);
//   - the bespoke global .char-btn skin was retired from App.css (its rule
//     absence is pinned in App.css.test.jsx).
// Behaviour lanes (delete confirm counting, popup wiring, display) stay in
// the sibling CharSummary-*.test.jsx files — do not duplicate them here.
//
// Mount idiom mirrors CharSummary-DeleteConfirm.test.jsx (the proven minimal
// mock block), except the rest buttons stay REAL — their kit classes are an
// assertion target here.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import CharSummary from './CharSummary.jsx';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

const HERE = dirname(fileURLToPath(import.meta.url));

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => null }));
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

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

function mountSummary() {
    return render(
        <CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            characters={[mockPlayerStats]}
            onDeleteCharacter={vi.fn()}
            onEditCharacter={vi.fn()}
            onUploadClick={vi.fn()}
            onSaveClick={vi.fn()}
            onLongRest={vi.fn()}
        />
    );
}

describe('character-sheet .ct-* kit classes (tranche 2 convergence)', () => {
    it('CharSheet view root carries the kit scoping container', () => {
        const src = readFileSync(join(HERE, '..', 'CharSheet.jsx'), 'utf-8');
        expect(src).toContain("className='char-sheet ct-container'");
        // CharSheet.css re-anchors its gutters as two-class compounds so the
        // kit's 20px padding can never claim the sheet or its print face.
        const css = readFileSync(join(HERE, '..', 'CharSheet.css'), 'utf-8');
        expect(css).toMatch(/\.char-sheet\.ct-container\s*{\s*max-width:\s*900px;\s*padding:\s*10px;/);
        expect(css).toMatch(/\.char-sheet\.ct-container\s*{\s*max-width:\s*7\.75in;\s*padding:\s*0;/);
    });

    it('sheet toolbar buttons ride the kit hierarchy alongside the pinned char-btn token', () => {
        mountSummary();
        const edit = screen.getByTitle('Edit Character');
        expect(edit).toHaveClass('char-btn', 'ct-btn');
        const del = screen.getByTitle('Delete Character');
        expect(del).toHaveClass('char-btn', 'ct-btn', 'ct-btn-danger');
        const upload = screen.getByTitle('Upload Character');
        expect(upload).toHaveClass('char-btn', 'ct-btn');
        const download = screen.getByTitle('Download Character');
        expect(download).toHaveClass('char-btn', 'ct-btn');
        // Pinned DOM contract: aria-labels survive the class convergence.
        expect(edit).toHaveAttribute('aria-label', `Edit "${mockPlayerStats.name}"`);
        expect(del).toHaveAttribute('aria-label', `Delete "${mockPlayerStats.name}"`);
    });

    it('rest buttons ride the plain kit tier', () => {
        mountSummary();
        const short = screen.getByTitle(/Short Rest: spend Hit Dice/);
        expect(short).toHaveClass('char-btn', 'ct-btn');
        const long = screen.getByTitle(/Long Rest/);
        expect(long).toHaveClass('char-btn', 'ct-btn');
    });
});
