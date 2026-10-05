<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch;

/**
 * The settings shape of contract section 4.
 */
final class Config
{
    public const VERSION = 1;

    /** Section-4 keys read straight from the `searchbox` block, with their defaults. */
    private const DEFAULTS = [
        'language' => 'en',
        'currency' => '',
        'priceCents' => false,
        'industry' => '',
        'layout' => 'box',
        'accent' => '',
        'radius' => null,
        'placeholders' => [],
        'questions' => [],
        'labels' => [],
        'showFilters' => true,
        'facets' => [],
        'facetStyles' => [],
        'facetLabels' => [],
        'card' => null,
        'searchPageHref' => '',
        'searchPageParam' => 'q',
        'contactHref' => '',
        'assistantAvatar' => '',
        'fallbackImage' => '',
        'productSearch' => true,
        'pageSearch' => true,
        'popularSearches' => false,
    ];

    /** Keys that are JSON objects: the renderer encodes an empty one as `{}`, not `[]`. */
    public const OBJECT_KEYS = ['labels', 'facetStyles', 'facetLabels'];

    /**
     * Map a full tool document (the `/api/public/tid/{id}` answer) down to the
     * section-4 settings. Only the listed keys are copied, so nothing else in
     * the document (and never the page list) reaches the browser.
     *
     * @param mixed  $doc    The decoded tool document.
     * @param string $toolId The tool id the document was fetched for.
     * @return array<string, mixed>
     */
    public static function fromToolDoc($doc, string $toolId): array
    {
        $doc = is_array($doc) ? $doc : [];
        $sb = isset($doc['searchbox']) && is_array($doc['searchbox']) ? $doc['searchbox'] : [];

        $config = ['v' => self::VERSION, 'toolId' => $toolId];
        foreach (self::DEFAULTS as $key => $default) {
            $config[$key] = self::typed(array_key_exists($key, $sb) ? $sb[$key] : null, $default);
        }
        if (!array_key_exists('language', $sb) || !is_string($sb['language']) || $sb['language'] === '') {
            $design = isset($doc['design']) && is_array($doc['design']) ? $doc['design'] : [];
            if (isset($design['language']) && is_string($design['language']) && $design['language'] !== '') {
                $config['language'] = $design['language'];
            }
        }
        $config['ai'] = !(array_key_exists('aiEnabled', $sb) && $sb['aiEnabled'] === false);
        $config['aiDisclaimer'] = (isset($sb['aiDisclaimer']) && $sb['aiDisclaimer'] === true
            && isset($sb['aiDisclaimerText']) && is_string($sb['aiDisclaimerText']))
            ? $sb['aiDisclaimerText']
            : '';
        $config['pagesCount'] = isset($sb['pages']) && is_array($sb['pages']) ? count($sb['pages']) : 0;

        return self::ordered($config);
    }

    /**
     * Tidy a settings answer of the config endpoint: must be an array, never
     * carries `pages`, always carries `v` and `toolId`.
     *
     * @param mixed  $config The decoded config answer.
     * @param string $toolId The tool id it was fetched for.
     * @return array<string, mixed>|null Null when the answer is not a settings object.
     */
    public static function fromApi($config, string $toolId): ?array
    {
        if (!is_array($config) || $config === [] || array_keys($config) === range(0, count($config) - 1)) {
            return null;
        }
        unset($config['pages']);
        if (!isset($config['v'])) {
            $config['v'] = self::VERSION;
        }
        if (!isset($config['toolId']) || !is_string($config['toolId']) || $config['toolId'] === '') {
            $config['toolId'] = $toolId;
        }
        return $config;
    }

    /**
     * Keep a value only when it has the type of its default; otherwise the default.
     *
     * @param mixed $value
     * @param mixed $default
     * @return mixed
     */
    private static function typed($value, $default)
    {
        if ($value === null) {
            return $default;
        }
        if (is_bool($default)) {
            return is_bool($value) ? $value : $default;
        }
        if (is_string($default)) {
            return is_string($value) ? $value : $default;
        }
        if (is_array($default)) {
            return is_array($value) ? $value : $default;
        }
        // Default null: `radius` (number) and `card` (object).
        return (is_numeric($value) || is_array($value)) ? $value : $default;
    }

    /**
     * Order the keys as the contract lists them.
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private static function ordered(array $config): array
    {
        $order = [
            'v', 'toolId', 'language', 'currency', 'priceCents', 'industry', 'layout', 'accent', 'radius',
            'ai', 'aiDisclaimer', 'placeholders', 'questions', 'labels', 'showFilters', 'facets', 'facetStyles',
            'facetLabels', 'card', 'searchPageHref', 'searchPageParam', 'contactHref', 'assistantAvatar',
            'fallbackImage', 'productSearch', 'pageSearch', 'popularSearches', 'pagesCount',
        ];
        $out = [];
        foreach ($order as $key) {
            $out[$key] = $config[$key];
        }

        return $out;
    }
}
