// @maintained-by-ai
// save_result attribution ledger (bug-save-result-rows-attribute-character-unknown):
// the generic save_result row emitted by createSaveListener's logSaveOutcome takes
// `characterName` from config.attackerName — the modal's save-result dispatch
// detail NEVER carries attackerName (SavePromptModal.buildResultDispatchDetail),
// so when rider/maneuver lanes omitted attackerName the Log view rendered the
// row owner as the literal "Unknown". Locks:
//  • a config carrying attackerName stamps the emitted save_result row with that
//    real acting character (rider/Shield-Bash lane shape, prompt-echo detail
//    WITHOUT attackerName — the exact broken live flow);
//  • payload truth: the pendingSavePrompts row + sendSavePrompt payload carry
//    attackerName (the "attackerName: null" gap was the visible source);
//  • attacker-less self-save lanes (Relentless Rage CON save shape — config
//    with attackerName absent) stamp the save's OWNER (targetName), NEVER the
//    literal "Unknown" (2026-11-16 TB ledger-phantom follow-up: the old
//    'Unknown' fallback made every self-save a phantom "Unknown" member in
//    character-grouped ledger views);
//  • config.suppressOutcomeLog skips the generic row entirely (turn-END
//    repeat-save lanes stamp their own attributed save_result row — one roll,
//    one row) while still resolving the promise.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
    default: { guid: vi.fn() },
}));

vi.mock('../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    deleteRuntimeKey: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

import { createSaveListener } from './savePrompt.js';
import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'test-campaign';

// §94 listener-ledger doctrine: unique promptIds per test — shared mock ids
// poison later ledgers via stale window listeners (test 2 never dispatches, so
// its handler stays attached — ids must NEVER recycle across tests).
let guidSeq = 0;
function mintGuid() {
    guidSeq += 1;
    return `prompt-${guidSeq}`;
}

// Mirror SavePromptModal.buildResultDispatchDetail: the rolled verdict carries
// target/save fields + roll math but NEVER attackerName.
function dispatchSaveResult(promptId, overrides = {}) {
    window.dispatchEvent(new CustomEvent('save-result', {
        detail: {
            promptId,
            targetName: 'ElderPaladin',
            saveType: 'STR',
            saveDc: 17,
            success: false,
            roll: 4,
            total: 14,
            saveBonus: 10,
            rawRolls: [4],
            mode: 'normal',
            ...overrides,
        },
    }));
}

function emittedSaveResultRows() {
    return addEntry.mock.calls.map(c => c[1]).filter(e => e?.type === 'save_result');
}

beforeEach(() => {
    vi.clearAllMocks();
    utils.guid.mockImplementation(() => mintGuid());
});

describe('save_result attribution — config.attackerName stamps the acting character', () => {
    it('rider-lane prompt with attackerName logs the save_result row attributed to the attacker (never "Unknown")', async () => {
        const { promptId, promise } = createSaveListener(CAMPAIGN, {
            targetName: 'ElderPaladin',
            attackerName: 'EvasiveFighter',
            saveType: 'STR',
            saveDc: 17,
            dcSuccess: false,
            sourceName: 'Shield Bash',
        });

        dispatchSaveResult(promptId);
        await promise;

        const rows = emittedSaveResultRows();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            type: 'save_result',
            characterName: 'EvasiveFighter',
            targetName: 'ElderPaladin',
            saveType: 'STR',
            saveDc: 17,
            success: false,
            roll: 4,
            total: 14,
            saveBonus: 10,
            sourceName: 'Shield Bash',
            description: 'ElderPaladin failed STR save (DC 17, rolled 4 +10 = 14)',
        });
    });

    it('attackerName threads into the prompt payload + pendingSavePrompts row (the "attackerName: null" gap)', () => {
        createSaveListener(CAMPAIGN, {
            targetName: 'ElderPaladin',
            attackerName: 'EvasiveFighter',
            saveType: 'CON',
            saveDc: 15,
        });

        expect(sendSavePrompt).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            targetName: 'ElderPaladin',
            attackerName: 'EvasiveFighter',
        }));
    });

    it('attacker-less self-save lane (Relentless Rage prompt shape) stamps the save OWNER — never "Unknown"', async () => {
        const { promptId, promise } = createSaveListener(CAMPAIGN, {
            targetName: 'ElderPaladin',
            saveType: 'STR',
            saveDc: 17,
        });

        dispatchSaveResult(promptId);
        await promise;

        const rows = emittedSaveResultRows();
        expect(rows).toHaveLength(1);
        // 2026-11-16 TB follow-up: the old 'Unknown' literal made every
        // self-save a phantom "Unknown" member in character-grouped ledger
        // views — the row now resolves to the prompt's targetName owner.
        expect(rows[0].characterName).toBe('ElderPaladin');
        expect(rows[0].characterName).not.toBe('Unknown');
        // Sibling fields stay byte-compatible (description already named the owner).
        expect(rows[0]).toMatchObject({
            type: 'save_result',
            targetName: 'ElderPaladin',
            saveType: 'STR',
            saveDc: 17,
            success: false,
            description: 'ElderPaladin failed STR save (DC 17, rolled 4 +10 = 14)',
        });
    });

    it("'Unknown' last resort survives ONLY for unattributable prompts (neither attacker nor target)", async () => {
        const { promptId, promise } = createSaveListener(CAMPAIGN, {
            saveType: 'STR',
            saveDc: 17,
        });

        // No targetName on config NOR on the dispatch detail — genuinely ownerless.
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId, saveType: 'STR', saveDc: 17, success: true, roll: 19, total: 23, saveBonus: 4 },
        }));
        await promise;

        const rows = emittedSaveResultRows();
        expect(rows).toHaveLength(1);
        expect(rows[0].characterName).toBe('Unknown');
    });
});

describe('suppressOutcomeLog — lanes that stamp their own attributed save_result row', () => {
    it('skips the generic row entirely but still resolves the promise with the verdict', async () => {
        const { promptId, promise } = createSaveListener(CAMPAIGN, {
            targetName: 'ElderPaladin',
            attackerName: 'EvasiveFighter',
            saveType: 'CON',
            saveDc: 15,
            dcSuccess: 'none',
            condition: 'poisoned (repeat save)',
            suppressOutcomeLog: true,
        });

        dispatchSaveResult(promptId, { saveType: 'CON', saveDc: 15, roll: 6, total: -3, saveBonus: -9 });
        const detail = await promise;

        expect(detail.success).toBe(false);
        expect(emittedSaveResultRows()).toHaveLength(0);
    });

    it('default (flag absent) keeps the single generic row — every other lane byte-unchanged', async () => {
        const { promptId, promise } = createSaveListener(CAMPAIGN, {
            targetName: 'ElderPaladin',
            attackerName: 'EvasiveFighter',
            saveType: 'STR',
            saveDc: 17,
        });

        dispatchSaveResult(promptId);
        await promise;

        expect(emittedSaveResultRows()).toHaveLength(1);
    });
});
