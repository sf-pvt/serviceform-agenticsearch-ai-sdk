<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch\Tests;

use PHPUnit\Framework\TestCase;
use Serviceform\AgenticSearch\Config;

final class ConfigTest extends TestCase
{
    public function testMapsTheSearchboxBlock(): void
    {
        $config = Config::fromToolDoc([
            'uid' => 'tenant-secret',
            'design' => ['language' => 'sv'],
            'searchbox' => [
                'language' => 'fi',
                'currency' => 'EUR',
                'industry' => 'automotive',
                'accent' => '#d61920',
                'radius' => 18,
                'aiEnabled' => true,
                'aiDisclaimer' => true,
                'aiDisclaimerText' => 'AI can be wrong',
                'placeholders' => ['Hae autoa'],
                'facets' => ['price', 'brand'],
                'facetLabels' => ['brand' => 'Merkki'],
                'searchPageParam' => 's',
                'pageSearch' => false,
                'pages' => [['t' => 'A', 'h' => 'https://a'], ['t' => 'B', 'h' => 'https://b']],
                'avatars' => ['not part of the shape'],
            ],
        ], 'tool1');

        $this->assertSame(1, $config['v']);
        $this->assertSame('tool1', $config['toolId']);
        $this->assertSame('fi', $config['language']);
        $this->assertSame('EUR', $config['currency']);
        $this->assertSame(18, $config['radius']);
        $this->assertTrue($config['ai']);
        $this->assertSame('AI can be wrong', $config['aiDisclaimer']);
        $this->assertSame(['Hae autoa'], $config['placeholders']);
        $this->assertSame(['brand' => 'Merkki'], $config['facetLabels']);
        $this->assertSame('s', $config['searchPageParam']);
        $this->assertFalse($config['pageSearch']);
        $this->assertTrue($config['productSearch']);
        $this->assertSame(2, $config['pagesCount']);
        $this->assertArrayNotHasKey('pages', $config);
        $this->assertArrayNotHasKey('avatars', $config);
        $this->assertArrayNotHasKey('uid', $config);
    }

    public function testKeysMatchTheContractExactly(): void
    {
        $expected = [
            'v', 'toolId', 'language', 'currency', 'priceCents', 'industry', 'layout', 'accent', 'radius',
            'ai', 'aiDisclaimer', 'placeholders', 'questions', 'labels', 'showFilters', 'facets', 'facetStyles',
            'facetLabels', 'card', 'searchPageHref', 'searchPageParam', 'contactHref', 'assistantAvatar',
            'fallbackImage', 'productSearch', 'pageSearch', 'popularSearches', 'pagesCount',
        ];

        $this->assertSame($expected, array_keys(Config::fromToolDoc([], 'tool1')));
        $this->assertSame($expected, array_keys(Config::fromToolDoc('404', 'tool1')));
    }

    public function testAiAndDisclaimerRules(): void
    {
        $off = Config::fromToolDoc(['searchbox' => ['aiEnabled' => false, 'aiDisclaimerText' => 'text']], 't');
        $this->assertFalse($off['ai']);
        $this->assertSame('', $off['aiDisclaimer'], 'text alone does not switch the disclaimer on');

        $unset = Config::fromToolDoc(['searchbox' => []], 't');
        $this->assertTrue($unset['ai']);
        $this->assertSame(0, $unset['pagesCount']);

        $zero = Config::fromToolDoc(['searchbox' => ['aiEnabled' => 0, 'aiDisclaimer' => 'yes', 'aiDisclaimerText' => 'x']], 't');
        $this->assertTrue($zero['ai'], 'only a strict false turns AI off');
        $this->assertSame('', $zero['aiDisclaimer']);
    }

    public function testLanguageFallsBackToDesignAndWrongTypesToDefaults(): void
    {
        $config = Config::fromToolDoc([
            'design' => ['language' => 'sv'],
            'searchbox' => ['placeholders' => 'not a list', 'showFilters' => 'yes', 'currency' => 12],
        ], 't');

        $this->assertSame('sv', $config['language']);
        $this->assertSame([], $config['placeholders']);
        $this->assertTrue($config['showFilters']);
        $this->assertSame('', $config['currency']);
    }

    public function testFromApiDropsPagesAndRejectsNonObjects(): void
    {
        $config = Config::fromApi(['language' => 'fi', 'pages' => [['t' => 'x']]], 'tool1');

        $this->assertSame(['language' => 'fi', 'v' => 1, 'toolId' => 'tool1'], $config);
        $this->assertNull(Config::fromApi('404', 'tool1'));
        $this->assertNull(Config::fromApi([], 'tool1'));
        $this->assertNull(Config::fromApi(['a', 'b'], 'tool1'));
    }
}
