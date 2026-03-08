/**
 * Generates a unique name by appending a number suffix if the name already exists.
 * Examples: "New Skill" → "New Skill 2" → "New Skill 3"
 *           "My Skill (copy)" → "My Skill (copy) 2"
 */
export function getUniqueName(baseName: string, existingNames: string[]): string {
    if (!existingNames.includes(baseName)) {
        return baseName;
    }

    let counter = 2;
    while (existingNames.includes(`${baseName} ${counter}`)) {
        counter++;
    }
    return `${baseName} ${counter}`;
}
