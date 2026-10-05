<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch;

use Serviceform\AgenticSearch\Exception\ApiException;

/**
 * Server-side client for the Serviceform AgenticSearch API.
 *
 *     $client = new Client('TOOL_ID');
 *     $result = $client->browse(['q' => 'red shoes', 'perPage' => 24]);
 */
class Client
{
    public const VERSION = '0.1.0';
    public const DEFAULT_API_BASE = 'https://dash.serviceform.com';
    public const TOOL_ID_PATTERN = '/^[A-Za-z0-9_-]{1,128}$/D';
    public const SORTS = [
        'relevance', 'price_asc', 'price_desc', 'year_desc', 'year_asc', 'mileage_asc', 'newest', 'name_asc',
    ];

    /** @var string */
    private $toolId;

    /** @var string */
    private $apiBase;

    /** @var float */
    private $timeout;

    /** @var callable|null */
    private $httpClient;

    /** @var bool */
    private $throw;

    /** @var string|null */
    private $lastError;

    /**
     * @param string               $toolId  The search tool id.
     * @param array<string, mixed> $options `apiBase` (default https://dash.serviceform.com),
     *                                      `timeout` in seconds (default 3),
     *                                      `httpClient` callable
     *                                      `(string $method, string $url, ?string $body, array $headers): array`
     *                                      returning `['status' => int, 'body' => string, 'headers' => array]`
     *                                      (`$headers` is a name => value map),
     *                                      `throw` (default false) to throw ApiException on a failed request.
     * @throws \InvalidArgumentException When the tool id or an option is not usable.
     */
    public function __construct(string $toolId, array $options = [])
    {
        if (!self::isValidToolId($toolId)) {
            throw new \InvalidArgumentException('Invalid Serviceform tool id.');
        }
        $apiBase = isset($options['apiBase']) && is_string($options['apiBase']) && $options['apiBase'] !== ''
            ? $options['apiBase']
            : self::DEFAULT_API_BASE;
        if (!preg_match('#^https?://[^\s/?\#]+#i', $apiBase)) {
            throw new \InvalidArgumentException('apiBase must be an http(s) URL.');
        }
        if (isset($options['httpClient']) && !is_callable($options['httpClient'])) {
            throw new \InvalidArgumentException('httpClient must be callable.');
        }

        $this->toolId = $toolId;
        $this->apiBase = rtrim($apiBase, '/');
        $this->timeout = isset($options['timeout']) && is_numeric($options['timeout']) && $options['timeout'] > 0
            ? (float) $options['timeout']
            : 3.0;
        $this->httpClient = $options['httpClient'] ?? null;
        $this->throw = !empty($options['throw']);
    }

    /**
     * Whether a string is a usable tool id.
     */
    public static function isValidToolId(string $toolId): bool
    {
        return preg_match(self::TOOL_ID_PATTERN, $toolId) === 1;
    }

    /**
     * The tool id this client talks to.
     */
    public function toolId(): string
    {
        return $this->toolId;
    }

    /**
     * The API host, without a trailing slash.
     */
    public function apiBase(): string
    {
        return $this->apiBase;
    }

    /**
     * The message of the last failed request, null when the last one succeeded.
     */
    public function lastError(): ?string
    {
        return $this->lastError;
    }

    /**
     * Instant search (the keystroke dropdown).
     *
     * @param string $q     What the visitor typed.
     * @param int    $limit How many products to return.
     * @return array{products: array, found: int, suggestions: array, understood: mixed}
     *               Products use the readable names. Empty on failure.
     * @throws ApiException Only with the `throw` option.
     */
    public function search(string $q, int $limit = 4): array
    {
        $empty = ['products' => [], 'found' => 0, 'suggestions' => [], 'understood' => null];
        $query = self::buildQuery([['q', $q], ['limit', (string) max(1, $limit)]]);
        $data = $this->guarded('GET', '/api/public/omnibox/search/' . $this->toolId, $query);
        if ($data === null) {
            return $empty;
        }

        return [
            'products' => Hit::listFromWire($data['products'] ?? null),
            'found' => isset($data['found']) && is_numeric($data['found']) ? (int) $data['found'] : 0,
            'suggestions' => isset($data['suggestions']) && is_array($data['suggestions']) ? $data['suggestions'] : [],
            'understood' => $data['understood'] ?? null,
        ];
    }

