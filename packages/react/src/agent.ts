// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import {
    type BaseEvent,
    EventType,
    HttpAgent,
    type HttpAgentConfig,
    type RunAgentInput,
    type RunStartedEvent,
    runHttpRequest,
    transformHttpEventStream,
} from "@ag-ui/client";
import { filter, finalize, tap } from "rxjs";

interface ActiveRun {
    threadId: string;
    runId: string;
}

interface ActiveStream {
    threadId: string;
    runId?: string;
}

/** Configuration for an A2A Net AG-UI endpoint. */
export type A2ANetAgentConfig = Omit<HttpAgentConfig, "fetch">;

function trailingUserTurn(input: RunAgentInput): RunAgentInput {
    const message = input.messages.findLast(({ role }) => role === "user");
    return { ...input, messages: message ? [message] : [] };
}

function hasIdentity(event: BaseEvent): event is BaseEvent & { threadId: string; runId: string } {
    const candidate = event as BaseEvent & { threadId?: unknown; runId?: unknown };
    return typeof candidate.threadId === "string" && typeof candidate.runId === "string";
}

/**
 * Direct AG-UI client for A2A Net's durable run endpoints.
 *
 * The agent retains the complete local transcript while sending only the latest
 * user turn to the runtime, whose durable thread owns the prior history.
 */
export class A2ANetAgent extends HttpAgent {
    private activeRun?: ActiveRun;
    private activeStream?: ActiveStream;

    /** Create an agent without exposing a package-specific fetch configuration API. */
    // biome-ignore lint/complexity/noUselessConstructor: Narrows HttpAgentConfig to A2ANetAgentConfig.
    constructor(config: A2ANetAgentConfig) {
        super(config);
    }

    /** Whether the agent knows a durable run that can currently be cancelled. */
    get hasCancelableRun(): boolean {
        return this.activeRun !== undefined;
    }

    /** Run the latest user turn while retaining the full transcript locally. */
    override run(input: RunAgentInput): ReturnType<HttpAgent["run"]> {
        const stream: ActiveStream = { threadId: input.threadId, runId: input.runId };
        const activeRun = { threadId: input.threadId, runId: input.runId };
        this.threadId = input.threadId;
        this.activeStream = stream;
        this.activeRun = activeRun;

        return super.run(trailingUserTurn(input)).pipe(
            filter((event) => this.acceptsEvent(stream, event)),
            tap((event) => this.trackRunEvent(event)),
            finalize(() => {
                if (this.activeStream === stream) this.activeStream = undefined;
                if (this.activeRun === activeRun) this.activeRun = undefined;
            }),
        );
    }

    /** Cancel the active producer through A2A Net's durable cancel endpoint. */
    async cancelRun(): Promise<void> {
        const activeRun = this.activeRun;
        if (!activeRun) return;

        const response = await this.fetch(`${this.url}/cancel`, {
            method: "POST",
            headers: {
                ...this.headers,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(activeRun),
            keepalive: true,
        });
        if (response.ok) return;
        if (response.status === 404) {
            try {
                const body = (await response.json()) as { detail?: unknown };
                if (body.detail === "Thread not found") return;
            } catch {
                // A router 404 without the endpoint's marker remains a failed stop.
            }
        }
        throw new Error(`Stop request failed with ${response.status}`);
    }

    /** Start durable cancellation before disconnecting the local stream. */
    override abortRun(): void {
        void this.cancelRun().catch((error: unknown) => {
            console.error("Failed to cancel the A2A Net run:", error);
        });
        this.activeRun = undefined;
        this.activeStream = undefined;
        super.abortRun();
    }

    /** Reconnect to a durable thread and replay its event history. */
    protected override connect(input: RunAgentInput): ReturnType<HttpAgent["run"]> {
        const stream: ActiveStream = { threadId: input.threadId };
        this.threadId = input.threadId;
        this.activeStream = stream;
        this.abortController = new globalThis.AbortController();

        return transformHttpEventStream(
            runHttpRequest(() => this.fetch(`${this.url}/connect`, this.requestInit(input))),
            this.debugLogger,
        ).pipe(
            filter((event) => this.acceptsEvent(stream, event)),
            tap((event) => this.trackRunEvent(event)),
            finalize(() => {
                if (this.activeStream !== stream) return;
                this.activeStream = undefined;
                if (this.activeRun?.threadId === stream.threadId) this.activeRun = undefined;
            }),
        );
    }

    private acceptsEvent(stream: ActiveStream, event: BaseEvent): boolean {
        if (this.activeStream !== stream || this.threadId !== stream.threadId) return false;
        if (!hasIdentity(event)) return true;
        if (event.threadId !== stream.threadId) return false;
        return stream.runId === undefined || event.runId === stream.runId;
    }

    private trackRunEvent(event: BaseEvent): void {
        if (event.type === EventType.RUN_STARTED) {
            const { threadId, runId } = event as RunStartedEvent;
            this.activeRun = { threadId, runId };
            return;
        }
        if (
            (event.type === EventType.RUN_FINISHED || event.type === EventType.RUN_ERROR) &&
            hasIdentity(event) &&
            this.activeRun?.threadId === event.threadId &&
            this.activeRun.runId === event.runId
        ) {
            this.activeRun = undefined;
        }
    }
}
