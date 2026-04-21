# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Solidflow** is an Nx monorepo providing a GUI for designing finite state machines (FSMs) that compile to Solidity smart contracts. Users visually design state flows and generate production-grade Solidity with security patterns.

## Commands

All commands are run from the `solidflow/` directory.

**Start dev servers:**
```bash
nx serve frontend    # Angular on http://localhost:4200
nx serve backend     # NestJS on http://localhost:3000/api
```

**Build:**
```bash
nx build frontend
nx build backend
nx run backend:prune   # Trim production dependencies
```

**Test:**
```bash
nx test frontend                  # Jest unit tests
nx test backend                   # Jest unit tests
nx run frontend-e2e:e2e           # Cypress E2E
nx run backend-e2e:e2e            # Jest E2E
```

**Run a single test file:**
```bash
nx test backend --testFile=src/app/fsm/solidity/solidity-gen.service.spec.ts
```

**Lint:**
```bash
nx lint frontend
nx lint backend
nx lint shared
```

**Visualize project graph:**
```bash
npx nx graph
```

## Architecture

The workspace has three Nx projects under `solidflow/`:

### `shared/` — TypeScript library (`@solidflow/shared`)
The source of truth for all types. Key files:
- `src/lib/fsm.types.ts` — Core interfaces (`FsmDefinition`, `FsmTransition`, `FsmGuard`, `FsmStatement`, `FsmContractVariable`, `FsmPlugins`, etc.)
- `src/lib/fsm.schema.ts` — AJV JSON schema used by the backend guard for runtime validation

### `backend/` — NestJS API
- `src/app/fsm/fsm.service.ts` — File-based CRUD; FSM definitions are stored as `data/fsm/{uuid}.json`
- `src/app/fsm/fsm.controller.ts` — REST endpoints: `GET/POST/PUT/DELETE /api/fsm`, `GET /api/fsm/:id/compile`
- `src/app/fsm/guards/fsm-schema.guard.ts` — AJV validation of incoming FSM payloads
- `src/app/fsm/solidity/solidity-gen.service.ts` — Converts `FsmDefinition` → Solidity source code
- `src/app/fsm/solidity/solidity-compile.service.ts` — Wraps `solc` to compile source; returns ABI + bytecode

**Solidity generation order:** custom struct types → contract header → State enum → state variable → plugin modifiers → constructor → plugin tracking variables → event declaration → contract variables → one function per transition (state check → guards → statements → event emit → state update).

### `frontend/` — Angular 21 application
- `src/app/core/services/fsm-api.service.ts` — HTTP client for all backend calls
- `src/app/pages/fsm-list/` — Dashboard (list, create, delete FSMs)
- `src/app/pages/fsm-editor/` — Main editor with:
  - `canvas/` — AntV X6 graph for visual FSM design
  - `panels/states-panel/` — Manage states
  - `panels/transitions-panel/` — Manage transitions (with guards and statements)
  - `panels/variables-panel/` — Contract state variables
  - `panels/plugins-panel/` — Toggle security plugins (locking, access control, reentrancy, events, counters)
  - `panels/solidity-preview/` — Live Solidity code preview + compile trigger

State management uses Angular signals. Auto-save triggers via RxJS debounce (3 s) after any change to the FSM definition.

## Key Concepts

**`FsmDefinition`** is the central data model shared between frontend and backend. Every editor panel reads from and patches into this single reactive definition object.

**Guards** constrain transitions: `accessControl`, `inputValidation`, `statePrecondition`, `pausable`, `postcondition`, `eventEmission`, `returnValue`, `reentrancy`, and temporal variants (`deadline`, `timelock`, `cooldown`, `timeWindow`) and oracle variants (`sourceWhitelist`, `dataFreshness`, `sanityBounds`).

**Statements** are the body of a transition function — either raw Solidity strings or guided structured types (`forLoop`, `ifStatement`).

**Plugins** generate cross-cutting contract code: `locking` (mutex), `accessControl` (owner), `transitionCounter`, `events`.

## Environment

Backend reads from environment variables (can use `.env` in `solidflow/`):
- `PORT` — default `3000`
- `CORS_ORIGIN` — default `http://localhost:4200`
- `FSM_DATA_DIR` — default `data/fsm`

Frontend dev server proxies `/api/*` to `localhost:3000` via `proxy.conf.mjs`.