    /**
     * Full faceted search for a results page.
     *
     * State keys: `q`, `page`, `perPage`, `sort`, `filters` (field => string[]),
     * `ranges` (field => ['min' => , 'max' => ]), `priceMin`, `priceMax`,
     * `inStock`, `kind`, `facets` (string[]), `language`, `fields` (string[]).
     *
     * @param array<string, mixed> $state
     * @return array<string, mixed> `q, page, perPage, found, hasMore, sort, products, facets, ranges, price,
     *                              priceCents, available, state, read, chips, note, dropped, mileageUnit`.
     *                              Products and facets use the readable names. Empty on failure.
     * @throws ApiException Only with the `throw` option.
     */
    public function browse(array $state = []): array
    {
        $data = $this->guarded('GET', '/api/public/omnibox/browse/' . $this->toolId, self::browseQuery($state));
        $page = isset($state['page']) && is_numeric($state['page']) ? max(1, (int) $state['page']) : 1;
        $perPage = isset($state['perPage']) && is_numeric($state['perPage']) ? (int) $state['perPage'] : 0;
        if ($data === null) {
            return [
                'q' => isset($state['q']) && is_scalar($state['q']) ? (string) $state['q'] : '',
                'page' => $page,
                'perPage' => $perPage,
                'found' => 0,
                'hasMore' => false,
                'sort' => isset($state['sort']) && is_string($state['sort']) ? $state['sort'] : 'relevance',
                'products' => [],
                'facets' => [],
                'ranges' => [],
                'price' => null,
                'priceCents' => false,
                'available' => false,
                'state' => null,
                'read' => null,
                'chips' => [],
                'note' => null,
                'dropped' => null,
                'mileageUnit' => null,
            ];
        }

        return [
            'q' => isset($data['q']) && is_scalar($data['q']) ? (string) $data['q'] : '',
            'page' => isset($data['page']) && is_numeric($data['page']) ? (int) $data['page'] : $page,
            'perPage' => isset($data['per_page']) && is_numeric($data['per_page']) ? (int) $data['per_page'] : $perPage,
            'found' => isset($data['found']) && is_numeric($data['found']) ? (int) $data['found'] : 0,
            'hasMore' => !empty($data['has_more']),
            'sort' => isset($data['sort']) && is_string($data['sort']) ? $data['sort'] : 'relevance',
            'products' => Hit::listFromWire($data['products'] ?? null),
            'facets' => Hit::facetsFromWire($data['facets'] ?? null),
            'ranges' => isset($data['ranges']) && is_array($data['ranges']) ? $data['ranges'] : [],
            'price' => isset($data['price']) && is_array($data['price']) ? $data['price'] : null,
            'priceCents' => !empty($data['price_cents']),
            'available' => !array_key_exists('available', $data) || !empty($data['available']),
            'state' => $data['state'] ?? null,
            'read' => $data['read'] ?? null,
            'chips' => isset($data['chips']) && is_array($data['chips']) ? $data['chips'] : [],
            'note' => $data['note'] ?? null,
            'dropped' => $data['dropped'] ?? null,
            'mileageUnit' => $data['mileage_unit'] ?? null,
        ];
    }

