# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Solidflow** is an Nx monorepo for converting supply chain models into Solidity smart contracts. It has an Angular 21 frontend (with SSR), a NestJS backend, and a shared library. Key domain dependencies: `@antv/x6` for flow/graph visualization, `solc` for Solidity compilation, `class-validator`/`class-transformer` for DTO validation, and `ajv` for JSON schema validation.

## Commands

All tasks run via Nx: `npx nx <target> <project>`

### Development
```bash
npx nx serve frontend     # Angular dev server
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

### Utilities
```bash
npx nx graph              # Visualize project dependency graph
```

## Architecture

```
frontend (Angular 21 + SSR)
    ↓ HTTP → /api/*
backend (NestJS, port 3000)
    ↑ ↗ @solidflow/shared
shared (buildable library)
```

### Frontend (`frontend/src/app/`)
- Standalone Angular components (no NgModules)
- SSR with dual entry points: `main.ts` (client), `main.server.ts` (server)
- Routes defined in `app.routes.ts` (client) and `app.routes.server.ts` (server)
- Styles: SCSS

### Backend (`backend/src/app/`)
- Standard NestJS module/controller/service pattern
- Global API prefix: `/api`
- Webpack build targeting Node/CommonJS

### Shared Library (`shared/src/`)
- Imported as `@solidflow/shared` (path alias in `tsconfig.base.json`)
- Builds to CJS (`dist/shared/index.cjs`) with auto-generated types
- For DTOs, types, and utilities shared between frontend and backend

## Module Boundaries

ESLint enforces `@nx/enforce-module-boundaries`. Do not import across project boundaries in ways that violate the dependency graph (frontend ← shared, backend ← shared; frontend and backend are isolated from each other except via HTTP).
