// SP-052: Foresight confirm lane — the runner must resolve the RADIO
// SELECTION (result), and the cast log's confirmTargets must report only the
// selection. The allTargets default stamped every combatant with
// creatureTargets[0] ("Bandit 1") as targetName regardless of who was picked.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/automation/index.js');
vi.mock('../../../services/rules/features/faerieFireService.js');
vi.mock('../../../services/rules/features/healService.js');
vi.mock('../../../services/rules/features/foresightService.js', () => ({
    triggerForesight: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../../services/rules/features/holdMonsterService.js');
vi.mock('../../../services/rules/features/charmPersonService.js');
vi.mock('../../../services/rules/features/charmMonsterService.js');
vi.mock('../../../services/rules/features/banishmentService.js');
vi.mock('../../../services/rules/features/revivifyService.js');
vi.mock('../../../services/rules/features/healingWordService.js');
vi.mock('../../../services/automation/handlers/spells/polymorphService.js');
vi.mock('../../../services/rules/features/greaterRestorationService.js');
vi.mock('../../../services/rules/features/removeCurseService.js');
vi.mock('../../../services/rules/features/regenerateService.js');
vi.mock('../../../services/rules/spells/materialComponents.js');
vi.mock('../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../useConfirmableFlow.js', () => ({ rollbackSpellSlot: vi.fn() }));
vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
    prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
    isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

import { useSimpleSpellHandlers } from './useSimpleSpellHandlers.js';
import { triggerForesight } from '../../../services/rules/features/foresightService.js';

function setup() {
    const applies = {};
    const confirmTargets = {};
    const buildHandlers = useSimpleSpellHandlers; // pure factory — no React hooks inside
    buildHandlers({
        createConfirmHandler: (name, applyFn, getTargets) => {
            applies[name] = applyFn;
            confirmTargets[name] = getTargets;
            return vi.fn();
        },
        createSkipHandler: () => vi.fn(),
        playerStats: { name: 'DivinationWizard' },
        campaignName: 'test-campaign',
        setPopupHtml: vi.fn(),
        getPending: () => null,
        cfClearPending: vi.fn(),
        onExecute: vi.fn(),
    });
    return { run: applies.foresight, getTargets: confirmTargets.foresight };
}

function makePending(overrides = {}) {
    return {
        spellName: 'Foresight',
        spell: { name: 'Foresight', level: 9, casting_time: 'Action' },
        spellLevel: 9,
        castingTime: 'Action',
        range: 'Touch',
        // First combatant is Bandit 1 — the bug stamped it as the target.
        creatureTargets: ['Bandit 1', 'DivinationWizard', 'ElfTest'],
        metaCtx: {},
        ...overrides,
    };
}

describe('SP-052 Foresight confirm lane — radio selection is the target', () => {
    it('run forwards the selected ElfTest (not creatureTargets[0] Bandit 1)', async () => {
        const { run } = setup();

        await run(makePending(), ['ElfTest']);

        expect(triggerForesight).toHaveBeenCalledTimes(1);
        const [spellData, metaCtx, stats, campaignName] = triggerForesight.mock.calls[0];
        expect(spellData.name).toBe('Foresight');
        expect(metaCtx.targetName).toBe('ElfTest');
        expect(stats.name).toBe('DivinationWizard');
        expect(campaignName).toBe('test-campaign');
    });

    it('confirmTargets logs ONLY the selection — never all combatants', () => {
        const { getTargets } = setup();
        const pending = makePending();

        // createConfirmHandler seam calls getTargets(pending, selection)
        const logged = getTargets(pending, ['ElfTest']);

        expect(logged).toEqual(['ElfTest']);
        expect(logged).not.toContain('Bandit 1');
    });
});
