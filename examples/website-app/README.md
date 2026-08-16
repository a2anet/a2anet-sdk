# Website/App example

Publishing an A2A Net agent inside your own product: one backend endpoint, and one
React provider.

## The contract

The browser talks to the agent directly, so it needs a credential of its own. Your
backend mints one with your A2A Net API key, which never leaves the server:

```ts
{
    token: string;
    expiresAt: string;
    agentId: string;
    runtimeUrl: string;
}
```

`A2ANetProvider` calls `getCredentials` on mount and again before `expiresAt`, so a
conversation outlives any single token.

## Files

| File                        | What it is                                                   |
| --------------------------- | ------------------------------------------------------------ |
| `server/agent-token.ts`     | `POST /agent/token`. Authenticates the user, mints the token |
| `src/AssistantProvider.tsx` | `A2ANetProvider` + `useA2ANet` + CopilotKit                  |

## Environment

Server side only — none of these belong in the browser bundle:

| Variable             | What it is                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| `A2ANET_API_KEY`     | A standard user API key, minted at <https://app.a2anet.com/api-keys>     |
| `A2ANET_API_URL`     | `https://app.a2anet.com/api/v1`                                          |
| `A2ANET_AGENT_ID`    | The agent, from its Publish page                                         |
| `A2ANET_RUNTIME_URL` | The Runtime URL, from the same page. The SDK appends `/{agentId}/ag-ui`  |

## Running it

This is source to copy, not an app to boot — a website or app already has its own
server, router and build. Take the two files, mount the endpoint where your other
routes live, and wrap your UI in `AssistantProvider`.

```bash
bun install
bun run typecheck
```

## Customer values

An agent that acts on your customer's behalf needs their access, not yours. Pass it
per customer when you mint the token:

```ts
await mintAgentToken(user.id, {
    variables: { yourServerUrl: "https://api.example.com" },
    secrets: { yourToken: user.token },
});
```

Variables reach the agent's session; secrets never do. Both are resolved by the
agent's tools by name, as `{yourServerUrl}` and `{yourToken}`.
