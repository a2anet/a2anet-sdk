// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "bun:test";

import { AG_UI_ARTIFACT_EVENT_NAME, readArtifactEvent } from "../src/index.js";

const event = (artifact: Record<string, unknown>, mimeType = "text/csv") => ({
    filename: "report.csv",
    version: 2,
    artifact,
    versionInfo: { mimeType },
});

describe("A2A Net artifacts", () => {
    test("exports the custom event name", () => {
        expect(AG_UI_ARTIFACT_EVENT_NAME).toBe("a2anet.adk.artifact");
    });

    test("parses inline and URI-delivered files", () => {
        expect(
            readArtifactEvent(event({ inlineData: { data: "YSxi", mimeType: "text/csv" } })),
        ).toEqual({
            id: "report.csv_2",
            filename: "report.csv",
            mimeType: "text/csv",
            bytes: "YSxi",
        });
        expect(
            readArtifactEvent(event({ fileData: { fileUri: "https://files.example/report.csv" } })),
        ).toEqual({
            id: "report.csv_2",
            filename: "report.csv",
            mimeType: "text/csv",
            uri: "https://files.example/report.csv",
        });
    });

    test("rejects malformed and text-only artifacts", () => {
        expect(readArtifactEvent(undefined)).toBeNull();
        expect(readArtifactEvent({ artifact: "invalid" })).toBeNull();
        expect(readArtifactEvent(event({ text: "already in the transcript" }))).toBeNull();
    });
});
