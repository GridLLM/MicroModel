/**
 * Calculates similarity score between two prompts using multiple similarity metrics
 * @param prompt1 - First prompt string
 * @param prompt2 - Second prompt string
 * @returns Similarity score between 0 and 1 (1 being most similar)
 */
export function createSimilarityScoreBetweenPrompts(prompt1: string, prompt2: string): number {
  if (!prompt1 || !prompt2) return 0;
  
  // Normalize prompts for comparison
  const normalizedPrompt1 = normalizePrompt(prompt1);
  const normalizedPrompt2 = normalizePrompt(prompt2);
  
  // Calculate multiple similarity metrics
  const jaccardSimilarity = calculateJaccardSimilarity(normalizedPrompt1, normalizedPrompt2);
  const cosineSimilarity = calculateCosineSimilarity(normalizedPrompt1, normalizedPrompt2);
  const structuralSimilarity = calculateStructuralSimilarity(prompt1, prompt2);
  
  // Weighted combination of similarity metrics
  const finalScore = (
    jaccardSimilarity * 0.3 +
    cosineSimilarity * 0.4 +
    structuralSimilarity * 0.3
  );
  
  return Math.round(finalScore * 1000) / 1000; // Round to 3 decimal places
}

/**
 * Normalizes a prompt by converting to lowercase, removing extra whitespace,
 * and extracting meaningful words
 */
function normalizePrompt(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .split(' ')
    .filter(word => word.length > 2) // Filter out short words
    .filter(word => !isStopWord(word)); // Filter out common stop words
}

/**
 * Calculates Jaccard similarity (intersection over union) between two sets of words
 */
function calculateJaccardSimilarity(words1: string[], words2: string[]): number {
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(word => set2.has(word)));
  const union = new Set([...set1, ...set2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Calculates cosine similarity between two prompts using word frequency vectors
 */
function calculateCosineSimilarity(words1: string[], words2: string[]): number {
  const allWords = [...new Set([...words1, ...words2])];
  
  const vector1 = allWords.map(word => words1.filter(w => w === word).length);
  const vector2 = allWords.map(word => words2.filter(w => w === word).length);
  
  const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
  const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
  
  return magnitude1 === 0 || magnitude2 === 0 ? 0 : dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculates structural similarity based on prompt format and structure
 */
function calculateStructuralSimilarity(prompt1: string, prompt2: string): number {
  let structuralScore = 0;
  let totalChecks = 0;
  
  // Check for similar formatting patterns
  const formatPatterns = [
    /\*\*.*?\*\*/g, // Bold text
    /##.*$/gm,      // Headers
    /^\-/gm,        // Bullet points
    /\{[\s\S]*?\}/g, // JSON-like structures
    /\[.*?\]/g,     // Brackets
    /Extract|Analyze|Identify/gi, // Common prompt verbs
    /Format|Structure|Template/gi, // Format-related words
  ];
  
  formatPatterns.forEach(pattern => {
    const matches1 = (prompt1.match(pattern) || []).length;
    const matches2 = (prompt2.match(pattern) || []).length;
    const maxMatches = Math.max(matches1, matches2);
    
    if (maxMatches > 0) {
      structuralScore += 1 - Math.abs(matches1 - matches2) / maxMatches;
    } else {
      structuralScore += 1; // Both have zero matches
    }
    totalChecks++;
  });
  
  // Check for similar length patterns
  const lengthRatio = Math.min(prompt1.length, prompt2.length) / Math.max(prompt1.length, prompt2.length);
  structuralScore += lengthRatio;
  totalChecks++;
  
  return totalChecks === 0 ? 0 : structuralScore / totalChecks;
}

/**
 * Simple stop words filter
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'shall', 'this', 'that',
    'these', 'those', 'your', 'you', 'all', 'any', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'can', 'just', 'should', 'now'
  ]);
  
  return stopWords.has(word.toLowerCase());
}