    /**
     * Ask the AI a question.
     *
     * @param string               $question What the visitor asked.
     * @param array<string, mixed> $options  Optional `history`, `previous`, `shown`, `userId`, `pageUrl`, `testMode`.
     * @return array<string, mixed> `answer, intent, products, links, facets, filters, chips, adopt, note, dropped,
     *                              language, continued`. Products and facets use the readable names.
     *                              An empty answer on failure.
     * @throws ApiException Only with the `throw` option.
     */
    public function ask(string $question, array $options = []): array
    {
        $payload = ['q' => $question];
        foreach (['history', 'previous', 'shown', 'userId', 'pageUrl', 'testMode'] as $key) {
            if (isset($options[$key])) {
                $payload[$key] = $options[$key];
            }
        }
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
        $data = $this->guarded('POST', '/api/public/omnibox/ask/' . $this->toolId, '', $body === false ? '{}' : $body);
        if ($data === null) {
            $data = [];
        }

        return [
            'answer' => isset($data['answer']) && is_string($data['answer']) ? $data['answer'] : '',
            'intent' => $data['intent'] ?? null,
            'products' => Hit::listFromWire($data['products'] ?? null),
            'links' => isset($data['links']) && is_array($data['links']) ? $data['links'] : [],
            'facets' => Hit::facetsFromWire($data['facets'] ?? null),
            'filters' => $data['filters'] ?? null,
            'chips' => isset($data['chips']) && is_array($data['chips']) ? $data['chips'] : [],
            'adopt' => $data['adopt'] ?? null,
            'note' => $data['note'] ?? null,
            'dropped' => $data['dropped'] ?? null,
            'language' => $data['language'] ?? null,
            'continued' => !empty($data['continued']),
        ];
    }

    /**
     * Load the tool's settings (contract section 4). Tries the config endpoint
     * and, on servers that do not have it yet (404), the full tool document
     * mapped down by Config::fromToolDoc().
     *
     * @return array<string, mixed>|null Null when the tool is missing or the request failed.
     * @throws ApiException Only with the `throw` option.
     */
    public function config(): ?array
    {
        $this->lastError = null;
        try {
            return $this->fetchConfig();
        } catch (ApiException $e) {
            $this->lastError = $e->getMessage();
            if ($this->throw) {
                throw $e;
            }
            return null;
        }
    }

    /**
     * Settings through a cache: fresh for `$ttl` seconds, refreshed after that,
     * and the stale copy is served (for up to `$staleTtl` seconds) when the
     * refresh fails. Never throws.
     *
     * @param CacheInterface $cache    FileCache, CallableCache or your own.
     * @param int            $ttl      Seconds settings count as fresh (default 6 hours).
     * @param int            $staleTtl Seconds a stale copy may be served (default 7 days).
     * @return array<string, mixed>|null
     */
    public function cachedConfig(CacheInterface $cache, int $ttl = 21600, int $staleTtl = 604800): ?array
    {
        $key = 'sfas_cfg_' . md5($this->apiBase . '|' . $this->toolId);

        return (new ConfigCache($cache, $ttl, $staleTtl))->remember($key, function (): ?array {
            return $this->fetchConfig();
        });
    }

    /**
     * Build the browse query string exactly as the API expects it:
     * `q, page, per_page, sort, f.FIELD=a|b, r.FIELD=min|max, price_min, price_max, in_stock=1, k, facets, lang, fields`,
     * with fields in sorted order, empty values left out and everything rawurlencoded.
     *
     * @param array<string, mixed> $state See browse().
     * @return string The query string without a leading "?".
     */
    public static function browseQuery(array $state): string
    {
        $pairs = [];
        if (isset($state['q']) && is_scalar($state['q']) && trim((string) $state['q']) !== '') {
            $pairs[] = ['q', trim((string) $state['q'])];
        }
        if (isset($state['page']) && is_numeric($state['page']) && (int) $state['page'] > 1) {
            $pairs[] = ['page', (string) (int) $state['page']];
        }
        if (isset($state['perPage']) && is_numeric($state['perPage']) && (int) $state['perPage'] > 0) {
            $pairs[] = ['per_page', (string) min(48, (int) $state['perPage'])];
        }
        if (isset($state['sort']) && is_string($state['sort']) && $state['sort'] !== ''
            && $state['sort'] !== 'relevance') {
            $pairs[] = ['sort', $state['sort']];
        }

        $filters = isset($state['filters']) && is_array($state['filters']) ? $state['filters'] : [];
        ksort($filters, SORT_STRING);
        foreach ($filters as $field => $values) {
            $values = self::stringList($values);
            if ((string) $field !== '' && $values !== []) {
                $pairs[] = ['f.' . $field, implode('|', $values)];
            }
        }

        $ranges = isset($state['ranges']) && is_array($state['ranges']) ? $state['ranges'] : [];
        ksort($ranges, SORT_STRING);
        foreach ($ranges as $field => $range) {
            if ((string) $field === '' || !is_array($range)) {
                continue;
            }
            $min = self::number($range['min'] ?? null);
            $max = self::number($range['max'] ?? null);
            if ($min !== '' || $max !== '') {
                $pairs[] = ['r.' . $field, $min . '|' . $max];
            }
        }

        $priceMin = self::number($state['priceMin'] ?? null);
        if ($priceMin !== '') {
            $pairs[] = ['price_min', $priceMin];
        }
        $priceMax = self::number($state['priceMax'] ?? null);
        if ($priceMax !== '') {
            $pairs[] = ['price_max', $priceMax];
        }
        if (!empty($state['inStock'])) {
            $pairs[] = ['in_stock', '1'];
        }
        if (isset($state['kind']) && is_scalar($state['kind']) && (string) $state['kind'] !== '') {
            $pairs[] = ['k', (string) $state['kind']];
        }
        $facets = self::stringList($state['facets'] ?? null);
        if ($facets !== []) {
            $pairs[] = ['facets', implode(',', $facets)];
        }
        if (isset($state['language']) && is_string($state['language']) && $state['language'] !== '') {
            $pairs[] = ['lang', $state['language']];
        }
        $fields = self::stringList($state['fields'] ?? null);
        if ($fields !== []) {
            $pairs[] = ['fields', implode(',', $fields)];
        }

        return self::buildQuery($pairs);
    }

