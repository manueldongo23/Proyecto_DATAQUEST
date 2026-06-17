<?php
namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class PdfReportService
{
    private NormalizationEngine $engine;
    private SqlGenerationService $sqlService;
    private MermaidGenerationService $mermaid;

    public function __construct(
        ?NormalizationEngine $engine = null,
        ?SqlGenerationService $sqlService = null,
        ?MermaidGenerationService $mermaid = null
    ) {
        $this->engine = $engine ?? new NormalizationEngine();
        $this->sqlService = $sqlService ?? new SqlGenerationService();
        $this->mermaid = $mermaid ?? new MermaidGenerationService();
    }

    public function generateReport(RelationSchema $schema, array $diagnosis, array $decomposition = [], string $dialect = 'postgresql'): string
    {
        return $this->generateHtmlReport($schema, $diagnosis, $decomposition, $dialect);
    }

    public function generateHtmlReport(RelationSchema $schema, array $diagnosis, array $decomposition = [], string $dialect = 'postgresql'): string
    {
        $candidateKeys = $this->engine->findCandidateKeys($schema);
        $attributes = $schema->getAttributesSet();
        $fds = $schema->getFds();
        $currentNf = $diagnosis['current_nf'] ?? '1NF';
        $violations = $diagnosis['violations'] ?? [];
        $suggestions = $diagnosis['suggestions'] ?? [];
        $engineLabel = strtoupper($decomposition['sql_engine'] ?? $dialect);
        $sql = '';

        if (!empty($decomposition)) {
            $sql = $decomposition['sql'] ?? '';
        } elseif (empty($decomposition)) {
            $sql = $this->sqlService->generateCreateTable($schema, $dialect);
        }

        // Build attribute rows
        $attrRows = '';
        foreach ($attributes as $attr) {
            $isPk = in_array($attr, $candidateKeys[0] ?? []);
            $attrRows .= "<tr>
                <td style=\"padding:8px;border:1px solid #ddd;\">{$attr}</td>
                <td style=\"padding:8px;border:1px solid #ddd;\">" . ($isPk ? '<strong>PK</strong>' : '') . "</td>
            </tr>\n";
        }

        // Build FD rows
        $fdRows = '';
        foreach ($fds as $fd) {
            $fdRows .= "<tr>
                <td style=\"padding:8px;border:1px solid #ddd;\">{" . implode(', ', $fd->determinant) . "}</td>
                <td style=\"padding:8px;border:1px solid #ddd;\">→</td>
                <td style=\"padding:8px;border:1px solid #ddd;\">{" . implode(', ', $fd->dependent) . "}</td>
            </tr>\n";
        }

        // Build violation items
        $violationItems = '';
        foreach ($violations as $v) {
            $violationItems .= "<li style=\"color:#dc2626;font-weight:600;\">Viola {$v}</li>\n";
        }

        // Build suggestion items
        $suggestionItems = '';
        foreach ($suggestions as $s) {
            $suggestionItems .= "<li>{$s}</li>\n";
        }

        // Build candidate keys
        $ckHtml = '';
        foreach ($candidateKeys as $ck) {
            $ckHtml .= "<span style=\"display:inline-block;background:#e0e7ff;padding:4px 12px;border-radius:6px;font-family:monospace;margin:2px;\">{" . implode(', ', $ck) . "}</span>\n";
        }

        // Build decomposition table
        $decompRows = '';
        if (!empty($decomposition['resulting_tables'])) {
            foreach ($decomposition['resulting_tables'] as $table) {
                $decompRows .= "<tr>
                    <td style=\"padding:8px;border:1px solid #ddd;\">{$table['name']}</td>
                    <td style=\"padding:8px;border:1px solid #ddd;\">" . implode(', ', $table['attributes']) . "</td>
                    <td style=\"padding:8px;border:1px solid #ddd;\">" . implode(', ', $table['primary_key'] ?? []) . "</td>
                </tr>\n";
            }
        }

        // Generate Mermaid ER diagram text
        $decompSchemas = $decomposition['resulting_tables'] ?? [];
        $mermaidEr = $this->mermaid->generateErDiagram($schema, $decompSchemas);

        $html = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>DataQuest - Reporte de Normalización: {$schema->name}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #f8fafc; }
  .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  h1 { font-size: 24px; margin-bottom: 4px; color: #1e293b; }
  h2 { font-size: 18px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 32px; }
  .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #f1f5f9; padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 13px; font-weight: 600; }
  td { font-size: 13px; }
  .nf-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; }
  .nf-1nf { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .nf-2nf { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
  .nf-3nf { background: #fefce8; color: #ca8a04; border: 1px solid #fef08a; }
  .nf-bcnf { background: #ecfdf5; color: #16a34a; border: 1px solid #bbf7d0; }
  .pre { background: #1e293b; color: #a5f3fc; padding: 16px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap; }
  .mermaid-text { background: #f1f5f9; padding: 16px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre; overflow-x: auto; border: 1px solid #e2e8f0; }
  .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; font-size: 13px; }
</style>
</head>
<body>
<div class="container">
  <h1>📊 Reporte de Normalización</h1>
  <p class="subtitle">DataQuest — Generado el " . date('Y-m-d H:i:s') . "</p>

  <p class="subtitle">Motor SQL: {$engineLabel}</p>

  <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
    <span>Esquema: <strong>{$schema->name}</strong></span>
    <span class="nf-badge nf-" . strtolower($currentNf) . "\">{$currentNf}</span>
  </div>

  <h2>Atributos</h2>
  <table>
    <thead><tr><th>Atributo</th><th>Clave</th></tr></thead>
    <tbody>{$attrRows}</tbody>
  </table>

  <h2>Dependencias Funcionales</h2>
  <table>
    <thead><tr><th>Determinante</th><th></th><th>Dependiente</th></tr></thead>
    <tbody>{$fdRows}</tbody>
  </table>

  <h2>Diagnóstico</h2>
  <p><strong>Forma Normal Actual:</strong> {$currentNf}</p>
  <ul>{$violationItems}</ul>

  <h2>Claves Candidatas</h2>
  <div>{$ckHtml}</div>

  <h2>Sugerencias</h2>
  <ul>{$suggestionItems}</ul>

HTML;

        if (!empty($decompRows)) {
            $html .= <<<HTML
  <h2>Descomposición Propuesta</h2>
  <table>
    <thead><tr><th>Tabla</th><th>Atributos</th><th>Clave Primaria</th></tr></thead>
    <tbody>{$decompRows}</tbody>
  </table>
HTML;
        }

        $html .= <<<HTML
  <h2>SQL Generado</h2>
  <div class="pre">{$sql}</div>

  <h2>Diagrama ER (Mermaid)</h2>
  <div class="mermaid-text">{$mermaidEr}</div>

  <div class="footer">
    DataQuest — Plataforma Interactiva de Aprendizaje de Normalización de Bases de Datos
  </div>
</div>
</body>
</html>
HTML;

        return $html;
    }
}
