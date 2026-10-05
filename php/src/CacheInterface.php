<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch;

/**
 * The minimal cache the SDK needs: arrays in, arrays out.
 */
interface CacheInterface
{
    /**
     * Read an entry.
     *
     * @param string $key
     * @return array<string, mixed>|null Null when missing or expired.
     */
    public function get(string $key): ?array;

    /**
     * Store an entry for at most `$ttl` seconds.
     *
     * @param string               $key
     * @param array<string, mixed> $value
     * @param int                  $ttl Seconds the backend may keep the entry.
     * @return bool Whether the entry was stored.
     */
    public function set(string $key, array $value, int $ttl): bool;
}
