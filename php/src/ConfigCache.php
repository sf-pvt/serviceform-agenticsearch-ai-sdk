<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch;

/**
 * Fresh / stale bookkeeping for cached settings on top of any CacheInterface.
 *
 * An entry is fresh for `$ttl` seconds and is kept for `$staleTtl` seconds so
 * it can still be served when a refresh fails. After a failed refresh the next
 * attempt waits RETRY_AFTER seconds, so a slow or unreachable API costs one
 * timeout per minute rather than one per page view.
 *
 * The storage backends live next to this class: FileCache and CallableCache.
 */
final class ConfigCache
{
    /** Seconds to wait before trying again after a failed refresh. */
    public const RETRY_AFTER = 60;

    /** @var CacheInterface */
    private $cache;

    /** @var int */
    private $ttl;

    /** @var int */
    private $staleTtl;

    /**
     * @param CacheInterface $cache    Storage backend.
     * @param int            $ttl      Seconds settings count as fresh (default 6 hours).
     * @param int            $staleTtl Seconds settings are kept for serving stale (default 7 days).
     */
    public function __construct(CacheInterface $cache, int $ttl = 21600, int $staleTtl = 604800)
    {
        $this->cache = $cache;
        $this->ttl = max(0, $ttl);
        $this->staleTtl = max($this->ttl, $staleTtl, 1);
    }

    /**
     * Return the settings under `$key`, calling `$fetch` when they are missing
     * or older than the ttl. When `$fetch` returns null or throws, the stale
     * copy is served if there is one.
     *
     * @param string   $key   Cache key.
     * @param callable $fetch `fn (): ?array` that loads fresh settings.
     * @return array<string, mixed>|null
     */
    public function remember(string $key, callable $fetch): ?array
    {
        $now = time();
        $entry = $this->cache->get($key);
        $stale = null;
        $storedAt = 0;
        if (is_array($entry) && array_key_exists('config', $entry)) {
            $stale = is_array($entry['config']) ? $entry['config'] : null;
            $storedAt = isset($entry['t']) ? (int) $entry['t'] : 0;
            if ($stale !== null && $now - $storedAt < $this->ttl) {
                return $stale;
            }
            if (isset($entry['retryAt']) && (int) $entry['retryAt'] > $now) {
                return $stale;
            }
        }

        try {
            $fresh = $fetch();
        } catch (\Throwable $e) {
            $fresh = null;
        }

        if (is_array($fresh)) {
            $this->cache->set($key, ['t' => $now, 'config' => $fresh], $this->staleTtl);
            return $fresh;
        }

        $retryAt = $now + self::RETRY_AFTER;
        if ($stale !== null) {
            $left = max(self::RETRY_AFTER, $this->staleTtl - ($now - $storedAt));
            $this->cache->set($key, ['t' => $storedAt, 'config' => $stale, 'retryAt' => $retryAt], $left);
        } else {
            $this->cache->set($key, ['t' => 0, 'config' => null, 'retryAt' => $retryAt], self::RETRY_AFTER);
        }

        return $stale;
    }
}
