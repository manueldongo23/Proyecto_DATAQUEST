<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use App\Domain\Entities\RelationSchema;
use Illuminate\Support\Facades\Log;

class ValidationCacheService
{
    private const CACHE_TTL = 3600; // 1 hour in seconds
    private const CACHE_PREFIX = 'normalization_validation:';

    /**
     * Get cached validation result if available
     */
    public function getValidation(RelationSchema $schema): ?array
    {
        $cacheKey = $this->generateCacheKey($schema);
        
        $cached = Cache::get($cacheKey);

        if ($cached) {
            Log::channel('cache')->info('cache_hit', ['key' => $cacheKey]);
        }

        return $cached;
    }

    /**
     * Store validation result in cache
     */
    public function cacheValidation(RelationSchema $schema, array $result): void
    {
        $cacheKey = $this->generateCacheKey($schema);
        
        Cache::put($cacheKey, $result, self::CACHE_TTL);
        
        Log::channel('cache')->info('cache_store', [
            'key' => $cacheKey,
            'ttl' => self::CACHE_TTL
        ]);
    }

    /**
     * Clear cache for specific schema
     */
    public function clearValidation(RelationSchema $schema): void
    {
        $cacheKey = $this->generateCacheKey($schema);
        Cache::forget($cacheKey);
    }

    /**
     * Clear all validation cache
     */
    public function clearAll(): void
    {
        Cache::flush();
    }

    /**
     * Get cache statistics
     */
    public function getStats(): array
    {
        // This would require Redis info command
        return [
            'hit_count' => Cache::get(self::CACHE_PREFIX . 'hits', 0),
            'miss_count' => Cache::get(self::CACHE_PREFIX . 'misses', 0),
        ];
    }

    /**
     * Generate unique cache key from schema
     */
    private function generateCacheKey(RelationSchema $schema): string
    {
        // Create deterministic hash of schema
        $attrs = $schema->attributes;
        sort($attrs);
        $schemaJson = json_encode([
            'table_name' => $schema->name,
            'attributes' => $attrs,
            'dependencies' => $this->normalizeDependencies($schema->dependencies),
        ]);

        $hash = hash('sha256', $schemaJson);
        
        return self::CACHE_PREFIX . $hash;
    }

    /**
     * Normalize dependencies for consistent hashing
     */
    private function normalizeDependencies(array $dependencies): array
    {
        return array_map(function ($dep) {
            $determinant = $dep['determinant'];
            $dependent = $dep['dependent'];
            sort($determinant);
            sort($dependent);
            return [
                'determinant' => $determinant,
                'dependent' => $dependent,
            ];
        }, $dependencies);
    }
}
