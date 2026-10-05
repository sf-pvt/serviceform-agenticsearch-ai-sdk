# WordPress and WooCommerce

The search is part of the [Serviceform plugin for WordPress](https://wordpress.org/plugins/serviceform-pixel/). Its files are served from your own site.

Install or update the plugin first: https://wordpress.org/plugins/serviceform-pixel/

## 1. Turn it on

1. In WordPress admin open **Serviceform** settings.
2. Under **Serviceform AgenticSearch**, tick **Enable AgenticSearch features**, paste your **Search tool ID** (Serviceform dashboard: Tools > Search box > Install) and save.

Nothing changes on the site until you place the search with one of the options below. Untick **Enable AgenticSearch features** to remove everything again: no files are loaded and the shortcode, block and widgets print nothing.

## 2. Place it

| How | What to do |
|---|---|
| **Elementor** | Add the **Serviceform AgenticSearch Box** widget to your header template, and the **Serviceform AgenticSearch Results** widget to your search results template (or any page) |
| **Block editor** | Add the **Serviceform AgenticSearch** block and pick a layout |
| **Shortcode** | `[serviceform_search layout="box"]` in the header, `[serviceform_search layout="page"]` on the results page |
| **Automatic** | Tick **Header search** to replace the theme's search field, and **Take over the search results page** to show the results on `?s=` searches |

Shortcode attributes: `layout` (`box`, `modal`, `page`, `section`), `per_page`, `placeholder`, `accent`, `ai` (`true` or `false`).

## 3. Good to know

- WordPress search uses `?s=`; the plugin sets that for you.
- The tool's settings are cached in WordPress and written into the page, so the search draws without waiting for a request.
- With the feature off, or the tool id empty, the plugin adds nothing to the site.
- Replacing the header search is fail-safe: if the Serviceform search cannot start, the theme's own search is shown again.
- Tested with Elementor, WooCommerce, Astra and the default block theme.
