<?php

namespace App\Domain\Services;

use App\Models\User;
use App\Models\DominioAprendizaje;
use App\Services\AcademicProgressService;

class GamificationService
{
    private const RANGOS = [
        0 => 'Aprendiz',
        100 => 'Normalizador Junior',
        300 => 'Especialista de Datos',
        600 => 'Maestro de Esquemas',
        1000 => 'Arquitecto Supremo',
        1500 => 'Guardián de la 3FN',
        2500 => 'Doctor en Normalización',
        4000 => 'Legendario del Diseño'
    ];

    public function __construct(
        private AcademicProgressService $progressService
    ) {}

    public function awardXP(User $user, int $xpEarned, array $conceptosAfectados = [])
    {
        $user->xp += $xpEarned;
        
        // Calcular rango
        $nuevoRango = 'Aprendiz';
        foreach (self::RANGOS as $minXp => $rango) {
            if ($user->xp >= $minXp) {
                $nuevoRango = $rango;
            }
        }
        $user->rango = $nuevoRango;
        $user->save();

        // Actualizar dominios y logros
        $this->progressService->updateProgress($user, end($conceptosAfectados) ?: '1FN', $xpEarned);

        return [
            'xp_total' => $user->xp,
            'xp_earned' => $xpEarned,
            'rango_actual' => $user->rango,
            'proximo_rango' => $this->getNextRank($user->xp),
            'xp_para_siguiente_rango' => $this->xpToNextRank($user->xp),
        ];
    }

    private function getNextRank(int $currentXp): string
    {
        $next = 'Máximo';
        foreach (self::RANGOS as $minXp => $rango) {
            if ($currentXp < $minXp) {
                $next = $rango;
                break;
            }
        }
        return $next;
    }

    private function xpToNextRank(int $currentXp): int
    {
        foreach (self::RANGOS as $minXp => $rango) {
            if ($currentXp < $minXp) {
                return $minXp - $currentXp;
            }
        }
        return 0;
    }
}