    /**
     * The settings request with its 404 fallback; throws on failure.
     *
     * @return array<string, mixed>|null Null when the tool does not exist.
     * @throws ApiException
     */
    private function fetchConfig(): ?array
    {
        try {
            $data = $this->request('GET', '/api/public/omnibox/config/' . $this->toolId, '');
            return Config::fromApi($data, $this->toolId);
        } catch (ApiException $e) {
            if ($e->getStatus() !== 404) {
                throw $e;
            }
        }

        try {
            $doc = $this->request('GET', '/api/public/tid/' . $this->toolId, '');
        } catch (ApiException $e) {
            if (in_array($e->getStatus(), [401, 404], true)) {
                return null;
            }
            throw $e;
        }
        // The tool endpoint answers a missing tool with the JSON string "404".
        if (!is_array($doc) || $doc === []) {
            return null;
        }

        return Config::fromToolDoc($doc, $this->toolId);
    }

    /**
     * A request that returns null on failure unless the `throw` option is set.
     *
     * @return array<mixed>|null
     * @throws ApiException Only with the `throw` option.
     */
    private function guarded(string $method, string $path, string $query, ?string $body = null): ?array
    {
        $this->lastError = null;
        try {
            $data = $this->request($method, $path, $query, $body);
            if (!is_array($data)) {
                throw new ApiException('Unexpected response from ' . $path, 200, $this->apiBase . $path);
            }
            return $data;
        } catch (ApiException $e) {
            $this->lastError = $e->getMessage();
            if ($this->throw) {
                throw $e;
            }
            return null;
        }
    }

    /**
     * Send one request and decode the JSON answer.
     *
     * @return mixed The decoded body.
     * @throws ApiException On a transport error, a non-2xx status or invalid JSON.
     */
    private function request(string $method, string $path, string $query, ?string $body = null)
    {
        $sdk = 'sdk=' . rawurlencode('agenticsearch-php@' . self::VERSION);
        $url = $this->apiBase . $path . '?' . ($query !== '' ? $query . '&' : '') . $sdk;
        $headers = ['Accept' => 'application/json', 'User-Agent' => 'agenticsearch-php/' . self::VERSION];
        if ($body !== null) {
            $headers['Content-Type'] = 'application/json';
        }

        try {
            $response = $this->httpClient !== null
                ? ($this->httpClient)($method, $url, $body, $headers)
                : $this->send($method, $url, $body, $headers);
        } catch (ApiException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw new ApiException('Request failed: ' . $e->getMessage(), 0, $url, $e);
        }

        $status = is_array($response) && isset($response['status']) ? (int) $response['status'] : 0;
        if ($status < 200 || $status >= 300) {
            throw new ApiException(
                $status === 0 ? 'Request failed: no response' : 'Request failed with HTTP ' . $status,
                $status,
                $url
            );
        }
        $raw = isset($response['body']) && is_string($response['body']) ? $response['body'] : '';
        $data = json_decode($raw, true);
        if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
            throw new ApiException('Response is not valid JSON', $status, $url);
        }

