// CLA-020: Aura of Devotion — the Charm Person/Monster failed-save leg is gated by
// the CLA-019 aura condition-immunity channel: protected targets SUPPRESS Charmed
// (suppression logged, zero writes); unprotected control still gets charmed byte-identical.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const logEntries = [];
const addedResults = [];

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 16),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const runtimeStore = {};
const setCalls = [];
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}:${key}`],
    setRuntimeValue: (name, key, value) => { setCalls.push({ name, key, value }); runtimeStore[`${name}:${key}`] = value; },
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { logEntries.push(entry); return Promise.resolve(); },
}));

const expirationCalls = [];
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn((args) => { expirationCalls.push(args); }),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    rollSaveForCreature: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 8),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
    sendSaveResult: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn((campaignName, r) => { addedResults.push(r); return Promise.resolve(); }),
}));

vi.mock('./areaSpellUtils.js', () => ({
    spellNoticePopup: vi.fn((name, description) => ({ type: 'popup', payload: { type: 'automation_info', name, description } })),
}));

// Aura channel: ElderPaladin hosts Aura of Devotion (charmed); Thug 1 is the control.
vi.mock('../../../combat/auras/auraConditionImmunity.js', async (importActual) => {
    const actual = await importActual();
    return {
        ...actual,
        getAuraConditionImmunities: vi.fn(async ({ targetName }) => (
            targetName === 'Thug 1'
                ? { immunities: [], immunitySources: {} }
                : { immunities: ['charmed'], immunitySources: { charmed: 'ElderPaladin' } }
        )),
    };
});

import { handle } from './charmPersonHandler.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const campaignName = 'test-campaign';

const devotionCharacters = [
    { name: 'ElderPaladin', computedStats: { automation: { passives: [{ name: 'Aura of Protection' }, { name: 'Aura of Devotion', type: 'passive_buff', target: 'allies_in_range', range_expression: '10_ft', conditionImmunity: 'charmed', casting_time: 'passive' }] } } },
];

function playerStats() {
    return { name: 'HexWarlock', level: 14, proficiency: 5, abilities: [{ name: 'Charisma', bonus: 3 }] };
}

function setupMocks(targetName, saveResult = { success: false, roll: 5, total: 5, saveBonus: 0 }) {
    getCombatContext.mockResolvedValue({ creatures: [{ name: targetName, type: 'player' }] });
    createSaveListener.mockReturnValue({ promptId: 'p-1', promise: Promise.resolve(saveResult) });
}

async function castCharmPerson(targetName, metaCtx = { characters: devotionCharacters }) {
    setupMocks(targetName);
    const action = {
        name: 'Charm Person',
        automation: { type: 'charm_person', saveDc: 16, targetName },
        metaCtx,
    };
    return await handle(action, playerStats(), campaignName, null);
}

beforeEach(() => {
    vi.clearAllMocks();
    logEntries.length = 0;
    setCalls.length = 0;
    addedResults.length = 0;
    expirationCalls.length = 0;
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
});

describe('CLA-020 Aura of Devotion — charm spell failed-save leg', () => {
    it('aura-covered ally: failed WIS save SUPPRESSES charmed — zero writes, immunity log names Aura of Devotion', async () => {
        const popup = await castCharmPerson('EvasiveFighter');

        expect(runtimeStore['EvasiveFighter:activeConditions']).toBeUndefined();
        expect(setCalls.filter(c => c.key === 'activeConditions' || c.key === 'activeConditionMeta')).toHaveLength(0);
        expect(expirationCalls).toHaveLength(0);

        const immunity = logEntries.filter(e => e.automationType === 'condition_immunity_aura');
        expect(immunity).toHaveLength(1);
        expect(immunity[0].type).toBe('automation');
        expect(immunity[0].characterName).toBe('EvasiveFighter');
        expect(immunity[0].sourceName).toBe('ElderPaladin');
        expect(immunity[0].description).toContain('EvasiveFighter is immune to Charmed (Aura of Devotion from ElderPaladin)');

        expect(logEntries.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        const failed = logEntries.find(e => e.type === 'save_result' && e.success === false);
        expect(failed.description).toContain('failed WIS save against Charm Person but is immune to Charmed');

        expect(addedResults).toHaveLength(1);
        expect(addedResults[0]).toMatchObject({ targetName: 'EvasiveFighter', saveResult: 'failure', conditions: [] });

        expect(popup.payload.description).toContain('immune: EvasiveFighter');
    });

    it('control target outside aura: failed WIS save applies charmed (legacy byte-shape intact)', async () => {
        await castCharmPerson('Thug 1');

        expect(runtimeStore['Thug 1:activeConditions']).toEqual(['charmed']);
        expect(runtimeStore['Thug 1:activeConditionMeta'].charmed).toMatchObject({ dc: 16, ability: 'wis' });
        expect(expirationCalls).toHaveLength(1);
        expect(expirationCalls[0].targetName).toBe('Thug 1');
        expect(logEntries.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Charmed' && e.reason === 'Charm Person spell')).toBe(true);
        expect(logEntries.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
    });

    it('callers that omit characters thread an empty roster (real channel is inert) — legacy write intact', async () => {
        const { getAuraConditionImmunities } = await import('../../../combat/auras/auraConditionImmunity.js');
        getAuraConditionImmunities.mockResolvedValueOnce({ immunities: [], immunitySources: {} });

        await castCharmPerson('EvasiveFighter', {});

        expect(getAuraConditionImmunities).toHaveBeenCalledWith({ targetName: 'EvasiveFighter', characters: [] });
        expect(runtimeStore['EvasiveFighter:activeConditions']).toEqual(['charmed']);
        expect(logEntries.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
    });

    it('successful save on covered target: nothing lands, no immunity log (legacy success leg)', async () => {
        const popup = await handleCharmSuccess('EvasiveFighter');

        expect(runtimeStore['EvasiveFighter:activeConditions']).toBeUndefined();
        expect(logEntries.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
        expect(logEntries.some(e => e.type === 'save_result' && e.success === true)).toBe(true);
        expect(popup.payload.description).toContain('saved: EvasiveFighter');
    });

    it('multi-target differential: protected suppressed, control charmed, summary reports both', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'EvasiveFighter', type: 'player' },
                { name: 'Thug 1', type: 'player' },
            ],
        });
        createSaveListener.mockReturnValue({ promptId: 'p-1', promise: Promise.resolve({ success: false, roll: 5, total: 5, saveBonus: 0 }) });

        const action = {
            name: 'Charm Person',
            automation: { type: 'charm_person', saveDc: 16 },
            metaCtx: { charmPersonTargets: ['EvasiveFighter', 'Thug 1'], characters: devotionCharacters },
        };
        const popup = await handle(action, playerStats(), campaignName, null);

        expect(runtimeStore['EvasiveFighter:activeConditions']).toBeUndefined();
        expect(runtimeStore['Thug 1:activeConditions']).toEqual(['charmed']);
        expect(logEntries.filter(e => e.automationType === 'condition_immunity_aura')).toHaveLength(1);
        expect(popup.payload.description).toContain('1 creature(s) charmed: Thug 1');
        expect(popup.payload.description).toContain('immune: EvasiveFighter');
    });

    it('channel parity: frightened-only coverage (Aura of Courage host) does NOT suppress charmed', async () => {
        setupMocks('EvasiveFighter');
        const { getAuraConditionImmunities } = await import('../../../combat/auras/auraConditionImmunity.js');
        getAuraConditionImmunities.mockResolvedValueOnce({ immunities: ['frightened'], immunitySources: { frightened: 'ElderPaladin' } });

        await handle({ name: 'Charm Person', automation: { type: 'charm_person', saveDc: 16, targetName: 'EvasiveFighter' }, metaCtx: { characters: devotionCharacters } }, playerStats(), campaignName, null);

        expect(runtimeStore['EvasiveFighter:activeConditions']).toEqual(['charmed']);
        expect(logEntries.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
    });
});

async function handleCharmSuccess(targetName) {
    setupMocks(targetName, { success: true, roll: 19, total: 19, saveBonus: 0 });
    const action = {
        name: 'Charm Person',
        automation: { type: 'charm_person', saveDc: 16, targetName },
        metaCtx: { characters: devotionCharacters },
    };
    return await handle(action, playerStats(), campaignName, null);
}
