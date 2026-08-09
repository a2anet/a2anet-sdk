.PHONY: install build lint typecheck test fix ci install-hooks

install:
	bun install

build:
	bun run build

lint:
	bun run check

typecheck:
	bun run typecheck

test:
	bun run test:coverage

fix:
	bun run check:fix

ci: lint typecheck test build

install-hooks:
	./scripts/install-git-hooks.sh
