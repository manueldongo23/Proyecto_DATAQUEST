<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Log;

class DataProtectionMiddleware
{
    public function handle($request, Closure $next)
    {
        // Registrar acceso a datos personales (Ley 29733)
        if ($request->user() && $request->is('api/admin/*')) {
            Log::channel('privacy')->info('Acceso a datos personales', [
                'admin_id' => $request->user()->id,
                'target_user' => $request->route('user_id'),
                'ip' => $request->ip(),
                'timestamp' => now()
            ]);
        }
        return $next($request);
    }
}
