<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\BenchmarkHelper;

class BenchmarkHelperTest extends TestCase
{
    public function test_measures_execution_time(): void
    {
        $result = BenchmarkHelper::measure(function () {
            usleep(10000);
            return 42;
        });

        $this->assertArrayHasKey('time_ms', $result);
        $this->assertGreaterThanOrEqual(1, $result['time_ms']);
        $this->assertArrayHasKey('result', $result);
        $this->assertEquals(42, $result['result']);
    }

    public function test_measures_memory_usage(): void
    {
        $result = BenchmarkHelper::measure(function () {
            $data = str_repeat('x', 1024 * 100);
            return strlen($data);
        });

        $this->assertArrayHasKey('memory_bytes', $result);
        $this->assertArrayHasKey('memory_mb', $result);
        $this->assertArrayHasKey('result', $result);
        $this->assertEquals(1024 * 100, $result['result']);
    }

    public function test_format_bytes(): void
    {
        $this->assertSame('1KB', BenchmarkHelper::formatBytes(1024));
        $this->assertSame('1MB', BenchmarkHelper::formatBytes(1048576));
        $this->assertSame('1GB', BenchmarkHelper::formatBytes(1073741824));
        $this->assertSame('500B', BenchmarkHelper::formatBytes(500));
        $this->assertSame('1.5MB', BenchmarkHelper::formatBytes(1572864));
    }

    public function test_closure_count_returns_int(): void
    {
        $count = BenchmarkHelper::closureCount();
        $this->assertIsInt($count);
    }
}
