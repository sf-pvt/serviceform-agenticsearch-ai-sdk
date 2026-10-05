# Vue and Nuxt

```bash
npm install @serviceform/agenticsearch
```

Vue 3.3 or newer.

## 1. Ready-made search

```vue
<script setup>
import { AgenticSearch } from '@serviceform/agenticsearch/vue';
import '@serviceform/agenticsearch/css';
</script>

<template>
  <!-- in the header, on every page -->
  <AgenticSearch tool-id="TOOL_ID" layout="box" search-page-href="/search" />

  <!-- on the results page -->
  <AgenticSearch tool-id="TOOL_ID" layout="page" />
</template>
```

- `layout` is `box`, `modal`, `page` or `section`. Props are the `mount()` keys in [AGENTS.md](../../AGENTS.md#3-every-option), in kebab-case in templates.
- It renders a placeholder shell first (on the server too), then the search takes its place in the browser. No `<ClientOnly>` needed in Nuxt.
- `@mount="(search) => ..."` hands you the handle; with a template ref, `searchRef.value.open()` and `.close()` drive the modal.
- The `page` layout reads and writes the query string itself.

## 2. Your own markup with composables

Each composable returns a ref holding that piece's current state.

```vue
<!-- Search.vue -->
<script setup>
import { AgenticSearchProvider } from '@serviceform/agenticsearch/vue';
import Results from './Results.vue';
</script>

<template>
  <AgenticSearchProvider tool-id="TOOL_ID" routing :per-page="12">
    <Results />
  </AgenticSearchProvider>
</template>
```

```vue
<!-- Results.vue -->
<script setup>
import { useSearchBox, useHits, useRefinementList, useCurrentRefinements, useStats, useAiAnswer } from '@serviceform/agenticsearch/vue';

const box = useSearchBox();
const hits = useHits();
const brand = useRefinementList({ attribute: 'brand' });
const chips = useCurrentRefinements();
const stats = useStats();
const ai = useAiAnswer();
</script>

<template>
  <form @submit.prevent="box.submit($event.target.q.value)">
    <input name="q" :value="box.query" @input="box.refine($event.target.value)" placeholder="Search" />
  </form>

  <p v-if="ai.status === 'done'">{{ ai.answer }}</p>

  <button v-for="chip in chips.items" :key="chip.key" @click="chip.refine()">{{ chip.label }} ×</button>

  <fieldset>
    <legend>{{ brand.label }}</legend>
    <label v-for="item in brand.items" :key="item.value">
      <input type="checkbox" :checked="item.isRefined" @change="brand.refine(item.value)" /> {{ item.label }} ({{ item.count }})
    </label>
  </fieldset>

  <p>{{ stats.text }}</p>
  <ul>
    <li v-for="(hit, i) in hits.hits" :key="hit.id || hit.url">
      <a :href="hit.url" @click="hits.sendClick(hit, i)">{{ hit.title }} <b>{{ hit.price }}</b></a>
    </li>
  </ul>
</template>
```

The composables are the same set as the React hooks, with the same names and state: `useSearchBox`, `useHits`, `useInfiniteHits`, `useRefinementList`, `useRange`, `useDynamicFacets`, `useCurrentRefinements`, `useClearRefinements`, `useSortBy`, `useStats`, `usePagination`, `useInStock`, `useNote`, `useAiAnswer`, `useSuggestedQuestions`, `useAutocomplete`, `useAgenticSearch`, `useConnector`. See the table in the [React guide](react.md#hooks).

Without the provider component, call `provideAgenticSearch({ toolId: 'TOOL_ID', routing: true })` in a parent's `setup()`.
