<?php

return [
    'warning_threshold_ms' => [
        'small_schema' => 100,
        'medium_schema' => 500,
        'large_schema' => 2000,
    ],
    'schema_sizes' => [
        'small' => 10,
        'medium' => 20,
        'large' => 30,
        'xlarge' => 40,
    ],
    'iterations' => env('BENCHMARK_ITERATIONS', 5),
    'save_results' => env('BENCHMARK_SAVE', storage_path('benchmark')),
];
