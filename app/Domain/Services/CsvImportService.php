<?php
namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class CsvImportService
{
    private const MAX_ROWS = 10000;
    private const SAMPLE_SIZE = 100;
    private const FD_THRESHOLD = 0.95;
    private const MAX_LHS_SIZE = 2;

    public function import(string $csvContent, ?string $tableName = null, bool $hasHeader = true, ?string $delimiter = null): array
    {
        $csvContent = $this->sanitizeCsv($csvContent);

        if (empty($csvContent)) {
            return $this->emptyResult($tableName);
        }

        $rows = $this->parseCsv($csvContent, $hasHeader, $delimiter);

        if (empty($rows)) {
            return $this->emptyResult($tableName);
        }

        $columnNames = array_keys($rows[0]);
        $columnTypes = [];
        $sampleValues = [];

        foreach ($columnNames as $col) {
            $values = array_column($rows, $col);
            $columnTypes[$col] = $this->inferColumnType($values);
            $sampleValues[$col] = array_slice(array_unique(array_values($values)), 0, 5);
        }

        $discoveredFds = $this->discoverFunctionalDependencies($rows, $columnNames);

        $fds = [];
        foreach ($discoveredFds as $fd) {
            $fds[] = new FunctionalDependency($fd['determinant'], $fd['dependent']);
        }

        $schema = new RelationSchema(
            $tableName ?? 'imported_table',
            $columnNames,
            $fds
        );

        $columns = [];
        foreach ($columnNames as $col) {
            $columns[] = [
                'name' => $col,
                'type' => $columnTypes[$col],
                'sample_values' => $sampleValues[$col],
            ];
        }

        return [
            'schema' => $schema,
            'columns' => $columns,
            'discovered_fds' => $discoveredFds,
            'row_count' => count($rows),
            'table_name' => $tableName ?? 'imported_table',
        ];
    }

    private function emptyResult(?string $tableName): array
    {
        return [
            'schema' => new RelationSchema($tableName ?? 'imported_table', [], []),
            'columns' => [],
            'discovered_fds' => [],
            'row_count' => 0,
            'table_name' => $tableName ?? 'imported_table',
        ];
    }

    private function sanitizeCsv(string $content): string
    {
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
        $content = str_replace(["\r\n", "\r"], "\n", $content);
        $content = trim($content);

        if (!mb_check_encoding($content, 'UTF-8')) {
            $content = mb_convert_encoding($content, 'UTF-8', 'auto');
        }

        return $content;
    }

    private function detectDelimiter(string $firstLine): string
    {
        $delimiters = [',', ';', "\t", '|'];
        $bestDelimiter = ',';
        $bestCount = 0;

        foreach ($delimiters as $delimiter) {
            $count = substr_count($firstLine, $delimiter);
            if ($count > $bestCount) {
                $bestCount = $count;
                $bestDelimiter = $delimiter;
            }
        }

        return $bestDelimiter;
    }

    private function parseCsv(string $content, bool $hasHeader, ?string $delimiter): array
    {
        $lines = explode("\n", $content);
        $lines = array_values(array_filter($lines, fn($line) => trim($line) !== ''));

        if (empty($lines)) {
            return [];
        }

        if ($delimiter === null) {
            $delimiter = $this->detectDelimiter($lines[0]);
        }

        $header = [];
        $startRow = 0;

        if ($hasHeader) {
            $header = str_getcsv($lines[0], $delimiter);
            $header = array_map('trim', $header);
            $startRow = 1;
        } else {
            $firstDataRow = str_getcsv($lines[0], $delimiter);
            $colCount = count($firstDataRow);
            for ($i = 0; $i < $colCount; $i++) {
                $header[] = 'col_' . ($i + 1);
            }
        }

        if (count($header) <= 1) {
            return [];
        }

        $maxCols = count($header);
        $rows = [];

        for ($i = $startRow; $i < count($lines); $i++) {
            if (count($rows) >= self::MAX_ROWS) {
                break;
            }

            $line = trim($lines[$i]);
            if ($line === '') {
                continue;
            }

            $values = str_getcsv($line, $delimiter);

            while (count($values) < $maxCols) {
                $values[] = '';
            }
            $values = array_slice($values, 0, $maxCols);
            $values = array_map('trim', $values);

            $row = [];
            foreach ($header as $idx => $colName) {
                $row[$colName] = $values[$idx] ?? '';
            }
            $rows[] = $row;
        }

        return $rows;
    }

    private function inferType(string $value): string
    {
        $val = trim($value);

        if (preg_match('/^\d+$/', $val)) {
            return 'INT';
        }

        if (preg_match('/^\d+\.\d+$/', $val)) {
            return 'DECIMAL';
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $val)) {
            return 'DATE';
        }

        return 'TEXT';
    }

    private function inferColumnType(array $values): string
    {
        $sample = array_slice($values, 0, self::SAMPLE_SIZE);
        $nonEmpty = array_filter($sample, fn($v) => $v !== '' && $v !== null);

        if (empty($nonEmpty)) {
            return 'TEXT';
        }

        $allInt = true;
        $allDecimal = true;
        $allDate = true;

        foreach ($nonEmpty as $value) {
            $val = trim((string) $value);

            if (!preg_match('/^\d+$/', $val)) {
                $allInt = false;
            }

            if (!preg_match('/^\d+\.\d+$/', $val)) {
                $allDecimal = false;
            }

            if (!preg_match('/^\d{4}-\d{2}-\d{2}/', $val)) {
                $allDate = false;
            }
        }

        if ($allInt) {
            return 'INT';
        }
        if ($allDecimal) {
            return 'DECIMAL';
        }
        if ($allDate) {
            return 'DATE';
        }

        return 'TEXT';
    }

    private function discoverFunctionalDependencies(array $rows, array $columnNames): array
    {
        if (count($rows) < 2) {
            return [];
        }

        $fds = [];
        $seen = [];

        foreach ($columnNames as $x) {
            foreach ($columnNames as $y) {
                if ($x === $y) {
                    continue;
                }

                $confidence = $this->checkFD($rows, $x, $y);
                if ($confidence >= self::FD_THRESHOLD) {
                    $key = $x . '->' . $y;
                    if (!isset($seen[$key])) {
                        $fds[] = [
                            'determinant' => [$x],
                            'dependent' => [$y],
                            'confidence' => round($confidence, 4),
                        ];
                        $seen[$key] = true;
                    }
                }
            }
        }

        if (count($columnNames) >= 2) {
            for ($i = 0; $i < count($columnNames); $i++) {
                for ($j = $i + 1; $j < count($columnNames); $j++) {
                    $lhs = [$columnNames[$i], $columnNames[$j]];

                    foreach ($columnNames as $y) {
                        if (in_array($y, $lhs)) {
                            continue;
                        }

                        $confidence = $this->checkFDMulti($rows, $lhs, $y);
                        if ($confidence >= self::FD_THRESHOLD) {
                            $key = implode(',', $lhs) . '->' . $y;
                            if (!isset($seen[$key])) {
                                $fds[] = [
                                    'determinant' => $lhs,
                                    'dependent' => [$y],
                                    'confidence' => round($confidence, 4),
                                ];
                                $seen[$key] = true;
                            }
                        }
                    }
                }
            }
        }

        return $fds;
    }

    private function checkFD(array $rows, string $x, string $y): float
    {
        $total = count($rows);
        $satisfied = 0;

        $groups = [];
        foreach ($rows as $row) {
            $groups[$row[$x]][] = $row[$y];
        }

        foreach ($groups as $group) {
            $first = $group[0];
            $allSame = true;
            foreach ($group as $val) {
                if ($val !== $first) {
                    $allSame = false;
                    break;
                }
            }
            if ($allSame) {
                $satisfied += count($group);
            }
        }

        return $total > 0 ? $satisfied / $total : 0.0;
    }

    private function checkFDMulti(array $rows, array $lhs, string $y): float
    {
        $total = count($rows);
        $satisfied = 0;

        $groups = [];
        foreach ($rows as $row) {
            $keyParts = [];
            foreach ($lhs as $attr) {
                $keyParts[] = $row[$attr];
            }
            $groups[implode("\0", $keyParts)][] = $row[$y];
        }

        foreach ($groups as $group) {
            $first = $group[0];
            $allSame = true;
            foreach ($group as $val) {
                if ($val !== $first) {
                    $allSame = false;
                    break;
                }
            }
            if ($allSame) {
                $satisfied += count($group);
            }
        }

        return $total > 0 ? $satisfied / $total : 0.0;
    }
}
