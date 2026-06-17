<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\Route;

class SanityTest extends TestCase
{
    public function test_application_boots(): void
    {
        $this->assertNotNull($this->app);
    }

    public function test_routes_are_registered(): void
    {
        $routes = Route::getRoutes()->getRoutes();
        $this->assertNotEmpty($routes);
    }

    public function test_config_files_are_loadable(): void
    {
        $this->assertNotNull(config('app.name'));
        $this->assertNotNull(config('database.default'));
        $this->assertNotNull(config('cache.default'));
    }
}
