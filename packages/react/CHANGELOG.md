# Changelog

## [0.2.0](https://github.com/a2anet/a2anet-sdk/compare/react-v0.1.0...react-v0.2.0) (2026-08-20)


### ⚠ BREAKING CHANGES

* rename ensureCredentials and drop the refresh timer
* `A2ANetCredentials` no longer carries `runtimeUrl`. Return `{ token, expiresAt, agentId }` from your token endpoint; pass `runtimeUrl` to `A2ANetProvider` if you need to point at a runtime of your own.

### Features

* add a website/app example for @a2anet/react ([cb30d4a](https://github.com/a2anet/a2anet-sdk/commit/cb30d4accc9a6e63a7e8a16593556477cbb584f2))
* drop runtimeUrl from the credential the browser is handed ([a9888b6](https://github.com/a2anet/a2anet-sdk/commit/a9888b6c49e425e328b6dbd7f4c400211f69db84))
* mount the website/app token endpoint at /api/token ([0fa38ff](https://github.com/a2anet/a2anet-sdk/commit/0fa38fff26a11c839544c045a4135f9dba61288b))
* rename ensureCredentials and drop the refresh timer ([ed65230](https://github.com/a2anet/a2anet-sdk/commit/ed65230c0df9095d83957a9033e33a1cee650600))


### Bug Fixes

* keep the ensureCredentials identity stable ([c7358c3](https://github.com/a2anet/a2anet-sdk/commit/c7358c3e931792d06e18fe44937d72e6ed6daa24))
* mint credentials on demand instead of on a timer alone ([2b61b4a](https://github.com/a2anet/a2anet-sdk/commit/2b61b4a112ff343e978043cea8d347db91e9d101))

## 0.1.0 (2026-08-11)


### Features

* **react:** add A2A Net integration SDK ([#2](https://github.com/a2anet/a2anet-sdk/issues/2)) ([f778cf3](https://github.com/a2anet/a2anet-sdk/commit/f778cf3059f12228d7d485f39efd85de48584173))
* set up React SDK workspace ([f5039ff](https://github.com/a2anet/a2anet-sdk/commit/f5039ff86629696d1cae19b0e1d923dc48af9aa4))


### Bug Fixes

* configure initial React release ([85398fc](https://github.com/a2anet/a2anet-sdk/commit/85398fcd5c011623e7b4c71281fe99a27f2ea663))
