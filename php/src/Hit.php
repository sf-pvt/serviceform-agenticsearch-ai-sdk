<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch;

/**
 * Maps product rows and facets from the short wire names to readable names.
 */
final class Hit
{
    /** Wire key => readable key (contract section 5). */
    private const MAP = [
        't' => 'title',
        'y' => 'year',
        'meta' => 'meta',
        'loc' => 'location',
        'p' => 'price',
        'mo' => 'monthly',
        'h' => 'url',
        'img' => 'image',
        'id' => 'id',
        'brand' => 'brand',
        'pn' => 'priceValue',
        'oos' => 'outOfStock',
        'f' => 'fields',
    ];

    /**
     * Map one wire product row to
     * `title, year, meta, location, price, monthly, url, image, id, brand, priceValue, outOfStock, fields`.
     * Every key is always present; missing values are null (`outOfStock` false, `fields` an empty array).
     *
     * @param mixed $row A product row as the API sends it.
     * @return array<string, mixed>
     */
    public static function fromWire($row): array
    {
        $row = is_array($row) ? $row : [];
        $hit = [];
        foreach (self::MAP as $wire => $name) {
            $hit[$name] = array_key_exists($wire, $row) ? $row[$wire] : null;
        }
        $hit['outOfStock'] = !empty($hit['outOfStock']);
        $hit['fields'] = is_array($hit['fields']) ? $hit['fields'] : [];

        return $hit;
    }

    /**
     * Map a list of wire product rows.
     *
     * @param mixed $rows
     * @return array<int, array<string, mixed>>
     */
    public static function listFromWire($rows): array
    {
        $hits = [];
        if (is_array($rows)) {
            foreach ($rows as $row) {
                if (is_array($row)) {
                    $hits[] = self::fromWire($row);
                }
            }
        }

        return $hits;
    }

    /**
     * Map wire facets `[{field, values: [{v, c, l?}]}]` to
     * `[['attribute' => , 'values' => [['value' => , 'count' => , 'label' => ]]]]`.
     * The label falls back to the value.
     *
     * @param mixed $facets
     * @return array<int, array{attribute: string, values: array<int, array{value: string, count: int, label: string}>}>
     */
    public static function facetsFromWire($facets): array
    {
        $out = [];
        if (!is_array($facets)) {
            return $out;
        }
        foreach ($facets as $facet) {
            if (!is_array($facet) || !isset($facet['field']) || !is_scalar($facet['field'])) {
                continue;
            }
            $values = [];
            $rows = isset($facet['values']) && is_array($facet['values']) ? $facet['values'] : [];
            foreach ($rows as $row) {
                if (!is_array($row) || !isset($row['v']) || !is_scalar($row['v'])) {
                    continue;
                }
                $value = (string) $row['v'];
                $label = isset($row['l']) && is_scalar($row['l']) && (string) $row['l'] !== '' ? (string) $row['l'] : $value;
                $values[] = [
                    'value' => $value,
                    'count' => isset($row['c']) && is_numeric($row['c']) ? (int) $row['c'] : 0,
                    'label' => $label,
                ];
            }
            $out[] = ['attribute' => (string) $facet['field'], 'values' => $values];
        }

        return $out;
    }
}
