<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\GlossaryService;

class GlossaryServiceTest extends TestCase
{
    private GlossaryService $glossary;

    protected function setUp(): void
    {
        parent::setUp();
        $this->glossary = new GlossaryService();
    }

    public function test_returns_term_in_spanish(): void
    {
        $term = $this->glossary->getTerm('DF', 'es');

        $this->assertNotNull($term);
        $this->assertEquals('Dependencia Funcional', $term['name']);
        $this->assertEquals('DF', $term['short']);
        $this->assertEquals('basic', $term['difficulty']);
    }

    public function test_returns_term_in_english(): void
    {
        $term = $this->glossary->getTerm('DF', 'en');

        $this->assertNotNull($term);
        $this->assertEquals('Functional Dependency', $term['name']);
        $this->assertEquals('FD', $term['short']);
        $this->assertEquals('basic', $term['difficulty']);
    }

    public function test_returns_term_in_portuguese(): void
    {
        $term = $this->glossary->getTerm('DF', 'pt-BR');

        $this->assertNotNull($term);
        $this->assertEquals('Dependência Funcional', $term['name']);
        $this->assertEquals('DF', $term['short']);
    }

    public function test_returns_null_for_unknown_term(): void
    {
        $term = $this->glossary->getTerm('TERMINO_INEXISTENTE', 'es');

        $this->assertNull($term);
    }

    public function test_searches_terms(): void
    {
        $results = $this->glossary->search('dependencia', 'es');

        $this->assertNotEmpty($results);
        $this->assertArrayHasKey('DF', $results);
    }

    public function test_searches_in_english(): void
    {
        $results = $this->glossary->search('functional', 'en');

        $this->assertNotEmpty($results);
        $this->assertArrayHasKey('DF', $results);
    }

    public function test_returns_empty_for_empty_query(): void
    {
        $results = $this->glossary->search('', 'es');

        $this->assertEmpty($results);
    }

    public function test_filters_by_difficulty(): void
    {
        $basic = $this->glossary->getTermsByDifficulty('basic', 'es');

        $this->assertNotEmpty($basic);

        foreach ($basic as $term) {
            $this->assertEquals('basic', $term['difficulty']);
        }
    }

    public function test_filters_intermediate_terms(): void
    {
        $intermediate = $this->glossary->getTermsByDifficulty('intermediate', 'es');

        $this->assertNotEmpty($intermediate);

        foreach ($intermediate as $term) {
            $this->assertEquals('intermediate', $term['difficulty']);
        }
    }

    public function test_filters_advanced_terms(): void
    {
        $advanced = $this->glossary->getTermsByDifficulty('advanced', 'es');

        $this->assertNotEmpty($advanced);

        foreach ($advanced as $term) {
            $this->assertEquals('advanced', $term['difficulty']);
        }
    }

    public function test_returns_all_terms(): void
    {
        $all = $this->glossary->getAllTerms('es');

        $this->assertNotEmpty($all);
        $this->assertArrayHasKey('DF', $all);
        $this->assertArrayHasKey('1FN', $all);
        $this->assertArrayHasKey('BCNF', $all);
        $this->assertArrayHasKey('4FN', $all);
    }

    public function test_returns_related_terms(): void
    {
        $related = $this->glossary->getRelatedTerms('DF', 'es');

        $this->assertNotEmpty($related);
    }

    public function test_falls_back_to_spanish_for_unsupported_locale(): void
    {
        $term = $this->glossary->getTerm('DF', 'fr');

        $this->assertNotNull($term);
        $this->assertEquals('Dependencia Funcional', $term['name']);
    }
}
