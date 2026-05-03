import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from './data-loader.js';

// Mock the data-loader module
vi.mock('./data-loader.js', () => ({
    loadValidationRules: vi.fn(),
    fetchBackgroundData: vi.fn(),
}));

// Import after mocking
import { 
    getFeatLimits, 
    validateFeats,
    getFeatTypeInfo,
    getPreSelectedFeats
} from './feat-validation.js';

describe('feat-validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
     });

    describe('getFeatLimits', () => {
        it('should return correct feat limits for 5e at level 4', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                  }
              });

            const result = await getFeatLimits({
                rules: '5e',
                level: 4
             });

            expect(result.allowed).toBe(1);
            expect(result.originRequired).toBe(false);
         });

        it('should return correct feat limits for 5e at level 8', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                  }
              });

            const result = await getFeatLimits({
                rules: '5e',
                level: 8
             });

            expect(result.allowed).toBe(2);
         });

        it('should return correct feat limits for 2024 at level 1', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [1, 4, 8, 12, 16, 19],
                    origin_feat_required: true,
                    origin_feat_level: 1
                  }
              });

            const result = await getFeatLimits({
                rules: '2024',
                level: 1
             });

            expect(result.allowed).toBe(1);
            expect(result.originRequired).toBe(true);
         });

        it('should return correct feat limits for 2024 at level 4', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [1, 4, 8, 12, 16, 19],
                    origin_feat_required: true
                  }
              });

            const result = await getFeatLimits({
                rules: '2024',
                level: 4
             });

            expect(result.allowed).toBe(2);
         });

        it('should return 0 feats for level below first feat level in 5e', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                  }
              });

            const result = await getFeatLimits({
                rules: '5e',
                level: 3
             });

            expect(result.allowed).toBe(0);
         });

        it('should use default values when feats not in rules', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({});

            const result = await getFeatLimits({
                rules: '5e',
                level: 4
             });

            expect(result.allowed).toBe(1);
     });
        });

    describe('validateFeats', () => {
        it('should return empty warnings when no feats selected', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                  }
              });

            const warnings = await validateFeats({
                rules: '5e',
                level: 4,
                feats: []
             }, []);

            expect(warnings).toEqual([]);
         });

        it('should warn when too many feats selected', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                  }
              });

            const warnings = await validateFeats({
                rules: '5e',
                level: 4,
                feats: ['Tough', 'Resilient']
             }, []);

            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings[0].type).toBe('warning');
         });

        it('should warn about origin feat requirement in 2024 at level 1', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [1, 4, 8, 12, 16, 19],
                    origin_feat_required: true
                  }
              });

            const allFeats = [
                  { name: 'Observer', type: 'Origin Feat' },
                  { name: 'Tough', type: 'General' }
              ];

            const warnings = await validateFeats({
                rules: '2024',
                level: 1,
                feats: ['Tough']
             }, allFeats);

            expect(warnings.some(w => w.message.includes('Origin feat'))).toBe(true);
         });

        it('should warn about Epic Boon feats at low levels', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                  }
              });

            const allFeats = [
                  { name: 'Master of Reality', type: 'Epic Boon' }
              ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 10,
                feats: ['Master of Reality']
             }, allFeats);

            expect(warnings.some(w => w.message.includes('Epic Boon'))).toBe(true);
         });

        it('should warn about level prerequisites', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                  }
              });

            const allFeats = [
                  { name: 'Ability Score Improvement', prerequisites: ['4th level'] }
              ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 2,
                feats: ['Ability Score Improvement']
             }, allFeats);

            expect(warnings.some(w => w.message.includes('4th level'))).toBe(true);
         });

        it('should warn about ability score prerequisites', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                  }
              });

            const allFeats = [
                  { name: 'Crusher', prerequisites: ['Strength 13'] }
              ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 4,
                feats: ['Crusher']
             }, allFeats);

            expect(warnings.some(w => w.message.includes('Strength'))).toBe(true);
     });
        });

    describe('getFeatTypeInfo', () => {
        it('should return type info for a known feat', () => {
            const allFeats = [
                  { name: 'Observer', type: 'Origin Feat' }
              ];

            const result = getFeatTypeInfo('Observer', allFeats);

            expect(result.type).toBe('Origin Feat');
            expect(result.isOrigin).toBe(true);
            expect(result.isEpicBoon).toBe(false);
         });

        it('should return type info for an Epic Boon feat', () => {
            const allFeats = [
                  { name: 'Master of Reality', type: 'Epic Boon' }
              ];

            const result = getFeatTypeInfo('Master of Reality', allFeats);

            expect(result.type).toBe('Epic Boon');
            expect(result.isOrigin).toBe(false);
            expect(result.isEpicBoon).toBe(true);
         });

        it('should return type info for Epic Boon Feat type', () => {
            const allFeats = [
                  { name: 'Awakened Mind', type: 'Epic Boon Feat' }
              ];

            const result = getFeatTypeInfo('Awakened Mind', allFeats);

            expect(result.isEpicBoon).toBe(true);
         });

        it('should return default info for unknown feat', () => {
            const result = getFeatTypeInfo('Unknown Feat', []);

            expect(result.type).toBe('Unknown');
            expect(result.isOrigin).toBe(false);
            expect(result.isEpicBoon).toBe(false);
         });

        it('should return General type when feat has no type', () => {
            const allFeats = [
                  { name: 'Tough' }
              ];
            
            const result = getFeatTypeInfo('Tough', allFeats);
            
            expect(result.type).toBe('General');
        });

        it('should handle feat with type as array', () => {
            const allFeats = [
                  { name: 'MultiType', type: ['Origin Feat', 'General'] }
              ];
            
            const result = getFeatTypeInfo('MultiType', allFeats);
            
            // When type is an array, it returns the array as the type
            expect(Array.isArray(result.type)).toBe(true);
        });
        });

    describe('getPreSelectedFeats', () => {
        it('should return pre-selected feats from background in 2024', async () => {
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
                feat: 'Observer'
             });

            const result = await getPreSelectedFeats({
                rules: '2024',
                background: 'Acolyte'
             });

            expect(result).toContain('Observer');
         });

        it('should return empty array for 5e backgrounds', async () => {
            const result = await getPreSelectedFeats({
                rules: '5e',
                background: 'Acolyte'
             });

            expect(result).toEqual([]);
         });

        it('should return empty array when no background specified', async () => {
            const result = await getPreSelectedFeats({
                rules: '2024'
             });

            expect(result).toEqual([]);
         });

        it('should return empty array when background has no feat', async () => {
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});

            const result = await getPreSelectedFeats({
                rules: '2024',
                background: 'Charlatan'
             });

            expect(result).toEqual([]);
     });
        });
});
