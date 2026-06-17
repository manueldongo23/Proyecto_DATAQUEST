<?php

return [
    'engine' => [
        'compute_closure' => true,
        'find_candidate_keys' => true,
        'diagnose_normalization' => true,
    ],

    'gamification' => [
        'xp_base_reward' => 50,
        'xp_hint_penalty' => 10,
        'xp_exercise_complete' => 30,
        'xp_validation_complete' => 20,
        'badge_completion_threshold' => 0.8,
    ],

    'academy' => [
        'max_hints_per_exercise' => 3,
        'min_password_length' => 8,
        'exercises_per_nf' => 5,
        'pass_percentage' => 70,
        'mastery_percentage' => 80,
    ],

    'ranks' => [
        ['name' => 'Aprendiz', 'min_xp' => 0, 'max_xp' => 99],
        ['name' => 'Normalizador Junior', 'min_xp' => 100, 'max_xp' => 299],
        ['name' => 'Especialista de Datos', 'min_xp' => 300, 'max_xp' => 599],
        ['name' => 'Maestro de Esquemas', 'min_xp' => 600, 'max_xp' => 999],
        ['name' => 'Arquitecto Supremo', 'min_xp' => 1000, 'max_xp' => 1499],
        ['name' => 'Guardián de la 3FN', 'min_xp' => 1500, 'max_xp' => 2499],
        ['name' => 'Doctor en Normalización', 'min_xp' => 2500, 'max_xp' => 3999],
        ['name' => 'Legendario del Diseño', 'min_xp' => 4000, 'max_xp' => PHP_INT_MAX],
    ],

    'difficulty_levels' => [
        1 => 'Muy Fácil',
        2 => 'Fácil',
        3 => 'Medio',
        4 => 'Difícil',
        5 => 'Muy Difícil',
    ],

    'quests' => [
        'max_attempts_per_day' => 10,
        'xp_perfect_bonus' => 1.5,
        'hint_penalty' => 0.1,
    ],
];
