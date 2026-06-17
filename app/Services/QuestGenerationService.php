<?php

namespace App\Services;

use App\Models\DominioAprendizaje;
use App\Models\Quest;
use App\Models\QuestAttempt;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class QuestGenerationService
{
    public const SOURCE = 'quest-generator';
    public const CATALOG_VERSION = '2026-06';

    public function refreshCatalog(): EloquentCollection
    {
        $blueprints = $this->catalogBlueprints();
        $questKeys = array_map(
            fn (array $blueprint) => $blueprint['quest_key'],
            $blueprints
        );

        return DB::transaction(function () use ($blueprints, $questKeys) {
            $quests = new EloquentCollection();

            foreach ($blueprints as $blueprint) {
                $payload = $this->materializeBlueprint($blueprint);

                $quest = Quest::updateOrCreate(
                    ['quest_key' => $payload['quest_key']],
                    $payload
                );

                $quests->push($quest->fresh());
            }

            if (! empty($questKeys)) {
                Quest::generated()
                    ->whereNotIn('quest_key', $questKeys)
                    ->update(['is_active' => false]);
            }

            return $quests;
        });
    }

    public function ensureCatalog(): EloquentCollection
    {
        $expected = count($this->catalogBlueprints());
        $current = Quest::generated()->active()->count();

        if ($current !== $expected) {
            return $this->refreshCatalog();
        }

        return Quest::generated()
            ->active()
            ->orderBy('catalog_order')
            ->get();
    }

    public function questsForUser(?User $user, ?string $sessionSeed = null, int $limit = 20): Collection
    {
        $this->ensureCatalog();
        $context = $this->buildContext($user, $sessionSeed);

        $sorted = Quest::generated()
            ->active()
            ->get()
            ->map(function (Quest $quest) use ($context) {
                return [
                    'quest' => $quest,
                    'score' => $this->scoreQuest($quest, $context),
                ];
            })
            ->sort(function (array $left, array $right) {
                return $this->compareQuestEntries($left, $right);
            })
            ->values();

        $quotas = $this->buildDifficultyQuotas($limit, $this->targetDifficulty($context));
        $selected = collect();
        $usedQuestIds = [];

        foreach ([1, 2, 3, 4] as $difficultyBucket) {
            $bucketLimit = $quotas[$difficultyBucket] ?? 0;
            if ($bucketLimit <= 0) {
                continue;
            }

            $bucketEntries = $sorted
                ->filter(function (array $entry) use ($difficultyBucket, $usedQuestIds) {
                    return $this->questDifficultyBucket($entry['quest']) === $difficultyBucket
                        && ! isset($usedQuestIds[$entry['quest']->id]);
                })
                ->take($bucketLimit);

            $bucketEntries->each(function (array $entry) use (&$usedQuestIds) {
                $usedQuestIds[$entry['quest']->id] = true;
            });

            $selected = $selected->concat($bucketEntries);
        }

        if ($selected->count() < $limit) {
            $remaining = $sorted
                ->filter(function (array $entry) use ($usedQuestIds) {
                    return ! isset($usedQuestIds[$entry['quest']->id]);
                })
                ->take($limit - $selected->count());

            $remaining->each(function (array $entry) use (&$usedQuestIds) {
                $usedQuestIds[$entry['quest']->id] = true;
            });

            $selected = $selected->concat($remaining);
        }

        return $selected
            ->sort(function (array $left, array $right) {
                return $this->compareQuestEntries($left, $right);
            })
            ->take($limit)
            ->values()
            ->map(function (array $entry) use ($context) {
                return $this->summarizeQuest($entry['quest'], $context, $entry['score']);
            });
    }

    private function compareQuestEntries(array $left, array $right): int
    {
        if ($left['score'] === $right['score']) {
            return ($left['quest']->catalog_order ?? 0) <=> ($right['quest']->catalog_order ?? 0);
        }

        return $right['score'] <=> $left['score'];
    }

    private function questDifficultyBucket(Quest $quest): int
    {
        return max(1, min(4, (int) $quest->difficulty));
    }

    private function buildDifficultyQuotas(int $limit, int $targetDifficulty): array
    {
        $weights = match ($targetDifficulty) {
            1 => [1 => 0.38, 2 => 0.30, 3 => 0.20, 4 => 0.12],
            2 => [1 => 0.25, 2 => 0.35, 3 => 0.25, 4 => 0.15],
            3 => [1 => 0.18, 2 => 0.24, 3 => 0.38, 4 => 0.20],
            4 => [1 => 0.12, 2 => 0.18, 3 => 0.25, 4 => 0.45],
            default => [1 => 0.25, 2 => 0.35, 3 => 0.25, 4 => 0.15],
        };

        $quotas = [];
        $remaining = max(0, $limit);
        foreach ($weights as $difficulty => $weight) {
            $quota = max(0, (int) floor($limit * $weight));
            $quotas[$difficulty] = $quota;
            $remaining -= $quota;
        }

        $sortedWeights = $weights;
        arsort($sortedWeights);
        $priorities = array_keys($sortedWeights);
        $index = 0;

        while ($remaining > 0 && ! empty($priorities)) {
            $difficulty = $priorities[$index % count($priorities)];
            $quotas[$difficulty] = ($quotas[$difficulty] ?? 0) + 1;
            $remaining--;
            $index++;
        }

        return $quotas;
    }

    private function buildContext(?User $user, ?string $sessionSeed): array
    {
        $sessionSeed = $sessionSeed ?: 'default-session';

        $nfOrder = ['DF', '1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'];
        $progress = array_fill_keys($nfOrder, 0);

        $dominios = collect();
        $completedQuestKeys = collect();
        $attemptedQuestKeys = collect();
        $completedCount = 0;
        $xp = 0;

        if ($user) {
            $xp = (int) $user->xp;
            $dominios = DominioAprendizaje::where('user_id', $user->id)->get()->keyBy('concepto');

            $progress['DF'] = (int) ($dominios->get('DF')?->porcentaje ?? 0);
            $progress['1FN'] = (int) ($dominios->get('1FN')?->porcentaje ?? 0);
            $progress['2FN'] = (int) ($dominios->get('2FN')?->porcentaje ?? 0);
            $progress['3FN'] = (int) ($dominios->get('3FN')?->porcentaje ?? 0);
            $progress['BCNF'] = (int) ($dominios->get('BCNF')?->porcentaje ?? 0);
            $progress['4FN'] = (int) ($dominios->get('4FN')?->porcentaje ?? 0);
            $progress['5FN'] = (int) ($dominios->get('5FN')?->porcentaje ?? 0);

            $attempts = QuestAttempt::where('user_id', $user->id)
                ->with('quest:id,quest_key')
                ->get();

            $completedCount = $attempts->where('status', 'completed')->count();
            $completedQuestKeys = $attempts
                ->where('status', 'completed')
                ->pluck('quest.quest_key')
                ->filter()
                ->values();
            $attemptedQuestKeys = $attempts
                ->pluck('quest.quest_key')
                ->filter()
                ->values()
                ->unique()
                ->values();
        }

        $focusOrder = collect($nfOrder)
            ->sortBy(fn (string $nf) => $progress[$nf] ?? 0)
            ->values()
            ->all();

        $signature = collect($nfOrder)
            ->map(fn (string $nf) => $nf . ':' . ($progress[$nf] ?? 0))
            ->implode('|');

        return [
            'session_seed' => $sessionSeed,
            'progress_signature' => $signature,
            'nf_progress' => $progress,
            'focus_order' => $focusOrder,
            'weakest_nf' => $focusOrder[0] ?? '1FN',
            'xp' => $xp,
            'completed_count' => $completedCount,
            'completed_quest_keys' => $completedQuestKeys,
            'attempted_quest_keys' => $attemptedQuestKeys,
        ];
    }

    private function scoreQuest(Quest $quest, array $context): int
    {
        $nf = strtoupper((string) $quest->nf_requirement);
        $progress = (int) ($context['nf_progress'][$nf] ?? 0);
        $focusOrder = $context['focus_order'] ?? [];
        $focusIndex = array_search($nf, $focusOrder, true);

        $focusBoost = match (true) {
            $focusIndex === 0 => 150,
            $focusIndex === 1 => 120,
            $focusIndex === 2 => 90,
            default => 40,
        };

        $difficultyAlignment = max(0, 40 - (abs((int) ($quest->difficulty ?? 1) - $this->targetDifficulty($context)) * 12));
        $sessionJitter = $this->jitter($context['session_seed'] . '|' . $quest->quest_key, 0, 35);
        $completedPenalty = $context['completed_quest_keys']->contains($quest->quest_key) ? 70 : 0;
        $attemptedPenalty = $context['attempted_quest_keys']->contains($quest->quest_key) ? 15 : 0;
        $xpBonus = min(25, (int) floor(($context['xp'] ?? 0) / 250));

        return $focusBoost + $progress + $difficultyAlignment + $sessionJitter + $xpBonus - $completedPenalty - $attemptedPenalty;
    }

    private function targetDifficulty(array $context): int
    {
        $focus = $context['weakest_nf'] ?? '1FN';

        return match ($focus) {
            'DF', '1FN' => 1,
            '2FN' => 2,
            '3FN' => 2,
            'BCNF' => 3,
            '4FN' => 3,
            default => 4,
        };
    }

    private function summarizeQuest(Quest $quest, array $context, int $score): array
    {
        $stage = strtoupper((string) $quest->nf_requirement);
        $readiness = $this->readinessForQuest($quest, $context);

        return [
            'id' => $quest->id,
            'title' => $quest->title,
            'description' => $quest->description,
            'quest_type' => $quest->quest_type,
            'difficulty' => $quest->difficulty,
            'xp_reward' => $quest->xp_reward,
            'nf_requirement' => $quest->nf_requirement,
            'initial_schema_json' => $quest->initial_schema_json,
            'generation_context' => $quest->generation_context,
            'score' => $score,
            'readiness' => $readiness,
            'recommended_nf' => $stage,
        ];
    }

    private function readinessForQuest(Quest $quest, array $context): int
    {
        $nf = strtoupper((string) $quest->nf_requirement);
        $current = (int) ($context['nf_progress'][$nf] ?? 0);

        if ($current > 0) {
            return $current;
        }

        return match ($nf) {
            'DF' => 10,
            '1FN' => 24,
            '2FN' => 18,
            '3FN' => 12,
            'BCNF' => 8,
            '4FN' => 5,
            '5FN' => 2,
            default => 0,
        };
    }

    private function catalogBlueprints(): array
    {
        $blueprints = [];
        $catalogOrder = 1;
        $themes = array_keys($this->themePacks());

        foreach ($this->catalogTracks() as $trackKey => $track) {
            foreach ($themes as $themeIndex => $themeKey) {
                for ($variant = 1; $variant <= 10; $variant++) {
                    $nf = $track['nfs'][($themeIndex + $variant - 1) % count($track['nfs'])];
                    $questType = $track['quest_types'][($themeIndex * 10 + $variant - 1) % count($track['quest_types'])];

                    $blueprints[] = [
                        'quest_key' => $this->questKey($trackKey, $themeKey, $nf, $variant, $catalogOrder),
                        'nf' => $nf,
                        'difficulty' => $track['difficulty'],
                        'quest_type' => $questType,
                        'theme' => $themeKey,
                        'variant' => $variant,
                        'catalog_order' => $catalogOrder,
                        'track' => $trackKey,
                        'special_event' => in_array($questType, ['evento', 'maraton'], true),
                    ];

                    $catalogOrder++;
                }
            }
        }

        return $blueprints;
    }

    private function catalogTracks(): array
    {
        return [
            'basico' => [
                'difficulty' => 1,
                'nfs' => ['1FN'],
                'quest_types' => ['puzzle', 'reto', 'diagnostico', 'repaso'],
            ],
            'intermedio' => [
                'difficulty' => 2,
                'nfs' => ['2FN', '3FN'],
                'quest_types' => ['reto', 'examen', 'diagnostico', 'repaso'],
            ],
            'avanzado' => [
                'difficulty' => 3,
                'nfs' => ['BCNF', '4FN'],
                'quest_types' => ['examen', 'reto', 'evento'],
            ],
            'experto' => [
                'difficulty' => 4,
                'nfs' => ['4FN', '5FN'],
                'quest_types' => ['examen', 'evento', 'maraton'],
            ],
        ];
    }

    private function materializeBlueprint(array $blueprint): array
    {
        $theme = $this->themePacks()[$blueprint['theme']] ?? $this->themePacks()['ventas'];
        $nf = $blueprint['nf'];
        $variant = (int) $blueprint['variant'];

        $payload = match ($nf) {
            '1FN' => $this->buildFirstFnQuest($theme, $blueprint),
            '2FN' => $this->buildSecondFnQuest($theme, $blueprint),
            '3FN' => $this->buildThirdFnQuest($theme, $blueprint),
            'BCNF' => $this->buildBcnfQuest($theme, $blueprint),
            '4FN' => $this->buildFourthFnQuest($theme, $blueprint),
            '5FN' => $this->buildFifthFnQuest($theme, $blueprint),
            default => $this->buildFirstFnQuest($theme, $blueprint),
        };

        $payload['quest_key'] = $blueprint['quest_key'];
        $payload['generation_source'] = self::SOURCE;
        $payload['catalog_order'] = (int) $blueprint['catalog_order'];
        $payload['generation_context'] = [
            'version' => self::CATALOG_VERSION,
            'theme' => $blueprint['theme'],
            'nf' => $nf,
            'variant' => $variant,
            'quest_type' => $blueprint['quest_type'],
            'catalog_order' => (int) $blueprint['catalog_order'],
            'track' => $blueprint['track'] ?? null,
            'special_event' => (bool) ($blueprint['special_event'] ?? false),
        ];

        return $payload;
    }

    private function buildFirstFnQuest(array $theme, array $blueprint): array
    {
        $root = $theme['root'];
        $entity = $theme['entity'];
        $multi = $theme['multi'];
        $rootTable = $this->tableName($root['plural']);
        $variant = (int) $blueprint['variant'];

        $titleTemplates = [
            'Identifica la clave primaria en %s',
            'Atomiza %s sin perder contexto',
            'Limpia atributos multivalorados de %s',
            'Normaliza %s para dejarla en 1FN',
            'Elimina grupos repetidos de %s',
            'Reformula %s con celdas atomicas',
            'Separa valores repetidos en %s',
            'Ajusta %s para cumplir atomicidad',
            'Revisa claves y atributos de %s',
            'Deja %s lista para 1FN',
        ];

        $descriptionTemplates = [
            'Encuentra valores repetidos y conviertelos en tablas atomicas.',
            'Revisa si %s mezcla varios hechos en una sola fila.',
            'Asegura que cada celda guarde un unico valor y nada mas.',
            'Separa los multivalores antes de seguir con mas formas normales.',
            'Convierte el esquema de %s en una base limpia y utilizable.',
            'Reordena el modelo para eliminar listas y grupos repetidos.',
            'Define una estructura simple, clara y preparada para validar.',
            'Detecta atributos no atomicos y reubicalos en tablas hijas.',
            'Ajusta la base para que la validacion de 1FN sea inmediata.',
            'Deja %s lista para crecer sin duplicidad inutil.',
        ];

        $mainAttributes = [
            $this->attribute('id', $root['singular']),
            $this->attribute('nombre', $entity['singular']),
        ];

        $multivaluedAttributes = array_map(
            fn (array $item) => $item['plural'],
            $multi
        );

        $solutionTables = [
            [
                'nombre' => $rootTable,
                'atributos' => $mainAttributes,
            ],
        ];

        foreach ($multi as $item) {
            $solutionTables[] = [
                'nombre' => $this->tableName([$item['plural'], $root['singular']]),
                'atributos' => [
                    $this->attribute('id', $root['singular']),
                    $item['singular'],
                ],
            ];
        }

        return [
            'title' => sprintf($titleTemplates[($variant - 1) % count($titleTemplates)], $theme['label']),
            'description' => sprintf($descriptionTemplates[($variant - 1) % count($descriptionTemplates)], $theme['label']),
            'quest_type' => $blueprint['quest_type'],
            'difficulty' => (int) $blueprint['difficulty'],
            'xp_reward' => $this->xpReward('1FN', (int) $blueprint['difficulty'], (int) $blueprint['catalog_order']),
            'nf_requirement' => '1FN',
            'initial_schema_json' => [
                'tema' => $theme['label'],
                'objetivo' => '1FN',
                'tablas' => [
                    [
                        'nombre' => $rootTable,
                        'atributos' => array_merge($mainAttributes, $multivaluedAttributes),
                    ],
                ],
                'dependencias' => array_merge(
                    [
                        $this->attribute('id', $root['singular']) . ' -> ' . $this->attribute('nombre', $entity['singular']),
                    ],
                    array_map(
                        fn (string $attr) => $this->attribute('id', $root['singular']) . ' -> ' . $attr,
                        $multivaluedAttributes
                    )
                ),
            ],
            'expected_solution_json' => [
                'tablas_normalizadas' => $solutionTables,
            ],
            'is_active' => true,
        ];
    }

    private function buildSecondFnQuest(array $theme, array $blueprint): array
    {
        $root = $theme['root'];
        $entity = $theme['entity'];
        $secondary = $theme['secondary'];
        $rootTable = $this->tableName($root['plural']);
        $entityTable = $this->tableName($entity['plural']);
        $secondaryTable = $this->tableName($secondary['plural']);
        $variant = (int) $blueprint['variant'];

        $titleTemplates = [
            'Rompe dependencias parciales en %s',
            'Ordena la clave compuesta de %s',
            'Lleva %s a 2FN',
            'Separa cabecera y detalle en %s',
            'Elimina atributos que dependen solo de una parte',
            'Ajusta %s para que la clave trabaje completa',
            'Desarma el parcial de %s',
            'Limpia la clave compuesta de %s',
            'Reformula %s con dependencias completas',
            'Convierte %s en un modelo 2FN',
        ];

        $descriptionTemplates = [
            'El esquema de %s usa una clave compuesta y arrastra atributos que dependen solo de una parte.',
            'Separa los datos que dependen parcialmente de la clave compuesta de %s.',
            'Reordena %s para que cada atributo no clave dependa de la clave completa.',
            'Divide la informacion para que ninguna columna quede atada a media clave.',
            'Identifica el detalle que se repite por cada subconjunto de la clave.',
            'Prepara un esquema mas limpio, estable y facil de validar.',
            'Aisla los atributos que no cumplen dependencia completa.',
            'Convierte la composicion en una estructura coherente para 2FN.',
            'Usa claves completas para eliminar redundancias en %s.',
            'Entrega una version sin dependencias parciales y con mejor mantenimiento.',
        ];

        $mainAttributes = [
            $this->attribute('id', $entity['singular']),
            $this->attribute('id', $secondary['singular']),
            $this->attribute('nombre', $entity['singular']),
            $this->attribute('nombre', $secondary['singular']),
            $this->attribute('detalle', $secondary['singular']),
            'nota',
        ];

        return [
            'title' => sprintf($titleTemplates[($variant - 1) % count($titleTemplates)], $theme['label']),
            'description' => sprintf($descriptionTemplates[($variant - 1) % count($descriptionTemplates)], $theme['label']),
            'quest_type' => $blueprint['quest_type'],
            'difficulty' => (int) $blueprint['difficulty'],
            'xp_reward' => $this->xpReward('2FN', (int) $blueprint['difficulty'], (int) $blueprint['catalog_order']),
            'nf_requirement' => '2FN',
            'initial_schema_json' => [
                'tema' => $theme['label'],
                'objetivo' => '2FN',
                'tablas' => [
                    [
                        'nombre' => $rootTable,
                        'atributos' => $mainAttributes,
                    ],
                ],
                'dependencias' => [
                    $this->attribute('id', $entity['singular']) . ', ' . $this->attribute('id', $secondary['singular']) . ' -> nota',
                    $this->attribute('id', $entity['singular']) . ' -> ' . $this->attribute('nombre', $entity['singular']),
                    $this->attribute('id', $secondary['singular']) . ' -> ' . $this->attribute('nombre', $secondary['singular']) . ', ' . $this->attribute('detalle', $secondary['singular']),
                ],
            ],
            'expected_solution_json' => [
                'tablas_normalizadas' => [
                    [
                        'nombre' => $entityTable,
                        'atributos' => [
                            $this->attribute('id', $entity['singular']),
                            $this->attribute('nombre', $entity['singular']),
                        ],
                    ],
                    [
                        'nombre' => $secondaryTable,
                        'atributos' => [
                            $this->attribute('id', $secondary['singular']),
                            $this->attribute('nombre', $secondary['singular']),
                            $this->attribute('detalle', $secondary['singular']),
                        ],
                    ],
                    [
                        'nombre' => $rootTable,
                        'atributos' => [
                            $this->attribute('id', $entity['singular']),
                            $this->attribute('id', $secondary['singular']),
                            'nota',
                        ],
                    ],
                ],
            ],
            'is_active' => true,
        ];
    }

    private function buildThirdFnQuest(array $theme, array $blueprint): array
    {
        $root = $theme['root'];
        $entity = $theme['entity'];
        $catalog = $theme['catalog'];
        $rootTable = $this->tableName($root['plural']);
        $entityTable = $this->tableName($entity['plural']);
        $catalogTable = $this->tableName($catalog['plural']);
        $variant = (int) $blueprint['variant'];

        $titleTemplates = [
            'Elimina dependencias transitivas en %s',
            'Desarma la cadena de dependencias de %s',
            'Lleva %s a 3FN',
            'Separa catalogos y operaciones en %s',
            'Aisla el dato derivado de %s',
            'Limpia la relacion transitiva de %s',
            'Convierte %s en un modelo 3FN',
            'Rompe la redundancia catalogada de %s',
            'Reestructura %s para dependencias directas',
            'Normaliza %s con reglas transitivas claras',
        ];

        $descriptionTemplates = [
            'Las dependencias transitivas de %s siguen mezclando datos de catalogo y operacion.',
            'Separa el catalogo y deja %s sin redundancia transitiva.',
            'Aisla los atributos catalogados de %s para cumplir 3FN.',
            'Busca el dato que depende de otro dato y no de la clave principal.',
            'Convierte referencias indirectas en tablas claras y estables.',
            'Reduce duplicidad y prepara el modelo para consultas limpias.',
            'Elimina la cadena derivada que impide una 3FN real.',
            'Asegura que cada atributo no clave dependa solo de la clave.',
            'Revisa si el catalogo puede vivir como entidad independiente.',
            'Entrega una version apta para validacion tecnica y analitica.',
        ];

        return [
            'title' => sprintf($titleTemplates[($variant - 1) % count($titleTemplates)], $theme['label']),
            'description' => sprintf($descriptionTemplates[($variant - 1) % count($descriptionTemplates)], $theme['label']),
            'quest_type' => $blueprint['quest_type'],
            'difficulty' => (int) $blueprint['difficulty'],
            'xp_reward' => $this->xpReward('3FN', (int) $blueprint['difficulty'], (int) $blueprint['catalog_order']),
            'nf_requirement' => '3FN',
            'initial_schema_json' => [
                'tema' => $theme['label'],
                'objetivo' => '3FN',
                'tablas' => [
                    [
                        'nombre' => $rootTable,
                        'atributos' => [
                            $this->attribute('id', $root['singular']),
                            $this->attribute('id', $entity['singular']),
                            $this->attribute('nombre', $entity['singular']),
                            $this->attribute('id', $catalog['singular']),
                            $this->attribute('nombre', $catalog['singular']),
                            $this->attribute('detalle', $catalog['singular']),
                            'total',
                        ],
                    ],
                ],
                'dependencias' => [
                    $this->attribute('id', $root['singular']) . ' -> ' . $this->attribute('id', $entity['singular']) . ', ' . $this->attribute('id', $catalog['singular']) . ', total',
                    $this->attribute('id', $entity['singular']) . ' -> ' . $this->attribute('nombre', $entity['singular']),
                    $this->attribute('id', $catalog['singular']) . ' -> ' . $this->attribute('nombre', $catalog['singular']) . ', ' . $this->attribute('detalle', $catalog['singular']),
                ],
            ],
            'expected_solution_json' => [
                'tablas_normalizadas' => [
                    [
                        'nombre' => $entityTable,
                        'atributos' => [
                            $this->attribute('id', $entity['singular']),
                            $this->attribute('nombre', $entity['singular']),
                        ],
                    ],
                    [
                        'nombre' => $catalogTable,
                        'atributos' => [
                            $this->attribute('id', $catalog['singular']),
                            $this->attribute('nombre', $catalog['singular']),
                            $this->attribute('detalle', $catalog['singular']),
                        ],
                    ],
                    [
                        'nombre' => $rootTable,
                        'atributos' => [
                            $this->attribute('id', $root['singular']),
                            $this->attribute('id', $entity['singular']),
                            $this->attribute('id', $catalog['singular']),
                            'total',
                        ],
                    ],
                ],
            ],
            'is_active' => true,
        ];
    }

    private function buildBcnfQuest(array $theme, array $blueprint): array
    {
        $root = $theme['root'];
        $entity = $theme['entity'];
        $support = $theme['support'];
        $rootTable = $this->tableName([$theme['root']['plural'], 'asignacion']);
        $supportTable = $this->tableName($support['plural']);
        $variant = (int) $blueprint['variant'];

        $titleTemplates = [
            'Reordena determinantes en %s',
            'Ajusta %s hasta BCNF',
            'Resuelve el determinante no clave de %s',
            'Separa la relacion que rompe BCNF en %s',
            'Corrige la superclave faltante en %s',
            'Limpia el determinante oculto de %s',
            'Reformula %s con reglas mas estrictas',
            'Eleva %s a BCNF sin ambiguedades',
            'Descompone el catalogo conflictivo de %s',
            'Valida la dependencia critica de %s',
        ];

        $descriptionTemplates = [
            '%s contiene un determinante que no es superclave. Descompone la relacion sin perder integridad.',
            'Hay una dependencia funcional que rompe BCNF dentro de %s.',
            'Separa la tabla de catalogo y deja %s en BCNF.',
            'La estructura parece correcta, pero una dependencia sigue violando la forma normal.',
            'Ajusta el modelo para que cada determinante sea tambien superclave.',
            'Verifica la integridad y la decomposicion antes de cerrar la solucion.',
            'El caso exige separar la informacion que hoy depende de la variable incorrecta.',
            'Usa una lectura tecnica para eliminar redundancias ocultas.',
            'Asegura que la solucion siga siendo util aunque el escenario crezca.',
            'Entrega una version robusta, trazable y apta para auditoria.',
        ];

        return [
            'title' => sprintf($titleTemplates[($variant - 1) % count($titleTemplates)], $theme['label']),
            'description' => sprintf($descriptionTemplates[($variant - 1) % count($descriptionTemplates)], $theme['label']),
            'quest_type' => $blueprint['quest_type'],
            'difficulty' => (int) $blueprint['difficulty'],
            'xp_reward' => $this->xpReward('BCNF', (int) $blueprint['difficulty'], (int) $blueprint['catalog_order']),
            'nf_requirement' => 'BCNF',
            'initial_schema_json' => [
                'tema' => $theme['label'],
                'objetivo' => 'BCNF',
                'tablas' => [
                    [
                        'nombre' => $rootTable,
                        'atributos' => [
                            $this->attribute('id', $entity['singular']),
                            $this->attribute('id', $support['singular']),
                            $this->attribute('nombre', $support['singular']),
                            $this->attribute('capacidad', $support['singular']),
                            'horario',
                        ],
                    ],
                ],
                'dependencias' => [
                    $this->attribute('id', $entity['singular']) . ', ' . $this->attribute('id', $support['singular']) . ' -> horario',
                    $this->attribute('id', $support['singular']) . ' -> ' . $this->attribute('nombre', $support['singular']) . ', ' . $this->attribute('capacidad', $support['singular']),
                ],
            ],
            'expected_solution_json' => [
                'tablas_normalizadas' => [
                    [
                        'nombre' => $supportTable,
                        'atributos' => [
                            $this->attribute('id', $support['singular']),
                            $this->attribute('nombre', $support['singular']),
                            $this->attribute('capacidad', $support['singular']),
                        ],
                    ],
                    [
                        'nombre' => $rootTable,
                        'atributos' => [
                            $this->attribute('id', $entity['singular']),
                            $this->attribute('id', $support['singular']),
                            'horario',
                        ],
                    ],
                ],
            ],
            'is_active' => true,
        ];
    }

    private function buildFourthFnQuest(array $theme, array $blueprint): array
    {
        $entity = $theme['entity'];
        $mvd = $theme['mvd'];
        $rootTable = $this->tableName($entity['plural']);
        $variant = (int) $blueprint['variant'];

        $titleTemplates = [
            'Separa multivalores de %s',
            'Rompe el producto cartesiano en %s',
            'Aisla dependencias multivaluadas en %s',
            'Limpia combinaciones independientes en %s',
            'Convierte %s en una estructura 4FN',
            'Desarma los multivalores de %s',
            'Reformula %s para dependencias separadas',
            'Elimina cruces inutiles en %s',
            'Divide los conjuntos independientes de %s',
            'Haz que %s cumpla 4FN de forma limpia',
        ];

        $descriptionTemplates = [
            '%s mezcla atributos independientes en un mismo registro y genera redundancia innecesaria.',
            'Separa los valores multivaluados independientes de %s para cumplir 4FN.',
            'Transforma %s para que cada conjunto multivaluado viva en su propia tabla.',
            'Elimina combinaciones que nacen solo por compartir la misma fila.',
            'Haz que cada conjunto multivaluado pueda validarse por separado.',
            'Asegura una descomposicion clara y facil de mantener.',
            'Evita que dos listas independientes se crucen dentro de la misma entidad.',
            'Prepara una solucion avanzada, estable y sin duplicacion geometrica.',
            'Aisla los grupos multivaluados antes de cerrar el caso.',
            'Deja el esquema listo para escenarios mas complejos.',
        ];

        $mainAttributes = [
            $this->attribute('id', $entity['singular']),
            $this->attribute('nombre', $entity['singular']),
        ];

        $multiAttributes = array_map(
            fn (array $item) => $item['plural'],
            $mvd
        );

        $solutionTables = [
            [
                'nombre' => $rootTable,
                'atributos' => $mainAttributes,
            ],
        ];

        foreach ($mvd as $item) {
            $solutionTables[] = [
                'nombre' => $this->tableName([$item['plural'], $entity['singular']]),
                'atributos' => [
                    $this->attribute('id', $entity['singular']),
                    $item['singular'],
                ],
            ];
        }

        return [
            'title' => sprintf($titleTemplates[($variant - 1) % count($titleTemplates)], $theme['label']),
            'description' => sprintf($descriptionTemplates[($variant - 1) % count($descriptionTemplates)], $theme['label']),
            'quest_type' => $blueprint['quest_type'],
            'difficulty' => (int) $blueprint['difficulty'],
            'xp_reward' => $this->xpReward('4FN', (int) $blueprint['difficulty'], (int) $blueprint['catalog_order']),
            'nf_requirement' => '4FN',
            'initial_schema_json' => [
                'tema' => $theme['label'],
                'objetivo' => '4FN',
                'etapas' => [
                    'Detectar multivalores independientes',
                    'Separar los conjuntos en tablas propias',
                    'Validar que no queden cruces innecesarios',
                ],
                'tablas' => [
                    [
                        'nombre' => $this->tableName($entity['plural']),
                        'atributos' => array_merge($mainAttributes, $multiAttributes),
                    ],
                ],
                'dependencias' => array_merge(
                    [
                        $this->attribute('id', $entity['singular']) . ' -> ' . $this->attribute('nombre', $entity['singular']),
                    ],
                    array_map(
                        fn (string $attr) => $this->attribute('id', $entity['singular']) . ' ->-> ' . $attr,
                        $multiAttributes
                    )
                ),
            ],
            'expected_solution_json' => [
                'tablas_normalizadas' => $solutionTables,
            ],
            'is_active' => true,
        ];
    }

    private function buildFifthFnQuest(array $theme, array $blueprint): array
    {
        $join = $theme['join'];
        $variant = (int) $blueprint['variant'];

        $titleTemplates = [
            'Descompone relaciones de %s',
            'Maestria de 5FN para %s',
            'Resuelve la dependencia de union en %s',
            'Separa la combinacion final de %s',
            'Rompe la relacion compuesta de %s',
            'Ajusta %s para una 5FN real',
            'Limpia las uniones artificiales de %s',
            'Convierte %s en un caso de 5FN',
            'Desarma el modelo multinivel de %s',
            'Verifica la descomposicion sin perdida de %s',
        ];

        $descriptionTemplates = [
            '%s contiene una combinacion que puede separarse sin perdida de informacion.',
            'Desarma la relacion ternaria de %s para cumplir 5FN.',
            'Deja %s sin combinaciones artificiales y con join seguro.',
            'La solucion necesita separar piezas que solo parecen necesarias juntas.',
            'Asegura que la reconstruccion del modelo siga siendo exacta.',
            'Define una descomposicion que soporte reglas de negocio complejas.',
            'Analiza la relacion final y evita dependencias de union innecesarias.',
            'Prepara un caso avanzado con validacion tecnica completa.',
            'El resultado debe ser estable, interpretable y libre de perdida.',
            'Cierra el escenario con una estructura lista para auditoria.',
        ];

        $rootTable = $this->tableName([$theme['root']['plural'], 'maestra']);
        $joinTables = [
            $this->tableName([$join[0], $join[1]]),
            $this->tableName([$join[0], $join[2]]),
            $this->tableName([$join[1], $join[2]]),
        ];

        return [
            'title' => sprintf($titleTemplates[($variant - 1) % count($titleTemplates)], $theme['label']),
            'description' => sprintf($descriptionTemplates[($variant - 1) % count($descriptionTemplates)], $theme['label']),
            'quest_type' => $blueprint['quest_type'],
            'difficulty' => (int) $blueprint['difficulty'],
            'xp_reward' => $this->xpReward('5FN', (int) $blueprint['difficulty'], (int) $blueprint['catalog_order']),
            'nf_requirement' => '5FN',
            'initial_schema_json' => [
                'tema' => $theme['label'],
                'objetivo' => '5FN',
                'etapas' => [
                    'Identificar la combinacion base',
                    'Descomponer sin perder informacion',
                    'Validar la reconstruccion con joins',
                    'Documentar la justificacion tecnica',
                ],
                'tablas' => [
                    [
                        'nombre' => $rootTable,
                        'atributos' => [
                            $join[0],
                            $join[1],
                            $join[2],
                            'fecha_compromiso',
                        ],
                    ],
                ],
                'dependencias' => [
                    $join[0] . ', ' . $join[1] . ', ' . $join[2] . ' -> fecha_compromiso',
                    $join[0] . ' ->-> ' . $join[1],
                    $join[1] . ' ->-> ' . $join[2],
                ],
            ],
            'expected_solution_json' => [
                'tablas_normalizadas' => [
                    [
                        'nombre' => $joinTables[0],
                        'atributos' => [
                            $join[0],
                            $join[1],
                        ],
                    ],
                    [
                        'nombre' => $joinTables[1],
                        'atributos' => [
                            $join[0],
                            $join[2],
                        ],
                    ],
                    [
                        'nombre' => $joinTables[2],
                        'atributos' => [
                            $join[1],
                            $join[2],
                        ],
                    ],
                ],
            ],
            'is_active' => true,
        ];
    }

    private function themePacks(): array
    {
        return [
            'ventas' => [
                'label' => 'Ventas',
                'root' => ['singular' => 'pedido', 'plural' => 'pedidos'],
                'entity' => ['singular' => 'cliente', 'plural' => 'clientes'],
                'secondary' => ['singular' => 'producto', 'plural' => 'productos'],
                'catalog' => ['singular' => 'ciudad', 'plural' => 'ciudades'],
                'support' => ['singular' => 'sede', 'plural' => 'sedes'],
                'multi' => [
                    ['plural' => 'telefonos', 'singular' => 'telefono'],
                    ['plural' => 'correos', 'singular' => 'correo'],
                    ['plural' => 'canales', 'singular' => 'canal'],
                ],
                'mvd' => [
                    ['plural' => 'idiomas', 'singular' => 'idioma'],
                    ['plural' => 'certificaciones', 'singular' => 'certificacion'],
                    ['plural' => 'habilidades', 'singular' => 'habilidad'],
                ],
                'join' => ['proveedor', 'producto', 'proyecto'],
            ],
            'academia' => [
                'label' => 'Academia',
                'root' => ['singular' => 'inscripcion', 'plural' => 'inscripciones'],
                'entity' => ['singular' => 'estudiante', 'plural' => 'estudiantes'],
                'secondary' => ['singular' => 'curso', 'plural' => 'cursos'],
                'catalog' => ['singular' => 'programa', 'plural' => 'programas'],
                'support' => ['singular' => 'aula', 'plural' => 'aulas'],
                'multi' => [
                    ['plural' => 'tutores', 'singular' => 'tutor'],
                    ['plural' => 'recursos', 'singular' => 'recurso'],
                    ['plural' => 'temas', 'singular' => 'tema'],
                ],
                'mvd' => [
                    ['plural' => 'idiomas', 'singular' => 'idioma'],
                    ['plural' => 'certificaciones', 'singular' => 'certificacion'],
                    ['plural' => 'habilidades', 'singular' => 'habilidad'],
                ],
                'join' => ['docente', 'curso', 'sede'],
            ],
            'salud' => [
                'label' => 'Salud',
                'root' => ['singular' => 'cita', 'plural' => 'citas'],
                'entity' => ['singular' => 'paciente', 'plural' => 'pacientes'],
                'secondary' => ['singular' => 'medico', 'plural' => 'medicos'],
                'catalog' => ['singular' => 'especialidad', 'plural' => 'especialidades'],
                'support' => ['singular' => 'sala', 'plural' => 'salas'],
                'multi' => [
                    ['plural' => 'telefonos', 'singular' => 'telefono'],
                    ['plural' => 'correos', 'singular' => 'correo'],
                    ['plural' => 'aseguradoras', 'singular' => 'aseguradora'],
                ],
                'mvd' => [
                    ['plural' => 'alergias', 'singular' => 'alergia'],
                    ['plural' => 'idiomas', 'singular' => 'idioma'],
                    ['plural' => 'planes', 'singular' => 'plan'],
                ],
                'join' => ['medico', 'sala', 'tratamiento'],
            ],
            'logistica' => [
                'label' => 'Logistica',
                'root' => ['singular' => 'envio', 'plural' => 'envios'],
                'entity' => ['singular' => 'almacen', 'plural' => 'almacenes'],
                'secondary' => ['singular' => 'ruta', 'plural' => 'rutas'],
                'catalog' => ['singular' => 'zona', 'plural' => 'zonas'],
                'support' => ['singular' => 'vehiculo', 'plural' => 'vehiculos'],
                'multi' => [
                    ['plural' => 'paquetes', 'singular' => 'paquete'],
                    ['plural' => 'transportistas', 'singular' => 'transportista'],
                    ['plural' => 'ventanas', 'singular' => 'ventana'],
                ],
                'mvd' => [
                    ['plural' => 'vehiculos', 'singular' => 'vehiculo'],
                    ['plural' => 'turnos', 'singular' => 'turno'],
                    ['plural' => 'canales', 'singular' => 'canal'],
                ],
                'join' => ['proveedor', 'producto', 'ruta'],
            ],
            'biblioteca' => [
                'label' => 'Biblioteca',
                'root' => ['singular' => 'prestamo', 'plural' => 'prestamos'],
                'entity' => ['singular' => 'socio', 'plural' => 'socios'],
                'secondary' => ['singular' => 'libro', 'plural' => 'libros'],
                'catalog' => ['singular' => 'categoria', 'plural' => 'categorias'],
                'support' => ['singular' => 'editorial', 'plural' => 'editoriales'],
                'multi' => [
                    ['plural' => 'telefonos', 'singular' => 'telefono'],
                    ['plural' => 'autores', 'singular' => 'autor'],
                    ['plural' => 'etiquetas', 'singular' => 'etiqueta'],
                ],
                'mvd' => [
                    ['plural' => 'idiomas', 'singular' => 'idioma'],
                    ['plural' => 'temas', 'singular' => 'tema'],
                    ['plural' => 'colecciones', 'singular' => 'coleccion'],
                ],
                'join' => ['editorial', 'libro', 'sala'],
            ],
            'rrhh' => [
                'label' => 'RRHH',
                'root' => ['singular' => 'asignacion', 'plural' => 'asignaciones'],
                'entity' => ['singular' => 'empleado', 'plural' => 'empleados'],
                'secondary' => ['singular' => 'departamento', 'plural' => 'departamentos'],
                'catalog' => ['singular' => 'sede', 'plural' => 'sedes'],
                'support' => ['singular' => 'turno', 'plural' => 'turnos'],
                'multi' => [
                    ['plural' => 'habilidades', 'singular' => 'habilidad'],
                    ['plural' => 'idiomas', 'singular' => 'idioma'],
                    ['plural' => 'certificaciones', 'singular' => 'certificacion'],
                ],
                'mvd' => [
                    ['plural' => 'proyectos', 'singular' => 'proyecto'],
                    ['plural' => 'turnos', 'singular' => 'turno'],
                    ['plural' => 'ubicaciones', 'singular' => 'ubicacion'],
                ],
                'join' => ['empleado', 'proyecto', 'sede'],
            ],
            'finanzas' => [
                'label' => 'Finanzas',
                'root' => ['singular' => 'factura', 'plural' => 'facturas'],
                'entity' => ['singular' => 'cliente', 'plural' => 'clientes'],
                'secondary' => ['singular' => 'cuenta', 'plural' => 'cuentas'],
                'catalog' => ['singular' => 'moneda', 'plural' => 'monedas'],
                'support' => ['singular' => 'sucursal', 'plural' => 'sucursales'],
                'multi' => [
                    ['plural' => 'metodos', 'singular' => 'metodo'],
                    ['plural' => 'referencias', 'singular' => 'referencia'],
                    ['plural' => 'impuestos', 'singular' => 'impuesto'],
                ],
                'mvd' => [
                    ['plural' => 'polizas', 'singular' => 'poliza'],
                    ['plural' => 'categorias', 'singular' => 'categoria'],
                    ['plural' => 'riesgos', 'singular' => 'riesgo'],
                ],
                'join' => ['cuenta', 'factura', 'sucursal'],
            ],
            'ecommerce' => [
                'label' => 'Ecommerce',
                'root' => ['singular' => 'pedido', 'plural' => 'pedidos'],
                'entity' => ['singular' => 'comprador', 'plural' => 'compradores'],
                'secondary' => ['singular' => 'producto', 'plural' => 'productos'],
                'catalog' => ['singular' => 'categoria', 'plural' => 'categorias'],
                'support' => ['singular' => 'almacen', 'plural' => 'almacenes'],
                'multi' => [
                    ['plural' => 'etiquetas', 'singular' => 'etiqueta'],
                    ['plural' => 'variantes', 'singular' => 'variante'],
                    ['plural' => 'canales', 'singular' => 'canal'],
                ],
                'mvd' => [
                    ['plural' => 'promociones', 'singular' => 'promocion'],
                    ['plural' => 'segmentos', 'singular' => 'segmento'],
                    ['plural' => 'preferencias', 'singular' => 'preferencia'],
                ],
                'join' => ['proveedor', 'producto', 'pedido'],
            ],
            'hoteleria' => [
                'label' => 'Hoteleria',
                'root' => ['singular' => 'reserva', 'plural' => 'reservas'],
                'entity' => ['singular' => 'huesped', 'plural' => 'huespedes'],
                'secondary' => ['singular' => 'habitacion', 'plural' => 'habitaciones'],
                'catalog' => ['singular' => 'tarifa', 'plural' => 'tarifas'],
                'support' => ['singular' => 'hotel', 'plural' => 'hoteles'],
                'multi' => [
                    ['plural' => 'servicios', 'singular' => 'servicio'],
                    ['plural' => 'preferencias', 'singular' => 'preferencia'],
                    ['plural' => 'contactos', 'singular' => 'contacto'],
                ],
                'mvd' => [
                    ['plural' => 'idiomas', 'singular' => 'idioma'],
                    ['plural' => 'paquetes', 'singular' => 'paquete'],
                    ['plural' => 'beneficios', 'singular' => 'beneficio'],
                ],
                'join' => ['habitacion', 'servicio', 'hotel'],
            ],
            'manufactura' => [
                'label' => 'Manufactura',
                'root' => ['singular' => 'orden', 'plural' => 'ordenes'],
                'entity' => ['singular' => 'operario', 'plural' => 'operarios'],
                'secondary' => ['singular' => 'maquina', 'plural' => 'maquinas'],
                'catalog' => ['singular' => 'planta', 'plural' => 'plantas'],
                'support' => ['singular' => 'linea', 'plural' => 'lineas'],
                'multi' => [
                    ['plural' => 'insumos', 'singular' => 'insumo'],
                    ['plural' => 'turnos', 'singular' => 'turno'],
                    ['plural' => 'revisiones', 'singular' => 'revision'],
                ],
                'mvd' => [
                    ['plural' => 'lotes', 'singular' => 'lote'],
                    ['plural' => 'fases', 'singular' => 'fase'],
                    ['plural' => 'certificaciones', 'singular' => 'certificacion'],
                ],
                'join' => ['maquina', 'orden', 'planta'],
            ],
        ];
    }

    private function questKey(string ...$parts): string
    {
        return Str::slug(self::CATALOG_VERSION . '-' . implode('-', $parts));
    }

    private function tableName(string|array $parts): string
    {
        if (is_array($parts)) {
            return Str::studly(implode('_', array_filter($parts)));
        }

        return Str::studly($parts);
    }

    private function attribute(string $prefix, string $noun): string
    {
        return $prefix . '_' . $noun;
    }

    private function xpReward(string $nf, int $difficulty, int $order): int
    {
        $base = match ($nf) {
            '1FN' => 80,
            '2FN' => 120,
            '3FN' => 160,
            'BCNF' => 210,
            '4FN' => 250,
            '5FN' => 300,
            default => 60,
        };

        return $base + ($difficulty * 18) + (int) floor($order / 2);
    }

    private function jitter(string $seed, int $min, int $max): int
    {
        $hash = hash('sha256', $seed);
        $value = hexdec(substr($hash, 0, 8));
        $range = max(1, $max - $min + 1);

        return $min + ($value % $range);
    }
}
