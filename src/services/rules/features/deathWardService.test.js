// Suppress fire-and-forget logService.addEntry rejection warnings from source code
process.on('unhandledRejection', () => {});

import { checkDeathWard } from './deathWardService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../services/ui/logService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../services/ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));

const CAMPAIGN_NAME = 'TestCampaign';

describe('deathWardService', () => {
    const mockCreature = { name: 'Fighter1', type: 'player', currentHp: 10 };
    const mockPlayerComputed = {
        name: 'Fighter1',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('checkDeathWard', () => {
        it('should return intercepted: false when no death_ward buff active', () => {
            runtimeState.getRuntimeValue.mockImplementation((charName, key) => {
                if (key === 'hitPoints') return 20;
                if (key === 'activeBuffs') return [];
                return undefined;
            });

            const result = checkDeathWard(mockCreature, mockPlayerComputed, CAMPAIGN_NAME);

            expect(result.intercepted).toBe(false);
        });

        it('should intercept when death_ward buff is active and set HP to 1', () => {
            runtimeState.getRuntimeValue.mockImplementation((charName, key, _campaign) => {
                if (key === 'hitPoints') return 20;
                if (key === 'activeBuffs') return [
                    { name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Cleric1' },
                ];
                if (key === 'activeConditions') return ['unconscious'];
                return undefined;
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = checkDeathWard(mockCreature, mockPlayerComputed, CAMPAIGN_NAME);

            expect(result.intercepted).toBe(true);
            expect(result.newHp).toBe(1);
            expect(result.finalDamage).toBe(0);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Fighter1',
                'currentHitPoints',
                1,
                CAMPAIGN_NAME,
            );
        });

        it('should clear death saves and death failures', () => {
            runtimeState.getRuntimeValue.mockImplementation((charName, key) => {
                if (key === 'hitPoints') return 20;
                if (key === 'activeBuffs') return [
                    { name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Cleric1' },
                ];
                if (key === 'activeConditions') return ['unconscious'];
                if (key === 'deathSaves') return [false, true, false];
                if (key === 'deathFailures') return [true, false, false];
                return undefined;
            });
            logService.addEntry.mockResolvedValue(undefined);

            checkDeathWard(mockCreature, mockPlayerComputed, CAMPAIGN_NAME);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Fighter1',
                'deathSaves',
                [false, false, false],
                CAMPAIGN_NAME,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Fighter1',
                'deathFailures',
                [false, false, false],
                CAMPAIGN_NAME,
            );
        });

        it('should remove unconscious condition', () => {
            runtimeState.getRuntimeValue.mockImplementation((charName, key) => {
                if (key === 'hitPoints') return 20;
                if (key === 'activeBuffs') return [
                    { name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Cleric1' },
                ];
                if (key === 'activeConditions') return ['unconscious', 'poisoned'];
                return undefined;
            });
            logService.addEntry.mockResolvedValue(undefined);

            checkDeathWard(mockCreature, mockPlayerComputed, CAMPAIGN_NAME);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Fighter1',
                'activeConditions',
                ['poisoned'],
                CAMPAIGN_NAME,
            );
        });

        it('should remove death_ward buff after triggering', () => {
            runtimeState.getRuntimeValue.mockImplementation((charName, key) => {
                if (key === 'hitPoints') return 20;
                if (key === 'activeBuffs') return [
                    { name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Cleric1' },
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ];
                if (key === 'activeConditions') return [];
                return undefined;
            });
            logService.addEntry.mockResolvedValue(undefined);

            checkDeathWard(mockCreature, mockPlayerComputed, CAMPAIGN_NAME);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Fighter1',
                'activeBuffs',
                [{ name: 'Mage Armor', effect: 'mage_armor' }],
                CAMPAIGN_NAME,
            );
        });

        it('should log hp_change and ability_use entries', () => {
            runtimeState.getRuntimeValue.mockImplementation((charName, key) => {
                if (key === 'hitPoints') return 20;
                if (key === 'activeBuffs') return [
                    { name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Cleric1' },
                ];
                if (key === 'activeConditions') return [];
                return undefined;
            });
            logService.addEntry.mockResolvedValue(undefined);

            checkDeathWard(mockCreature, mockPlayerComputed, CAMPAIGN_NAME);

            expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                type: 'hp_change',
                targetName: 'Fighter1',
                currentHp: 1,
                maxHp: 20,
                isUnconscious: false,
                sourceName: 'Death Ward',
            }));
            expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                type: 'ability_use',
                characterName: 'Cleric1',
                abilityName: 'Death Ward',
                description: expect.stringContaining('Death Ward protected Fighter1'),
            }));
        });

        it('should dispatch combat-summary-updated event', () => {
            runtimeState.getRuntimeValue.mockImplementation((charName, key) => {
                if (key === 'hitPoints') return 20;
                if (key === 'activeBuffs') return [
                    { name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Cleric1' },
                ];
                if (key === 'activeConditions') return [];
                return undefined;
            });
            logService.addEntry.mockResolvedValue(undefined);

            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

            checkDeathWard(mockCreature, mockPlayerComputed, CAMPAIGN_NAME);

            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
            dispatchSpy.mockRestore();
        });
    });
});
