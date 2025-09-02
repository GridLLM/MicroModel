import { createSimilarityScoreBetweenPrompts } from '../../../../src/prompts/detection';
import { create10kPrompt, createNewsPrompt } from './testPrompts';

describe('Prompt Similarity Detection', () => {
  // Sample data for testing
  const sampleTenKText = 'Sample 10-K filing text for testing purposes';
  const sampleNewsText = 'Apple announces new iPhone with advanced AI features';

  // Generate test prompts using existing functions
  const tenKPrompt1 = create10kPrompt(sampleTenKText);
  const tenKPrompt2 = create10kPrompt(sampleTenKText);
  const newsPrompt = createNewsPrompt(sampleNewsText);

  describe('createSimilarityScoreBetweenPrompts', () => {
    it('should return high similarity (>0.7) for two similar 10-K prompts', () => {
      const similarity = createSimilarityScoreBetweenPrompts(tenKPrompt1, tenKPrompt2);
      
      console.log('Similarity between 10-K prompts:', similarity);
      
      expect(similarity).toBeGreaterThan(0.7);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return low similarity (<0.4) between 10-K prompt and news prompt', () => {
      const similarity1 = createSimilarityScoreBetweenPrompts(tenKPrompt1, newsPrompt);
      const similarity2 = createSimilarityScoreBetweenPrompts(tenKPrompt2, newsPrompt);
      
      console.log('Similarity between 10-K prompt 1 and news prompt:', similarity1);
      console.log('Similarity between 10-K prompt 2 and news prompt:', similarity2);
      
      expect(similarity1).toBeLessThan(0.4);
      expect(similarity2).toBeLessThan(0.4);
    });

    it('should return 0 for empty or null prompts', () => {
      expect(createSimilarityScoreBetweenPrompts('', tenKPrompt1)).toBe(0);
      expect(createSimilarityScoreBetweenPrompts(tenKPrompt1, '')).toBe(0);
      expect(createSimilarityScoreBetweenPrompts('', '')).toBe(0);
    });

    it('should return 1.0 for identical prompts', () => {
      const similarity = createSimilarityScoreBetweenPrompts(tenKPrompt1, tenKPrompt1);
      expect(similarity).toBe(1.0);
    });

    it('should return values between 0 and 1', () => {
      const similarities = [
        createSimilarityScoreBetweenPrompts(tenKPrompt1, tenKPrompt2),
        createSimilarityScoreBetweenPrompts(tenKPrompt1, newsPrompt),
        createSimilarityScoreBetweenPrompts(tenKPrompt2, newsPrompt)
      ];

      similarities.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should demonstrate the expected similarity patterns', () => {
      const tenKSimilarity = createSimilarityScoreBetweenPrompts(tenKPrompt1, tenKPrompt2);
      const crossSimilarity1 = createSimilarityScoreBetweenPrompts(tenKPrompt1, newsPrompt);
      const crossSimilarity2 = createSimilarityScoreBetweenPrompts(tenKPrompt2, newsPrompt);

      console.log('\n=== SIMILARITY TEST RESULTS ===');
      console.log(`10-K Prompt 1 vs 10-K Prompt 2: ${tenKSimilarity}`);
      console.log(`10-K Prompt 1 vs News Prompt: ${crossSimilarity1}`);
      console.log(`10-K Prompt 2 vs News Prompt: ${crossSimilarity2}`);
      console.log('================================\n');

      // The two 10-K prompts should be more similar to each other than to the news prompt
      expect(tenKSimilarity).toBeGreaterThan(crossSimilarity1);
      expect(tenKSimilarity).toBeGreaterThan(crossSimilarity2);
    });
  });
});
