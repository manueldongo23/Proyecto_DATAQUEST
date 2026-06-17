<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class LocaleMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $locale = $request->header('X-Locale');

        if (!$locale) {
            $acceptLanguage = $request->header('Accept-Language');
            if ($acceptLanguage) {
                $locales = explode(',', $acceptLanguage);
                $primary = strtolower(trim(explode(';', $locales[0])[0]));

                $locale = match (true) {
                    str_starts_with($primary, 'es') => 'es',
                    str_starts_with($primary, 'en') => 'en',
                    str_starts_with($primary, 'pt') => 'pt_BR',
                    default => 'es',
                };
            }
        }

        if ($locale) {
            $localeMap = [
                'es' => 'es',
                'en' => 'en',
                'pt-BR' => 'pt_BR',
                'pt_BR' => 'pt_BR',
            ];

            $mapped = $localeMap[$locale] ?? 'es';
            app()->setLocale($mapped);
        }

        return $next($request);
    }
}
