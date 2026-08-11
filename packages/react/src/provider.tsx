// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import type { CopilotKitProviderProps } from "@copilotkit/react-core/v2";
import {
    type ReactElement,
    type ReactNode,
    createContext,
    createElement,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { A2ANetAgent, type A2ANetRunContext } from "./agent.js";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 1000;

/** Credentials minted by an application's backend for direct A2A Net access. */
export interface A2ANetCredentials {
    token: string;
    expiresAt: string;
    agentId: string;
    runtimeUrl: string;
}

/** Runtime values returned for a normal CopilotKit provider. */
export interface A2ANetCopilotKitProps
    extends Omit<CopilotKitProviderProps, "children" | "runtimeUrl"> {
    runtimeUrl?: string;
    /** The agent name used by CopilotKit integrations that support a default agent prop. */
    agent?: string;
}

/** A2A Net credential lifecycle states. */
export const A2ANetStatus = {
    Loading: "loading",
    Ready: "ready",
    Error: "error",
} as const;

/** The current A2A Net credential lifecycle state. */
export type A2ANetStatus = (typeof A2ANetStatus)[keyof typeof A2ANetStatus];

/** Properties accepted by {@link A2ANetProvider}. */
export interface A2ANetProviderProps {
    children: ReactNode;
    getCredentials: () => Promise<A2ANetCredentials>;
    /** Read on every run, so a caller may return whatever its current page holds. */
    getContext?: () => A2ANetRunContext;
}

/** Values exposed by {@link useA2ANet}. */
export interface A2ANetContextValue {
    agent: A2ANetAgent | null;
    copilotKitProps: A2ANetCopilotKitProps;
    status: A2ANetStatus;
    /** A failed refresh reports its error while the current credential keeps working. */
    error: Error | null;
    retry: () => void;
}

interface ProviderState {
    agent: A2ANetAgent | null;
    credentials: A2ANetCredentials | null;
    status: A2ANetStatus;
    error: Error | null;
}

const A2ANetContext = createContext<A2ANetContextValue | null>(null);

function errorFrom(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
}

function refreshDelay(expiresAt: string): number {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
        throw new Error("A2A Net credentials must have a future expiresAt value");
    }
    return remaining - Math.min(REFRESH_MARGIN_MS, remaining / 2);
}

function agentUrl(credentials: A2ANetCredentials): string {
    return `${credentials.runtimeUrl.replace(/\/+$/, "")}/${credentials.agentId}/ag-ui`;
}

/**
 * Load and refresh A2A Net credentials while keeping one agent instance alive.
 *
 * The provider only supplies integration state; it always renders its children and
 * never mounts CopilotKit or application UI itself.
 */
export function A2ANetProvider({
    children,
    getCredentials,
    getContext,
}: A2ANetProviderProps): ReactElement {
    const agentRef = useRef<A2ANetAgent | null>(null);
    const getContextRef = useRef(getContext);
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<ProviderState>({
        agent: null,
        credentials: null,
        status: A2ANetStatus.Loading,
        error: null,
    });

    const retry = useCallback((): void => {
        setAttempt((current) => current + 1);
    }, []);

    // Held in a ref so the agent reads the newest context on every run without the
    // provider having to rebuild it whenever the caller's page changes.
    useEffect(() => {
        getContextRef.current = getContext;
    }, [getContext]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: attempt intentionally triggers retries.
    useEffect(() => {
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const load = async (showLoading: boolean): Promise<void> => {
            if (showLoading) {
                setState((current) => ({
                    ...current,
                    status: A2ANetStatus.Loading,
                    error: null,
                }));
            }

            try {
                const credentials = await getCredentials();
                const delay = refreshDelay(credentials.expiresAt);
                if (!active) return;

                const headers = { Authorization: `Bearer ${credentials.token}` };
                const agent =
                    agentRef.current ??
                    new A2ANetAgent({
                        agentId: credentials.agentId,
                        url: agentUrl(credentials),
                        headers,
                        getContext: () => getContextRef.current?.() ?? {},
                    });
                agentRef.current = agent;
                agent.agentId = credentials.agentId;
                agent.url = agentUrl(credentials);
                agent.headers = headers;

                setState({
                    agent,
                    credentials,
                    status: A2ANetStatus.Ready,
                    error: null,
                });
                timer = setTimeout(() => void load(false), delay);
            } catch (value) {
                if (!active) return;
                // A background refresh runs while the current credential still works, so
                // a failed one reports its error and tries again rather than tearing the
                // conversation down. Only a caller with nothing to fall back on is broken.
                setState((current) => ({
                    ...current,
                    status: showLoading ? A2ANetStatus.Error : current.status,
                    error: errorFrom(value),
                }));
                timer = setTimeout(() => void load(showLoading), RETRY_DELAY_MS);
            }
        };

        void load(true);
        return () => {
            active = false;
            if (timer) clearTimeout(timer);
        };
    }, [attempt, getCredentials]);

    const { agent, credentials } = state;
    const agentId = credentials?.agentId;
    const selfManagedAgents = useMemo(
        () => (agent && agentId ? { [agentId]: agent } : undefined),
        [agent, agentId],
    );
    const copilotKitProps = useMemo<A2ANetCopilotKitProps>(() => {
        if (!agent || !credentials || !selfManagedAgents) return {};
        return {
            runtimeUrl: credentials.runtimeUrl,
            agent: credentials.agentId,
            headers: { Authorization: `Bearer ${credentials.token}` },
            useSingleEndpoint: false,
            selfManagedAgents,
        };
    }, [agent, credentials, selfManagedAgents]);
    const context = useMemo<A2ANetContextValue>(
        () => ({
            agent,
            copilotKitProps,
            status: state.status,
            error: state.error,
            retry,
        }),
        [agent, copilotKitProps, retry, state.error, state.status],
    );

    return createElement(A2ANetContext.Provider, { value: context }, children);
}

/** Read the nearest A2A Net provider's CopilotKit properties and credential status. */
export function useA2ANet(): A2ANetContextValue {
    const context = useContext(A2ANetContext);
    if (!context) throw new Error("useA2ANet must be used within an A2ANetProvider");
    return context;
}
