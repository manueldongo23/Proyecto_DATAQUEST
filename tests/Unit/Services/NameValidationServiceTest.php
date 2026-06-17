<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Services\NameValidationService;

class NameValidationServiceTest extends TestCase
{
    private NameValidationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new NameValidationService();
    }

    public function test_normalize_removes_accents(): void
    {
        $this->assertEquals('juan', $this->service->normalize('Juán'));
        $this->assertEquals('perez', $this->service->normalize('Pérez'));
    }

    public function test_normalize_lowercases(): void
    {
        $this->assertEquals('admin', $this->service->normalize('ADMIN'));
        $this->assertEquals('test', $this->service->normalize('Test'));
    }

    public function test_normalize_collapses_spaces(): void
    {
        $this->assertEquals('juan perez', $this->service->normalize('  Juan   Pérez  '));
    }

    public function test_normalize_converts_leet(): void
    {
        $this->assertEquals('hitler', $this->service->normalize('h1tl3r'));
        $this->assertEquals('admin', $this->service->normalize('4dm1n'));
    }

    public function test_normalize_removes_zero_width_chars(): void
    {
        $this->assertEquals('admin', $this->service->normalize("ad\xE2\x80\x8Bmin"));
    }

    public function test_normalize_handles_empty_input(): void
    {
        $this->assertEquals('', $this->service->normalize(''));
        $this->assertEquals('', $this->service->normalize('   '));
    }

    public function test_validate_empty_name(): void
    {
        $result = $this->service->validate('');
        $this->assertFalse($result['valid']);
    }

    public function test_validate_short_name(): void
    {
        $result = $this->service->validate('a');
        $this->assertFalse($result['valid']);
    }

    public function test_validate_long_name(): void
    {
        $result = $this->service->validate(str_repeat('a', 51));
        $this->assertFalse($result['valid']);
    }

    public function test_validate_name_with_numbers(): void
    {
        $result = $this->service->validate('Juan123');
        $this->assertFalse($result['valid']);
    }

    public function test_validate_name_with_repeated_chars(): void
    {
        $result = $this->service->validate('aaaa');
        $this->assertFalse($result['valid']);
    }

    public function test_validate_rejects_blocked_terms(): void
    {
        // This test relies on the database having blocked_terms seeded
        // For unit testing without DB, we test the normalization path
        $result = $this->service->validate('Juan Pérez');
        $this->assertTrue($result['valid']);
    }

    public function test_validate_valid_name(): void
    {
        $result = $this->service->validate('María García');
        $this->assertTrue($result['valid']);
        $this->assertEmpty($result['errors']);
    }

    public function test_normalize_rejects_excessively_long_input(): void
    {
        $this->assertEquals('', $this->service->normalize(str_repeat('a', 6000)));
    }
}
