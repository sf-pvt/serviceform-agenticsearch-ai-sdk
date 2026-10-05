<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch\Tests;

use PHPUnit\Framework\TestCase;
use Serviceform\AgenticSearch\Client;

final class BrowseQueryTest extends TestCase
{
    public function testEmptyStateGivesEmptyQuery(): void
    {
        $this->assertSame('', Client::browseQuery([]));
        $this->assertSame('', Client::browseQuery(['q' => '  ', 'page' => 1, 'sort' => 'relevance', 'filters' => []]));
    }

    public function testFullStateInContractOrder(): void
    {
        $query = Client::browseQuery([
            'q' => 'red shoes',
            'page' => 3,
            'perPage' => 24,
            'sort' => 'price_asc',
            'filters' => ['size' => ['42', '43'], 'brand' => ['Nike', 'New Balance']],
            'ranges' => ['year' => ['min' => 2018, 'max' => 2022], 'mileage' => ['max' => 100000]],
            'priceMin' => 10,
            'priceMax' => 99.5,
            'inStock' => true,
            'kind' => 'two_doors',
            'facets' => ['brand', 'price'],
            'language' => 'fi',
            'fields' => ['gearbox', 'fuel'],
        ]);

        $this->assertSame(
            'q=red%20shoes&page=3&per_page=24&sort=price_asc'
            . '&f.brand=Nike%7CNew%20Balance&f.size=42%7C43'
            . '&r.mileage=%7C100000&r.year=2018%7C2022'
            . '&price_min=10&price_max=99.5&in_stock=1&k=two_doors'
            . '&facets=brand%2Cprice&lang=fi&fields=gearbox%2Cfuel',
            $query
        );
    }

    public function testDecodesToTheWireShape(): void
    {
        $query = Client::browseQuery([
            'filters' => ['brand' => ['Citroën', 'a&b=c']],
            'ranges' => ['year' => ['min' => '2018', 'max' => '']],
        ]);
        $decoded = [];
        foreach (explode('&', $query) as $part) {
            [$name, $value] = explode('=', $part, 2);
            $decoded[rawurldecode($name)] = rawurldecode($value);
        }

        $this->assertSame(['f.brand' => 'Citroën|a&b=c', 'r.year' => '2018|'], $decoded);
    }

    public function testEmptyAndInvalidValuesAreLeftOut(): void
    {
        $query = Client::browseQuery([
            'filters' => ['brand' => [], 'color' => ['', ' '], 'size' => 'M'],
            'ranges' => ['year' => ['min' => null, 'max' => null], 'km' => 'nope', 'power' => ['min' => 'abc']],
            'priceMin' => '',
            'priceMax' => 'cheap',
            'inStock' => false,
            'perPage' => 500,
            'facets' => [],
        ]);

        $this->assertSame('per_page=48&f.size=M', $query);
    }
}
