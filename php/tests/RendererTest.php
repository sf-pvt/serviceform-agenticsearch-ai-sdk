<?php

declare(strict_types=1);

namespace Serviceform\AgenticSearch\Tests;

use PHPUnit\Framework\TestCase;
use Serviceform\AgenticSearch\Renderer;

final class RendererTest extends TestCase
{
    public function testBoxMountWithDefaults(): void
    {
        $this->assertSame(
            '<div class="sfas sfas-shell sfas-shell--box" data-sf-agenticsearch data-tool-id="abc_1-2" data-layout="box">'
            . '<div class="sfas-shell-field"><span class="sfas-shell-icon"></span><span class="sfas-shell-text"></span></div>'
            . '</div>',
            Renderer::mount(['toolId' => 'abc_1-2'])
        );
    }

    public function testPageMountCarriesEveryAttributeAndTheGridShell(): void
    {
        $html = Renderer::mount([
            'toolId' => 'abc',
            'layout' => 'page',
            'language' => 'fi-FI',
            'accent' => '#111111',
            'ai' => false,
            'searchPage' => '/search',
            'searchParam' => 's',
            'perPage' => 500,
            'facets' => ['brand', 'price'],
            'placeholder' => 'Search',
            'apiBase' => 'https://dash.serviceform.com/',
            'id' => 'main-search',
            'class' => 'alignwide "bad',
        ]);

        $this->assertStringStartsWith('<div id="main-search" class="sfas sfas-shell sfas-shell--page alignwide" data-sf-agenticsearch', $html);
        foreach ([
            'data-tool-id="abc"', 'data-layout="page"', 'data-language="fi"', 'data-accent="#111111"',
            'data-ai="false"', 'data-search-page="/search"', 'data-search-param="s"', 'data-per-page="48"',
            'data-facets="brand,price"', 'data-placeholder="Search"', 'data-api-base="https://dash.serviceform.com"',
        ] as $attribute) {
            $this->assertStringContainsString(' ' . $attribute, $html);
        }
        $this->assertStringContainsString('<span class="sfas-shell-text">Search</span>', $html);
        $this->assertStringContainsString(
            '<div class="sfas-shell-body"><div class="sfas-shell-side"></div><div class="sfas-shell-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>',
            $html
        );
        $this->assertStringNotContainsString('<script', $html);
    }

    public function testOptionalAttributesAreLeftOutAndBadValuesDropped(): void
    {
        $html = Renderer::mount([
            'toolId' => 'abc',
            'layout' => 'carousel',
            'language' => 'finnish',
            'searchPage' => 'javascript:alert(1)',
            'apiBase' => 'ftp://example.com',
            'id' => '"><script>',
        ]);

        $this->assertStringContainsString('data-layout="box"', $html);
        foreach (['data-language', 'data-search-page', 'data-api-base', 'data-ai', 'data-per-page', ' id=', 'javascript', '<script'] as $absent) {
            $this->assertStringNotContainsString($absent, $html);
        }
    }

    /**
     * @dataProvider badToolIds
     * @param mixed $toolId
     */
    public function testRejectsBadToolIds($toolId): void
    {
        $this->expectException(\InvalidArgumentException::class);
        Renderer::mount(['toolId' => $toolId]);
    }

    /**
     * @return array<string, array{0: mixed}>
     */
    public function badToolIds(): array
    {
        return [
            'quotes and brackets' => ['abc"><script>alert(1)</script>'],
            'space' => ['abc def'],
            'empty' => [''],
            'too long' => [str_repeat('a', 129)],
            'missing' => [null],
            'newline' => ["abc\n"],
        ];
    }

    public function testPlaceholderIsEscapedInAttributeAndShell(): void
    {
        $html = Renderer::mount([
            'toolId' => 'abc',
            'placeholder' => '"><img src=x onerror=alert(1)> \'quoted\' & more',
            'accent' => '" onmouseover="alert(1)',
            'searchParam' => '"><b>',
            'facets' => ['<i>', '"x"'],
        ]);

        $escaped = '&quot;&gt;&lt;img src=x onerror=alert(1)&gt; &#039;quoted&#039; &amp; more';
        $this->assertStringContainsString('data-placeholder="' . $escaped . '"', $html);
        $this->assertStringContainsString('<span class="sfas-shell-text">' . $escaped . '</span>', $html);
        $this->assertStringContainsString('data-accent="&quot; onmouseover=&quot;alert(1)"', $html);
        $this->assertStringContainsString('data-facets="&lt;i&gt;,&quot;x&quot;"', $html);
        $this->assertStringNotContainsString('<img', $html);
        $this->assertStringNotContainsString('<b>', $html);
        $this->assertSame(1, substr_count($html, '<div class="sfas '), 'one mount element');
    }

