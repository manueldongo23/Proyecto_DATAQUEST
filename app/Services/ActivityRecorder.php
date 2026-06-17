<?php

namespace App\Services;

use App\Models\Log as SystemLog;

class ActivityRecorder
{
    public function record(?int $userId, string $type, string $message): void
    {
        if (!$userId) {
            return;
        }

        $normalizedType = substr($type, 0, 20);

        try {
            SystemLog::create([
                'tipo' => $normalizedType,
                'mensaje' => $message,
                'user_id' => $userId,
            ]);
        } catch (\Throwable $exception) {
            try {
                SystemLog::create([
                    'tipo' => 'evento',
                    'mensaje' => sprintf('[%s] %s', $normalizedType, $message),
                    'user_id' => $userId,
                ]);
            } catch (\Throwable $nestedException) {
                // No bloqueamos el flujo principal si falla la auditoria.
            }
        }
    }
}
