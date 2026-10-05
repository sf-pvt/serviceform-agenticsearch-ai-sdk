# Shopify

The search ships with the [Serviceform app for Shopify](https://apps.shopify.com/serviceform-app) as two theme blocks. Its files are served from Shopify's CDN.

Install the app first: https://apps.shopify.com/serviceform-app

## 1. Header search

1. Online Store > Themes > **Customize**.
2. Open **App embeds** and switch on **AgenticSearch header bar**.
3. Paste your **Search tool ID** (Serviceform dashboard: Tools > Search box > Install).
4. Choose **Box** (field with instant results) or **Modal** (button that opens the full search).

It replaces the theme's own search control. If the Serviceform search cannot start, the theme's control is shown again.

Not on a Dawn-based theme? Set **Theme search control to replace** to the CSS selector of your theme's search element.

## 2. Results page

1. In the theme editor open the **Search** template.
2. **Add block** (or section) > Apps > **Serviceform AgenticSearch**.
3. Paste the same tool ID. Optionally hide the theme's own results section.

The same block also works on any other page, as a hero section or a box.

## 3. Good to know

- Both blocks are off until you switch them on, and render nothing without a tool ID.
- Colour, placeholder, products per page and AI answers are block settings in the theme editor.
