# `@a2anet/react`

React SDK for [A2A Net](https://a2anet.com).

## Quick start

```bash
npm install @a2anet/react @ag-ui/client @copilotkit/react-core react react-dom
```

Credentials must be minted by your application's backend. Pass a stable callback that returns:

```ts
{
    token: string;
    expiresAt: string;
    agentId: string;
    runtimeUrl: string;
}
```

Mount the A2A Net provider around your application:

```tsx
import { A2ANetProvider, type A2ANetCredentials } from "@a2anet/react";

async function getCredentials(): Promise<A2ANetCredentials> {
    const response = await fetch("/api/a2anet/credentials", { method: "POST" });
    if (!response.ok) throw new Error(`Credential request failed with ${response.status}`);
    return response.json();
}

export function Root() {
    return (
        <A2ANetProvider getCredentials={getCredentials}>
            <App />
        </A2ANetProvider>
    );
}
```

Inside the provider, spread the returned properties onto CopilotKit. A2A Net does not mount
CopilotKit or choose loading and error UI for the application:

```tsx
import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
import { A2ANetStatus, useA2ANet } from "@a2anet/react";

export function App() {
    const { copilotKitProps, status, error, retry } = useA2ANet();

    if (status === A2ANetStatus.Loading) return <p>Connecting…</p>;
    if (status === A2ANetStatus.Error) {
        return <button onClick={retry}>{error?.message ?? "Try again"}</button>;
    }

    return (
        <CopilotKitProvider {...copilotKitProps}>
            <CopilotChat agentId={copilotKitProps.agent} />
        </CopilotKitProvider>
    );
}
```

`A2ANetProvider` refreshes the credential before `expiresAt` and updates CopilotKit without
replacing the agent or its local transcript. The SDK deliberately contains no server-side token
minting implementation; keep the authority used to mint credentials on your backend.

The package root also exports `A2ANetAgent`, `AG_UI_ARTIFACT_EVENT_NAME`,
`ReceivedArtifactFile`, and `readArtifactEvent` for lower-level integrations and artifact handling.
