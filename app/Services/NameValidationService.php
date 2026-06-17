<?php

namespace App\Services;

use App\Models\BlockedTerm;
use Illuminate\Support\Facades\Log;
use Normalizer;

class NameValidationService
{
    private const MIN_LENGTH = 2;
    private const MAX_LENGTH = 50;
    private const REPEATED_CHAR_LIMIT = 3;

    /**
     * Normalize a name for consistent comparison:
     * - Lowercase
     * - Trim whitespace
     * - Collapse multiple spaces
     * - Remove accents/diacritics
     * - Replace common leet-speak substitutions
     */
    public function normalize(string $value): string
    {
        // Reject extremely long inputs early
        if (mb_strlen($value, 'UTF-8') > 5000) {
            return '';
        }

        // Remove zero-width and invisible characters
        $value = preg_replace('/[\x{200B}-\x{200D}\x{FEFF}\x{00AD}\x{2060}\x{180E}]/u', '', $value);

        $normalized = mb_strtolower(trim($value), 'UTF-8');

        // Collapse multiple spaces
        $normalized = preg_replace('/\s+/', ' ', $normalized);

        // Remove accents/diacritics (NFD normalization)
        $normalized = Normalizer::normalize($normalized, Normalizer::FORM_D);
        $normalized = preg_replace('/[\x{0300}-\x{036f}]/u', '', $normalized);

        // Transliterate homoglyphs to ASCII (catches Cyrillic lookalikes, etc.)
        if (function_exists('transliterator_transliterate')) {
            $normalized = transliterator_transliterate('Any-Latin; Latin-ASCII; Lower()', $normalized);
        }

        // Replace common leet-speak substitutions
        $leetMap = [
            '1' => 'i', '3' => 'e', '4' => 'a',
            '0' => 'o', '5' => 's', '7' => 't',
            '6' => 'g', '8' => 'b',
        ];
        $normalized = str_replace(array_keys($leetMap), array_values($leetMap), $normalized);

        // Extended leet-speak and symbol substitutions
        $extendedLeet = [
            '$' => 's', '@' => 'a', '!' => 'i', '|' => 'i',
            '2' => 'z', '9' => 'g', '+' => 't',
        ];
        $normalized = str_replace(array_keys($extendedLeet), array_values($extendedLeet), $normalized);

        // Remove non-alphanumeric characters except spaces for comparison
        $normalized = preg_replace('/[^a-z0-9\s]/', '', $normalized);

        // Remove extra spaces again after replacements
        $normalized = preg_replace('/\s+/', ' ', $normalized);

        return trim($normalized);
    }

    /**
     * Validate a name and return validation result.
     *
     * @return array{valid: bool, errors: string[]}
     */
    public function validate(string $name): array
    {
        $errors = [];
        $originalName = trim($name);

        // Empty check
        if (empty($originalName)) {
            return ['valid' => false, 'errors' => ['El nombre no puede estar vacío']];
        }

        // Length checks
        if (mb_strlen($originalName, 'UTF-8') < self::MIN_LENGTH) {
            $errors[] = "El nombre debe tener al menos " . self::MIN_LENGTH . " caracteres";
        }

        if (mb_strlen($originalName, 'UTF-8') > self::MAX_LENGTH) {
            $errors[] = "El nombre no puede exceder los " . self::MAX_LENGTH . " caracteres";
        }

        // Only letters and spaces allowed
        if (!preg_match('/^[\p{L}\s]+$/u', $originalName)) {
            $errors[] = 'El nombre solo debe contener letras y espacios';
        }

        // Repeated characters check
        if (preg_match('/(.)\1{' . self::REPEATED_CHAR_LIMIT . ',}/u', $originalName)) {
            $errors[] = 'El nombre contiene demasiados caracteres repetidos';
        }

        // All-whitespace or nonsense
        if (preg_match('/^\s+$/', $originalName)) {
            $errors[] = 'El nombre no puede ser solo espacios';
        }

        // If basic validation passed, check blocked terms
        if (empty($errors)) {
            $blockedResult = $this->checkBlockedTerms($originalName);
            if (!$blockedResult['allowed']) {
                $errors[] = $blockedResult['message'];
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Check if a normalized name matches any blocked term in the database.
     *
     * @return array{allowed: bool, message?: string}
     */
    public function checkBlockedTerms(string $name): array
    {
        try {
            $normalizedName = $this->normalize($name);

            $activeTerms = BlockedTerm::active()->get(['term', 'severity']);

            foreach ($activeTerms as $blocked) {
                $blockedNormalized = $this->normalize($blocked->term);

                if (str_contains($normalizedName, $blockedNormalized)) {
                    $this->safeLog('info', 'Name validation: blocked term detected', [
                        'name' => $name,
                        'matched_term' => $blocked->term,
                        'severity' => $blocked->severity,
                    ]);

                    return [
                        'allowed' => false,
                        'message' => 'El nombre ingresado no está permitido',
                    ];
                }
            }

            return ['allowed' => true];
        } catch (\Throwable $e) {
            $this->safeLog('error', 'Error checking blocked terms: ' . $e->getMessage());
            return ['allowed' => true];
        }
    }

    /**
     * Safely log a message without requiring a fully bootstrapped Laravel app.
     */
    private function safeLog(string $level, string $message, array $context = []): void
    {
        try {
            Log::$level($message, $context);
        } catch (\Throwable $e) {
            // Silently ignore logging errors (e.g., when no Laravel app is bootstrapped)
        }
    }
}
