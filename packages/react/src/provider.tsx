// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import type { HttpAgentFetchFn } from "@ag-ui/client";
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

/** Life left below which a credential is replaced rather than used. */
const MINT_MARGIN_MS = 5 * 60 * 1000;

/**
 * Delays between failed mints, after which only an action mints again.
 *
 * A caller that cannot mint at all must not keep asking for as long as its tab stays open,
 * so the ladder gives a transient failure several quick chances and then stops.
 */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000];

/** Where A2A Net runs agents. Fixed, so minting a token cannot change it. */
export const A2ANET_RUNTIME_URL = "https://agent.a2anet.com";

/** Credentials minted by an application's backend for direct A2A Net access. */
export interface A2ANetCredentials {
    token: string;
    expiresAt: string;
    /** The token is minted for one agent, so the server that mints it names it. */
    agentId: string;
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
    /** Overridden only for local development against a runtime of your own. */
    runtimeUrl?: string;
}

/** Values exposed by {@link useA2ANet}. */
export interface A2ANetContextValue {
    agent: A2ANetAgent | null;
    copilotKitProps: A2ANetCopilotKitProps;
    status: A2ANetStatus;
    /** A failed refresh reports its error while the current credential keeps working. */
    error: Error | null;
    retry: () => void;
    /**
     * Replace the current credential if it is spent, and resolve once one is usable.
     *
     * The provider runs this ahead of every request the agent makes, so it is only worth
     * calling for requests the provider does not make: CopilotKit's thread endpoints
     * build a `fetch` of their own, and carry whatever token the last render gave them.
     */
    checkAndMintCredentials: () => Promise<void>;
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

/** Milliseconds of life left in a credential; zero for one already spent or unreadable. */
function expiresIn(credentials: A2ANetCredentials): number {
    const remaining = new Date(credentials.expiresAt).getTime() - Date.now();
    return Number.isFinite(remaining) ? Math.max(remaining, 0) : 0;
}

function agentUrl(runtimeUrl: string, agentId: string): string {
    return `${runtimeUrl.replace(/\/+$/, "")}/${agentId}/ag-ui`;
}

/**
 * Load and replace A2A Net credentials while keeping one agent instance alive.
 *
 * The provider gives the agent a `fetch` of its own, so `checkAndMintCredentials` runs
 * ahead of every request the agent makes and a spent token is replaced by the next thing
 * the user does. No timer renews one: a background tab or a sleeping machine defers timers
 * well past a token's life, and a session waiting on one signs its requests with a dead
 * token and reads back a 401.
 *
 * The provider only supplies integration state; it always renders its children and
 * never mounts CopilotKit or application UI itself.
 */
export function A2ANetProvider({
    children,
    getCredentials,
    getContext,
    runtimeUrl = A2ANET_RUNTIME_URL,
}: A2ANetProviderProps): ReactElement {
    const agentRef = useRef<A2ANetAgent | null>(null);
    const getContextRef = useRef(getContext);
    const getCredentialsRef = useRef(getCredentials);
    const credentialsRef = useRef<A2ANetCredentials | null>(null);
    const pendingRef = useRef<Promise<A2ANetCredentials> | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const attemptRef = useRef(0);
    const activeRef = useRef(true);
    // The agent's fetch mints through `checkAndMintCredentials`, which is defined after
    // the agent that uses it; the ref ties that knot without rebuilding either one.
    const checkAndMintRef = useRef<() => Promise<A2ANetCredentials>>(() =>
        Promise.reject(new Error("A2A Net credentials are not loading yet")),
    );
    const [state, setState] = useState<ProviderState>({
        agent: null,
        credentials: null,
        status: A2ANetStatus.Loading,
        error: null,
    });

    // Held in refs so a request mints with the newest inputs without the provider
    // having to rebuild the agent whenever the caller's page changes.
    useEffect(() => {
        getContextRef.current = getContext;
    }, [getContext]);
    useEffect(() => {
        getCredentialsRef.current = getCredentials;
    }, [getCredentials]);

    const schedule = useCallback((delay: number, action: () => void): void => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(action, Math.max(delay, 0));
    }, []);

