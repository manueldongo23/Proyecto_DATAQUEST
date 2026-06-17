<?php
namespace App\Domain\Entities;

class FunctionalDependency
{
    public function __construct(
        public readonly array $determinant,   // ej: ['id_estudiante']
        public readonly array $dependent      // ej: ['nombre', 'apellido']
    ) {}

    public function equals(FunctionalDependency $other): bool
    {
        return $this->determinant === $other->determinant 
            && $this->dependent === $other->dependent;
    }

    public function toArray(): array
    {
        return [
            'determinant' => $this->determinant,
            'dependent' => $this->dependent
        ];
    }
}
