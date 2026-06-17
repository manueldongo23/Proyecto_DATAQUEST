<?php
namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class SqlDdlParserService
{
    public function parse(string $sql): array
    {
        $sql = $this->removeComments($sql);
        $sql = $this->normalizeWhitespace($sql);

        $tableName = $this->extractTableName($sql);
        $body = $this->extractParenthesesContent($sql);

        $closeParenPos = $this->findCloseParenPos($sql);
        $trailingSql = '';
        if ($closeParenPos !== false && $closeParenPos + 1 < strlen($sql)) {
            $trailingSql = trim(substr($sql, $closeParenPos + 1));
        }
        $tableOptions = $this->extractTableOptions($trailingSql);

        $definitions = $this->splitDefinitions($body);

        $columns = [];
        $tableLevelPk = [];
        $tableLevelUnique = [];
        $foreignKeys = [];
        $checks = [];

        foreach ($definitions as $def) {
            $trimmed = trim($def);

            if (preg_match('/^\s*PRIMARY\s+KEY\s*\(\s*(.+?)\s*\)\s*$/i', $trimmed, $m)) {
                $tableLevelPk = array_map('trim', explode(',', $m[1]));
            } elseif (preg_match('/^\s*FOREIGN\s+KEY\s*\(\s*(.+?)\s*\)\s*REFERENCES\s+`?(\w+)`?\s*\(\s*(.+?)\s*\)\s*$/i', $trimmed, $m)) {
                $fkCols = array_map('trim', explode(',', $m[1]));
                $refTable = trim($m[2]);
                $refCols = array_map('trim', explode(',', $m[3]));
                $foreignKeys[] = [
                    'columns' => $fkCols,
                    'referenced_table' => $refTable,
                    'referenced_columns' => $refCols,
                ];
            } elseif (preg_match('/^\s*UNIQUE\s*\(\s*(.+?)\s*\)\s*$/i', $trimmed, $m)) {
                $tableLevelUnique[] = array_map('trim', explode(',', $m[1]));
            } elseif (preg_match('/^\s*CHECK\s*\(/i', $trimmed)) {
                $checks[] = $this->extractCheckContent($trimmed);
            } elseif (preg_match('/^\s*CONSTRAINT\s+/i', $trimmed)) {
                $parsed = $this->parseConstraintDefinition($trimmed);
                if ($parsed) {
                    if ($parsed['type'] === 'primary_key') {
                        $tableLevelPk = $parsed['columns'];
                    } elseif ($parsed['type'] === 'foreign_key') {
                        $foreignKeys[] = $parsed['data'];
                    } elseif ($parsed['type'] === 'unique') {
                        $tableLevelUnique[] = $parsed['columns'];
                    } elseif ($parsed['type'] === 'check') {
                        $checks[] = $parsed['condition'];
                    }
                }
            } else {
                $col = $this->parseColumnDefinition($trimmed);
                if ($col) {
                    $columns[] = $col;
                    if ($col['references'] !== null) {
                        $foreignKeys[] = [
                            'columns' => [$col['name']],
                            'referenced_table' => $col['references']['table'],
                            'referenced_columns' => [$col['references']['column']],
                        ];
                    }
                }
            }
        }

        $attributes = array_column($columns, 'name');

        if (!empty($tableLevelPk)) {
            foreach ($columns as &$col) {
                if (in_array($col['name'], $tableLevelPk)) {
                    $col['primary_key'] = true;
                }
            }
            unset($col);
        }

        $pkCols = [];
        foreach ($columns as $col) {
            if (!empty($col['primary_key'])) {
                $pkCols[] = $col['name'];
            }
        }

        $fdsFromPk = [];
        if (!empty($pkCols)) {
            $dependents = array_values(array_diff($attributes, $pkCols));
            if (!empty($dependents)) {
                $fdsFromPk[] = new FunctionalDependency($pkCols, $dependents);
            }
        }

        $uniqueColsList = [];
        foreach ($columns as $col) {
            if (!empty($col['unique'])) {
                $uniqueColsList[] = [$col['name']];
            }
        }
        foreach ($tableLevelUnique as $uc) {
            $uniqueColsList[] = $uc;
        }

        $fdsFromUnique = [];
        foreach ($uniqueColsList as $uc) {
            $dependents = array_values(array_diff($attributes, $uc));
            if (!empty($dependents)) {
                $fdsFromUnique[] = new FunctionalDependency($uc, $dependents);
            }
        }

        $allFds = array_merge($fdsFromPk, $fdsFromUnique);

        $schema = new RelationSchema($tableName, $attributes, $allFds);

        return [
            'schema' => $schema,
            'raw_columns' => $columns,
            'fds_from_pk' => $fdsFromPk,
            'fds_from_unique' => $fdsFromUnique,
            'fks' => $foreignKeys,
            'checks' => $checks,
            'table_options' => $tableOptions,
        ];
    }

    public function parseMultiple(string $sql): array
    {
        $sql = $this->normalizeSql($sql);
        $statements = $this->splitStatements($sql);
        $results = [];

        foreach ($statements as $stmt) {
            $stmt = trim($stmt);
            if (empty($stmt)) {
                continue;
            }

            if (preg_match('/^\s*CREATE\s+TABLE/i', $stmt)) {
                $results[] = [
                    'type' => 'CREATE_TABLE',
                    'data' => $this->parse($stmt),
                ];
            } elseif (preg_match('/^\s*CREATE\s+(UNIQUE\s+)?INDEX/i', $stmt)) {
                $results[] = [
                    'type' => 'CREATE_INDEX',
                    'data' => $this->parseCreateIndex($stmt),
                ];
            } elseif (preg_match('/^\s*ALTER\s+TABLE/i', $stmt)) {
                $results[] = [
                    'type' => 'ALTER_TABLE',
                    'data' => $this->parseAlterTable($stmt),
                ];
            } elseif (preg_match('/^\s*DROP\s+TABLE/i', $stmt)) {
                $results[] = [
                    'type' => 'DROP_TABLE',
                    'data' => $this->parseDropTable($stmt),
                ];
            } else {
                $results[] = [
                    'type' => 'UNKNOWN',
                    'sql' => $stmt,
                ];
            }
        }

        return $results;
    }

    public function normalizeSql(string $sql): string
    {
        $sql = $this->removeComments($sql);

        $parts = preg_split("/((?s)'(?:[^'\\\\]*(?:\\\\.[^'\\\\]*)*)'|\"(?:[^\"\\\\]*(?:\\\\.[^\"\\\\]*)*)\")/", $sql, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);

        $keywords = [
            'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'UNIQUE', 'CONCURRENTLY',
            'IF', 'NOT', 'EXISTS', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
            'NULL', 'DEFAULT', 'CHECK', 'CONSTRAINT', 'ADD', 'COLUMN',
            'RENAME', 'TO', 'SET', 'CASCADE', 'RESTRICT',
            'WITH', 'WITHOUT', 'OIDS', 'TABLESPACE', 'ON', 'COMMIT',
            'PRESERVE', 'ROWS', 'DELETE', 'STORAGE', 'ONLY',
            'INT', 'INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT',
            'VARCHAR', 'CHAR', 'CHARACTER', 'VARYING',
            'TEXT', 'BOOLEAN', 'BOOL',
            'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
            'NUMERIC', 'DECIMAL', 'REAL', 'FLOAT', 'DOUBLE', 'PRECISION',
            'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'ZONE',
            'BLOB', 'BYTEA', 'JSON', 'JSONB', 'UUID', 'ENUM',
            'INTERVAL', 'CIDR', 'INET', 'MACADDR',
            'TRUE', 'FALSE', 'CURRENT_TIMESTAMP', 'NOW',
        ];

        $normalized = '';
        foreach ($parts as $part) {
            if (preg_match("/^['\"]/", $part)) {
                $normalized .= $part;
            } else {
                $part = preg_replace('/\s+/', ' ', $part);
                $part = str_replace('( ', '(', $part);
                $part = str_replace(' )', ')', $part);
                $part = str_replace(', ', ',', $part);

                usort($keywords, fn($a, $b) => strlen($b) - strlen($a));
                foreach ($keywords as $kw) {
                    $part = preg_replace('/\b' . preg_quote($kw, '/') . '\b/i', $kw, $part);
                }

                $normalized .= $part;
            }
        }

        return trim($normalized);
    }

    public function validateSql(string $sql): array
    {
        $errors = [];
        $warnings = [];

        if (empty(trim($sql))) {
            return [
                'valid' => false,
                'errors' => ['Empty SQL statement'],
                'warnings' => [],
            ];
        }

        try {
            $normalized = $this->normalizeSql($sql);
        } catch (\Exception $e) {
            return [
                'valid' => false,
                'errors' => ['Error normalizing SQL: ' . $e->getMessage()],
                'warnings' => [],
            ];
        }

        $parenCount = substr_count($normalized, '(') - substr_count($normalized, ')');
        if ($parenCount !== 0) {
            $errors[] = "Unmatched parentheses: {$parenCount} unclosed";
        }

        if (!preg_match('/^\s*(CREATE|ALTER|DROP)\s/i', $normalized)) {
            $errors[] = 'Statement must start with CREATE, ALTER, or DROP';
        }

        $inString = false;
        $stringChar = null;
        $len = strlen($normalized);
        for ($i = 0; $i < $len; $i++) {
            $ch = $normalized[$i];
            if ($inString) {
                if ($ch === $stringChar && ($i === 0 || $normalized[$i - 1] !== '\\')) {
                    $inString = false;
                }
            } elseif ($ch === "'" || $ch === '"') {
                $inString = true;
                $stringChar = $ch;
            }
        }

        if ($inString) {
            $errors[] = 'Unterminated string literal';
        }

        if (empty($errors) && preg_match('/^\s*CREATE\s+TABLE/i', $normalized)) {
            try {
                $this->extractTableName($normalized);
            } catch (\InvalidArgumentException $e) {
                $errors[] = $e->getMessage();
            }

            try {
                $this->extractParenthesesContent($normalized);
            } catch (\InvalidArgumentException $e) {
                $errors[] = $e->getMessage();
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'warnings' => $warnings,
        ];
    }

    public function parseCreateIndex(string $sql): array
    {
        $sql = $this->normalizeSql($sql);

        $unique = (bool) preg_match('/CREATE\s+UNIQUE\s+INDEX/i', $sql);
        $concurrently = (bool) preg_match('/INDEX\s+CONCURRENTLY/i', $sql);

        if (preg_match('/CREATE\s+(UNIQUE\s+)?INDEX\s+(CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s+ON\s+`?(\w+)`?\s*\((.+?)\)\s*$/i', $sql, $m)) {
            $indexName = $m[3];
            $tableName = $m[4];
            $columns = array_map('trim', explode(',', $m[5]));

            return [
                'name' => $indexName,
                'table' => $tableName,
                'columns' => $columns,
                'unique' => $unique,
                'concurrently' => $concurrently,
            ];
        }

        throw new \InvalidArgumentException('Could not parse CREATE INDEX statement');
    }

    public function parseAlterTable(string $sql): array
    {
        $sql = $this->normalizeSql($sql);

        if (!preg_match('/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?`?(\w+)`?\s+(.+)/i', $sql, $m)) {
            throw new \InvalidArgumentException('Could not parse ALTER TABLE statement');
        }

        $tableName = $m[1];
        $actions = trim($m[2]);

        $operations = [];
        $actionParts = $this->splitAlterActions($actions);

        foreach ($actionParts as $action) {
            $action = trim($action);
            $op = $this->parseSingleAlterAction($action);
            if ($op !== null) {
                $operations[] = $op;
            }
        }

        return [
            'table' => $tableName,
            'operations' => $operations,
        ];
    }

    public function parseDropTable(string $sql): array
    {
        $sql = $this->normalizeSql($sql);

        $ifExists = (bool) preg_match('/IF\s+EXISTS/i', $sql);
        $cascade = (bool) preg_match('/\bCASCADE\b/i', $sql);

        if (preg_match('/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`?(\w+)`?\s*/i', $sql, $m)) {
            return [
                'table' => $m[1],
                'if_exists' => $ifExists,
                'cascade' => $cascade,
            ];
        }

        throw new \InvalidArgumentException('Could not parse DROP TABLE statement');
    }

    private function removeComments(string $sql): string
    {
        $sql = preg_replace('/\/\*.*?\*\//s', '', $sql);
        $sql = preg_replace('/--[^\n]*/', '', $sql);
        return $sql;
    }

    private function normalizeWhitespace(string $sql): string
    {
        $sql = preg_replace('/\s+/', ' ', $sql);
        $sql = str_replace('( ', '(', $sql);
        $sql = str_replace(' )', ')', $sql);
        $sql = str_replace(', ', ',', $sql);
        return trim($sql);
    }

    private function extractTableName(string $sql): string
    {
        if (preg_match('/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?(\w+)`?\.)?`?(\w+)`?\s*\(/i', $sql, $m)) {
            return !empty($m[2]) ? $m[2] : $m[1];
        }
        throw new \InvalidArgumentException('Could not extract table name from SQL statement');
    }

    private function extractParenthesesContent(string $sql): string
    {
        $start = strpos($sql, '(');
        if ($start === false) {
            throw new \InvalidArgumentException('No parentheses found in CREATE TABLE statement');
        }

        $depth = 0;
        $content = '';
        $len = strlen($sql);
        $started = false;

        for ($i = $start; $i < $len; $i++) {
            $ch = $sql[$i];
            if ($ch === '(') {
                if ($started) {
                    $content .= '(';
                }
                $depth++;
                $started = true;
            } elseif ($ch === ')') {
                $depth--;
                if ($depth === 0) {
                    break;
                }
                $content .= ')';
            } else {
                if ($started) {
                    $content .= $ch;
                }
            }
        }

        if ($depth !== 0) {
            throw new \InvalidArgumentException('Unmatched parentheses in CREATE TABLE statement');
        }

        return $content;
    }

    private function splitDefinitions(string $body): array
    {
        $defs = [];
        $current = '';
        $depth = 0;
        $len = strlen($body);

        for ($i = 0; $i < $len; $i++) {
            $ch = $body[$i];
            if ($ch === '(') {
                $depth++;
                $current .= $ch;
            } elseif ($ch === ')') {
                $depth--;
                $current .= $ch;
            } elseif ($ch === ',' && $depth === 0) {
                $defs[] = trim($current);
                $current = '';
            } else {
                $current .= $ch;
            }
        }

        $remaining = trim($current);
        if ($remaining !== '') {
            $defs[] = $remaining;
        }

        return $defs;
    }

    private function parseColumnDefinition(string $def): ?array
    {
        if (!preg_match('/^\s*`?(\w+)`?\s+(.+)$/is', $def, $m)) {
            return null;
        }

        $name = $m[1];
        $rest = trim($m[2]);

        $constraintPos = strlen($rest);
        $constraintKeywords = ['PRIMARY', 'NOT', 'NULL', 'UNIQUE', 'REFERENCES', 'DEFAULT', 'CHECK', 'CONSTRAINT'];
        foreach ($constraintKeywords as $keyword) {
            $pos = stripos($rest, $keyword);
            if ($pos !== false && $pos < $constraintPos) {
                $constraintPos = $pos;
            }
        }

        $type = trim(substr($rest, 0, $constraintPos));

        $primaryKey = (bool) preg_match('/PRIMARY\s+KEY/i', $rest);
        $nullable = !(bool) preg_match('/NOT\s+NULL/i', $rest);
        $unique = (bool) preg_match('/\bUNIQUE\b/i', $rest);

        $references = null;
        if (preg_match('/REFERENCES\s+`?(\w+)`?\s*\(\s*`?(\w+)`?\s*\)/i', $rest, $rm)) {
            $references = [
                'table' => $rm[1],
                'column' => $rm[2],
            ];
        }

        $default = null;
        if (preg_match('/DEFAULT\s/i', $rest)) {
            $default = $this->extractDefaultValue($rest);
        }

        $check = null;
        if (preg_match('/CHECK\s*\(/i', $rest)) {
            $check = $this->extractCheckContent($rest);
        }

        return [
            'name' => $name,
            'type' => $type,
            'primary_key' => $primaryKey,
            'nullable' => $nullable,
            'unique' => $unique,
            'references' => $references,
            'default' => $default,
            'check' => $check,
        ];
    }

    private function parseConstraintDefinition(string $def): ?array
    {
        $def = preg_replace('/^\s*CONSTRAINT\s+`?\w+`?\s+/i', '', trim($def));

        if (preg_match('/^\s*PRIMARY\s+KEY\s*\(\s*(.+?)\s*\)\s*$/i', $def, $m)) {
            return [
                'type' => 'primary_key',
                'columns' => array_map('trim', explode(',', $m[1])),
            ];
        }

        if (preg_match('/^\s*FOREIGN\s+KEY\s*\(\s*(.+?)\s*\)\s*REFERENCES\s+`?(\w+)`?\s*\(\s*(.+?)\s*\)\s*$/i', $def, $m)) {
            return [
                'type' => 'foreign_key',
                'data' => [
                    'columns' => array_map('trim', explode(',', $m[1])),
                    'referenced_table' => trim($m[2]),
                    'referenced_columns' => array_map('trim', explode(',', $m[3])),
                ],
            ];
        }

        if (preg_match('/^\s*UNIQUE\s*\(\s*(.+?)\s*\)\s*$/i', $def, $m)) {
            return [
                'type' => 'unique',
                'columns' => array_map('trim', explode(',', $m[1])),
            ];
        }

        if (preg_match('/^\s*CHECK\s*\(/i', $def)) {
            return [
                'type' => 'check',
                'condition' => $this->extractCheckContent($def),
            ];
        }

        return null;
    }

    private function extractMatchingParen(string $sql): string
    {
        $start = strpos($sql, '(');
        if ($start === false) {
            return '';
        }

        $depth = 0;
        $content = '';
        $len = strlen($sql);

        for ($i = $start; $i < $len; $i++) {
            $ch = $sql[$i];
            $content .= $ch;
            if ($ch === '(') {
                $depth++;
            } elseif ($ch === ')') {
                $depth--;
                if ($depth === 0) {
                    break;
                }
            }
        }

        return $content;
    }

    private function extractCheckContent(string $s): string
    {
        if (preg_match('/CHECK\s*\(/i', $s, $m, PREG_OFFSET_CAPTURE)) {
            $checkStart = $m[0][1];
            $fromCheck = substr($s, $checkStart);
            $parenStart = strpos($fromCheck, '(');
            if ($parenStart !== false) {
                return $this->extractMatchingParen(substr($fromCheck, $parenStart));
            }
        }
        return '';
    }

    private function extractDefaultValue(string $rest): ?string
    {
        if (!preg_match('/DEFAULT\s+/i', $rest, $dm, PREG_OFFSET_CAPTURE)) {
            return null;
        }

        $defaultStart = $dm[0][1] + strlen($dm[0][0]);
        $stopKeywords = ['PRIMARY', 'NOT', 'UNIQUE', 'REFERENCES', 'CHECK', 'CONSTRAINT'];

        $nextKwPos = strlen($rest);
        foreach ($stopKeywords as $kw) {
            $pos = stripos($rest, $kw, $defaultStart);
            if ($pos !== false && $pos < $nextKwPos && $pos >= $defaultStart) {
                $nextKwPos = $pos;
            }
        }

        return trim(substr($rest, $defaultStart, $nextKwPos - $defaultStart));
    }

    private function extractTableOptions(string $trailingSql): array
    {
        $options = [];
        if (empty($trailingSql)) {
            return $options;
        }

        if (preg_match('/WITH\s*\((.+?)\)/i', $trailingSql, $m)) {
            $options['with'] = trim($m[1]);
        }
        if (preg_match('/WITHOUT\s+OIDS/i', $trailingSql)) {
            $options['without_oids'] = true;
        }
        if (preg_match('/TABLESPACE\s+(\w+)/i', $trailingSql, $m)) {
            $options['tablespace'] = trim($m[1]);
        }
        if (preg_match('/ON\s+COMMIT\s+(PRESERVE\s+ROWS|DELETE\s+ROWS|DROP)/i', $trailingSql, $m)) {
            $options['on_commit'] = strtoupper(trim($m[1]));
        }
        if (preg_match('/STORAGE\s+(.+)/i', $trailingSql, $m)) {
            $options['storage'] = trim($m[1]);
        }

        return $options;
    }

    private function findCloseParenPos(string $sql): int|false
    {
        $start = strpos($sql, '(');
        if ($start === false) {
            return false;
        }

        $depth = 0;
        $len = strlen($sql);

        for ($i = $start; $i < $len; $i++) {
            if ($sql[$i] === '(') {
                $depth++;
            } elseif ($sql[$i] === ')') {
                $depth--;
                if ($depth === 0) {
                    return $i;
                }
            }
        }

        return false;
    }

    private function splitStatements(string $sql): array
    {
        $statements = [];
        $current = '';
        $depth = 0;
        $inString = false;
        $stringChar = null;
        $len = strlen($sql);

        for ($i = 0; $i < $len; $i++) {
            $ch = $sql[$i];

            if ($inString) {
                $current .= $ch;
                if ($ch === $stringChar && ($i === 0 || $sql[$i - 1] !== '\\')) {
                    $inString = false;
                }
            } elseif ($ch === "'" || $ch === '"') {
                $current .= $ch;
                $inString = true;
                $stringChar = $ch;
            } elseif ($ch === '(') {
                $depth++;
                $current .= $ch;
            } elseif ($ch === ')') {
                $depth--;
                $current .= $ch;
            } elseif ($ch === ';' && $depth === 0) {
                $trimmed = trim($current);
                if ($trimmed !== '') {
                    $statements[] = $trimmed;
                }
                $current = '';
            } else {
                $current .= $ch;
            }
        }

        $trimmed = trim($current);
        if ($trimmed !== '') {
            $statements[] = $trimmed;
        }

        return $statements;
    }

    private function splitAlterActions(string $actions): array
    {
        $parts = [];
        $current = '';
        $depth = 0;
        $len = strlen($actions);

        for ($i = 0; $i < $len; $i++) {
            $ch = $actions[$i];
            if ($ch === '(') {
                $depth++;
                $current .= $ch;
            } elseif ($ch === ')') {
                $depth--;
                $current .= $ch;
            } elseif ($ch === ',' && $depth === 0) {
                $parts[] = trim($current);
                $current = '';
            } else {
                $current .= $ch;
            }
        }

        $remaining = trim($current);
        if ($remaining !== '') {
            $parts[] = $remaining;
        }

        return $parts;
    }

    private function parseSingleAlterAction(string $action): ?array
    {
        if (preg_match('/^ADD\s+COLUMN\s+`?(\w+)`?\s+(.+)$/i', $action, $m)) {
            $colDef = $this->parseColumnDefinition($m[1] . ' ' . $m[2]);
            return [
                'operation' => 'ADD_COLUMN',
                'column_definition' => $colDef,
            ];
        }

        if (preg_match('/^ADD\s+PRIMARY\s+KEY\s*\(\s*(.+?)\s*\)\s*$/i', $action, $m)) {
            return [
                'operation' => 'ADD_PRIMARY_KEY',
                'columns' => array_map('trim', explode(',', $m[1])),
            ];
        }

        if (preg_match('/^ADD\s+FOREIGN\s+KEY\s*\(\s*(.+?)\s*\)\s*REFERENCES\s+`?(\w+)`?\s*\(\s*(.+?)\s*\)\s*$/i', $action, $m)) {
            return [
                'operation' => 'ADD_FOREIGN_KEY',
                'columns' => array_map('trim', explode(',', $m[1])),
                'referenced_table' => trim($m[2]),
                'referenced_columns' => array_map('trim', explode(',', $m[3])),
            ];
        }

        if (preg_match('/^ADD\s+CONSTRAINT\s+`?(\w+)`?\s+UNIQUE\s*\(\s*(.+?)\s*\)\s*$/i', $action, $m)) {
            return [
                'operation' => 'ADD_UNIQUE',
                'constraint_name' => $m[1],
                'columns' => array_map('trim', explode(',', $m[2])),
            ];
        }

        if (preg_match('/^ADD\s+(UNIQUE\s*\(\s*(.+?)\s*\))\s*$/i', $action, $m)) {
            return [
                'operation' => 'ADD_UNIQUE',
                'columns' => array_map('trim', explode(',', $m[2])),
            ];
        }

        if (preg_match('/^ALTER\s+COLUMN\s+`?(\w+)`?\s+SET\s+NOT\s+NULL\s*$/i', $action, $m)) {
            return [
                'operation' => 'ALTER_SET_NOT_NULL',
                'column' => $m[1],
            ];
        }

        if (preg_match('/^ALTER\s+COLUMN\s+`?(\w+)`?\s+DROP\s+NOT\s+NULL\s*$/i', $action, $m)) {
            return [
                'operation' => 'ALTER_DROP_NOT_NULL',
                'column' => $m[1],
            ];
        }

        if (preg_match('/^DROP\s+COLUMN\s+`?(\w+)`?\s*/i', $action, $m)) {
            return [
                'operation' => 'DROP_COLUMN',
                'column' => $m[1],
            ];
        }

        if (preg_match('/^DROP\s+PRIMARY\s+KEY\s*/i', $action)) {
            return [
                'operation' => 'DROP_PRIMARY_KEY',
            ];
        }

        if (preg_match('/^RENAME\s+COLUMN\s+`?(\w+)`?\s+TO\s+`?(\w+)`?\s*$/i', $action, $m)) {
            return [
                'operation' => 'RENAME_COLUMN',
                'old_name' => $m[1],
                'new_name' => $m[2],
            ];
        }

        if (preg_match('/^RENAME\s+TO\s+`?(\w+)`?\s*$/i', $action, $m)) {
            return [
                'operation' => 'RENAME_TABLE',
                'new_name' => $m[1],
            ];
        }

        return [
            'operation' => 'UNKNOWN',
            'raw' => $action,
        ];
    }
}
