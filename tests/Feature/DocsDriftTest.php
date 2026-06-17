<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\Route;

class DocsDriftTest extends TestCase
{
    public function test_all_documented_endpoints_exist(): void
    {
        $routes = $this->getRegisteredApiRoutes();
        $documented = $this->parseDocumentedEndpoints();

        $missing = [];
        foreach ($documented as $endpoint) {
            if (!in_array($endpoint, $routes)) {
                $found = false;
                foreach ($routes as $route) {
                    if ($this->routesMatch($endpoint, $route)) {
                        $found = true;
                        break;
                    }
                }
                if (!$found) {
                    $missing[] = $endpoint;
                }
            }
        }

        $this->assertEmpty($missing,
            "Endpoints documentados pero NO implementados:\n" . implode("\n", $missing)
        );
    }

    public function test_all_routes_are_documented(): void
    {
        $routes = $this->getRegisteredApiRoutes();
        $documented = $this->parseDocumentedEndpoints();

        $undocumented = [];
        foreach ($routes as $route) {
            $found = false;
            foreach ($documented as $doc) {
                if ($this->routesMatch($route, $doc)) {
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $undocumented[] = $route;
            }
        }

        $this->assertEmpty($undocumented,
            "Rutas implementadas pero NO documentadas:\n" . implode("\n", $undocumented)
        );
    }

    private function getRegisteredApiRoutes(): array
    {
        $routes = Route::getRoutes();
        $apiRoutes = [];

        foreach ($routes as $route) {
            $uri = $route->uri();
            if (str_starts_with($uri, 'api/') || str_starts_with($uri, 'api/')) {
                $path = preg_replace('#^api/#', '', $uri);
                $methods = $route->methods();
                $httpMethods = array_intersect($methods, ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
                foreach ($httpMethods as $method) {
                    $apiRoutes[] = "$method /$path";
                }
            }
        }

        return array_unique($apiRoutes);
    }

    private function parseDocumentedEndpoints(): array
    {
        $docPath = base_path('API_DOCUMENTATION.md');
        if (!file_exists($docPath)) {
            $this->markTestSkipped('API_DOCUMENTATION.md not found');
        }

        $content = file_get_contents($docPath);
        $endpoints = [];

        preg_match_all('/###\s+(GET|POST|PUT|DELETE|PATCH)\s+`?\/?([a-z0-9\/\-\{\}_.]+)`?/i', $content, $matches, PREG_SET_ORDER);

        foreach ($matches as $match) {
            $method = strtoupper($match[1]);
            $path = $match[2];
            $path = '/' . ltrim($path, '/');
            $endpoints[] = "$method $path";
        }

        return array_unique($endpoints);
    }

    private function routesMatch(string $route1, string $route2): bool
    {
        $normalize = function(string $r): string {
            $parts = explode(' ', $r, 2);
            $path = '/' . trim($parts[1] ?? $parts[0], '/');
            $path = preg_replace('/\{[^}]+\}/', '{param}', $path);
            return $parts[0] . ' ' . $path;
        };

        return $normalize($route1) === $normalize($route2);
    }
}
