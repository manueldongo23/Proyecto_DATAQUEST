<?php
namespace App\Domain\Entities;

class RelationSchema
{
    public function __construct(
        public readonly string $name,
        public readonly array $attributes,   // ['id', 'nombre', 'ciudad']
        public readonly array $functionalDependencies // FunctionalDependency[]
    ) {}

    public function getAttributesSet(): array
    {
        return $this->attributes;
    }

    public function getFds(): array
    {
        return $this->functionalDependencies;
    }
}
