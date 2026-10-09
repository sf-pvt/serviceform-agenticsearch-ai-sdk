<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch;

/**
 * Builds the HTML a server renders for AgenticSearch. No I/O: strings in,
 * strings out. Every value is escaped; URLs pass only when they are http(s)
 * or root-relative.
 */
final class Renderer
{
    public const LAYOUTS = ['box', 'modal', 'page', 'section'];

    private const JSON_FLAGS = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE;

    /**
     * The mount element (contract section 2) with the pre-rendered shell
     * (section 3) inside and, when `config` is given, the inline settings
     * script after it.
     *
     * Options: `toolId` (required), `layout` (box | modal | page | section, default box),
     * `language`, `accent`, `ai` (bool), `searchPage`, `searchParam`, `perPage` (1..48),
     * `facets` (string[]), `placeholder`, `apiBase`, `config` (settings array),
     * `id`, `class` (extra classes).
     *
     * @param array<string, mixed> $options
     * @return string HTML.
     * @throws \InvalidArgumentException When `toolId` is missing or not a valid id.
     */
    public static function mount(array $options): string
    {
        $toolId = isset($options['toolId']) && is_string($options['toolId']) ? $options['toolId'] : '';
        if (!Client::isValidToolId($toolId)) {
            throw new \InvalidArgumentException('Renderer::mount() needs a valid toolId.');
        }
        $config = isset($options['config']) && is_array($options['config']) ? $options['config'] : null;

        $layout = isset($options['layout']) && in_array($options['layout'], self::LAYOUTS, true)
            ? $options['layout']
            : 'box';

        $classes = ['sfas', 'sfas-shell', 'sfas-shell--' . $layout];
        if (isset($options['class']) && is_string($options['class'])) {
            foreach (preg_split('/\s+/', trim($options['class'])) ?: [] as $class) {
                if ($class !== '' && preg_match('/^[A-Za-z0-9_-]+$/', $class) && !in_array($class, $classes, true)) {
                    $classes[] = $class;
                }
            }
        }

        $attrs = [];
        if (isset($options['id']) && is_string($options['id']) && preg_match('/^[A-Za-z][A-Za-z0-9_:.-]*$/D', $options['id'])) {
            $attrs['id'] = $options['id'];
        }
        $attrs['class'] = implode(' ', $classes);
        $attrs['data-sf-agenticsearch'] = true;
        $attrs['data-tool-id'] = $toolId;
        $attrs['data-layout'] = $layout;

        if (isset($options['language']) && is_string($options['language'])
            && preg_match('/^([A-Za-z]{2})(?:[-_][A-Za-z0-9]+)*$/', trim($options['language']), $m)) {
            $attrs['data-language'] = strtolower($m[1]);
        }
        if (isset($options['accent']) && is_string($options['accent']) && trim($options['accent']) !== '') {
            $attrs['data-accent'] = trim($options['accent']);
        }
        if (isset($options['ai'])) {
            $attrs['data-ai'] = $options['ai'] ? 'true' : 'false';
        }
        if (isset($options['searchPage']) && is_string($options['searchPage'])) {
            $searchPage = self::safeUrl($options['searchPage']);
            if ($searchPage !== '') {
                $attrs['data-search-page'] = $searchPage;
            }
        }
        if (isset($options['searchParam']) && is_string($options['searchParam']) && trim($options['searchParam']) !== '') {
            $attrs['data-search-param'] = trim($options['searchParam']);
        }
        if (isset($options['perPage']) && is_numeric($options['perPage'])) {
            $attrs['data-per-page'] = (string) max(1, min(48, (int) $options['perPage']));
        }
        if (isset($options['facets']) && is_array($options['facets'])) {
            $facets = [];
            foreach ($options['facets'] as $facet) {
                if (is_scalar($facet) && trim((string) $facet) !== '') {
                    $facets[] = trim((string) $facet);
                }
            }
            if ($facets !== []) {
                $attrs['data-facets'] = implode(',', $facets);
            }
        }

        $placeholder = '';
        if (isset($options['placeholder']) && is_string($options['placeholder']) && $options['placeholder'] !== '') {
            $placeholder = $options['placeholder'];
            $attrs['data-placeholder'] = $placeholder;
        } elseif ($config !== null && isset($config['placeholders'][0]) && is_string($config['placeholders'][0])) {
            // Shown in the shell only; the script picks its own placeholder from the settings.
            $placeholder = $config['placeholders'][0];
        }
        if (isset($options['apiBase']) && is_string($options['apiBase'])
            && preg_match('#^https?://#i', trim($options['apiBase']))) {
            $attrs['data-api-base'] = rtrim(self::safeUrl($options['apiBase']), '/');
        }

        $html = '<div' . self::attributes($attrs) . '>' . self::shell($layout, $placeholder) . '</div>';
        if ($config !== null) {
            $html .= "\n" . self::configScript($toolId, $config);
        }

        return $html;
    }

