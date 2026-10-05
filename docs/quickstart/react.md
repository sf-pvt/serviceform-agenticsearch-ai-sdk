# React and Next.js

```bash
npm install @serviceform/agenticsearch
```

React 17 or newer. Works in Next.js (App Router and Pages Router), Remix and Vite.

## 1. Ready-made search

```jsx
'use client';

import { AgenticSearch } from '@serviceform/agenticsearch/react';
import '@serviceform/agenticsearch/css';

// In the header, on every page
export function HeaderSearch() {
  return <AgenticSearch toolId="TOOL_ID" layout="box" searchPageHref="/search" />;
}

// On the results page (app/search/page.jsx or pages/search.jsx)
export function SearchPage() {
  return <AgenticSearch toolId="TOOL_ID" layout="page" />;
}
```

- `layout` is `box`, `modal`, `page` or `section`. Every prop is listed in [AGENTS.md](../../AGENTS.md#3-every-option) (use the `mount()` key names).
- It renders a placeholder shell on the server and in the first paint, so nothing shifts when the search takes over.
- The `page` layout reads and writes the query string itself (`?q=...&f.brand=...`). You do not need `useSearchParams`.
- `onMount={(search) => ...}` hands you the handle: `search.open()` and `search.close()` for the modal, `search.instance` for the search itself.
- If your bundler cannot import CSS from a package, drop the CSS import: the search injects its own styles.

## 2. Your own markup with hooks

Wrap your components in a provider and use one hook per piece.

```jsx
'use client';

import { AgenticSearchProvider, useSearchBox, useHits, useRefinementList, useCurrentRefinements, useStats, useAiAnswer } from '@serviceform/agenticsearch/react';

export default function Search() {
  return (
    <AgenticSearchProvider toolId="TOOL_ID" routing perPage={12}>
      <SearchField />
      <Answer />
      <Chips />
      <Brands />
      <Results />
    </AgenticSearchProvider>
  );
}

function SearchField() {
  const { query, refine, submit } = useSearchBox();
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget.q.value); }}>
      <input name="q" defaultValue={query} onChange={(e) => refine(e.target.value)} placeholder="Search" />
    </form>
  );
}

function Answer() {
  const { status, answer, links } = useAiAnswer();
  if (status === 'loading') return <p>Thinking...</p>;
  if (status !== 'done') return null;
  return <p>{answer} {links.map((l) => <a key={l.url} href={l.url}>{l.label}</a>)}</p>;
}

function Chips() {
  const { items } = useCurrentRefinements();
  return <div>{items.map((chip) => <button key={chip.key} onClick={chip.refine}>{chip.label} ×</button>)}</div>;
}

function Brands() {
  const { label, items, refine } = useRefinementList({ attribute: 'brand' });
  return (
    <fieldset>
      <legend>{label}</legend>
      {items.map((item) => (
        <label key={item.value}>
          <input type="checkbox" checked={item.isRefined} onChange={() => refine(item.value)} /> {item.label} ({item.count})
        </label>
      ))}
    </fieldset>
  );
}

function Results() {
  const { hits, sendClick } = useHits();
  const { text } = useStats();
  return (
    <>
      <p>{text}</p>
      <ul>
        {hits.map((hit, i) => (
          <li key={hit.id || hit.url}>
            <a href={hit.url} onClick={() => sendClick(hit, i)}>
              <img src={hit.image} alt="" width="120" /> {hit.title} <b>{hit.price}</b>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
```

### Hooks

| Hook | Gives you |
|---|---|
| `useSearchBox()` | `query`, `refine(text)` (as you type), `submit(text)` (Enter: new search and AI), `clear()`, `isLoading` |
| `useHits()` / `useInfiniteHits()` | `hits`, `found`, `status`, `sendClick(hit, position)`; infinite adds `showMore()`, `isLastPage` |
| `useRefinementList({ attribute })` | `items` (`value`, `label`, `count`, `isRefined`), `refine(value)`, `toggleShowMore()`, `searchForItems(text)` |
| `useRange({ attribute })` | `range`, `start`, `refine([min, max])`, `format(value)`; `attribute: 'price'` is in currency units |
| `useDynamicFacets()` | The filters this catalogue has, in the tool's order: `facets` (`attribute`, `type`, `label`, `style`) |
| `useCurrentRefinements()` / `useClearRefinements()` | Applied filters as removable chips; clear all |
| `useSortBy()`, `useStats()`, `usePagination()`, `useInStock()`, `useNote()` | Order, count text, page numbers, stock toggle, what the search loosened |
| `useAiAnswer()` / `useSuggestedQuestions()` | `status`, `answer`, `links`, `hits`, `ask(question)`, `reset()`; the tool's example questions |
| `useAutocomplete()` | Instant dropdown data: `hits`, `pages`, `suggestions`, `refine(text)` |
| `useAgenticSearch()` | The search instance: `state`, `results`, `setQuery()`, `toggleRefinement()`, `ask()` |
| `useConnector(connector, params)` | Any connector as a hook |

Provider props: `toolId` (or `searchClient`), `routing`, `perPage`, `facets`, `fields`, `language`, `ai`, `initialState`, `insights`, `apiBase`.

The hooks render on the server (they return the initial state and make no request there) and work under `StrictMode`.

## 3. TypeScript

Everything is typed. Useful imports:

```ts
import type { AgenticSearchProps, AgenticSearchProviderProps } from '@serviceform/agenticsearch/react';
import type { Hit, SearchState } from '@serviceform/agenticsearch';
```
