<?php

namespace App\Console\Commands;

use App\Domain\Services\NormalizationEngine;
use App\Domain\Services\BenchmarkHelper;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;
use Illuminate\Console\Command;

class BenchmarkComparison extends Command
{
    protected $signature = 'benchmark:compare
        {--baseline= : Path to baseline JSON file}
        {--save= : Path to save results}
        {--attributes=10,20,30,40,50 : Attribute sizes to test}';

    protected $description = 'Compare normalization engine performance against a baseline';

    private NormalizationEngine $engine;

    public function __construct()
    {
        parent::__construct();
        $this->engine = new NormalizationEngine();
    }

    public function handle(): int
    {
        $sizes = array_map('intval', explode(',', $this->option('attributes')));
        $baselinePath = $this->option('baseline');
        $savePath = $this->option('save');

        $results = [];

        foreach ($sizes as $size) {
            $this->newLine();
            $this->info("Benchmarking {$size} attributes...");
            $results[] = $this->runSingleBenchmark($size);
        }

        if ($savePath) {
            $dir = dirname($savePath);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            file_put_contents($savePath, json_encode($results, JSON_PRETTY_PRINT));
            $this->info("Results saved to {$savePath}");
        }

        if ($baselinePath) {
            $this->compareWithBaseline($results, $baselinePath);
        } else {
            $this->outputCurrentResults($results);
        }

        return 0;
    }

    private function runSingleBenchmark(int $numAttributes): array
    {
        $schema = $this->generateSchema($numAttributes);

        NormalizationEngine::resetClosureCounter();

        $ck = BenchmarkHelper::measure(fn() => $this->engine->findCandidateKeys($schema));
        $closuresCK = BenchmarkHelper::closureCount();

        $cc = BenchmarkHelper::measure(fn() => $this->engine->computeCanonicalCover($schema->getFds()));
        $closuresCC = BenchmarkHelper::closureCount() - $closuresCK;

        NormalizationEngine::resetClosureCounter();

        $diag = BenchmarkHelper::measure(fn() => $this->engine->diagnoseNormalization($schema));
        $closuresDiag = BenchmarkHelper::closureCount();

        NormalizationEngine::resetClosureCounter();

        $bcnf = BenchmarkHelper::measure(fn() => $this->engine->decomposeToBCNF($schema));
        $closuresBCNF = BenchmarkHelper::closureCount();
        $decomposition = $bcnf['result'];

        NormalizationEngine::resetClosureCounter();

        $lossless = BenchmarkHelper::measure(fn() => $this->engine->isLosslessJoin($schema, $decomposition));

        return [
            'attributes' => $numAttributes,
            'candidate_keys' => count($ck['result']),
            'ck_time_ms' => $ck['time_ms'],
            'cc_time_ms' => $cc['time_ms'],
            'diag_time_ms' => $diag['time_ms'],
            'bcnf_time_ms' => $bcnf['time_ms'],
            'lossless_time_ms' => $lossless['time_ms'],
            'memory_mb' => $diag['memory_mb'],
            'closure_calls' => $closuresDiag,
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

    private function compareWithBaseline(array $current, string $baselinePath): void
    {
        if (!file_exists($baselinePath)) {
            $this->error("Baseline file not found: {$baselinePath}");
            return;
        }

        $baseline = json_decode(file_get_contents($baselinePath), true);
        if ($baseline === null) {
            $this->error("Invalid baseline JSON");
            return;
        }

        $baselineIndexed = [];
        foreach ($baseline as $b) {
            $baselineIndexed[$b['attributes']] = $b;
        }

        $headers = ['Attrs', 'Metric', 'Baseline', 'Current', 'Change', 'Status'];
        $rows = [];

        $metrics = [
            'ck_time_ms' => 'CK Time',
            'cc_time_ms' => 'CC Time',
            'diag_time_ms' => 'Diag Time',
            'bcnf_time_ms' => 'BCNF Time',
            'lossless_time_ms' => 'Lossless Time',
            'memory_mb' => 'Memory',
        ];

        foreach ($current as $c) {
            $attr = $c['attributes'];
            $base = $baselineIndexed[$attr] ?? null;
            if (!$base) {
                $this->warn("No baseline for {$attr} attributes, skipping.");
                continue;
            }

            foreach ($metrics as $key => $label) {
                $baseVal = $base[$key];
                $currVal = $c[$key];
                $change = $baseVal > 0
                    ? round((($currVal - $baseVal) / $baseVal) * 100, 1) . '%'
                    : 'N/A';
                $isRegression = $baseVal > 0 && $currVal > $baseVal * 1.1;
                $status = $isRegression ? 'REGRESSION' : 'OK';

                $rows[] = [
                    $attr,
                    $label,
                    $baseVal,
                    $currVal,
                    $change,
                    $status,
                ];
            }
        }

        $this->table($headers, $rows);

        $regressions = array_filter($rows, fn($r) => $r[5] === 'REGRESSION');
        if (!empty($regressions)) {
            $this->newLine();
            $this->warn(count($regressions) . ' regressions detected (>10% slowdown)');
        }
    }

    private function outputCurrentResults(array $results): void
    {
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
                $r['closure_calls'],
            ];
        }
        $this->table($headers, $rows);
    }
}
