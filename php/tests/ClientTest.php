<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch\Tests;

use PHPUnit\Framework\TestCase;
use Serviceform\AgenticSearch\Client;
use Serviceform\AgenticSearch\Exception\ApiException;

final class ClientTest extends TestCase
{
    private const SDK = 'sdk=agenticsearch-php%40' . Client::VERSION;

    public function testRejectsBadToolIdAndApiBase(): void
    {
        try {
            new Client('../tid/other');
            $this->fail('expected an exception');
        } catch (\InvalidArgumentException $e) {
            $this->addToAssertionCount(1);
        }
        $this->expectException(\InvalidArgumentException::class);
        new Client('tool1', ['apiBase' => 'file:///etc/passwd']);
    }

    public function testSearchBuildsUrlAndMapsProducts(): void
    {
        $http = new FakeHttp(['/omnibox/search/tool1' => [200, [
            'products' => [['t' => 'Volvo V60', 'h' => 'https://shop.example/v60', 'p' => '24 900 €']],
            'found' => 12,
            'suggestions' => [['t' => 'volvo v60', 'b' => 'volvo']],
        ]]]);
        $client = new Client('tool1', ['httpClient' => $http, 'apiBase' => 'https://api.example.test/']);

        $result = $client->search('volvo & co', 6);

        $this->assertSame(
            'https://api.example.test/api/public/omnibox/search/tool1?q=volvo%20%26%20co&limit=6&' . self::SDK,
            $http->calls[0]['url']
        );
        $this->assertSame('GET', $http->calls[0]['method']);
        $this->assertNull($http->calls[0]['body']);
        $this->assertSame('application/json', $http->calls[0]['headers']['Accept']);
        $this->assertSame(12, $result['found']);
        $this->assertSame('Volvo V60', $result['products'][0]['title']);
        $this->assertSame('https://shop.example/v60', $result['products'][0]['url']);
        $this->assertSame([['t' => 'volvo v60', 'b' => 'volvo']], $result['suggestions']);
        $this->assertNull($client->lastError());
    }

    public function testBrowseMapsTheAnswer(): void
    {
        $http = new FakeHttp(['/omnibox/browse/tool1' => [200, [
            'q' => 'volvo', 'page' => 2, 'per_page' => 24, 'found' => 30, 'has_more' => false, 'sort' => 'price_asc',
            'products' => [['t' => 'A', 'oos' => true], ['t' => 'B']],
            'facets' => [['field' => 'brand', 'values' => [['v' => 'volvo', 'c' => 30, 'l' => 'Volvo']]]],
            'ranges' => [['field' => 'year', 'min' => 2010, 'max' => 2024]],
            'price' => ['min' => 100, 'max' => 900], 'price_cents' => false, 'available' => true,
            'chips' => [['k' => 'brand:volvo', 'l' => 'Volvo']], 'mileage_unit' => 'km',
        ]]]);
        $client = new Client('tool1', ['httpClient' => $http]);

        $result = $client->browse(['q' => 'volvo', 'page' => 2, 'perPage' => 24, 'filters' => ['brand' => ['volvo']]]);

        $this->assertSame(
            'https://dash.serviceform.com/api/public/omnibox/browse/tool1?q=volvo&page=2&per_page=24&f.brand=volvo&' . self::SDK,
            $http->calls[0]['url']
        );
        $this->assertSame(2, $result['page']);
        $this->assertSame(24, $result['perPage']);
        $this->assertSame(30, $result['found']);
        $this->assertFalse($result['hasMore']);
        $this->assertTrue($result['products'][0]['outOfStock']);
        $this->assertSame('B', $result['products'][1]['title']);
        $this->assertSame('brand', $result['facets'][0]['attribute']);
        $this->assertSame(['value' => 'volvo', 'count' => 30, 'label' => 'Volvo'], $result['facets'][0]['values'][0]);
        $this->assertSame('km', $result['mileageUnit']);
        $this->assertSame(['min' => 100, 'max' => 900], $result['price']);
    }

    public function testBrowseWithNoStateStillCarriesSdk(): void
    {
        $http = new FakeHttp(['/omnibox/browse/tool1' => [200, ['products' => []]]]);
        (new Client('tool1', ['httpClient' => $http]))->browse();

        $this->assertSame('https://dash.serviceform.com/api/public/omnibox/browse/tool1?' . self::SDK, $http->calls[0]['url']);
    }

    public function testAskPostsJson(): void
    {
        $http = new FakeHttp(['/omnibox/ask/tool1' => [200, [
            'answer' => 'Try the V60.', 'intent' => 'product', 'products' => [['t' => 'V60']],
            'links' => [['l' => 'Contact', 'h' => '/contact']], 'language' => 'en', 'continued' => true,
        ]]]);
        $client = new Client('tool1', ['httpClient' => $http]);

        $result = $client->ask('Which estate?', ['pageUrl' => 'https://shop.example/', 'history' => [['q' => 'hi']], 'ignored' => 1]);

        $call = $http->calls[0];
        $this->assertSame('POST', $call['method']);
        $this->assertSame('https://dash.serviceform.com/api/public/omnibox/ask/tool1?' . self::SDK, $call['url']);
        $this->assertSame('application/json', $call['headers']['Content-Type']);
        $this->assertSame(
            ['q' => 'Which estate?', 'history' => [['q' => 'hi']], 'pageUrl' => 'https://shop.example/'],
            json_decode((string) $call['body'], true)
        );
        $this->assertSame('Try the V60.', $result['answer']);
        $this->assertSame('V60', $result['products'][0]['title']);
        $this->assertTrue($result['continued']);
    }

