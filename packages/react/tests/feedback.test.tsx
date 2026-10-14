// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, test } from "bun:test";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import {
    A2ANetProvider,
    type A2ANetRateMessage,
    A2ANetStatus,
    useA2ANet,
    useA2ANetFeedback,
} from "../src/index.js";

const originalFetch = globalThis.fetch;

let rate: A2ANetRateMessage | undefined;

function Probe(): ReactNode {
    rate = useA2ANetFeedback("thread-1");
    return null;
}

function CopilotBridge(): ReactNode {
    const { copilotKitProps, status } = useA2ANet();
    if (status !== A2ANetStatus.Ready) return null;
    return (
        <CopilotKitProvider {...copilotKitProps}>
            <Probe />
        </CopilotKitProvider>
    );
}

function renderProbe(): void {
    render(
        <A2ANetProvider
            getCredentials={() =>
                Promise.resolve({
                    token: "customer-token",
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    agentId: "agent-1",
                })
            }
            runtimeUrl="https://runtime.a2anet.test"
        >
            <CopilotBridge />
        </A2ANetProvider>,
    );
}

afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    rate = undefined;
});

describe("useA2ANetFeedback", () => {
    test("records feedback on the turn a message belongs to", async () => {
        const requests: Array<{ url: string; init?: RequestInit }> = [];
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.endsWith("/info")) return Response.json({ version: "1.0.0", agents: {} });
            requests.push({ url, init });
            return Response.json({ ok: true });
        }) as typeof globalThis.fetch;
        renderProbe();
        await waitFor(() => expect(rate).toBeDefined());

        await rate?.("message-1", { value: 0, rationale: "It booked the wrong day." });

        expect(requests).toHaveLength(1);
        expect(requests[0]?.url).toBe(
            "https://runtime.a2anet.test/threads/thread-1/messages/message-1/feedback",
        );
        expect(requests[0]?.init?.method).toBe("PUT");
        expect(new Headers(requests[0]?.init?.headers).get("Authorization")).toBe(
            "Bearer customer-token",
        );
        expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
            value: 0,
            rationale: "It booked the wrong day.",
        });
    });

    test("throws when the runtime refuses the feedback", async () => {
        globalThis.fetch = (async (input: RequestInfo | URL) =>
            String(input).endsWith("/info")
                ? Response.json({ version: "1.0.0", agents: {} })
                : Response.json(
                      { detail: "Not found" },
                      { status: 404 },
                  )) as typeof globalThis.fetch;
        renderProbe();
        await waitFor(() => expect(rate).toBeDefined());

        await expect(rate?.("message-2", { value: 1 })).rejects.toThrow("failed with 404");
    });
});
