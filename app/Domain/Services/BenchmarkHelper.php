<?php

namespace App\Domain\Services;

class BenchmarkHelper
{
    public static function measure(callable $fn): array
    {
        $start = hrtime(true);
        $memBefore = memory_get_usage();

        $result = $fn();

        $time = (hrtime(true) - $start) / 1e6;
        $memAfter = memory_get_usage();

        return [
            'time_ms' => round($time, 2),
            'memory_bytes' => $memAfter - $memBefore,
            'memory_mb' => round(($memAfter - $memBefore) / 1024 / 1024, 2),
            'result' => $result,
        ];
    }

    public static function closureCount(): int
    {
        return NormalizationEngine::getClosureCounter();
    }

    public static function formatBytes(int $bytes): string
    {
        if ($bytes >= 1073741824) return round($bytes / 1073741824, 2) . 'GB';
        if ($bytes >= 1048576) return round($bytes / 1048576, 2) . 'MB';
        if ($bytes >= 1024) return round($bytes / 1024, 2) . 'KB';
        return $bytes . 'B';
    }
}
