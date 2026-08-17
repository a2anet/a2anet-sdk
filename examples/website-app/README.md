# Website/App Example

Publishing an A2A Net agent inside your own product: one backend endpoint, one
React provider, and a runnable app around them.

## The contract

For performance reasons, the chat sidebar connects to A2A Net from the browser
without going through a server-side endpoint or proxy. For browsers to
authenticate with A2A Net, they use a short-lived JWT token.

Your backend mints one with your A2A Net API key, which never leaves the server:

```ts
{
    token: string;
    expiresAt: string;
    agentId: string;
}
```

`A2ANetProvider` calls `getCredentials` on mount and again before `expiresAt`.

## Files

| File                        | What it is                                                    |
| --------------------------- | ------------------------------------------------------------- |
| `server/agent-token.ts`     | `POST /agent/token`. Authenticates the user, mints the token  |
| `src/AssistantProvider.tsx` | `A2ANetProvider` + `useA2ANet` + CopilotKit                   |
| `src/App.tsx`               | The page, with a full chat and a collapsible sidebar          |
| `vite.config.ts`            | Mounts the endpoint on the dev server, so there is one process |

## Environment

Server side only — neither belongs in the browser bundle:

| Variable          | What it is                                                          |
| ----------------- | ------------------------------------------------------------------- |
| `A2ANET_API_KEY`  | A standard user API key, minted at <https://app.a2anet.com/api-keys> |
| `A2ANET_AGENT_ID` | The agent, from its Publish page                                     |

## Running it

```bash
bun install
cp .env.example .env   # then fill both values in
bun run dev
```

The page opens with the agent in the middle and the same conversation in a
sidebar you can hide. Send a message and it appears under Sessions on
<https://app.a2anet.com>.

To put this in your own app, mount `handleAgentTokenRequest` at
`https://app.example.com/agent/token` wherever your other routes live, and wrap
your UI in `AssistantProvider`.

## Customer values

If you've used dynamic variables and secrets (e.g. `{customerName}`,
`{customerToken}`) in your agent's instructions or tools, you need to set them for
each customer. Pass them when you mint the token:

```ts
await mintAgentToken(user.id, {
    variables: { yourServerUrl: "https://api.example.com" },
    secrets: { yourToken: user.token },
});
```

Both are resolved by the agent's tools by name, as `{yourServerUrl}` and
`{yourToken}`.
