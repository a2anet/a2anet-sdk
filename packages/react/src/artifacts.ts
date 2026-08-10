// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

/** The AG-UI custom event emitted when an A2A Net agent produces an artifact. */
export const AG_UI_ARTIFACT_EVENT_NAME = "a2anet.adk.artifact";

/** A downloadable file parsed from an A2A Net artifact event. */
export interface ReceivedArtifactFile {
    id: string;
    filename: string;
    mimeType: string;
    /** Base64 bytes as serialized by ADK. Absent for URI-delivered files. */
    bytes?: string;
    uri?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string {
    return typeof record[key] === "string" ? (record[key] as string) : "";
}

function getRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
    return isRecord(record[key]) ? (record[key] as Record<string, unknown>) : {};
}

/**
 * Parse the value of an `a2anet.adk.artifact` custom event.
 *
 * Text artifacts are omitted because their content is already represented in the transcript.
 */
export function readArtifactEvent(value: unknown): ReceivedArtifactFile | null {
    if (!isRecord(value)) return null;

    const filename = getString(value, "filename");
    const part = getRecord(value, "artifact");
    if (!filename || Object.keys(part).length === 0) return null;

    const versionMimeType = getString(getRecord(value, "versionInfo"), "mimeType");
    const id = `${filename}_${String(value.version ?? 0)}`;
    const inlineData = getRecord(part, "inlineData");
    if (Object.keys(inlineData).length > 0) {
        return {
            id,
            filename,
            mimeType: getString(inlineData, "mimeType") || versionMimeType,
            bytes: getString(inlineData, "data"),
        };
    }

    const fileData = getRecord(part, "fileData");
    if (Object.keys(fileData).length > 0) {
        return {
            id,
            filename,
            mimeType: getString(fileData, "mimeType") || versionMimeType,
            uri: getString(fileData, "fileUri"),
        };
    }

    return null;
}
