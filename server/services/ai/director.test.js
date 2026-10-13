// §9.3 — monster allowlist loader + intent schema + director funnel.
import { baseName, speedFeetOf, lookupMonsterActions } from './monsterActions.js';
import { validateNpcIntent } from './schemas.js';
import { askNpcDirector } from './index.js';

describe('monsterActions allowlist loader', () => {
    it('baseName strips trailing instance digits only', () => {
        expect(baseName('Goblin 1')).toBe('goblin');
        expect(baseName('Goblin')).toBe('goblin');
        expect(baseName('Ogre Zombie 2')).toBe('ogre zombie');
        expect(baseName('NPC 1')).toBe('npc');
    });

    it('speedFeetOf parses string and object speed fields', () => {
        expect(speedFeetOf({ speed: '30 ft.' })).toBe(30);
        expect(speedFeetOf({ speed: { walk: '30 ft.', fly: '60 ft.' } })).toBe(60);
        expect(speedFeetOf({})).toBeNull();
    });

    it('resolves combat-instance names to real stat-block actions', () => {
        const goblin = lookupMonsterActions('Goblin 1');
        expect(goblin).not.toBeNull();
        expect(goblin.name).toBe('Goblin');
        expect(goblin.speedFeet).toBe(30);
        expect(goblin.actions.map(a => a.name)).toEqual(expect.arrayContaining(['Scimitar', 'Shortbow']));
    });

    it('unknown names resolve to null (fail closed)', () => {
        expect(lookupMonsterActions('NPC 1')).toBeNull();
        expect(lookupMonsterActions('Definitely Not A Monster')).toBeNull();
    });
});

describe('validateNpcIntent — the allowlist is the contract', () => {
    const ALLOW = { actionNames: ['Scimitar', 'Shortbow'], targetNames: ['Rakan', 'Mira'], speedFeet: 30 };

    it('accepts a listed attack and canonicalizes spelling', () => {
        const intent = { intent: 'attack', actionName: ' scimitar ', targetName: 'rakan', explanation: 'close', confidence: 0.8 };
        const r = validateNpcIntent(intent, ALLOW);
        expect(r.ok).toBe(true);
        expect(intent.actionName).toBe('Scimitar');
        expect(intent.targetName).toBe('Rakan');
    });

    it('REFUSES hallucinated actions and dead/absent targets', () => {
        expect(validateNpcIntent({ intent: 'attack', actionName: 'Wish', targetName: 'Rakan' }, ALLOW).ok).toBe(false);
        expect(validateNpcIntent({ intent: 'attack', actionName: 'Scimitar', targetName: 'Goblin' }, ALLOW).ok).toBe(false);
        expect(validateNpcIntent({ intent: 'attack', actionName: 'Scimitar' }, ALLOW).ok).toBe(false);
    });

    it('economy-spent restricts intents; move obeys speed', () => {
        const spent = { ...ALLOW, allowedIntents: ['move', 'talk', 'pass'] };
        expect(validateNpcIntent({ intent: 'attack', actionName: 'Scimitar', targetName: 'Rakan' }, spent).ok).toBe(false);
        expect(validateNpcIntent({ intent: 'pass' }, spent).ok).toBe(true);
        expect(validateNpcIntent({ intent: 'move', feet: 40 }, ALLOW).ok).toBe(false);
        expect(validateNpcIntent({ intent: 'move', feet: 30 }, ALLOW).ok).toBe(true);
        expect(validateNpcIntent({ intent: 'move', feet: 1.5 }, ALLOW).ok).toBe(false);
    });

    it('unknown intent + garbage refused', () => {
        expect(validateNpcIntent({ intent: 'mind_control_world' }, ALLOW).ok).toBe(false);
        expect(validateNpcIntent(null, ALLOW).ok).toBe(false);
        expect(validateNpcIntent('nope', ALLOW).ok).toBe(false);
    });
});

