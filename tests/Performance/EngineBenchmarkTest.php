<?php

namespace Tests\Performance;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\NormalizationEngine;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class EngineBenchmarkTest extends TestCase
{
    private NormalizationEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = new NormalizationEngine();
    }

    /**
     * @group benchmark
     */
    public function test_small_schema_performance(): void
    {
        $schema = $this->generateSchema(10);
        $start = microtime(true);
        $result = $this->engine->diagnoseNormalization($schema);
        $time = (microtime(true) - $start) * 1000;
        $this->assertLessThan(100, $time, "Small schema took {$time}ms (max 100ms)");
    }

    /**
     * @group benchmark
     */
    public function test_medium_schema_performance(): void
    {
        $schema = $this->generateSchema(20);
        $start = microtime(true);
        $result = $this->engine->diagnoseNormalization($schema);
        $time = (microtime(true) - $start) * 1000;
        $this->assertLessThan(1000, $time, "Medium schema took {$time}ms (max 1000ms)");
    }

    /**
     * @group benchmark
     */
    public function test_canonical_cover_benchmark(): void
    {
        $schema = $this->generateSchema(15);
        $start = microtime(true);
        $cover = $this->engine->computeCanonicalCover($schema->getFds());
        $time = (microtime(true) - $start) * 1000;
        $this->assertLessThan(500, $time, "Canonical cover took {$time}ms (max 500ms)");
        $this->assertIsArray($cover);
    }

    /**
     * @group benchmark
     */
    public function test_bcnf_decomposition_benchmark(): void
    {
        $schema = $this->generateSchema(12);
        $start = microtime(true);
        $result = $this->engine->decomposeToBCNF($schema);
        $time = (microtime(true) - $start) * 1000;
        $this->assertLessThan(500, $time, "BCNF decomposition took {$time}ms (max 500ms)");
        $this->assertIsArray($result);
    }

    private function generateSchema(int $numAttrs): RelationSchema
    {
        $attributes = [];
        for ($i = 0; $i < $numAttrs; $i++) {
            $attributes[] = chr(65 + ($i % 26)) . ($i >= 26 ? (int)floor($i / 26) : '');
        }

        $fds = [];
        $numFds = (int)($numAttrs * 1.5);

        $fds[] = new FunctionalDependency(
            determinant: [$attributes[0]],
            dependent: array_slice($attributes, 1)
        );

        for ($i = 1; $i < $numFds; $i++) {
            $detSize = rand(1, min(3, $numAttrs - 1));
            $keys = array_flip($attributes);
            $det = (array)array_rand($keys, $detSize);
            $depSize = rand(1, min(3, $numAttrs - count($det)));
            $available = array_diff($attributes, $det);
            if (empty($available)) continue;
            $depKeys = array_flip(array_values($available));
            $dep = (array)array_rand($depKeys, min($depSize, count($available)));
            $fds[] = new FunctionalDependency(determinant: $det, dependent: $dep);
        }

        return new RelationSchema('Benchmark_' . $numAttrs, $attributes, $fds);
    }
}
