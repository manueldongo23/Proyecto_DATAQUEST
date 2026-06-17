<?php

namespace App\Console\Commands;

use App\Domain\Services\NormalizationEngine;
use App\Domain\Services\BenchmarkHelper;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;
use Illuminate\Console\Command;

class BenchmarkEngine extends Command
{
    protected $signature = 'benchmark:engine
        {--min-attributes=5 : Minimum number of attributes}
        {--max-attributes=50 : Maximum number of attributes}
        {--step=5 : Attribute count step size}
        {--iterations=3 : Iterations per size}
        {--format=table : Output format (table|json|csv)}';

    protected $description = 'Benchmark the normalization engine performance';

    private NormalizationEngine $engine;

    public function __construct()
    {
        parent::__construct();
        $this->engine = new NormalizationEngine();
    }

    public function handle(): int
    {
        $minAttrs = (int)$this->option('min-attributes');
        $maxAttrs = (int)$this->option('max-attributes');
        $step = (int)$this->option('step');
        $iterations = (int)$this->option('iterations');
        $format = $this->option('format');

        $results = [];

        for ($size = $minAttrs; $size <= $maxAttrs; $size += $step) {
            $this->newLine();
            $this->info("Benchmarking {$size} attributes...");

            $avgResult = $this->benchmarkSize($size, $iterations);
            $results[] = $avgResult;
        }

        $this->outputResults($results, $format);

        return 0;
    }

    private function benchmarkSize(int $numAttributes, int $iterations): array
    {
        $totals = [
            'attributes' => $numAttributes,
            'candidate_keys' => 0,
            'ck_time_ms' => 0,
            'cc_time_ms' => 0,
            'diag_time_ms' => 0,
            'bcnf_time_ms' => 0,
            'lossless_time_ms' => 0,
            'memory_mb' => 0,
            'closures' => 0,
        ];

        for ($i = 0; $i < $iterations; $i++) {
            $schema = $this->generateSchema($numAttributes);

            NormalizationEngine::resetClosureCounter();

            $ckMeasurement = BenchmarkHelper::measure(fn() => $this->engine->findCandidateKeys($schema));
            $closuresAfterCK = BenchmarkHelper::closureCount();

            $ccMeasurement = BenchmarkHelper::measure(fn() => $this->engine->computeCanonicalCover($schema->getFds()));
            $closuresAfterCC = BenchmarkHelper::closureCount() - $closuresAfterCK;

            NormalizationEngine::resetClosureCounter();

            $diagMeasurement = BenchmarkHelper::measure(fn() => $this->engine->diagnoseNormalization($schema));
            $closuresDiag = BenchmarkHelper::closureCount();

            NormalizationEngine::resetClosureCounter();

            $bcnfMeasurement = BenchmarkHelper::measure(fn() => $this->engine->decomposeToBCNF($schema));
            $closuresBCNF = BenchmarkHelper::closureCount();

            NormalizationEngine::resetClosureCounter();

            $decomposition = $this->engine->decomposeToBCNF($schema);
            $losslessMeasurement = BenchmarkHelper::measure(fn() => $this->engine->isLosslessJoin($schema, $decomposition));

            $totals['candidate_keys'] += count($ckMeasurement['result']);
            $totals['ck_time_ms'] += $ckMeasurement['time_ms'];
            $totals['cc_time_ms'] += $ccMeasurement['time_ms'];
            $totals['diag_time_ms'] += $diagMeasurement['time_ms'];
            $totals['bcnf_time_ms'] += $bcnfMeasurement['time_ms'];
            $totals['lossless_time_ms'] += $losslessMeasurement['time_ms'];
            $totals['memory_mb'] += $diagMeasurement['memory_mb'];
            $totals['closures'] += $closuresDiag;
        }

        return [
            'attributes' => $numAttributes,
            'candidate_keys' => round($totals['candidate_keys'] / $iterations, 1),
            'ck_time_ms' => round($totals['ck_time_ms'] / $iterations, 2),
            'cc_time_ms' => round($totals['cc_time_ms'] / $iterations, 2),
            'diag_time_ms' => round($totals['diag_time_ms'] / $iterations, 2),
            'bcnf_time_ms' => round($totals['bcnf_time_ms'] / $iterations, 2),
            'lossless_time_ms' => round($totals['lossless_time_ms'] / $iterations, 2),
            'memory_mb' => round($totals['memory_mb'] / $iterations, 2),
            'closures' => round($totals['closures'] / $iterations, 0),
        ];
    }

    private function generateSchema(int $numAttributes): RelationSchema
    {
        $attributes = [];
        for ($i = 0; $i < $numAttributes; $i++) {
            $attributes[] = chr(65 + ($i % 26)) . ($i >= 26 ? (int)floor($i / 26) : '');
        }

        $fds = [];
        $numFds = (int)($numAttributes * 1.5);

        $fds[] = new FunctionalDependency(
            determinant: [$attributes[0]],
            dependent: array_slice($attributes, 1)
        );

        for ($i = 1; $i < $numFds; $i++) {
            $detSize = rand(1, min(3, $numAttributes - 1));
            $keys = array_flip($attributes);
            $det = (array)array_rand($keys, $detSize);
            $depSize = rand(1, min(3, $numAttributes - count($det)));
            $available = array_diff($attributes, $det);
            if (empty($available)) continue;
            $depKeys = array_flip(array_values($available));
            $dep = (array)array_rand($depKeys, min($depSize, count($available)));
            $fds[] = new FunctionalDependency(determinant: $det, dependent: $dep);
        }

        return new RelationSchema('Benchmark_' . $numAttributes, $attributes, $fds);
    }

    private function outputResults(array $results, string $format): void
    {
        if ($format === 'json') {
            $this->line(json_encode($results, JSON_PRETTY_PRINT));
            return;
        }

        if ($format === 'csv') {
            $headers = ['Attrs', 'Keys', 'CK Time', 'CC Time', 'Diag', 'BCNF', 'Lossless', 'Memory', 'Closures'];
            $this->line(implode(',', $headers));
            foreach ($results as $r) {
                $this->line(implode(',', [
                    $r['attributes'],
                    $r['candidate_keys'],
                    $r['ck_time_ms'] . 'ms',
                    $r['cc_time_ms'] . 'ms',
                    $r['diag_time_ms'] . 'ms',
                    $r['bcnf_time_ms'] . 'ms',
                    $r['lossless_time_ms'] . 'ms',
                    $r['memory_mb'] . 'MB',
                    $r['closures'],
                ]));
            }
            return;
        }

        $headers = ['Attrs', 'Keys', 'CK Time', 'CC Time', 'Diag', 'BCNF', 'Lossless', 'Memory', 'Closures'];
        $rows = [];
        foreach ($results as $r) {
            $rows[] = [
                $r['attributes'],
                $r['candidate_keys'],
                $r['ck_time_ms'] . 'ms',
                $r['cc_time_ms'] . 'ms',
                $r['diag_time_ms'] . 'ms',
                $r['bcnf_time_ms'] . 'ms',
                $r['lossless_time_ms'] . 'ms',
                $r['memory_mb'] . 'MB',
                $r['closures'],
            ];
        }
        $this->table($headers, $rows);
    }
}
