<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch\Tests;

use PHPUnit\Framework\TestCase;
use Serviceform\AgenticSearch\Hit;

final class HitTest extends TestCase
{
    public function testMapsWireNamesToReadableNames(): void
    {
        $hit = Hit::fromWire([
            't' => 'Volvo V60', 'y' => 2020, 'meta' => '45 000 km', 'loc' => 'Helsinki', 'p' => '24 900 €',
            'mo' => '289 €/kk', 'h' => 'https://shop.example/v60', 'img' => 'https://shop.example/v60.jpg',
            'id' => 'abc', 'brand' => 'Volvo', 'pn' => 24900, 'oos' => 1, 'f' => ['fuel' => 'Diesel'],
            'unknown' => 'dropped',
        ]);

        $this->assertSame([
            'title' => 'Volvo V60', 'year' => 2020, 'meta' => '45 000 km', 'location' => 'Helsinki',
            'price' => '24 900 €', 'monthly' => '289 €/kk', 'url' => 'https://shop.example/v60',
            'image' => 'https://shop.example/v60.jpg', 'id' => 'abc', 'brand' => 'Volvo', 'priceValue' => 24900,
            'outOfStock' => true, 'fields' => ['fuel' => 'Diesel'],
        ], $hit);
    }

    public function testMissingKeysGetDefaults(): void
    {
        $hit = Hit::fromWire(['t' => 'Only a title']);

        $this->assertSame('Only a title', $hit['title']);
        $this->assertNull($hit['price']);
        $this->assertFalse($hit['outOfStock']);
        $this->assertSame([], $hit['fields']);
        $this->assertCount(13, $hit);
        $this->assertSame([], Hit::listFromWire('nonsense'));
        $this->assertCount(1, Hit::listFromWire([['t' => 'a'], 'junk', null]));
    }

    public function testMapsFacets(): void
    {
        $facets = Hit::facetsFromWire([
            ['field' => 'brand', 'values' => [['v' => 'volvo', 'c' => 12, 'l' => 'Volvo'], ['v' => 'saab', 'c' => '3']]],
            ['field' => 'empty'],
            ['values' => [['v' => 'x', 'c' => 1]]],
            'junk',
        ]);

        $this->assertSame([
            ['attribute' => 'brand', 'values' => [
                ['value' => 'volvo', 'count' => 12, 'label' => 'Volvo'],
                ['value' => 'saab', 'count' => 3, 'label' => 'saab'],
            ]],
            ['attribute' => 'empty', 'values' => []],
        ], $facets);
        $this->assertSame([], Hit::facetsFromWire(null));
    }
}
