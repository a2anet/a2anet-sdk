import { A2ANetProvider, A2ANetStatus, useA2ANet } from "@a2anet/react";
import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function Chat() {
    const { copilotKitProps, status } = useA2ANet();
    if (status !== A2ANetStatus.Ready) return <span>{status}</span>;

    return (
        <CopilotKitProvider {...copilotKitProps}>
            <CopilotChat agentId={copilotKitProps.agent} />
        </CopilotKitProvider>
    );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");

createRoot(root).render(
    <StrictMode>
        <A2ANetProvider
            getCredentials={() =>
                Promise.resolve({
                    token: "browser-token",
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    agentId: "agent-1",
                    runtimeUrl: "https://runtime.example",
                })
            }
        >
            <Chat />
        </A2ANetProvider>
    </StrictMode>,
);