    public function testConfigUsesTheConfigEndpoint(): void
    {
        $http = new FakeHttp(['/omnibox/config/tool1' => [200, ['v' => 1, 'toolId' => 'tool1', 'language' => 'fi', 'pages' => [['t' => 'x']]]]]);
        $config = (new Client('tool1', ['httpClient' => $http]))->config();

        $this->assertSame(['v' => 1, 'toolId' => 'tool1', 'language' => 'fi'], $config);
        $this->assertCount(1, $http->calls);
        $this->assertStringEndsWith('/api/public/omnibox/config/tool1?' . self::SDK, $http->calls[0]['url']);
    }

    public function testConfigFallsBackToTheToolDocOn404(): void
    {
        $http = new FakeHttp([
            '/omnibox/config/tool1' => [404, '{"error":"not found"}'],
            '/api/public/tid/tool1' => [200, ['searchbox' => [
                'language' => 'fi', 'aiEnabled' => false, 'pages' => [['t' => 'a'], ['t' => 'b'], ['t' => 'c']],
            ]]],
        ]);
        $config = (new Client('tool1', ['httpClient' => $http]))->config();

        $this->assertCount(2, $http->calls);
        $this->assertStringContainsString('/api/public/omnibox/config/tool1?', $http->calls[0]['url']);
        $this->assertSame('https://dash.serviceform.com/api/public/tid/tool1?' . self::SDK, $http->calls[1]['url']);
        $this->assertSame('tool1', $config['toolId']);
        $this->assertSame('fi', $config['language']);
        $this->assertFalse($config['ai']);
        $this->assertSame(3, $config['pagesCount']);
        $this->assertArrayNotHasKey('pages', $config);
    }

    public function testConfigIsNullForAMissingTool(): void
    {
        $http = new FakeHttp([
            '/omnibox/config/tool1' => [404, '{}'],
            '/api/public/tid/tool1' => [200, '"404"'],
        ]);
        $this->assertNull((new Client('tool1', ['httpClient' => $http, 'throw' => true]))->config());

        $both = new FakeHttp([]);
        $this->assertNull((new Client('tool1', ['httpClient' => $both]))->config());
        $this->assertCount(2, $both->calls);
    }

    public function testConfigDoesNotFallBackOnServerErrors(): void
    {
        $http = new FakeHttp(['/' => [503, 'unavailable']]);
        $client = new Client('tool1', ['httpClient' => $http]);

        $this->assertNull($client->config());
        $this->assertCount(1, $http->calls);
        $this->assertSame('Request failed with HTTP 503', $client->lastError());
    }

    /**
     * @dataProvider failures
     * @param array{0: int, 1: mixed}|callable $answer
     */
    public function testFailuresReturnEmptyResults($answer): void
    {
        $http = new FakeHttp(['/' => $answer]);
        $client = new Client('tool1', ['httpClient' => $http]);

        $this->assertSame(['products' => [], 'found' => 0, 'suggestions' => [], 'understood' => null], $client->search('x'));
        $this->assertNotNull($client->lastError());

        $browse = $client->browse(['q' => 'x', 'page' => 2, 'perPage' => 12]);
        $this->assertSame([], $browse['products']);
        $this->assertSame([], $browse['facets']);
        $this->assertSame(0, $browse['found']);
        $this->assertFalse($browse['hasMore']);
        $this->assertSame('x', $browse['q']);
        $this->assertSame(2, $browse['page']);

        $this->assertNull($client->config());

        $ask = $client->ask('x');
        $this->assertSame('', $ask['answer']);
        $this->assertSame([], $ask['products']);
    }

    /**
     * @return array<string, array{0: mixed}>
     */
    public function failures(): array
    {
        return [
            'server error' => [[500, '{"error":"boom"}']],
            'html instead of json' => [[200, '<html>gateway</html>']],
            'json string instead of object' => [[200, '"404"']],
            'no response' => [[0, '']],
            'transport throws' => [function () {
                throw new \RuntimeException('timed out');
            }],
        ];
    }

    public function testThrowOptionThrowsApiException(): void
    {
        $http = new FakeHttp(['/' => [502, 'bad gateway']]);
        $client = new Client('tool1', ['httpClient' => $http, 'throw' => true]);

        try {
            $client->browse(['q' => 'x']);
            $this->fail('expected an ApiException');
        } catch (ApiException $e) {
            $this->assertSame(502, $e->getStatus());
            $this->assertStringContainsString('/omnibox/browse/tool1', $e->getUrl());
        }

        $this->expectException(ApiException::class);
        $client->config();
    }

    public function testTransportExceptionIsWrappedWhenThrowing(): void
    {
        $http = new FakeHttp(['/' => function () {
            throw new \RuntimeException('timed out');
        }]);
        $client = new Client('tool1', ['httpClient' => $http, 'throw' => true]);

        try {
            $client->search('x');
            $this->fail('expected an ApiException');
        } catch (ApiException $e) {
            $this->assertSame(0, $e->getStatus());
            $this->assertStringContainsString('timed out', $e->getMessage());
            $this->assertInstanceOf(\RuntimeException::class, $e->getPrevious());
        }
    }
}
