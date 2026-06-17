<?php
require 'backend/app/Core/NormalizationEngine.php';

$allAttrs = [];
for ($i=1; $i<=200; $i++) $allAttrs[] = "attr_$i";

$fds = [
    ['lhs' => ['attr_1', 'attr_2'], 'rhs' => array_slice($allAttrs, 2)]
];

$nf = NormalizationEngine::getNormalForm($allAttrs, $fds);
echo "NF: $nf\n";

$decomposition = NormalizationEngine::synthesize3FN($allAttrs, $fds);
echo "Decomp count: " . count($decomposition) . "\n";

$report = NormalizationEngine::generateStepByStepReport($allAttrs, $fds);
echo "Report count: " . count($report) . "\n";
echo "Success\n";
