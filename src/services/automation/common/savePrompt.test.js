import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    buildSaveDc,
    createSaveListener,
} from './savePrompt.js';

// ── Dependency mocks ──────────────────────────────────────────────

vi.mock('../../combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
  }));

vi.mock('../../ui/utils.js', () => {
    const utils = { guid: vi.fn() };
    return { default: utils };
  });

vi.mock('../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn(),
  }));

// Re-import after mocking
const { sendSavePrompt } = await import(
    '../../combat/conditions/savePromptService.js'
);
const utilsModule = await import('../../ui/utils.js');
const utils = utilsModule.default;
const { getAbilityModifier } = await import(
    '../../shared/abilityLookup.js'
);

// ── Test fixtures ─────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
    return {
        name: 'Hero',
        abilities: [
            { name: 'Strength', bonus: 3 },
            { name: 'Dexterity', bonus: 1 },
            { name: 'Constitution', bonus: 2 },
            { name: 'Intelligence', bonus: -1 },
            { name: 'Wisdom', bonus: 0 },
            { name: 'Charisma', bonus: 4 },
        ],
        proficiency: 3,
        ...overrides,
    };
}

// ── Helpers ───────────────────────────────────────────────────────

function resetMocks() {
    vi.clearAllMocks();
    getAbilityModifier.mockReturnValue(0);
    utils.guid.mockReturnValue('test-guid');
  }

// ── Tests ─────────────────────────────────────────────────────────

beforeEach(() => {
    resetMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── buildSaveDc ─────────────────────────────────────────────────

describe('buildSaveDc', () => {
    const basePlayerStats = makePlayerStats();

    describe('saveDc === "ability"', () => {
        it('uses default CON ability when saveAbility is not set', () => {
            getAbilityModifier.mockReturnValue(2);
            const auto = { saveDc: 'ability' };

            const dc = buildSaveDc(auto, basePlayerStats);

            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'CON'
              );
            expect(dc).toBe(8 + 2 + 3); // 8 + abilityBonus(CON=2) + prof(3) = 13
          });

        it('uses explicit saveAbility when provided', () => {
            getAbilityModifier.mockReturnValue(3);
            const auto = { saveDc: 'ability', saveAbility: 'STR' };

            const dc = buildSaveDc(auto, basePlayerStats);

            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'STR'
              );
            expect(dc).toBe(8 + 3 + 3); // 14
          });

        it('uses negative ability bonus correctly', () => {
            getAbilityModifier.mockReturnValue(-1);
            const auto = { saveDc: 'ability', saveAbility: 'INT' };

            const dc = buildSaveDc(auto, basePlayerStats);

            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'INT'
              );
            expect(dc).toBe(8 + (-1) + 3); // 10
          });

        it('uses proficiency of 0 when not set on playerStats', () => {
            getAbilityModifier.mockReturnValue(2);
            const auto = { saveDc: 'ability' };
            const ps = makePlayerStats({ proficiency: undefined });

            const dc = buildSaveDc(auto, ps);

            expect(dc).toBe(8 + 2 + 0); // 10 — prof defaults to 0
          });

        it('uses proficiency of 0 when explicitly set to 0', () => {
            getAbilityModifier.mockReturnValue(0);
            const auto = { saveDc: 'ability' };
            const ps = makePlayerStats({ proficiency: 0 });

            const dc = buildSaveDc(auto, ps);

            expect(dc).toBe(8 + 0 + 0); // 8
          });

        it('handles high ability bonus and prof', () => {
            getAbilityModifier.mockReturnValue(5);
            const auto = { saveDc: 'ability', saveAbility: 'CHA' };
            const ps = makePlayerStats({ proficiency: 6 });

            const dc = buildSaveDc(auto, ps);

            expect(getAbilityModifier).toHaveBeenCalledWith(
                expect.any(Array),
                'CHA'
              );
            expect(dc).toBe(8 + 5 + 6); // 19
          });
      });

    describe('saveDc === "spell_save_dc"', () => {
        it('uses CHA ability modifier', () => {
            getAbilityModifier.mockReturnValue(4);
            const auto = { saveDc: 'spell_save_dc' };

            const dc = buildSaveDc(auto, basePlayerStats);

            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'CHA'
              );
            expect(dc).toBe(8 + 4 + 3); // 15
          });

        it('uses proficiency of 0 when not set on playerStats', () => {
            getAbilityModifier.mockReturnValue(2);
            const auto = { saveDc: 'spell_save_dc' };
            const ps = makePlayerStats({ proficiency: undefined });

            const dc = buildSaveDc(auto, ps);

            expect(dc).toBe(8 + 2 + 0); // 10
          });

        it('handles zero CHA bonus', () => {
            getAbilityModifier.mockReturnValue(0);
            const auto = { saveDc: 'spell_save_dc' };

            const dc = buildSaveDc(auto, basePlayerStats);

            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'CHA'
              );
            expect(dc).toBe(8 + 0 + 3); // 11
          });

        it('handles negative CHA bonus', () => {
            getAbilityModifier.mockReturnValue(-2);
            const auto = { saveDc: 'spell_save_dc' };

            const dc = buildSaveDc(auto, basePlayerStats);

            expect(dc).toBe(8 + (-2) + 3); // 9
          });
      });

    describe('fallback (numeric or missing saveDc)', () => {
        it('returns auto.saveDc when it is a number', () => {
            const auto = { saveDc: 15 };
            expect(buildSaveDc(auto, basePlayerStats)).toBe(15);
          });

        it('returns default 10 when saveDc is undefined', () => {
            const auto = {};
            expect(buildSaveDc(auto, basePlayerStats)).toBe(10);
          });

        it('returns default 10 when saveDc is null', () => {
            const auto = { saveDc: null };
            expect(buildSaveDc(auto, basePlayerStats)).toBe(10);
          });

        it('returns default 10 when saveDc is an empty string (falsy)', () => {
            const auto = { saveDc: '' };
            expect(buildSaveDc(auto, basePlayerStats)).toBe(10);
          });

        it('does not call getAbilityModifier for fallback case', () => {
            const auto = { saveDc: 12 };
            buildSaveDc(auto, basePlayerStats);
            expect(getAbilityModifier).not.toHaveBeenCalled();
          });

        it('does not call getAbilityModifier when saveDc is missing', () => {
            const auto = {};
            buildSaveDc(auto, basePlayerStats);
            expect(getAbilityModifier).not.toHaveBeenCalled();
          });
      });
});

