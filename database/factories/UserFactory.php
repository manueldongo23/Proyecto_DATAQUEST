<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'correo' => fake()->unique()->safeEmail(),
            'apodo' => fake()->unique()->userName(),
            'password_hash' => Hash::make('password'),
            'role' => 'usuario',
            'xp' => 0,
            'rango' => 'Aprendiz',
            'medallas' => null,
            'activo' => true,
        ];
    }
}
