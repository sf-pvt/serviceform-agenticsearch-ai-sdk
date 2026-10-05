<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch;

/**
 * One JSON file per key in a directory. Writes go to a temporary file that is
 * renamed into place, so a reader never sees a half-written entry.
 */
final class FileCache implements CacheInterface
{
    /** @var string */
    private $directory;

    /**
     * @param string $directory Where the cache files live; created when missing.
     */
    public function __construct(string $directory)
    {
        $this->directory = rtrim($directory, '/\\');
    }

    /**
     * {@inheritDoc}
     */
    public function get(string $key): ?array
    {
        $file = $this->path($key);
        if (!is_file($file)) {
            return null;
        }
        $raw = @file_get_contents($file);
        if ($raw === false || $raw === '') {
            return null;
        }
        $entry = json_decode($raw, true);
        if (!is_array($entry) || !isset($entry['expires']) || !isset($entry['value']) || !is_array($entry['value'])) {
            return null;
        }
        if ((int) $entry['expires'] < time()) {
            @unlink($file);
            return null;
        }

        return $entry['value'];
    }

    /**
     * {@inheritDoc}
     */
    public function set(string $key, array $value, int $ttl): bool
    {
        if (!is_dir($this->directory) && !@mkdir($this->directory, 0775, true) && !is_dir($this->directory)) {
            return false;
        }
        $json = json_encode(
            ['expires' => time() + max(1, $ttl), 'value' => $value],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        if ($json === false) {
            return false;
        }
        $tmp = @tempnam($this->directory, 'sfas');
        if ($tmp === false) {
            return false;
        }
        if (@file_put_contents($tmp, $json, LOCK_EX) === false || !@rename($tmp, $this->path($key))) {
            @unlink($tmp);
            return false;
        }

        return true;
    }

    /**
     * The file an entry is stored in.
     */
    private function path(string $key): string
    {
        return $this->directory . DIRECTORY_SEPARATOR . 'sfas-' . sha1($key) . '.json';
    }
}