        return $data;
    }

    /**
     * The built-in transport: cURL when the extension is loaded, PHP streams otherwise.
     *
     * @param array<string, string> $headers
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    private function send(string $method, string $url, ?string $body, array $headers): array
    {
        $lines = [];
        foreach ($headers as $name => $value) {
            $lines[] = $name . ': ' . $value;
        }

        if (function_exists('curl_init')) {
            $responseHeaders = [];
            $ch = curl_init($url);
            $timeoutMs = (int) ceil($this->timeout * 1000);
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST => $method,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_HTTPHEADER => $lines,
                CURLOPT_TIMEOUT_MS => $timeoutMs,
                CURLOPT_CONNECTTIMEOUT_MS => $timeoutMs,
                CURLOPT_NOSIGNAL => true,
                CURLOPT_ENCODING => '',
                CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$responseHeaders): int {
                    $parts = explode(':', $line, 2);
                    if (count($parts) === 2) {
                        $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                    }
                    return strlen($line);
                },
            ]);
            if ($body !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            }
            $raw = curl_exec($ch);
            if ($raw === false) {
                throw new ApiException('Request failed: ' . curl_error($ch), 0, $url);
            }

            return [
                'status' => (int) curl_getinfo($ch, CURLINFO_HTTP_CODE),
                'body' => (string) $raw,
                'headers' => $responseHeaders,
            ];
        }

        $context = stream_context_create(['http' => [
            'method' => $method,
            'header' => implode("\r\n", $lines),
            'content' => $body === null ? '' : $body,
            'timeout' => $this->timeout,
            'ignore_errors' => true,
            'follow_location' => 0,
        ]]);
        $raw = @file_get_contents($url, false, $context);
        if ($raw === false) {
            throw new ApiException('Request failed: no response', 0, $url);
        }
        $headerLines = function_exists('http_get_last_response_headers')
            ? (http_get_last_response_headers() ?: [])
            : ($http_response_header ?? []);
        $status = 0;
        $responseHeaders = [];
        foreach ($headerLines as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
                $status = (int) $m[1];
                continue;
            }
            $parts = explode(':', $line, 2);
            if (count($parts) === 2) {
                $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
        }

        return ['status' => $status, 'body' => $raw, 'headers' => $responseHeaders];
    }

    /**
     * Join name/value pairs into a rawurlencoded query string.
     *
     * @param array<int, array{0: string, 1: string}> $pairs
     */
    private static function buildQuery(array $pairs): string
    {
        $parts = [];
        foreach ($pairs as $pair) {
            $parts[] = rawurlencode((string) $pair[0]) . '=' . rawurlencode((string) $pair[1]);
        }

        return implode('&', $parts);
    }

    /**
     * A clean list of non-empty strings from a list (or a single scalar).
     *
     * @param mixed $values
     * @return string[]
     */
    private static function stringList($values): array
    {
        if (is_scalar($values)) {
            $values = [$values];
        }
        $out = [];
        if (is_array($values)) {
            foreach ($values as $value) {
                if (is_scalar($value) && !is_bool($value) && trim((string) $value) !== '') {
                    $out[] = trim((string) $value);
                }
            }
        }

        return array_values(array_unique($out));
    }

    /**
     * A number as the API reads it, or '' when the value is not a number.
     *
     * @param mixed $value
     */
    private static function number($value): string
    {
        if (is_string($value)) {
            $value = trim($value);
        }
        if ($value === null || $value === '' || is_bool($value) || !is_numeric($value)) {
            return '';
        }
        $number = (float) $value;
        if (is_nan($number) || is_infinite($number)) {
            return '';
        }

        return $number == floor($number) && abs($number) < 1e15 ? (string) (int) $number : rtrim(rtrim(sprintf('%.6F', $number), '0'), '.');
    }
}
