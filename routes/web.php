<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return response()->json([
        'app' => 'Normalization Quest Lab',
        'version' => '0.1.0',
        'status' => 'running'
    ]);
});
