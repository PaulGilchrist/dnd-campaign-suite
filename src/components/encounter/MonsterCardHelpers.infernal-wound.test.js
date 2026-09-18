// MA-0367: Bearded Devil Infernal Glaive — parseInfernalWoundClause arms the
// registered infernal_wound te producer off the MA-0367 structured keys. Rows
// without hit_target_effect stay byte-inert (null) so no other monster's wound
// prose (e.g. the DC 17 Cornugon 3d6 variant) can double-arm.
import { describe, it, expect } from 'vitest';
import { parseInfernalWoundClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-0367 parseInfernalWoundClause', () => {
    const glaive = monstersData.find(m => m.name === 'Bearded Devil')
        .actions.find(a => a.name === 'Infernal Glaive');

    it('arms the wound off the authored bearded-devil Infernal Glaive row', () => {
        expect(parseInfernalWoundClause(glaive)).toEqual({
            effect: 'infernal_wound',
            bleedDie: '1d10',
            expiresMinutes: 1,
            medicineDc: 12,
        });
    });

    it('the authored row carries dc_success "full" (save gates only the wound)', () => {
        expect(glaive.dc_success).toBe('full');
        expect(glaive.hit_target_effect).toBe('infernal_wound');
    });

    it('defaults bleed die / minute / medicine DC when keys omitted', () => {
        expect(parseInfernalWoundClause({ hit_target_effect: 'infernal_wound' })).toEqual({
            effect: 'infernal_wound',
            bleedDie: '1d10',
            expiresMinutes: 1,
            medicineDc: 12,
        });
    });

    it('byte-inert null for rows without the structured key / non-objects', () => {
        expect(parseInfernalWoundClause({ name: 'Claws', save_effect: 'bleeds' })).toBeNull();
        expect(parseInfernalWoundClause(null)).toBeNull();
        expect(parseInfernalWoundClause(undefined)).toBeNull();
    });

    it('no OTHER wound-prose monster row arms (only the structured key arms)', () => {
        const armed = monstersData.flatMap(m =>
            [...(m.actions || []), ...(m.legendary_actions || [])]
                .filter(a => parseInfernalWoundClause(a))
                .map(a => `${m.name}/${a.name}`)
        );
        expect(armed).toEqual(['Bearded Devil/Infernal Glaive']);
    });
});
