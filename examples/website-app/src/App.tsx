// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

/**
 * The page, standing in for your product.
 *
 * Two `CopilotChat`s — the page's own and a sidebar that opens and closes — sit
 * inside one `AssistantProvider`, so they are two views of the same conversation
 * rather than two conversations.
 */

import { A2ANetStatus, useA2ANet } from "@a2anet/react";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { type ReactElement, useState } from "react";

import { AssistantProvider } from "./AssistantProvider.js";

function Page(): ReactElement {
    const { copilotKitProps, status, error, retry } = useA2ANet();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    if (status === A2ANetStatus.Loading) return <p className="notice">Connecting…</p>;
    if (status === A2ANetStatus.Error) {
        return (
            <p className="notice">
                {error?.message ?? "Could not reach A2A Net"}{" "}
                <button type="button" onClick={retry}>
                    Try again
                </button>
            </p>
        );
    }

    return (
        <div className="layout">
            <main className="page">
                <header>
                    <h1>Your product</h1>
                    <button type="button" onClick={() => setSidebarOpen((open) => !open)}>
                        {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                    </button>
                </header>
                <CopilotChat agentId={copilotKitProps.agent} />
            </main>

            {sidebarOpen && (
                <aside className="sidebar">
                    <CopilotChat agentId={copilotKitProps.agent} />
                </aside>
            )}
        </div>
    );
}

export function App(): ReactElement {
    return (
        <AssistantProvider>
            <Page />
        </AssistantProvider>
    );
}
