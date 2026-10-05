# Before you start: account, product index, knowledge base, search tool

The SDK shows a search. What it searches lives in your Serviceform account. Four things have to exist before any snippet works, and each takes a few minutes.

Prefer not to do this yourself? Serviceform sets it up for you: [book a demo on your own catalogue](https://www.serviceform.com/industries/automotive/ai-search/).

## 1. Create a Serviceform account

Sign up at https://dash.serviceform.com/signup and log in to the dashboard.

## 2. Index your catalogue

The **product index** is the searchable copy of what you sell: cars, properties, courses, products.

1. In the dashboard menu open **Product indexes** and add one.
2. Choose where the data comes from:
   - **Website / feed URL**: an XML, JSON or CSV feed (for example your Google Shopping feed or your dealer system's stock feed)
   - **Shopify** or **WooCommerce**: read straight from the store
   - **Upload a file**
   - an API, or **Web scraping** when there is no feed
3. Check that titles, prices, images and links landed in the right fields, then publish it.

The index refreshes from its source on a schedule, so sold items disappear and new ones appear without you touching it.

## 3. Create a knowledge base

The **knowledge base** is what the AI answers from: your site's pages, documents and questions you teach it. It also owns the product indexes the search may use.

1. In the dashboard menu open **Knowledge base** and create one.
2. Add your website so it can read your pages (opening hours, delivery, financing, returns).
3. Connect the product index from step 2 to this knowledge base.

Without a knowledge base the search still draws, but it has nothing to answer with and no products to show.

## 4. Create the search tool

1. In the dashboard menu open **Tools**, choose **Add tool** and pick **AI Agentic Search**.
2. Go through the builder:
   - **Design**: colour, corner roundness, layout (section, box, modal or full page)
   - **Wording**: language, placeholders and the example questions
   - **Search**: select your **knowledge base**, and which index to use if it has more than one. Set the currency. The builder tells you here if the knowledge base has no product index yet.
   - **Install**: your **search tool ID** and a ready snippet
3. Save.

## 5. Copy the search tool ID

The ID is in the builder's **Install** step (and in the builder's address, after `tid=`). It is 20 letters and digits. It is a public identifier, not a secret: it goes into your page's HTML.

That ID is the `TOOL_ID` in every guide:

- [Plain HTML](html.md) · [Astro](astro.md) · [React / Next.js](react.md) · [Vue / Nuxt](vue.md) · [WordPress](wordpress.md) · [Shopify](shopify.md) · [PHP](../../php/README.md)

## Check it works

Paste this in your browser's console on any page that has the SDK loaded, with your ID:

```js
await ServiceformAgenticSearch.serviceformSearch('TOOL_ID').browse({ q: '' }).then((r) => r.found)
```

A number above 0 means the tool, the knowledge base and the index are connected. `0` means the tool exists but finds no products: check step 3. An error means the ID is wrong.

## Changing things later

Colours, wording, filters and which index is searched are all changed in the builder. Sites pick the changes up by themselves; there is nothing to redeploy.
