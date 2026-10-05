<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch\Tests;

/**
 * A scripted httpClient: answers by URL path and records every call.
 */
final class FakeHttp
{
    /** @var array<int, array{method: string, url: string, body: ?string, headers: array}> */
    public $calls = [];

    /** @var array<string, array{0: int, 1: mixed}|callable> */
    private $routes;

    /**
     * @param array<string, array{0: int, 1: mixed}|callable> $routes path fragment => [status, body]
     */
    public function __construct(array $routes = [])
    {
        $this->routes = $routes;
    }

    /**
     * @param array<string, string> $headers
     * @return array{status: int, body: string, headers: array}
     */
    public function __invoke(string $method, string $url, ?string $body, array $headers): array
    {
        $this->calls[] = ['method' => $method, 'url' => $url, 'body' => $body, 'headers' => $headers];
        foreach ($this->routes as $fragment => $answer) {
            if (strpos($url, $fragment) === false) {
                continue;
            }
            if (is_callable($answer)) {
                $answer = $answer($method, $url, $body, $headers);
            }
            $payload = is_string($answer[1]) ? $answer[1] : json_encode($answer[1]);

            return ['status' => $answer[0], 'body' => (string) $payload, 'headers' => []];
        }

        return ['status' => 404, 'body' => '{"error":"not found"}', 'headers' => []];
    }

    /**
     * Replace the routes (to make later calls fail, for instance).
     *
     * @param array<string, array{0: int, 1: mixed}|callable> $routes
     */
    public function routes(array $routes): void
    {
        $this->routes = $routes;
    }
}
