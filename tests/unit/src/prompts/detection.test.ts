import { comparePrompts } from '../../../../src/prompts/detection';

describe('comparePrompts', () => {
    it('should return true for identical prompts', async () => {
        const promptA = 'Hello world';
        const promptB = 'Hello world';
        const result = await comparePrompts(promptA, promptB);
        expect(result).toBe(true);
    });

    it('should return true for prompts with same content but different whitespace', async () => {
        const promptA = '  Hello world  ';
        const promptB = 'Hello world';
        const result = await comparePrompts(promptA, promptB);
        expect(result).toBe(true);
    });

    it('should return false for different prompts', async () => {
        const promptA = 'Hello world';
        const promptB = 'Goodbye world';
        const result = await comparePrompts(promptA, promptB);
        expect(result).toBe(false);
    });

    it('should return true for empty strings', async () => {
        const promptA = '';
        const promptB = '';
        const result = await comparePrompts(promptA, promptB);
        expect(result).toBe(true);
    });

    it('should return true for strings with only whitespace', async () => {
        const promptA = '   ';
        const promptB = '\t\n';
        const result = await comparePrompts(promptA, promptB);
        expect(result).toBe(true);
    });

    it('should handle multiline prompts correctly', async () => {
        const promptA = `Line 1
        Line 2
        Line 3`;
        const promptB = `Line 1
        Line 2
        Line 3`;
        const result = await comparePrompts(promptA, promptB);
        expect(result).toBe(true);
    });

    it('should return false for multiline prompts with different content', async () => {
        const promptA = `Line 1
        Line 2`;
        const promptB = `Line 1
        Line 3`;
        const result = await comparePrompts(promptA, promptB);
        expect(result).toBe(false);
    });
});