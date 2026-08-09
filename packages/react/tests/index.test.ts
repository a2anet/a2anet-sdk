// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "bun:test";
import { VERSION } from "../src/index.js";

describe("@a2anet/react", () => {
    test("has a semantic version", () => {
        expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