    const authorizedFetch = useCallback<HttpAgentFetchFn>(async (url, requestInit) => {
        const { token } = await checkAndMintRef.current();
        const headers = new Headers(requestInit.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(url, { ...requestInit, headers });
    }, []);

    const buildAgent = useCallback(
        (credentials: A2ANetCredentials): A2ANetAgent => {
            const headers = { Authorization: `Bearer ${credentials.token}` };
            const url = agentUrl(runtimeUrl, credentials.agentId);
            const agent =
                agentRef.current ??
                new A2ANetAgent({
                    agentId: credentials.agentId,
                    url,
                    headers,
                    fetch: authorizedFetch,
                    getContext: () => getContextRef.current?.() ?? {},
                });
            agentRef.current = agent;
            agent.agentId = credentials.agentId;
            agent.url = url;
            agent.headers = headers;
            return agent;
        },
        [authorizedFetch, runtimeUrl],
    );

    // One mint at a time, cleared through `finally` on the promise rather than inside
    // the body: a `getCredentials` that throws synchronously would otherwise run the
    // body to completion before the assignment, pinning that failure here for every
    // later request to read back.
    const load = useCallback((): Promise<A2ANetCredentials> => {
        pendingRef.current ??= (async (): Promise<A2ANetCredentials> => {
            try {
                const credentials = await getCredentialsRef.current();
                if (!activeRef.current) return credentials;

                attemptRef.current = 0;
                credentialsRef.current = credentials;
                setState({
                    agent: buildAgent(credentials),
                    credentials,
                    status: A2ANetStatus.Ready,
                    error: null,
                });
                clearTimeout(timerRef.current);
                return credentials;
            } catch (value) {
                const error = errorFrom(value);
                if (!activeRef.current) throw error;

                // A credential with life left in it keeps the conversation up; a spent
                // one has to say so, because every request it signs now reads back 401.
                const current = credentialsRef.current;
                setState((previous) => ({
                    ...previous,
                    status:
                        current && expiresIn(current) > 0 ? previous.status : A2ANetStatus.Error,
                    error,
                }));

                const delay = RETRY_DELAYS_MS[attemptRef.current];
                if (delay !== undefined) {
                    attemptRef.current += 1;
                    schedule(delay, () => {
                        void checkAndMintRef.current().catch(() => {});
                    });
                }
                throw error;
            }
        })().finally(() => {
            pendingRef.current = null;
        });
        return pendingRef.current;
    }, [buildAgent, schedule]);

    const checkAndMintCredentials = useCallback(async (): Promise<A2ANetCredentials> => {
        const current = credentialsRef.current;
        if (current && expiresIn(current) > MINT_MARGIN_MS) return current;

        try {
            return await load();
        } catch (error) {
            // A mint that fails while the credential it replaces is still good must not
            // fail the request that triggered it.
            if (current && expiresIn(current) > 0) return current;
            throw error;
        }
    }, [load]);
    checkAndMintRef.current = checkAndMintCredentials;

    // Exposed separately so it keeps a stable identity a caller can put in a dependency
    // array, and so the credential itself stays inside the provider.
    const checkAndMintCredentialsVoid = useCallback(async (): Promise<void> => {
        await checkAndMintCredentials();
    }, [checkAndMintCredentials]);

    const retry = useCallback((): void => {
        attemptRef.current = 0;
        setState((previous) => ({ ...previous, error: null }));
        void load().catch(() => {});
    }, [load]);

    useEffect(() => {
        activeRef.current = true;
        void checkAndMintRef.current().catch(() => {});
        return () => {
            activeRef.current = false;
            clearTimeout(timerRef.current);
        };
    }, []);

    const { agent, credentials } = state;
    const agentId = credentials?.agentId;
    const selfManagedAgents = useMemo(
        () => (agent && agentId ? { [agentId]: agent } : undefined),
        [agent, agentId],
    );
    const copilotKitProps = useMemo<A2ANetCopilotKitProps>(() => {
        if (!agent || !credentials || !selfManagedAgents) return {};
        return {
            runtimeUrl,
            agent: credentials.agentId,
            headers: { Authorization: `Bearer ${credentials.token}` },
            useSingleEndpoint: false,
            selfManagedAgents,
        };
    }, [agent, credentials, runtimeUrl, selfManagedAgents]);
    const context = useMemo<A2ANetContextValue>(
        () => ({
            agent,
            copilotKitProps,
            status: state.status,
            error: state.error,
            retry,
            checkAndMintCredentials: checkAndMintCredentialsVoid,
        }),
        [agent, checkAndMintCredentialsVoid, copilotKitProps, retry, state.error, state.status],
    );

    return createElement(A2ANetContext.Provider, { value: context }, children);
}

/** Read the nearest A2A Net provider's CopilotKit properties and credential status. */
export function useA2ANet(): A2ANetContextValue {
    const context = useContext(A2ANetContext);
    if (!context) throw new Error("useA2ANet must be used within an A2ANetProvider");
    return context;
}
