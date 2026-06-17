import React, { useState } from 'react';
import { Download, FileText, Code, GitBranch } from 'lucide-react';
import axiosInstance from '../services/api';
import { toast } from './Toast';

interface ExportPanelProps {
  tableName: string;
  attributes: string[];
  dependencies: { determinant: string[]; dependent: string[] }[];
}

export const ExportPanel: React.FC<ExportPanelProps> = (props) => {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: string) => {
    setExporting(format);
    try {
      const res = await axiosInstance.post(`/export/${format}`, {
        table_name: props.tableName,
        attributes: props.attributes,
        dependencies: props.dependencies,
      }, { responseType: 'text' });

      // Download as file
      const blob = new Blob([res.data], { type: format === 'html' ? 'text/html' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${props.tableName}.${format === 'html' ? 'html' : format}`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} exportado correctamente`);
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
        <Download className="w-4 h-4 text-indigo-500" />
        Exportar Resultados
      </h3>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => handleExport('dbml')} disabled={exporting !== null}
          className="btn-secondary text-sm flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
          <Code className="w-4 h-4" /> DBML
        </button>
        <button onClick={() => handleExport('mermaid')} disabled={exporting !== null}
          className="btn-secondary text-sm flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
          <GitBranch className="w-4 h-4" /> Mermaid
        </button>
        <button onClick={() => handleExport('html')} disabled={exporting !== null}
          className="btn-secondary text-sm flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
          <FileText className="w-4 h-4" /> HTML
        </button>
        <button onClick={() => handleExport('all')} disabled={exporting !== null}
          className="btn-primary text-sm flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
          <Download className="w-4 h-4" /> Todo
        </button>
      </div>
    </div>
  );
};
