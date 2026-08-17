// SPDX-FileCopyrightText: 2026-present A2A Net <hello@a2anet.com>
//
// SPDX-License-Identifier: Apache-2.0

import { CopilotKitProvider, type CopilotKitProviderProps } from "@copilotkit/react-core/v2";
import type { ReactNode } from "react";

import { A2ANetProvider, useA2ANet } from "../src/index.js";

function CopilotBridge(): ReactNode {
    const { copilotKitProps } = useA2ANet();
    const standardProps: Omit<CopilotKitProviderProps, "children"> = copilotKitProps;
    return <CopilotKitProvider {...standardProps}>chat</CopilotKitProvider>;
}

export const typeCompatibility = (
    <A2ANetProvider
        getCredentials={() =>
            Promise.resolve({
                token: "token",
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                agentId: "agent",
            })
        }
    >
        <CopilotBridge />
    </A2ANetProvider>
);
