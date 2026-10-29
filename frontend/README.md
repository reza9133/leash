# Leash frontend

React 19, TypeScript (strict), Vite and plain CSS with design tokens. Routing uses hash routes, so the build can be
hosted on any static host.

## Run

```bash
npm install
npm run dev
npm run build        # type check and build
npm test             # unit tests
npm run check:contract
```

`VITE_LEASH_ADDRESS` overrides the contract address at build time. The default is in `src/config.ts`.

## Structure

| Path | What it holds |
| --- | --- |
| `src/lib/` | contract client, wallet (EIP-6963), transactions, formatting, validation, themes |
| `src/lib/contract.generated.json` | methods, parameters, errors and constants, generated from `contracts/leash.py` |
| `src/components/` | shell, logo, spinners, gauges, lifecycle diagram, shared UI |
| `src/pages/` | home, dashboard, create, mandate, request, explorer, docs |
| `src/docs/` | page registry, search, the building blocks, method and error descriptions |
| `src/docs/pages/` | one file per documentation page |
| `src/three/` | the 3D hero scene (loaded lazily) |
| `src/styles/` | tokens, base, components, layout, pages, docs |
| `tests/unit/` | unit tests (vitest) |
| `tests/e2e/` | browser tests against the real contract behind a local chain |

## Keeping in step with the contract

`npm run sync:contract` regenerates `src/lib/contract.generated.json` from `../contracts/leash.py`.
`npm run check:contract` exits with 1 when the file is stale. The unit tests fail when a method or an error message
has no entry in `src/docs/methodDocs.ts` or `src/docs/errors.ts`.

## Adding a documentation page

Add an entry to `src/docs/registry.ts` and create `src/docs/pages/<slug>.tsx` that default-exports a component. Use the
helpers in `src/docs/kit.tsx` (`H2`, `H3`, `Note`, `DocTable`, `MethodLink`). Headings need an `id` so they can be linked
and searched.