describe('askNpcDirector funnel', () => {
    const CFG = { endpoint: 'http://localhost:11434', model: 'stub-llm', mode: 'suggest' };
    const STATE = {
        combatSummary: {
            round: 2,
            activeCreatureName: 'Goblin 1',
            creatures: [
                { name: 'Goblin 1', type: 'npc', currentHp: 7 },
                { name: 'Rakan', type: 'player', currentHp: 20, ac: 16 },
            ],
        },
        turnState: { 'Goblin 1': { actionsUsed: 0 } },
        enforcement: { mode: 'off' },
    };
    const log = vi.fn(async () => ({}));

    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.unstubAllGlobals());

    function stubModel(content) {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: { content } }) })));
    }

    it('AI off ⇒ AI_OFF, no traffic', async () => {
        const fetchFn = vi.fn();
        vi.stubGlobal('fetch', fetchFn);
        const r = await askNpcDirector({ campaign: 'test-campaign', creatureName: 'Goblin 1', aiConfig: null, state: STATE, log });
        expect(r).toEqual({ ok: false, code: 'AI_OFF' });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('no stat block ⇒ needs_human without calling the model', async () => {
        const fetchFn = vi.fn();
        vi.stubGlobal('fetch', fetchFn);
        const r = await askNpcDirector({ campaign: 'test-campaign', creatureName: 'NPC 1', aiConfig: CFG, state: STATE, log });
        expect(r.ok).toBe(false);
        expect(r.code).toBe('AI_NEEDS_HUMAN');
        expect(fetchFn).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ai_director' }));
    });

    it('turn-lock ON and not its turn ⇒ refused before any model call', async () => {
        const fetchFn = vi.fn();
        vi.stubGlobal('fetch', fetchFn);
        const r = await askNpcDirector({
            campaign: 'test-campaign', creatureName: 'Goblin 1', aiConfig: CFG,
            state: { ...STATE, enforcement: { mode: 'on', turnLock: true }, combatSummary: { ...STATE.combatSummary, activeCreatureName: 'Rakan' } }, log,
        });
        expect(r).toEqual({ ok: false, code: 'NOT_THEIR_TURN' });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('valid proposal returns the canonicalized intent + audits', async () => {
        stubModel('```json\n{"intent":"attack","actionName":"scimitar","targetName":"rakan","explanation":"get him","confidence":0.8}\n```');
        const r = await askNpcDirector({ campaign: 'test-campaign', creatureName: 'Goblin 1', aiConfig: CFG, state: STATE, log });
        expect(r.ok).toBe(true);
        expect(r.intent).toMatchObject({ intent: 'attack', actionName: 'Scimitar', targetName: 'Rakan', creatureName: 'Goblin 1' });
        expect(log).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ai_director' }));
    });

    it('hallucinated action: retry ONCE then needs_human (never guessed)', async () => {
        const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: { content: '{"intent":"attack","actionName":"Wish","targetName":"Rakan"}' } }) }));
        vi.stubGlobal('fetch', fetchFn);
        const r = await askNpcDirector({ campaign: 'test-campaign', creatureName: 'Goblin 1', aiConfig: CFG, state: STATE, log });
        expect(r.ok).toBe(false);
        expect(r.code).toBe('AI_NEEDS_HUMAN');
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('economy spent: attack refused at validation, pass accepted', async () => {
        stubModel('{"intent":"attack","actionName":"Scimitar","targetName":"Rakan"}');
        const spent = { ...STATE, enforcement: { mode: 'on', actionEconomy: true }, turnState: { 'Goblin 1': { actionsUsed: 1 } } };
        const bad = await askNpcDirector({ campaign: 'test-campaign', creatureName: 'Goblin 1', aiConfig: CFG, state: spent, log });
        expect(bad.ok).toBe(false);
        expect(bad.code).toBe('AI_NEEDS_HUMAN');

        stubModel('{"intent":"pass","explanation":"wait for orders"}');
        const ok = await askNpcDirector({ campaign: 'test-campaign', creatureName: 'Goblin 1', aiConfig: CFG, state: spent, log });
        expect(ok.ok).toBe(true);
        expect(ok.intent.intent).toBe('pass');
    });
});
