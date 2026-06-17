<?php
return [
    'default' => env('LOG_CHANNEL', 'stack'),
    'channels' => [
        'stack' => [
            'driver' => 'stack',
            'channels' => ['single'],
        ],
        'single' => [
            'driver' => 'single',
            'path' => storage_path('logs/laravel.log'),
            'level' => env('LOG_LEVEL', 'debug'),
        ],
        'cache' => [
            'driver' => 'single',
            'path' => storage_path('logs/cache.log'),
            'level' => 'debug',
        ],
        'audit' => [
            'driver' => 'single',
            'path' => storage_path('logs/audit.log'),
            'level' => 'info',
        ],
        'security' => [
            'driver' => 'single',
            'path' => storage_path('logs/security.log'),
            'level' => 'info',
        ],
        'privacy' => [
            'driver' => 'single',
            'path' => storage_path('logs/privacy.log'),
            'level' => 'info',
        ],
    ],
];
