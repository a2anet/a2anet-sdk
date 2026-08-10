// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import {
    type A2ANetAgent,
    type A2ANetContextValue,
    type A2ANetCredentials,
    A2ANetProvider,
    A2ANetStatus,
    useA2ANet,
} from "../src/index.js";

GlobalRegistrator.register();

const credentials = (overrides: Partial<A2ANetCredentials> = {}): A2ANetCredentials => ({
    token: "token-1",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    agentId: "agent-1",
    runtimeUrl: "https://runtime.example",
    ...overrides,
});

let current: A2ANetContextValue | undefined;

function Probe(): ReactNode {
    current = useA2ANet();
    return <span data-testid="status">{current.status}</span>;
}

afterEach(() => {
    cleanup();
    current = undefined;
});

describe("A2ANetProvider", () => {
    test("always renders children while credentials are loading", () => {
        const view = render(
            <A2ANetProvider getCredentials={() => new Promise(() => {})}>
                <Probe />
            </A2ANetProvider>,
        );

        expect(view.getByTestId("status").textContent).toBe(A2ANetStatus.Loading);
        expect(current?.copilotKitProps).toEqual({});
    });

    test("loads CopilotKit-compatible runtime and self-managed agent properties", async () => {
        render(
            <A2ANetProvider getCredentials={() => Promise.resolve(credentials())}>
                <Probe />
            </A2ANetProvider>,
        );

        await waitFor(() => expect(current?.status).toBe(A2ANetStatus.Ready));
        const props = current?.copilotKitProps;
        const agent = props?.selfManagedAgents?.["agent-1"] as A2ANetAgent | undefined;

        expect(props).toMatchObject({
            runtimeUrl: "https://runtime.example",
            agent: "agent-1",
            headers: { Authorization: "Bearer token-1" },
            useSingleEndpoint: false,
        });
        expect(agent?.url).toBe("https://runtime.example/agent-1/ag-ui");
        expect(agent?.headers).toEqual({ Authorization: "Bearer token-1" });
        expect(current?.error).toBeNull();
    });

    test("exposes credential failures and retries explicitly", async () => {
        let calls = 0;
        const getCredentials = (): Promise<A2ANetCredentials> => {
            calls += 1;
            return calls === 1
                ? Promise.reject(new Error("mint failed"))
                : Promise.resolve(credentials());
        };
        render(
            <A2ANetProvider getCredentials={getCredentials}>
                <Probe />
            </A2ANetProvider>,
        );

        await waitFor(() => expect(current?.status).toBe(A2ANetStatus.Error));
        expect(current?.error?.message).toBe("mint failed");

        act(() => current?.retry());
        await waitFor(() => expect(current?.status).toBe(A2ANetStatus.Ready));
        expect(calls).toBe(2);
    });

    test("refreshes before expiry without replacing the agent", async () => {
        let calls = 0;
        const getCredentials = (): Promise<A2ANetCredentials> => {
            calls += 1;
            return Promise.resolve(
                credentials(
                    calls === 1
                        ? {
                              expiresAt: new Date(Date.now() + 40).toISOString(),
                          }
                        : {
                              token: "token-2",
                          },
                ),
            );
        };
        render(
            <A2ANetProvider getCredentials={getCredentials}>
                <Probe />
            </A2ANetProvider>,
        );

        await waitFor(() => expect(current?.status).toBe(A2ANetStatus.Ready));
        const firstAgent = current?.copilotKitProps.selfManagedAgents?.["agent-1"] as
            | A2ANetAgent
            | undefined;
        await waitFor(() => expect(calls).toBe(2));
        await waitFor(() =>
            expect(current?.copilotKitProps.headers).toEqual({
                Authorization: "Bearer token-2",
            }),
        );

        expect(current?.copilotKitProps.selfManagedAgents?.["agent-1"]).toBe(firstAgent);
        expect(firstAgent?.headers).toEqual({ Authorization: "Bearer token-2" });
    });

    test("retains the agent and provider properties when refresh fails", async () => {
        let calls = 0;
        const getCredentials = (): Promise<A2ANetCredentials> => {
            calls += 1;
            if (calls === 1) {
                return Promise.resolve(
                    credentials({ expiresAt: new Date(Date.now() + 40).toISOString() }),
                );
            }
            if (calls === 2) return Promise.reject(new Error("refresh failed"));
            return Promise.resolve(credentials({ token: "token-3" }));
        };
        render(
            <A2ANetProvider getCredentials={getCredentials}>
                <Probe />
            </A2ANetProvider>,
        );

        await waitFor(() => expect(current?.status).toBe(A2ANetStatus.Error));
        const agent = current?.copilotKitProps.selfManagedAgents?.["agent-1"];
        expect(current?.error?.message).toBe("refresh failed");
        expect(current?.copilotKitProps.headers).toEqual({ Authorization: "Bearer token-1" });

        act(() => current?.retry());
        await waitFor(() => expect(current?.status).toBe(A2ANetStatus.Ready));
        expect(current?.copilotKitProps.selfManagedAgents?.["agent-1"]).toBe(agent);
        expect(current?.copilotKitProps.headers).toEqual({ Authorization: "Bearer token-3" });
    });
});
