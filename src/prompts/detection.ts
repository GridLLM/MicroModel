export async function comparePrompts(
  promptA: string,
  promptB: string,
): Promise<boolean> {
  return promptA.trim() === promptB.trim();
}

export async function findSimilarityScore(
  promptA: string,
  promptB: string,
): Promise<number> {
  // Return how much of the two prompts is similar
  const trimmedA = promptA.trim();
  const trimmedB = promptB.trim();

  if (trimmedA === trimmedB) {
    return 1.0;
  }

  // If either is empty after trimming, similarity is 0
  if (trimmedA.length === 0 || trimmedB.length === 0) {
    return 0.0;
  }

  // Calculate a simple similarity score based on common characters
  let commonChars = 0;
  const length = Math.min(trimmedA.length, trimmedB.length);

  for (let i = 0; i < length; i++) {
    if (trimmedA[i] === trimmedB[i]) {
      commonChars++;
    }
  }

  return commonChars / Math.max(trimmedA.length, trimmedB.length);
}
