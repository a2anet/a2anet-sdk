// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from "react";

import { useA2ANet } from "./provider.js";

/** Where a scheduled chat's reply is sent, besides its own thread. */
export type A2ANetScheduleDelivery =
    | { platform: "email" }
    | { platform: "slack"; channel?: { id: string; name: string } };

/** A message A2A Net sends the agent on the user's behalf, on a cron schedule. */
export interface A2ANetSchedule {
    id: string;
    message: string;
    cron: string;
    timeZone: string;
    enabled: boolean;
    sendResponseTo: A2ANetScheduleDelivery | null;
    nextRunAt: string | null;
    lastRunAt: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
}

/** What creating a schedule sets. The time zone defaults to the user's profile, then UTC. */
export interface A2ANetScheduleInput {
    message: string;
    cron: string;
    timeZone?: string;
    enabled?: boolean;
    /** A Slack channel is named by id or name; leaving it out sends a direct message. */
    sendResponseTo?:
        | { platform: "email" }
        | { platform: "slack"; channel?: { id?: string; name?: string } }
        | null;
}

/** Schedule state and operations returned by {@link useA2ANetSchedules}. */
export interface UseA2ANetSchedulesResult {
    schedules: A2ANetSchedule[];
    isLoading: boolean;
    error: Error | null;
    refetchSchedules: () => Promise<void>;
    createSchedule: (input: A2ANetScheduleInput) => Promise<A2ANetSchedule>;
    /** Also pauses or resumes one, through `enabled`. */
    updateSchedule: (id: string, changes: Partial<A2ANetScheduleInput>) => Promise<A2ANetSchedule>;
    deleteSchedule: (id: string) => Promise<void>;
}

/**
 * List and manage the user's scheduled chats with the agent.
 *
 * The customer token names the user and the agent, so A2A Net confines every request to
 * their own schedules. A run a schedule starts appears in `useA2ANetThreads` with the type
 * `"scheduled"`.
 */
export function useA2ANetSchedules(): UseA2ANetSchedulesResult {
    const { apiUrl, authenticatedFetch } = useA2ANet();
    const [schedules, setSchedules] = useState<A2ANetSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const request = useCallback(
        async <T>(path: string, method: string, body?: unknown): Promise<T> => {
            const response = await authenticatedFetch(`${apiUrl}/customer-schedules${path}`, {
                method,
                headers: { "Content-Type": "application/json" },
                body: body === undefined ? undefined : JSON.stringify(body),
            });
            if (!response.ok) {
                // A2A Net explains a refused schedule, such as a cron it cannot honour.
                const failure = (await response.json().catch(() => null)) as {
                    error?: { message?: string };
                } | null;
                throw new Error(
                    failure?.error?.message ?? `A2A Net request failed with ${response.status}`,
                );
            }
            return (response.status === 204 ? undefined : await response.json()) as T;
        },
        [apiUrl, authenticatedFetch],
    );

    const refetchSchedules = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        try {
            const listed = await request<{ schedules: A2ANetSchedule[] }>("", "GET");
            setSchedules(listed.schedules);
            setError(null);
        } catch (value) {
            setError(value instanceof Error ? value : new Error(String(value)));
        } finally {
            setIsLoading(false);
        }
    }, [request]);

    useEffect(() => {
        void refetchSchedules();
    }, [refetchSchedules]);

    const createSchedule = useCallback(
        async (input: A2ANetScheduleInput): Promise<A2ANetSchedule> => {
            const created = await request<A2ANetSchedule>("", "POST", input);
            setSchedules((previous) => [...previous, created]);
            return created;
        },
        [request],
    );

    const updateSchedule = useCallback(
        async (id: string, changes: Partial<A2ANetScheduleInput>): Promise<A2ANetSchedule> => {
            const updated = await request<A2ANetSchedule>(
                `/${encodeURIComponent(id)}`,
                "PATCH",
                changes,
            );
            setSchedules((previous) =>
                previous.map((schedule) => (schedule.id === id ? updated : schedule)),
            );
            return updated;
        },
        [request],
    );

    const deleteSchedule = useCallback(
        async (id: string): Promise<void> => {
            await request<void>(`/${encodeURIComponent(id)}`, "DELETE");
            setSchedules((previous) => previous.filter((schedule) => schedule.id !== id));
        },
        [request],
    );

    return {
        schedules,
        isLoading,
        error,
        refetchSchedules,
        createSchedule,
        updateSchedule,
        deleteSchedule,
    };
}
