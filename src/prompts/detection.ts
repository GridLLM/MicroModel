export async function comparePrompts(promptA: string, promptB: string): Promise<boolean> {
    return promptA.trim() === promptB.trim();
}