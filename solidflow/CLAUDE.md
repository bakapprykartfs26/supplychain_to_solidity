# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Solidflow** is an Nx monorepo for converting supply chain models into Solidity smart contracts. Users design finite state machines (FSMs) visually, which are translated to Solidity contract code. Key domain dependencies: `@antv/x6` for graph visualization, `solc` for Solidity compilation, `class-validator`/`class-transformer` for DTO validation, and `ajv` for JSON schema validation.

## Commands

All tasks run via Nx: `npx nx <target> <project>`

### Development
```bash
npx nx serve frontend     # Angular dev server (port 4200)
npx nx serve backend      # NestJS dev server (port 3000, API prefix /api)
```

### Build
```bash
npx nx build frontend     # Angular SSR build → dist/frontend
npx nx build backend      # Webpack/Node build → dist/backend
npx nx build shared       # ESBuild CJS build → dist/shared
```

### Test
```bash
npx nx test frontend      # Jest (jsdom environment)
npx nx test backend       # Jest (node environment)
npx nx test shared        # Jest (node environment)
npx nx test frontend --testFile=path/to/file.spec.ts  # Single file
```

### Lint & E2E
```bash
npx nx lint frontend
npx nx lint backend
npx nx e2e frontend-e2e
npx nx e2e backend-e2e
```

## Architecture

```
frontend (Angular 21 + SSR)
    ↓ HTTP → /api/*
backend (NestJS, port 3000)
    ↑ ↗ @solidflow/shared
shared (buildable library)
```

### Data Flow

1. User designs an FSM in the editor (canvas + tabbed panels)
2. Changes are debounced (3s) and auto-saved to backend
3. Frontend/backend validate via class-validator DTOs and AJV schema guard
4. Backend persists FSMs as JSON files in `data/fsm/{uuid}.json`
5. On demand: backend generates Solidity source → compiles via `solc` → returns ABI + bytecode
6. Frontend shows live Solidity preview via `SolidityPreviewComponent`

### API Endpoints

```
GET    /api/fsm              → FsmDefinition[]
GET    /api/fsm/:id          → FsmDefinition
POST   /api/fsm              → FsmDefinition  (schema-validated)
PUT    /api/fsm/:id          → FsmDefinition  (schema-validated)
DELETE /api/fsm/:id          → void
GET    /api/fsm/:id/compile  → { success, abi?, bytecode?, errors? }
POST   /api/fsm/compile      → Same, with { source: string } body
```

### Frontend (`frontend/src/app/`)

- **Standalone Angular components** (no NgModules); signals for reactive state
- **SSR**: dual entry points `main.ts` (client) and `main.server.ts` (server); X6 canvas guarded with `isPlatformBrowser` to avoid SSR crashes
- **FsmEditorComponent** is the main page: manages definition signal, auto-save debouncing, resizable right panel (persisted in localStorage), tab group (States | Transitions | Variables | Plugins), and Solidity preview drawer
- **FsmCanvasComponent** wraps `@antv/x6`; `x6-adapter.ts` converts between `FsmDefinition` and X6 graph model (double-click to add state, drag between states to create transition)
- Panel components (States, Transitions, Variables, Plugins) emit partial definition changes upward
- **FsmApiService** (`core/services/`) is the sole HTTP client; all calls go through it

### Backend (`backend/src/app/`)

- Standard NestJS module/controller/service pattern
- **FsmService**: file-based persistence (no database) — reads/writes JSON files in `data/fsm/`
- **FsmSchemaGuard**: AJV validation against `FSM_JSON_SCHEMA` from shared; applied to POST/PUT, returns 400 with details on failure
- **SolidityGenService**: translates `FsmDefinition` into Solidity source — generates State enum, currentState variable, transition functions with guards/statements, and plugin features (locking, access control, events, timers, counters)
- **SolidityCompileService**: wraps `solc` to produce ABI + bytecode
- Global `ValidationPipe` (whitelist + transform) and CORS (default origin: `http://localhost:4200`)

### Shared Library (`shared/src/`)

- Imported as `@solidflow/shared` (path alias in `tsconfig.base.json`)
- Builds to CJS (`dist/shared/index.cjs`) with auto-generated types
- Exports:
  - `FsmDefinition`, `FsmTransition`, `FsmContractVariable`, `FsmCustomType`, `FsmPlugins` — TypeScript interfaces used by both frontend and backend
  - `FSM_JSON_SCHEMA` — AJV schema for runtime validation in the backend guard

## Module Boundaries

ESLint enforces `@nx/enforce-module-boundaries`. Allowed imports: frontend ← shared, backend ← shared. Frontend and backend are isolated from each other except via HTTP.

## Key Patterns

- **Validation is dual-layered**: class-validator DTOs handle NestJS pipe validation; `FsmSchemaGuard` + AJV independently validates the JSON body shape against the shared schema
- **No database**: persistence is pure file I/O (`data/fsm/*.json`); `FsmService` uses async `fs/promises`
- **Solidity generation lives entirely in the backend** (`solidity/` subfolder in `fsm/`); the frontend only displays the result
- **X6 adapter** (`x6-adapter.ts`) is the critical translation layer between the domain model and the visual graph — changes to `FsmDefinition` shape require updating this adapter
