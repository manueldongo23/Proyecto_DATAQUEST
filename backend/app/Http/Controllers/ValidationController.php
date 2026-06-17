<?php
class ValidationController {
    public function computeClosure($data) {
        $attrs = explode(',', $data['attrs']);
        $attrs = array_map('trim', $attrs);
        $fds = NormalizationEngine::parseFDs($data['fdText']);
        $closure = NormalizationEngine::computeClosure($attrs, $fds, $attrs);
        if (isset($_SESSION['user_id'])) LogSistema::registrar('evento', "Cálculo de clausura", $_SESSION['user_id']);
        return ['closure' => $closure];
    }
    
    public function getNormalForm($data) {
        $attrs = explode(',', $data['attrs']);
        $attrs = array_map('trim', $attrs);
        $fds = NormalizationEngine::parseFDs($data['fdText']);
        $nf = NormalizationEngine::getNormalForm($attrs, $fds);
        $decomposition = NormalizationEngine::synthesize3FN($attrs, $fds);
        $report = NormalizationEngine::generateStepByStepReport($attrs, $fds);
        if (isset($_SESSION['user_id'])) LogSistema::registrar('evento', "Cálculo de FN: $nf", $_SESSION['user_id']);
        return ['normalForm' => $nf, 'decomposition' => $decomposition, 'report' => $report];
    }
    
    public function generateER($data) {
        $entities = SchemaParser::parse($data['tableText']);
        $mermaid = SchemaParser::toMermaid($entities);
        return ['mermaid' => $mermaid];
    }
}