    /**
     * The stylesheet link and the deferred script for the two vendored files
     * (`agenticsearch.css`, `agenticsearch.js`) under a base URL.
     *
     * @param string      $baseUrl http(s) or root-relative URL of the directory that holds the files.
     * @param string|null $version Optional cache-busting version, added as `?ver=`.
     * @return string HTML.
     * @throws \InvalidArgumentException When the base URL is not http(s) or root-relative.
     */
    public static function assets(string $baseUrl, ?string $version = null): string
    {
        $base = self::safeUrl($baseUrl);
        if ($base === '') {
            throw new \InvalidArgumentException('Renderer::assets() needs an http(s) or root-relative base URL.');
        }
        $base = rtrim($base, '/');
        $suffix = $version !== null && $version !== '' ? '?ver=' . rawurlencode($version) : '';

        return '<link rel="stylesheet" href="' . self::esc($base . '/agenticsearch.css' . $suffix) . '">' . "\n"
            . '<script src="' . self::esc($base . '/agenticsearch.js' . $suffix) . '" defer></script>';
    }

    /**
     * A plain, semantic list of product cards for a server-rendered first
     * page. Put it inside the mount element; the script replaces it on mount.
     *
     * @param array<int, array<string, mixed>> $hits Products with the readable names (wire rows are mapped too).
     * @return string HTML, an empty string when there are no hits.
     */
    public static function hits(array $hits): string
    {
        $items = '';
        foreach ($hits as $hit) {
            if (!is_array($hit)) {
                continue;
            }
            if (!array_key_exists('title', $hit) && array_key_exists('t', $hit)) {
                $hit = Hit::fromWire($hit);
            }
            $title = self::text($hit['title'] ?? null);
            if ($title === '') {
                continue;
            }
            $url = self::safeUrl(self::text($hit['url'] ?? null));
            $image = self::safeUrl(self::text($hit['image'] ?? null));
            $meta = self::text($hit['meta'] ?? null);
            $price = self::text($hit['price'] ?? null);

            $inner = '';
            if ($image !== '') {
                $inner .= '<img class="sfas-hit-image" src="' . self::esc($image) . '" alt="" loading="lazy">';
            }
            $inner .= '<span class="sfas-hit-title">' . self::esc($title) . '</span>';
            if ($meta !== '') {
                $inner .= '<span class="sfas-hit-meta">' . self::esc($meta) . '</span>';
            }
            if ($price !== '') {
                $inner .= '<span class="sfas-hit-price">' . self::esc($price) . '</span>';
            }

            $class = 'sfas-hit' . (!empty($hit['outOfStock']) ? ' sfas-hit--out' : '');
            $items .= '<li class="' . $class . '">'
                . ($url !== ''
                    ? '<a class="sfas-hit-link" href="' . self::esc($url) . '">' . $inner . '</a>'
                    : '<div class="sfas-hit-link">' . $inner . '</div>')
                . '</li>';
        }

        return $items === '' ? '' : '<ul class="sfas-hits">' . $items . '</ul>';
    }

    /**
     * The inline settings script for a tool. The JSON cannot close the script
     * tag: `<`, `>`, `&` and quotes are written as \uXXXX escapes.
     *
     * @param string               $toolId
     * @param array<string, mixed> $config Settings (contract section 4).
     * @return string HTML.
     * @throws \InvalidArgumentException When the tool id is not valid.
     */
    public static function configScript(string $toolId, array $config): string
    {
        if (!Client::isValidToolId($toolId)) {
            throw new \InvalidArgumentException('Renderer::configScript() needs a valid toolId.');
        }
        unset($config['pages']);
        foreach (Config::OBJECT_KEYS as $key) {
            if (isset($config[$key]) && $config[$key] === []) {
                $config[$key] = new \stdClass();
            }
        }
        $json = json_encode($config, self::JSON_FLAGS | JSON_PARTIAL_OUTPUT_ON_ERROR);
        if ($json === false) {
            $json = '{}';
        }

        return '<script type="application/json" data-sf-agenticsearch-config="' . self::esc($toolId) . '">'
            . $json . '</script>';
    }

    /**
     * Escape a value for HTML text or an attribute.
     */
    public static function esc(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /**
     * Return the URL when it is http(s) or root-relative, an empty string otherwise.
     */
    public static function safeUrl(string $url): string
    {
        $url = trim($url);
        if ($url === '' || preg_match('/[\x00-\x20\x7F]/', $url)) {
            return '';
        }
        if (preg_match('#^https?://#i', $url) || $url[0] === '/') {
            return $url;
        }

        return '';
    }

    /**
     * The section-3 shell for a layout.
     */
    private static function shell(string $layout, string $placeholder): string
    {
        $field = '<div class="sfas-shell-field"><span class="sfas-shell-icon"></span>'
            . '<span class="sfas-shell-text">' . self::esc($placeholder) . '</span></div>';
        if ($layout === 'page') {
            // The filters' card down the left, the field over the results.
            return '<div class="sfas-shell-body"><div class="sfas-shell-side"></div><div class="sfas-shell-main">' . $field
                . '<div class="sfas-shell-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div>';
        }

        return $field;
    }

    /**
     * Render an attribute map; `true` renders a bare attribute.
     *
     * @param array<string, string|bool> $attrs
     */
    private static function attributes(array $attrs): string
    {
        $html = '';
        foreach ($attrs as $name => $value) {
            if ($value === true) {
                $html .= ' ' . $name;
            } elseif (is_string($value)) {
                $html .= ' ' . $name . '="' . self::esc($value) . '"';
            }
        }

        return $html;
    }

    /**
     * A scalar as trimmed text, '' for anything else.
     *
     * @param mixed $value
     */
    private static function text($value): string
    {
        return is_scalar($value) && !is_bool($value) ? trim((string) $value) : '';
    }
}
