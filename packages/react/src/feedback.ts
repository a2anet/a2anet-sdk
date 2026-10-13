// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import { useCopilotKit } from "@copilotkit/react-core/v2";
import { useCallback } from "react";

import { useA2ANet } from "./provider.js";

/** A thumbs up (1) or down (0), and optionally what the user said about it. */
export interface A2ANetFeedback {
    value: 0 | 1;
    rationale?: string | null;
}

/** Records feedback on the turn one message belongs to. */
export type A2ANetRateMessage = (messageId: string, feedback: A2ANetFeedback) => Promise<void>;

/**
 * Rate the agent's replies, for its owner to read alongside the conversation.
 *
 * A2A Net records feedback per turn rather than per message, so every message in one turn
 * shares a rating, and rating any of them again replaces it. Wire it to `CopilotChat`'s
 * thumbs, and call it again with the same value to add text the user writes afterwards.
 */
export function useA2ANetFeedback(agentId: string, threadId: string): A2ANetRateMessage {
    const { authenticatedFetch } = useA2ANet();
    const { copilotkit } = useCopilotKit();

    return useCallback<A2ANetRateMessage>(
        async (messageId, { value, rationale = null }) => {
            const { runtimeUrl } = copilotkit;
            if (!runtimeUrl) throw new Error("Runtime URL is not configured");
            const runId = copilotkit.getRunIdForMessage(agentId, threadId, messageId);
            if (!runId) throw new Error(`Message ${messageId} belongs to no known run`);

            const response = await authenticatedFetch(
                `${runtimeUrl.replace(/\/+$/, "")}/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/feedback`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ value, rationale }),
                },
            );
            if (!response.ok) {
                throw new Error(`A2A Net feedback request failed with ${response.status}`);
            }
        },
        [agentId, authenticatedFetch, copilotkit, threadId],
    );
}
