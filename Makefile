.DEFAULT_GOAL := help
.PHONY: help install dev-web dev-www dev-desktop reset-desktop build build-desktop dist-mac dist-win dist-linux test typecheck lint format check clean

help: ## List available targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install all workspace dependencies
	bun install

dev-web: ## Run the web app (Next dev server, :3000)
	bun run dev:web

dev-www: ## Run the landing page (Next dev server, :3001)
	bun run dev:www

dev-desktop: ## Run Electron against the web dev server (start dev-web first)
	bun run dev:desktop

reset-desktop: ## Delete the dev database to redo the onboarding (close the app first)
	bun run reset:desktop

build: ## Build every app
	bun run build

build-desktop: ## Export the web app and compile the desktop app
	bun run build:desktop

dist-mac: build-desktop ## Package the desktop app for macOS
	bun run --filter @tempi/desktop dist:mac

dist-win: build-desktop ## Package the desktop app for Windows
	bun run --filter @tempi/desktop dist:win

dist-linux: build-desktop ## Package the desktop app for Linux
	bun run --filter @tempi/desktop dist:linux

test: ## Run all tests (bun test)
	bun run test

typecheck: ## Type-check every app
	bun run typecheck

lint: ## Lint and check formatting (no writes)
	bun run lint

format: ## Format all files
	bun run format

check: ## Lint, format and organize imports (writes fixes)
	bun run check

clean: ## Remove build outputs and caches
	rm -rf apps/*/dist apps/*/out apps/*/.next apps/*/release apps/*/*.tsbuildinfo
