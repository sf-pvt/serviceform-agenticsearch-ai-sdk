<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch;

/**
 * A cache made of two callables, so WordPress transients, APCu, Redis or a
 * framework cache plug in without an adapter class.
 *
 *     new CallableCache('get_transient', 'set_transient');
 *
 * The getter receives the key and returns the stored array (anything else
 * counts as a miss). The setter receives key, value and ttl in seconds.
 */
final class CallableCache implements CacheInterface
{
    /** @var callable */
    private $getter;

    /** @var callable */
    private $setter;

    /**
     * @param callable $getter `fn (string $key): mixed`
     * @param callable $setter `fn (string $key, array $value, int $ttl): mixed`
     */
    public function __construct(callable $getter, callable $setter)
    {
        $this->getter = $getter;
        $this->setter = $setter;
    }

    /**
     * {@inheritDoc}
     */
    public function get(string $key): ?array
    {
        $value = ($this->getter)($key);

        return is_array($value) ? $value : null;
    }

    /**
     * {@inheritDoc}
     */
    public function set(string $key, array $value, int $ttl): bool
    {
        return ($this->setter)($key, $value, $ttl) !== false;
    }
}
