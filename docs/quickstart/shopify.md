# Shopify

The search ships with the [Serviceform app for Shopify](https://apps.shopify.com/serviceform-app). Its files are served from Shopify's CDN and its markup is rendered by Shopify with the page, so nothing of the theme's own search is drawn first and replaced afterwards.

Install the app first: https://apps.shopify.com/serviceform-app

## 1. Connect your search tool

1. In Shopify admin open the Serviceform app and go to **Search & selling**.
2. Paste your **Search tool ID** (Serviceform dashboard: Tools > your search tool > Install; [how to get one](account.md)) and press **Save**.

The ID is saved with the app. Nothing needs pasting in the theme editor.

## 2. Switch it on in your theme

On the same page, press **Open theme editor with the search switched on**. Shopify opens your theme editor with **AgenticSearch site search** already switched on under App embeds: press **Save**.

To try it without touching your live store, duplicate your theme first and switch it on in the copy.

## 3. Choose what your shoppers get

Each feature has its own switch on the **Search & selling** page, with a description of what shoppers see. A switch takes effect on the storefront on the next page load.

| Feature | What it does |
|---|---|
| Search in the header | Replaces the theme's header search. A field with an instant dropdown (products, pages, AI) on desktop, a search icon on phones. |
| Search results page | Replaces the store's `/search` page with the full search: filters, sorting, results. |
| AI answers | Shoppers can ask a question and get a short answer with matching products. |
| Add to cart from search | An "Add to cart" button under every result. Products with sizes or colours ask the shopper to choose first, by the store's own option names. |
| Favourites | A heart on every result, the number saved in the header search, and a Favourites filter on the search page. Saved in the shopper's browser. |
| Favourite button on product pages | A "Save to favourites" button under the buy buttons, in the store's language. |
| Recommendations in the cart | Products that go with what is in the cart, under the cart, with the store's own prices and stock. Headed "Others also bought" only when they come from what shoppers bought together. |

Everything is on by default. Switching a feature off puts back what the theme showed before.

## 4. Themes

The app finds the theme's own search, results and product form by itself:

| Themes | Header search | Results page, favourite button, cart recommendations |
|---|---|---|
| Dawn and the themes built on it (Craft, Sense, Refresh, Studio, Taste, Crave, Ride, Origin, Spotlight, Publisher, Colorblock, Trade) | Yes | Yes |
| Horizon and its family | Yes | Yes |
| Prestige, Impulse, Symmetry, Empire, Warehouse, Focal, Broadcast, Impact | Yes | Not yet: the theme's own stay |
| Any other theme | Set the selectors below | Set the selectors below |

For a theme not in the table, open the embed's settings in the theme editor and fill in the CSS selectors: **Theme search control to replace**, **Theme search results to replace** and **Put the favourite button after**. If a selector matches nothing, nothing on the page changes and the theme's own search stays.

## 5. Placing things yourself

The embed places everything by itself. To put something somewhere else, add one of these app blocks in the theme editor; with a block on the page, the embed leaves its own copy out.

- **Serviceform AgenticSearch**: the search as a full page, a hero section or a box, on any page.
- **Favourite button**: on a product page, as a full-width button, a button or a heart only, with your own wording.
- **Cart recommendations**: on the cart page, with your own heading and number of products.

## 6. Good to know

- The search uses your Serviceform product index, so the product feed must be switched on (Pixel Settings in the app).
- Colours, wording, filters and AI behaviour are settings of the search tool, in the Serviceform dashboard.
- The theme editor has a checkbox for most features too. A feature shows only when it is on in both places, so a checkbox there can turn a feature off for one theme.
- If the Serviceform search cannot start (the tool was deleted, the script did not load), its copy is removed and the theme's own search is shown again.
- Favourites live in the shopper's browser: no account is needed, and they do not follow the shopper to another device.
