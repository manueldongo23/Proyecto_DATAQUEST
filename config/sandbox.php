<?php

return [
    'enabled' => env('SANDBOX_ENABLED', true),
    'max_attributes' => 50,
    'max_dependencies' => 100,
    'max_csv_rows' => 1000,
    'max_csv_size' => 524288,
    'rate_limit' => [
        'analyze' => 60,
        'parse_ddl' => 30,
        'import_csv' => 10,
    ],
];
