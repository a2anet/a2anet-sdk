# `@a2anet/react`

React SDK for [A2A Net](https://a2anet.com). It connects your app to an agent and gives
[CopilotKit](https://www.copilotkit.ai/) everything it needs to render the conversation.

## Install

```bash
npm install @a2anet/react @ag-ui/client @copilotkit/react-core
```

## Credentials

The browser talks to the agent directly, using a short-lived credential your backend mints
with your A2A Net API key. Add an endpoint that authenticates the user, mints a customer
token, and returns it along with the agent it is for:

```ts
{
    token: string;
    expiresAt: string;
    agentId: string;
}
```

The token is minted for one agent, so the server that mints it is the one place that names
it. The runtime the browser talks to is `https://agent.a2anet.com`, exported as
`A2ANET_RUNTIME_URL`; pass `runtimeUrl` to the provider to point at a runtime of your own
during local development.

`A2ANetProvider` calls `getCredentials` on mount and again before `expiresAt`. Send whatever
your backend needs to authenticate the user, the same as any other request to it:

```tsx
import { useCallback } from "react";
import { A2ANetProvider, type A2ANetCredentials } from "@a2anet/react";

export function Root() {
    const getCredentials = useCallback(async (): Promise<A2ANetCredentials> => {
        const response = await fetch("/api/token", {
            method: "POST",
            headers: { Authorization: `Bearer ${await getAccessToken()}` },
        });
        if (!response.ok) throw new Error(`Credential request failed with ${response.status}`);
        return response.json();
    }, []);

    return (
        <A2ANetProvider getCredentials={getCredentials}>
            <App />
        </A2ANetProvider>
    );
}
```

Mount the provider above anything that can unmount, such as a drawer. It holds the agent,
which owns the conversation.

A working endpoint and provider, ready to copy, are in
[`examples/website-app`](../../examples/website-app).

## Rendering the chat

`useA2ANet` returns the properties CopilotKit needs, plus the credential's status. The SDK
does not mount CopilotKit, so the loading and error UI stay yours:

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

## Credentials

A minted token is short-lived. Every agent request mints a replacement first when the one
it holds is spent, so a token is renewed by whatever the user does next; a scheduled
refresh runs as well, but nothing depends on it firing. `status` turns to `Error` only
once no usable token is left, so one failed refresh does not tear down a working
conversation.

Requests the SDK does not issue are not gated — CopilotKit's thread endpoints build their
own `fetch`. Await `ensureCredentials` before those:

```tsx
const { ensureCredentials } = useA2ANet();
const { refetchThreads } = useThreads({ agentId });

const showThreads = async () => {
    await ensureCredentials();
    refetchThreads();
};
```

## Artifacts

Files the agent produces arrive as events rather than messages, so render them yourself.
`useA2ANetArtifacts` collects them, keyed by the message each one followed, and
`downloadArtifact` saves one. Render this inside `CopilotKitProvider`:

```tsx
import { useMemo } from "react";
import { downloadArtifact, useA2ANetArtifacts } from "@a2anet/react";
import {
    CopilotChat,
    CopilotChatAssistantMessage,
    useAgent,
    type CopilotChatAssistantMessageProps,
} from "@copilotkit/react-core/v2";

function Chat({ agentId, threadId }: { agentId: string; threadId: string }) {
    const { agent } = useAgent({ agentId, updates: [] });
    const artifacts = useA2ANetArtifacts(agent, threadId);

    // Object.assign carries over the slot's static members, which its type requires.
    const assistantMessage = useMemo(
        () =>
            Object.assign(
                (props: CopilotChatAssistantMessageProps) => (
                    <>
                        <CopilotChatAssistantMessage {...props} />
                        {(artifacts.get(props.message.id) ?? []).map((file) => (
                            <button
                                key={file.id}
                                type="button"
                                onClick={() => downloadArtifact(file)}
                            >
                                {file.filename}
                            </button>
                        ))}
                    </>
                ),
                CopilotChatAssistantMessage,
            ),
        [artifacts],
    );

    return <CopilotChat agentId={agentId} threadId={threadId} messageView={{ assistantMessage }} />;
}
```

## Context

Pass `getContext` to tell the agent what the user is looking at. It is read on every run, so
it can return whatever the current page holds:

```tsx
<A2ANetProvider getCredentials={getCredentials} getContext={() => ({ "venue-name": venue })}>
```

Context values are prepended to the user's message. The agent sees them and they stay in its
session, but they are not saved to the AG-UI transcript that the user sees.
