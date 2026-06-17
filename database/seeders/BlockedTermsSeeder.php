<?php

namespace Database\Seeders;

use App\Models\BlockedTerm;
use Illuminate\Database\Seeder;

class BlockedTermsSeeder extends Seeder
{
    public function run(): void
    {
        $terms = [
            // Historical inappropriate names
            ['term' => 'hitler', 'category' => 'historical_inappropriate', 'severity' => 'high', 'description' => 'Nombre históricamente inapropiado'],
            ['term' => 'nazi', 'category' => 'hate_reference', 'severity' => 'high', 'description' => 'Referencia a odio'],
            ['term' => 'ss', 'category' => 'hate_reference', 'severity' => 'high'],
            ['term' => 'gestapo', 'category' => 'hate_reference', 'severity' => 'high'],

            // Reserved names
            ['term' => 'admin', 'category' => 'reserved_name', 'severity' => 'medium'],
            ['term' => 'administrator', 'category' => 'reserved_name', 'severity' => 'medium'],
            ['term' => 'root', 'category' => 'reserved_name', 'severity' => 'medium'],
            ['term' => 'superuser', 'category' => 'reserved_name', 'severity' => 'medium'],
            ['term' => 'mod', 'category' => 'reserved_name', 'severity' => 'medium'],
            ['term' => 'moderator', 'category' => 'reserved_name', 'severity' => 'medium'],

            // Invalid names
            ['term' => 'null', 'category' => 'invalid_name', 'severity' => 'medium'],
            ['term' => 'undefined', 'category' => 'invalid_name', 'severity' => 'medium'],
            ['term' => 'test', 'category' => 'invalid_name', 'severity' => 'low', 'description' => 'Nombre de prueba no permitido'],
            ['term' => 'testing', 'category' => 'invalid_name', 'severity' => 'low'],
            ['term' => 'prueba', 'category' => 'invalid_name', 'severity' => 'low'],
            ['term' => 'demo', 'category' => 'invalid_name', 'severity' => 'low'],

            // Offensive terms
            ['term' => 'puto', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'puta', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'pendejo', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'pendeja', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'mierda', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'culero', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'culera', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'verga', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'cojones', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'carajo', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'cabron', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'cabrona', 'category' => 'offensive', 'severity' => 'high'],
            ['term' => 'estupido', 'category' => 'offensive', 'severity' => 'medium'],
            ['term' => 'estupida', 'category' => 'offensive', 'severity' => 'medium'],
            ['term' => 'idiota', 'category' => 'offensive', 'severity' => 'medium'],
            ['term' => 'imbecil', 'category' => 'offensive', 'severity' => 'medium'],
            ['term' => 'tonto', 'category' => 'offensive', 'severity' => 'low'],
            ['term' => 'tonta', 'category' => 'offensive', 'severity' => 'low'],

            // Violence
            ['term' => 'matar', 'category' => 'violence', 'severity' => 'high'],
            ['term' => 'asesino', 'category' => 'violence', 'severity' => 'high'],
            ['term' => 'bomba', 'category' => 'violence', 'severity' => 'high'],
            ['term' => 'terrorista', 'category' => 'violence', 'severity' => 'high'],

            // Spam/incoherent patterns
            ['term' => 'aaaa', 'category' => 'incoherent', 'severity' => 'low', 'description' => 'Caracteres repetidos sin sentido'],
            ['term' => 'bbbb', 'category' => 'incoherent', 'severity' => 'low'],
            ['term' => '1234', 'category' => 'incoherent', 'severity' => 'low', 'description' => 'Solo números'],
            ['term' => 'asdf', 'category' => 'incoherent', 'severity' => 'low', 'description' => 'Teclado sin sentido'],
            ['term' => 'qwerty', 'category' => 'incoherent', 'severity' => 'low'],
            ['term' => 'zxcv', 'category' => 'incoherent', 'severity' => 'low'],

            // Sexual explicit terms
            ['term' => 'porno', 'category' => 'sexual_explicit', 'severity' => 'high'],
            ['term' => 'xxx', 'category' => 'sexual_explicit', 'severity' => 'high'],
            ['term' => 'sexo', 'category' => 'sexual_explicit', 'severity' => 'high'],
        ];

        foreach ($terms as $term) {
            BlockedTerm::firstOrCreate(
                ['term' => $term['term']],
                $term
            );
        }
    }
}
