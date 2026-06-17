<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Cache\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class ApiRateLimiting
{
    public function __construct(protected RateLimiter $limiter) {}

    /**
     * Handle an incoming request with API rate limiting
     * 
     * Limits:
     * - Validation endpoint: 100 requests per minute per user/IP
     * - Login endpoint: 5 requests per minute per IP
     * - Register endpoint: 3 requests per 10 minutes per IP
     * - Default: 60 requests per minute per user/IP
     */
    public function handle(Request $request, Closure $next): Response
    {
        $key = $this->resolveKey($request);
        $limit = $this->getLimit($request);
        $decay = $this->getDecay($request);

        if ($this->limiter->tooManyAttempts($key, $limit)) {
            return response()->json([
                'success' => false,
                'message' => 'Too many requests. Please try again in ' . 
                    $this->limiter->availableIn($key) . ' seconds.',
                'retry_after' => $this->limiter->availableIn($key),
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $this->limiter->hit($key, $decay);

        return $next($request);
    }

    protected function resolveKey(Request $request): string
    {
        $user = $request->user();
        $ip = $request->ip();
        $endpoint = $request->path();

        // Use user ID if authenticated, otherwise use IP
        $identifier = $user ? "user_{$user->id}" : "ip_{$ip}";

        return "api_limit_{$endpoint}_{$identifier}";
    }

    protected function getLimit(Request $request): int
    {
        return match ($request->path()) {
            'api/auth/login' => 5,
            'api/auth/register' => 3,
            'api/validate-schema' => 100,
            default => 60,
        };
    }

    protected function getDecay(Request $request): int
    {
        return match ($request->path()) {
            'api/auth/login' => 60,          // 1 minute
            'api/auth/register' => 600,      // 10 minutes
            'api/validate-schema' => 60,     // 1 minute
            default => 60,                   // 1 minute
        };
    }
}
