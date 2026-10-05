# Serviceform AgenticSearch for PHP

Server-side half of Serviceform AgenticSearch: renders the mount markup with a
pre-rendered shell (no layout shift), inlines cached settings so the first
render needs no settings request, and offers a small client for the search API.
PHP 7.4+, no runtime dependencies (cURL when loaded, PHP streams otherwise).

Made for car sales, real estate, education, e-commerce and site search in general.

## Install

```bash
composer require serviceform/agenticsearch
```

Copy `agenticsearch.js` and `agenticsearch.css` from the JavaScript package's
`dist/` folder to a public directory on your own origin.

## A search box in the header

```php
use Serviceform\AgenticSearch\Renderer;

// In <head>, or anywhere before the closing </body>:
echo Renderer::assets('/assets/agenticsearch', '1.0.0');

// Where the box goes:
echo Renderer::mount([
    'toolId'     => 'YOUR_TOOL_ID',
    'layout'     => 'box',          // box | modal | page | section
    'searchPage' => '/search',      // where "show all results" goes
    'placeholder' => 'Search products',
]);
```

## A search page

```php
echo Renderer::mount([
    'toolId'   => 'YOUR_TOOL_ID',
    'layout'   => 'page',
    'language' => 'fi',
    'perPage'  => 24,
    'facets'   => ['brand', 'price'],   // optional override of the tool's filters
]);
```

Other options: `accent`, `ai` (false turns AI answers off), `searchParam`
(`q` by default), `apiBase`, `id`, `class`, `config`.

Every value is HTML-escaped. URLs are only output when they are http(s) or
root-relative, and `toolId` must match `[A-Za-z0-9_-]{1,128}` (otherwise
`mount()` throws `InvalidArgumentException`).

## Cached settings

Pass the tool's settings as `config` and they are inlined next to the mount
element, so the script renders at once without a settings request.

```php
use Serviceform\AgenticSearch\Client;
use Serviceform\AgenticSearch\FileCache;
use Serviceform\AgenticSearch\Renderer;

$client = new Client('YOUR_TOOL_ID');
$config = $client->cachedConfig(new FileCache(__DIR__ . '/var/cache/agenticsearch'));

echo Renderer::mount([
    'toolId' => 'YOUR_TOOL_ID',
    'layout' => 'box',
    'config' => $config,   // null is fine: the script then loads the settings itself
]);
```

`cachedConfig($cache, $ttl = 21600, $staleTtl = 604800)` serves the cached
copy for six hours, refreshes after that, and keeps serving the old copy for up
to seven days when the refresh fails. After a failed refresh it waits a minute
before trying again, so an unreachable API never slows down every page view.
It never throws.

Any cache works through `CallableCache`:

```php
use Serviceform\AgenticSearch\CallableCache;

$cache = new CallableCache(
    function (string $key) { return apcu_fetch($key); },
    function (string $key, array $value, int $ttl) { return apcu_store($key, $value, $ttl); }
);
```

## Server-rendered first page

Fetch the first page of results on the server and print it as a plain list
inside the page. The script replaces it when it mounts; crawlers and visitors
without JavaScript still get the products.

```php
$query  = isset($_GET['q']) ? (string) $_GET['q'] : '';
$result = $client->browse(['q' => $query, 'perPage' => 24]);

echo Renderer::mount(['toolId' => 'YOUR_TOOL_ID', 'layout' => 'page', 'config' => $config]);
echo '<noscript>' . Renderer::hits($result['products']) . '</noscript>';
```

`browse()` takes `q, page, perPage, sort, filters, ranges, priceMin, priceMax,
inStock, kind, facets, language, fields`:

```php
$result = $client->browse([
    'q'       => 'volvo',
    'sort'    => 'price_asc',
    'filters' => ['brand' => ['Volvo', 'Saab']],
    'ranges'  => ['year' => ['min' => 2018, 'max' => 2022]],
    'inStock' => true,
]);

foreach ($result['products'] as $hit) {
    // title, year, meta, location, price, monthly, url, image, id, brand,
    // priceValue, outOfStock, fields
}
foreach ($result['facets'] as $facet) {
    // ['attribute' => 'brand', 'values' => [['value' => , 'count' => , 'label' => ]]]
}
```

Also available: `search($q, $limit = 4)` for the instant dropdown and
`ask($question, $options = [])` for an AI answer.

A failed request does not throw: you get an empty result (`products` is an
empty array, `config()` is null) and `$client->lastError()` holds the reason.
Pass `'throw' => true` to the constructor to get an
`Serviceform\AgenticSearch\Exception\ApiException` instead.

## Client options

```php
$client = new Client('YOUR_TOOL_ID', [
    'apiBase'    => 'https://dash.serviceform.com', // default
    'timeout'    => 3,                               // seconds, default
    'throw'      => false,                           // default
    'httpClient' => $callable,                       // optional transport
]);
```

`httpClient` is a callable
`(string $method, string $url, ?string $body, array $headers): array` that
returns `['status' => int, 'body' => string, 'headers' => array]`. `$headers`
is a name => value map.

## WordPress

Use the WordPress HTTP API as the transport and transients as the cache:

```php
use Serviceform\AgenticSearch\CallableCache;
use Serviceform\AgenticSearch\Client;
use Serviceform\AgenticSearch\Renderer;

$http = function (string $method, string $url, ?string $body, array $headers): array {
    $response = wp_remote_request($url, [
        'method'  => $method,
        'headers' => $headers,
        'body'    => $body,
        'timeout' => 3,
    ]);
    if (is_wp_error($response)) {
        return ['status' => 0, 'body' => '', 'headers' => []];
    }
    return [
        'status'  => (int) wp_remote_retrieve_response_code($response),
        'body'    => (string) wp_remote_retrieve_body($response),
        'headers' => (array) wp_remote_retrieve_headers($response),
    ];
};

$client = new Client(get_option('sf_agenticsearch_tool_id'), ['httpClient' => $http]);
$config = $client->cachedConfig(new CallableCache('get_transient', 'set_transient'));

add_action('wp_enqueue_scripts', function () {
    $base = plugins_url('assets', __FILE__);
    wp_enqueue_style('sf-agenticsearch', $base . '/agenticsearch.css', [], '1.0.0');
    wp_enqueue_script('sf-agenticsearch', $base . '/agenticsearch.js', [], '1.0.0', ['strategy' => 'defer']);
});

add_shortcode('agenticsearch', function ($atts) use ($client, $config) {
    $atts = shortcode_atts(['layout' => 'box'], $atts);
    return Renderer::mount([
        'toolId'      => $client->toolId(),
        'layout'      => $atts['layout'],
        'searchPage'  => home_url('/'),
        'searchParam' => 's',
        'config'      => $config,
    ]);
});
```

## Tests

```bash
composer install
vendor/bin/phpunit
```
