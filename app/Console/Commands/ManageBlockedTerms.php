<?php

namespace App\Console\Commands;

use App\Models\BlockedTerm;
use Illuminate\Console\Command;

class ManageBlockedTerms extends Command
{
    protected $signature = 'blocked-terms
        {action : list|add|remove|toggle}
        {term? : The term to manage}
        {--category=general : Category for the term}
        {--severity=medium : Severity level (low|medium|high)}
        {--description= : Description of the term}';

    protected $description = 'Manage blocked terms for name validation';

    public function handle(): int
    {
        $action = $this->argument('action');

        return match ($action) {
            'list'   => $this->listTerms(),
            'add'    => $this->addTerm(),
            'remove' => $this->removeTerm(),
            'toggle' => $this->toggleTerm(),
            default  => $this->error('Unknown action. Use: list, add, remove, toggle'),
        };
    }

    private function listTerms(): int
    {
        $terms = BlockedTerm::orderBy('category')->get(['id', 'term', 'category', 'severity', 'is_active']);
        if ($terms->isEmpty()) {
            $this->info('No blocked terms found.');
            return 0;
        }
        $this->table(['ID', 'Term', 'Category', 'Severity', 'Active'], $terms->toArray());
        return 0;
    }

    private function addTerm(): int
    {
        $term = $this->argument('term');
        if (!$term) {
            $this->error('Please provide a term to add.');
            return 1;
        }

        BlockedTerm::create([
            'term' => strtolower(trim($term)),
            'category' => $this->option('category'),
            'severity' => $this->option('severity'),
            'description' => $this->option('description'),
        ]);

        $this->info("Term '{$term}' added successfully.");
        return 0;
    }

    private function removeTerm(): int
    {
        $term = $this->argument('term');
        if (!$term) {
            $this->error('Please provide a term to remove.');
            return 1;
        }

        $deleted = BlockedTerm::where('term', strtolower(trim($term)))->delete();
        if ($deleted) {
            $this->info("Term '{$term}' removed.");
        } else {
            $this->warn("Term '{$term}' not found.");
        }
        return 0;
    }

    private function toggleTerm(): int
    {
        $term = $this->argument('term');
        if (!$term) {
            $this->error('Please provide a term to toggle.');
            return 1;
        }

        $record = BlockedTerm::where('term', strtolower(trim($term)))->first();
        if (!$record) {
            $this->warn("Term '{$term}' not found.");
            return 1;
        }

        $record->update(['is_active' => !$record->is_active]);
        $status = $record->is_active ? 'activated' : 'deactivated';
        $this->info("Term '{$term}' {$status}.");
        return 0;
    }
}
