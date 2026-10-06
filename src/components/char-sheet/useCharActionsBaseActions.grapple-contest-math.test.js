// BA-002 regression: Grapple contested check math.
// Previously broken: attacker roll was bare STR (no proficiency) vs a static
// target STR modifier. Fixed: Strength (Athletics) = d20 + STR + PB (when
// proficient) vs the target's higher Athletics-or-Acrobatics total, logged
// with the skill used.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import {
    createHooks,
    mockRollAbilityCheck,
    mockSetPopupHtml,
    mockAddEntry,
    campaignName,
    basePlayerStats,
} from './useCharActionsBaseActions.test-utils.js';

const lv20AthleticsBarbarian = {
    ...basePlayerStats,
    name: 'DraconicDragon',
    level: 20,
    class: { name: 'Barbarian' },
    skillProficiencies: ['Athletics'],
    abilities: [
        { name: 'Strength', bonus: 5, skills: [{ name: 'Athletics', bonus: 11 }] },
        { name: 'Dexterity', bonus: 2, skills: [{ name: 'Acrobatics', bonus: 2 }] },
        { name: 'Wisdom', bonus: 1, skills: [] },
        { name: 'Constitution', bonus: 3, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
    ],
};

function grv(total, d20) {
    return vi.fn((charKey, key) => {
        if (key === 'lastAttack') return { total, d20 };
        return undefined;
    });
}

function banditTarget(overrides = {}) {
    return {
        name: 'Bandit 1',
        conditions: [],
        type: 'monster',
        ability_score_modifiers: { str: 0, dex: 1 },
        ...overrides,
    };
}

function csWith(attacker, target) {
    return {
        creatures: [
            { name: attacker, targetName: target.name },
            target,
        ],
    };
}

describe('BA-002 grapple contest math', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes proficiency in the attacker check via the computed Athletics skill bonus', async () => {
        const cs = csWith('DraconicDragon', banditTarget());
        const hooks = createHooks({
            playerStats: lv20AthleticsBarbarian,
            loadCombatSummary: () => Promise.resolve(cs),
            getRuntimeValue: grv(28, 17),
            setRuntimeValue: vi.fn().mockResolvedValue(undefined),
        });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleGrappleAction();

        // lv20 Barbarian STR +5 + PB +6 = +11 (was bare +5 before BA-002 fix)
        expect(mockRollAbilityCheck).toHaveBeenCalledWith(
            'Strength',
            11,
            expect.any(Object),
        );
    });

    it('derives STR + PB from skillProficiencies when no listed skill bonus exists', async () => {
        const noSkillStats = {
            ...lv20AthleticsBarbarian,
            abilities: lv20AthleticsBarbarian.abilities.map(a => ({ ...a, skills: [] })),
            skills: [],
        };
        const cs = csWith('DraconicDragon', banditTarget());
        const hooks = createHooks({
            playerStats: noSkillStats,
            loadCombatSummary: () => Promise.resolve(cs),
            getRuntimeValue: grv(28, 17),
            setRuntimeValue: vi.fn().mockResolvedValue(undefined),
        });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleGrappleAction();

        // STR 5 + PB 6 (proficient in Athletics) = +11
        expect(mockRollAbilityCheck).toHaveBeenCalledWith(
            'Strength',
            11,
            expect.any(Object),
        );
    });

    it('does not stack Jack of All Trades half bonus on top of Athletics proficiency', async () => {
        const cs = csWith('DraconicDragon', banditTarget());
        const hooks = createHooks({
            playerStats: {
                ...lv20AthleticsBarbarian,
                automation: { passives: [{ type: 'jack_of_all_trades' }] },
            },
            loadCombatSummary: () => Promise.resolve(cs),
            getRuntimeValue: grv(28, 17),
            setRuntimeValue: vi.fn().mockResolvedValue(undefined),
        });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleGrappleAction();

        expect(mockRollAbilityCheck).toHaveBeenCalledWith(
            'Strength',
            11,
            expect.any(Object),
        );
    });

    it('contests against the target Athletics-or-Acrobatics total, not static target STR', async () => {
        // Bandit: STR +0, DEX +1, no listed skills -> Acrobatics (+1) is higher.
        const cs = csWith('DraconicDragon', banditTarget());
        const hooks = createHooks({
            playerStats: lv20AthleticsBarbarian,
            loadCombatSummary: () => Promise.resolve(cs),
            getRuntimeValue: grv(28, 17),
            getMonsterData: vi.fn().mockResolvedValue({ ability_score_modifiers: { str: 0, dex: 1 } }),
            setRuntimeValue: vi.fn().mockResolvedValue(undefined),
        });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleGrappleAction();

        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            description: expect.stringContaining('vs Bandit 1 Acrobatics (+1)'),
        }));
        expect(mockAddEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Grapple',
            description: expect.stringContaining('Strength (Athletics) check: 28 (d20: 17 + 11) vs Bandit 1 Acrobatics (+1) contest — Success. Target is now grappled.'),
        }));
    });

    it('prefers a listed monster skill total over the raw ability modifier', async () => {
        // Ogre-style monster: listed Athletics modifier +7 beats DEX +1 contest.
        const ogre = {
            name: 'Ogre 1',
            conditions: [],
            type: 'monster',
            skills: { Athletics: { modifier: 7 }, Acrobatics: { modifier: -1 } },
        };
        const cs = csWith('DraconicDragon', ogre);
        const hooks = createHooks({
            playerStats: lv20AthleticsBarbarian,
            loadCombatSummary: () => Promise.resolve(cs),
            getRuntimeValue: grv(28, 17),
            setRuntimeValue: vi.fn().mockResolvedValue(undefined),
        });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleGrappleAction();

        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            description: expect.stringContaining('vs Ogre 1 Athletics (+7)'),
        }));
    });

    it('fails when the grapple check does not beat the contest total and does not stamp grappled', async () => {
        const cs = csWith('DraconicDragon', banditTarget({ ability_score_modifiers: { str: 15, dex: 1 } }));
        const srw = vi.fn().mockResolvedValue(undefined);
        const hooks = createHooks({
            playerStats: lv20AthleticsBarbarian,
            loadCombatSummary: () => Promise.resolve(cs),
            getRuntimeValue: grv(12, 1),
            getMonsterData: vi.fn().mockResolvedValue({ ability_score_modifiers: { str: 15, dex: 1 } }),
            setRuntimeValue: srw,
        });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleGrappleAction();

        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            description: expect.stringContaining('vs Bandit 1 Athletics (+15)'),
        }));
        expect(mockAddEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            description: expect.stringContaining('contest — Failure. Target is not grappled.'),
        }));
        expect(srw).not.toHaveBeenCalled();
    });

    it('resolves a player target contest from its computedStats skill bonuses', async () => {
        const playerTarget = {
            name: 'ElfTest',
            conditions: [],
            type: 'player',
            computedStats: {
                skills: [{ name: 'Acrobatics', bonus: 7 }],
                abilities: [{ name: 'Strength', bonus: 1 }],
            },
        };
        const cs = csWith('DraconicDragon', playerTarget);
        const hooks = createHooks({
            playerStats: lv20AthleticsBarbarian,
            loadCombatSummary: () => Promise.resolve(cs),
            getRuntimeValue: grv(28, 17),
            setRuntimeValue: vi.fn().mockResolvedValue(undefined),
        });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleGrappleAction();

        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            description: expect.stringContaining('vs ElfTest Acrobatics (+7)'),
        }));
    });

    it('stamps grappled on the target when the contest is won', async () => {
        const cs = csWith('DraconicDragon', banditTarget());
        const srw = vi.fn().mockResolvedValue(undefined);
        const hooks = createHooks({
            playerStats: lv20AthleticsBarbarian,
            loadCombatSummary: () => Promise.resolve(cs),
            getRuntimeValue: grv(28, 17),
            setRuntimeValue: srw,
        });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleGrappleAction();

        expect(srw).toHaveBeenCalledWith(
            'Bandit 1',
            'activeConditions',
            expect.arrayContaining(['grappled']),
            campaignName,
        );
    });
});
