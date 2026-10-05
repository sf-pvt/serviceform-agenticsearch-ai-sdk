<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch\Tests;

use PHPUnit\Framework\TestCase;
use Serviceform\AgenticSearch\CallableCache;
use Serviceform\AgenticSearch\Client;
use Serviceform\AgenticSearch\ConfigCache;
use Serviceform\AgenticSearch\FileCache;

final class CacheTest extends TestCase
{
    /** @var string */
    private $dir;

    /** @var array<string, array> */
    private $store = [];

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/sfas-test-' . bin2hex(random_bytes(6));
        $this->store = [];
    }

    protected function tearDown(): void
    {
        foreach (glob($this->dir . '/*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($this->dir);
    }

    private function memory(): CallableCache
    {
        return new CallableCache(
            function (string $key) {
                return $this->store[$key] ?? false;
            },
            function (string $key, array $value, int $ttl): bool {
                $this->store[$key] = $value;
                return true;
            }
        );
    }

    private function client(FakeHttp $http): Client
    {
        return new Client('tool1', ['httpClient' => $http]);
    }

    public function testFileCacheRoundTripAndExpiry(): void
    {
        $cache = new FileCache($this->dir . '/nested');
        $this->assertNull($cache->get('k'));
        $this->assertTrue($cache->set('k', ['a' => 'ä', 'n' => [1, 2]], 60));
        $this->assertSame(['a' => 'ä', 'n' => [1, 2]], $cache->get('k'));
        $this->assertNull($cache->get('other'));

        $files = glob($this->dir . '/nested/*');
        $this->assertCount(1, $files, 'no temporary file is left behind');
        file_put_contents($files[0], json_encode(['expires' => time() - 1, 'value' => ['a' => 1]]));
        $this->assertNull($cache->get('k'));
        $this->assertFileDoesNotExist($files[0]);

        @rmdir($this->dir . '/nested');
    }

    public function testFileCacheIgnoresCorruptFiles(): void
    {
        $cache = new FileCache($this->dir);
        $cache->set('k', ['a' => 1], 60);
        $files = glob($this->dir . '/*');
        file_put_contents($files[0], '{half');

        $this->assertNull($cache->get('k'));
    }

    public function testCallableCacheTreatsNonArraysAsMiss(): void
    {
        $cache = $this->memory();
        $this->assertNull($cache->get('missing'));
        $this->assertTrue($cache->set('k', ['a' => 1], 10));
        $this->assertSame(['a' => 1], $cache->get('k'));
    }

    public function testFreshEntryIsServedWithoutARequest(): void
    {
        $http = new FakeHttp(['/omnibox/config/tool1' => [200, ['v' => 1, 'toolId' => 'tool1', 'language' => 'fi']]]);
        $client = $this->client($http);
        $cache = $this->memory();

        $first = $client->cachedConfig($cache);
        $second = $client->cachedConfig($cache);

        $this->assertSame('fi', $first['language']);
        $this->assertSame($first, $second);
        $this->assertCount(1, $http->calls);
    }

    public function testExpiredEntryIsRefreshed(): void
    {
        $http = new FakeHttp(['/omnibox/config/tool1' => [200, ['v' => 1, 'toolId' => 'tool1', 'language' => 'fi']]]);
        $client = $this->client($http);
        $cache = $this->memory();
        $client->cachedConfig($cache);
        $key = array_keys($this->store)[0];
        $this->store[$key]['t'] = time() - 30000;
        $this->store[$key]['config']['language'] = 'old';

        $this->assertSame('fi', $client->cachedConfig($cache)['language']);
        $this->assertCount(2, $http->calls);
        $this->assertSame('fi', $this->store[$key]['config']['language']);
    }

    public function testStaleIsServedOnFailureAndRetriesAreSpaced(): void
    {
        $http = new FakeHttp(['/omnibox/config/tool1' => [200, ['v' => 1, 'toolId' => 'tool1', 'language' => 'fi']]]);
        $client = $this->client($http);
        $cache = $this->memory();
        $client->cachedConfig($cache);
        $key = array_keys($this->store)[0];
        $this->store[$key]['t'] = time() - 30000;
        $http->routes(['/' => [500, 'boom']]);

        $stale = $client->cachedConfig($cache);
        $this->assertSame('fi', $stale['language']);
        $this->assertCount(2, $http->calls);

        $again = $client->cachedConfig($cache);
        $this->assertSame('fi', $again['language']);
        $this->assertCount(2, $http->calls, 'no new request inside the retry window');

        $this->store[$key]['retryAt'] = time() - 1;
        $http->routes(['/omnibox/config/tool1' => [200, ['v' => 1, 'toolId' => 'tool1', 'language' => 'sv']]]);
        $this->assertSame('sv', $client->cachedConfig($cache)['language']);
    }

    public function testFailureWithoutStaleGivesNullAndBacksOff(): void
    {
        $http = new FakeHttp(['/' => function () {
            throw new \RuntimeException('connection refused');
        }]);
        $client = $this->client($http);
        $cache = $this->memory();

        $this->assertNull($client->cachedConfig($cache));
        $this->assertNull($client->cachedConfig($cache));
        $this->assertCount(1, $http->calls);
    }

    public function testWorksWithFileCache(): void
    {
        $http = new FakeHttp(['/omnibox/config/tool1' => [200, ['v' => 1, 'toolId' => 'tool1', 'labels' => []]]]);
        $client = $this->client($http);
        $cache = new FileCache($this->dir);

        $client->cachedConfig($cache, 60, 120);
        $this->assertSame(['v' => 1, 'toolId' => 'tool1', 'labels' => []], $client->cachedConfig($cache, 60, 120));
        $this->assertCount(1, $http->calls);
    }

    public function testRememberSwallowsFetchErrors(): void
    {
        $configCache = new ConfigCache($this->memory(), 10, 100);

        $this->assertNull($configCache->remember('k', function () {
            throw new \RuntimeException('down');
        }));
    }
}
