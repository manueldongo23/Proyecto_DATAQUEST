<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    public function index()
    {
        $status = [
            'app' => 'Normalization Quest Lab',
            'version' => '0.2.0',
            'status' => 'running',
            'timestamp' => now()->toIso8601String(),
            'checks' => []
        ];

        try {
            DB::connection()->getPdo();
            $status['checks']['database'] = 'healthy';
        } catch (\Exception $e) {
            $status['checks']['database'] = 'unhealthy';
            $status['status'] = 'degraded';
        }

        try {
            Cache::store('array')->put('health_check', true, 1);
            $status['checks']['cache'] = 'healthy';
        } catch (\Exception $e) {
            $status['checks']['cache'] = 'unhealthy';
            $status['status'] = 'degraded';
        }

        return response()->json($status);
    }
}
