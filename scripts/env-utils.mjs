import fs from 'node:fs';

function normalizeEnvValue(value) {
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }

    return value;
}

function formatValueForLog(value) {
    return value === '' ? '<empty>' : value;
}

export function parseEnvFileDetailed(filePath) {
    const result = {
        env: {},
        duplicates: [],
        filePath,
        exists: fs.existsSync(filePath),
    };

    if (!result.exists) {
        return result;
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const occurrencesByKey = new Map();

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, eqIndex).trim();
        const value = normalizeEnvValue(trimmed.slice(eqIndex + 1).trim());
        const occurrence = { line: index + 1, value };

        if (!occurrencesByKey.has(key)) {
            occurrencesByKey.set(key, []);
        }

        occurrencesByKey.get(key).push(occurrence);
        result.env[key] = value;
    }

    for (const [key, occurrences] of occurrencesByKey.entries()) {
        if (occurrences.length < 2) {
            continue;
        }

        const finalOccurrence = occurrences[occurrences.length - 1];
        const earlierNonEmpty = [...occurrences]
            .slice(0, -1)
            .reverse()
            .find((entry) => entry.value !== '');

        result.duplicates.push({
            key,
            occurrences,
            finalOccurrence,
            emptyOverrideOfNonEmpty: finalOccurrence.value === '' && Boolean(earlierNonEmpty),
            overriddenNonEmptyOccurrence: earlierNonEmpty || null,
        });
    }

    return result;
}

export function createDuplicateEnvWarnings(sourceLabel, parsedEnv) {
    return parsedEnv.duplicates.map((duplicate) => {
        const occurrenceLines = duplicate.occurrences.map((entry) => entry.line).join(', ');
        let message =
            `${sourceLabel}: duplicate key \`${duplicate.key}\` at lines ${occurrenceLines}. `
            + `Final value is ${formatValueForLog(duplicate.finalOccurrence.value)}.`;

        if (duplicate.emptyOverrideOfNonEmpty && duplicate.overriddenNonEmptyOccurrence) {
            message += ` Empty value on line ${duplicate.finalOccurrence.line} overrides `
                + `non-empty value from line ${duplicate.overriddenNonEmptyOccurrence.line}.`;
        }

        return message;
    });
}