    public function testInlineConfigCannotCloseTheScriptTag(): void
    {
        $config = [
            'v' => 1,
            'toolId' => 'abc',
            'placeholders' => ['</script><script>alert(1)</script>', 'Etsi tästä'],
            'aiDisclaimer' => "<!-- it's \"quoted\" & more",
            'labels' => [],
            'facetLabels' => ['brand' => 'Merkki'],
            'pages' => [['t' => 'never inline']],
        ];
        $html = Renderer::mount(['toolId' => 'abc', 'config' => $config]);

        $this->assertSame(1, preg_match(
            '#<script type="application/json" data-sf-agenticsearch-config="abc">(.*)</script>$#s',
            $html,
            $m
        ));
        $json = $m[1];
        foreach (['<', '>', '&', "'", '"quoted"', '</script', '<!--'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $json);
        }
        $this->assertStringContainsString('Etsi tästä', $json, 'unicode stays readable');
        $this->assertStringContainsString('"labels":{}', $json, 'empty maps stay objects');
        $this->assertSame(1, substr_count($html, '</script>'));

        $decoded = json_decode($json, true);
        $this->assertSame('</script><script>alert(1)</script>', $decoded['placeholders'][0]);
        $this->assertSame("<!-- it's \"quoted\" & more", $decoded['aiDisclaimer']);
        $this->assertArrayNotHasKey('pages', $decoded);

        // The first placeholder also fills the shell, escaped.
        $this->assertStringContainsString('<span class="sfas-shell-text">&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;</span>', $html);
        $this->assertStringNotContainsString('data-placeholder', $html);
    }

    public function testAssets(): void
    {
        $this->assertSame(
            '<link rel="stylesheet" href="/wp-content/plugins/sf/assets/agenticsearch.css?ver=1.2%203">' . "\n"
            . '<script src="/wp-content/plugins/sf/assets/agenticsearch.js?ver=1.2%203" defer></script>',
            Renderer::assets('/wp-content/plugins/sf/assets/', '1.2 3')
        );
        $this->assertStringContainsString(
            'href="https://cdn.example/a?x=1&amp;y=&quot;/agenticsearch.css"',
            Renderer::assets('https://cdn.example/a?x=1&y="')
        );
    }

    public function testAssetsRejectsUnsafeBase(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        Renderer::assets('javascript:alert(1)//');
    }

    public function testHitsRenderEscapedCards(): void
    {
        $html = Renderer::hits([
            [
                'title' => 'Volvo <b>V60</b>',
                'meta' => '2020 & "clean"',
                'price' => '24 900 €',
                'url' => 'https://shop.example/v60?a=1&b=2',
                'image' => '/img/v60.jpg',
            ],
            ['title' => 'No link', 'url' => 'javascript:alert(1)', 'image' => 'data:image/svg+xml,<svg onload=alert(1)>', 'outOfStock' => true],
            ['t' => 'Wire row', 'h' => '/p/wire', 'p' => '10 €'],
            ['title' => ''],
            'junk',
        ]);

        $this->assertStringStartsWith('<ul class="sfas-hits"><li class="sfas-hit">', $html);
        $this->assertStringEndsWith('</li></ul>', $html);
        $this->assertSame(3, substr_count($html, '<li class="sfas-hit'));
        $this->assertStringContainsString('<a class="sfas-hit-link" href="https://shop.example/v60?a=1&amp;b=2">', $html);
        $this->assertStringContainsString('<img class="sfas-hit-image" src="/img/v60.jpg" alt="" loading="lazy">', $html);
        $this->assertStringContainsString('<span class="sfas-hit-title">Volvo &lt;b&gt;V60&lt;/b&gt;</span>', $html);
        $this->assertStringContainsString('<span class="sfas-hit-meta">2020 &amp; &quot;clean&quot;</span>', $html);
        $this->assertStringContainsString('<span class="sfas-hit-price">24 900 €</span>', $html);
        $this->assertStringContainsString('<li class="sfas-hit sfas-hit--out"><div class="sfas-hit-link"><span class="sfas-hit-title">No link</span></div></li>', $html);
        $this->assertStringContainsString('<a class="sfas-hit-link" href="/p/wire"><span class="sfas-hit-title">Wire row</span>', $html);
        $this->assertStringNotContainsString('javascript:', $html);
        $this->assertStringNotContainsString('data:image', $html);
        $this->assertStringNotContainsString('<b>', $html);
        $this->assertSame('', Renderer::hits([]));
    }

    public function testSafeUrl(): void
    {
        $this->assertSame('https://a.example/x', Renderer::safeUrl(' https://a.example/x '));
        $this->assertSame('HTTP://a.example', Renderer::safeUrl('HTTP://a.example'));
        $this->assertSame('/search?q=1', Renderer::safeUrl('/search?q=1'));
        foreach (['javascript:alert(1)', ' JaVaScRiPt:alert(1)', "java\tscript:alert(1)", 'data:text/html,x', 'vbscript:x', 'search', '', "/a b", "/a\nb"] as $bad) {
            $this->assertSame('', Renderer::safeUrl($bad), $bad);
        }
    }
}