// ─── createSaveListener ────────────────────────────────────────────

describe('createSaveListener', () => {
    const campaignName = 'TestCampaign';

    it('generates a unique promptId via utils.guid()', () => {
        utils.guid.mockReturnValue('unique-id-123');

        createSaveListener(campaignName, { targetName: 'Goblin' });

        expect(utils.guid).toHaveBeenCalledTimes(1);
      });

    it('calls sendSavePrompt with correct data', () => {
        utils.guid.mockReturnValue('prompt-abc');

        const config = {
            targetName: 'Orc',
            saveType: 'DEX',
            saveDc: 15,
            dcSuccess: 'The orc falls prone.',
          };

        createSaveListener(campaignName, config);

        expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, {
            promptId: 'prompt-abc',
            targetName: 'Orc',
            saveType: 'DEX',
            saveDc: 15,
            dcSuccess: 'The orc falls prone.',
            advantage: false,
            disadvantage: false,
          });
      });

    it('defaults saveType to CON when not provided', () => {
        utils.guid.mockReturnValue('prompt-default');

        const config = { targetName: 'Goblin' };
        createSaveListener(campaignName, config);

        expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, {
            promptId: 'prompt-default',
            targetName: 'Goblin',
            saveType: 'CON',
            advantage: false,
            disadvantage: false,
          });
      });

    it('returns an object with promptId and promise', () => {
        utils.guid.mockReturnValue('ret-id');
        const config = { targetName: 'Test' };

        const result = createSaveListener(campaignName, config);

        expect(result).toHaveProperty('promptId', 'ret-id');
        expect(result).toHaveProperty('promise');
        expect(result.promise).toBeInstanceOf(Promise);
      });

    it('resolves with event.detail when matching promptId is received', async () => {
        utils.guid.mockReturnValue('matching-guid');
        const config = { targetName: 'Goblin' };

        // Call createSaveListener — listener is registered synchronously before return
        const { promise } = createSaveListener(campaignName, config);

          // Now dispatch the matching event (listener already on window)
        window.dispatchEvent(
            new CustomEvent('save-result', {
                detail: { promptId: 'matching-guid', rolled: 17, success: true },
                })
            );

          // Await settles so microtask queue processes the resolve callback
        await Promise.resolve();
        const result = await promise;

        expect(result).toEqual({ promptId: 'matching-guid', rolled: 17, success: true });
        });

    it('returns correct promptId from utils.guid()', () => {
        utils.guid.mockReturnValue('correct-guid');
        const config = { targetName: 'Troll' };

        const { promptId } = createSaveListener(campaignName, config);

        expect(promptId).toBe('correct-guid');
       });

    it('cleans up event listener on resolution', async () => {
        utils.guid.mockReturnValue('cleanup-test-guid');
        const config = { targetName: 'Goblin' };

        const removeSpy = vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});

        createSaveListener(campaignName, config);

         // Dispatch matching event after listener is registered
        window.dispatchEvent(
            new CustomEvent('save-result', {
                detail: { promptId: 'cleanup-test-guid', rolled: 20 },
               })
           );

        expect(removeSpy).toHaveBeenCalledWith('save-result', expect.any(Function));

        removeSpy.mockRestore();
       });

    it('adds an event listener to window for save-result', () => {
        const addSpy = vi.spyOn(window, 'addEventListener');
        utils.guid.mockReturnValue('listener-test');

        createSaveListener(campaignName, { targetName: 'Goblin' });

        expect(addSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
        addSpy.mockRestore();
      });
});
