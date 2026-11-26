// @maintained-by-ai 2026-11-17
// Census lock (backlog 2026-11-17 sp-overlay entrance-focus adoption): every
// component file whose ROOT renders the .sp-overlay chrome must adopt the
// shared entrance-focus tier (src/hooks/ui/useOverlayEntranceFocus.js — pull
// to the first focusable on open, stranded-only anchor restore on close) or
// stand in the explicit skip-list below with a concrete reason. New
// .sp-overlay files can therefore no longer silently skip the tier: an
// unadopted, unlisted file fails this test with its path named.
//
// Detection is deliberately regex-level: `className=` followed by an
// "sp-overlay" string/template opening — that is exactly the root-div shape
// the census (85 component files + PolymorphSelectionModal as the pattern
// source) standardizes on. Comment-only mentions (e.g. AiInstructionModal's
// prose about .sp-overlay/.mc-overlay) and sibling roots that do NOT carry
// the class (DeathSavePromptModal's .dsp-overlay) never match.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const OVERLAY_ROOT_RE = /className=\{?\s*[`"]sp-overlay\b/;

// Non-component lanes legitimately outside the tier — add here ONLY with a reason.
const SKIP_LIST = [
    // Test-harness fixture rendering sp-overlay chrome for SaveAttackAoeModal
    // specs; adopting the focus tier here would perturb other tests' focus.
    'src/components/char-sheet/modals/shared/SaveAttackAoeModal.test-utils.jsx',
];

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p, out);
        else if (entry.name.endsWith('.jsx') && !entry.name.includes('.test.')) out.push(p);
    }
    return out;
}

describe('sp-overlay entrance-focus census lock', () => {
    it('every .sp-overlay-root component file adopts useOverlayEntranceFocus or is explicitly skipped', () => {
        const offenders = [];
        let censusCount = 0;
        for (const file of walk(SRC)) {
            const rel = path.relative(path.resolve(SRC, '..'), file).split(path.sep).join('/');
            if (rel === 'src/hooks/ui/useOverlayEntranceFocus.js') continue;
            const src = fs.readFileSync(file, 'utf8');
            if (!OVERLAY_ROOT_RE.test(src)) continue;
            censusCount++;
            if (SKIP_LIST.includes(rel)) continue;
            if (!src.includes('useOverlayEntranceFocus')) offenders.push(rel);
        }
        // Guard the scan itself: a broken walk must not "pass" by finding nothing.
        expect(censusCount).toBeGreaterThanOrEqual(85);
        expect(offenders, `unadopted .sp-overlay files: ${offenders.join(', ')}`).toEqual([]);
    });
});
