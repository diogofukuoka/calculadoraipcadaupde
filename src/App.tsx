import React, { useState, useEffect } from 'react';
import { Calculator, AlertCircle, TrendingUp, Hash, Play, FileText, CheckCircle2, Calendar, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface IPCAData {
  data: string;
  valor: string;
}

interface ResultData {
  value: number;
  percentage: number;
}

interface ProcessedRow {
  id: string;
  sih: string;
  initialDateRaw: string;
  valRaw: string;
  val: number;
  result?: ResultData;
  error?: string;
}

export default function App() {
  const [ipcaData, setIpcaData] = useState<IPCAData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [rawInput, setRawInput] = useState<string>('');
  
  const getLastClosedYearMonth = () => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const [finalYearMonth, setFinalYearMonth] = useState<string>(getLastClosedYearMonth());
  
  const [rows, setRows] = useState<ProcessedRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  useEffect(() => {
    const fetchIpcaData = async () => {
      try {
        const response = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json');
        if (!response.ok) {
          throw new Error('Falha ao buscar dados da API');
        }
        const data = await response.json();
        setIpcaData(data);
        setFetchError(null);
      } catch (err) {
        setFetchError('Erro ao carregar dados do Banco Central. Tente novamente mais tarde.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchIpcaData();
  }, []);

  const parseToYearMonth = (dateStr: string) => {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}`; // YYYY-MM
    }
    return '';
  };

  const parseBRLFloat = (valStr: string) => {
    const cleanStr = valStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanStr);
  };

  const processAndCalculate = () => {
    if (ipcaData.length === 0) return;

    const lines = rawInput.trim().split('\n');
    const endYearMonth = finalYearMonth;

    const newRows = lines.map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) return null;

      const sih = parts[0];
      const initialDateRaw = parts[1];
      const valRaw = parts[2];

      const startYearMonth = parseToYearMonth(initialDateRaw);
      const val = parseBRLFloat(valRaw);

      let error;
      let result;

      if (!startYearMonth) {
        error = 'Último Mês de Entrada inválida.';
      } else if (!endYearMonth) {
        error = 'Data final não encontrada.';
      } else if (isNaN(val)) {
        error = 'Valor inválido.';
      } else if (val < 0) {
        error = 'Valor não pode ser negativo.';
      } else if (startYearMonth > endYearMonth) {
        error = 'Último Mês de Entrada > Data final.';
      } else {
        let fatorAcumulado = 1;
        let encontrouDados = false;

        for (let i = 0; i < ipcaData.length; i++) {
          const ipcaParts = ipcaData[i].data.split('/');
          const dataFormatada = `${ipcaParts[2]}-${ipcaParts[1]}`;

          if (dataFormatada >= startYearMonth && dataFormatada <= endYearMonth) {
            encontrouDados = true;
            const taxaDecimal = parseFloat(ipcaData[i].valor) / 100;
            fatorAcumulado *= (1 + taxaDecimal);
          }
        }

        if (!encontrouDados) {
          error = 'Sem dados de IPCA p/ período.';
        } else {
          result = {
            value: val * fatorAcumulado,
            percentage: (fatorAcumulado - 1) * 100
          };
        }
      }

      return {
        id: crypto.randomUUID(),
        sih,
        initialDateRaw,
        valRaw,
        val,
        result,
        error
      };
    }).filter(Boolean) as ProcessedRow[];

    setRows(newRows);
    if (newRows.length > 0) {
      setSelectedRowId(newRows[0].id);
    }
  };

  const exportToExcel = () => {
    if (rows.length === 0) return;

    const dataToExport = rows.map((row) => ({
      'SIH': row.sih,
      'Último Mês de Entrada': row.initialDateRaw,
      'Último Preço (R$)': row.val,
      'Data final': finalYearMonth.split('-').reverse().join('/'),
      'IPCA Acumulado (%)': row.result ? row.result.percentage / 100 : (row.error || 'Erro'),
      'Preço Corrigido (R$)': row.result ? Number(row.result.value.toFixed(4)) : (row.error || 'Erro'),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados IPCA');
    
    XLSX.writeFile(workbook, `calculo_ipca_${finalYearMonth}.xlsx`);
  };

  const selectedRow = rows.find(r => r.id === selectedRowId);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900 overflow-hidden">
      <div className="bg-white border border-slate-200 rounded-lg max-w-[1280px] w-full shadow-sm flex flex-col h-[800px] max-h-[90vh]">
        
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">
              C
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold leading-tight">Calculadora IPCA da UPDE</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Empty space for future actions if needed */}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex overflow-hidden bg-slate-50">
          
          {/* Central Area: Textarea & Data Grid */}
          <section className="flex-1 bg-white flex flex-col shadow-sm z-10 overflow-hidden border-r border-slate-200">
            <div className="h-8 bg-slate-100 border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
              <div className="flex gap-4">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span> Batch Processing
                </div>
                <div className="text-[11px] font-medium text-slate-500">{rows.length} records processed</div>
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                Data final: <span className="text-indigo-600 font-bold">{finalYearMonth.split('-').reverse().join('/')}</span>
              </div>
            </div>
            
            <div className="flex flex-col flex-1 overflow-hidden">
              
              {/* Input Area */}
              <div className="p-4 border-b border-slate-200 bg-white shrink-0 flex flex-col gap-3">
                
                {/* Status Notifications */}
                {loading && (
                  <div className="inline-flex items-center gap-2 p-2 px-3 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium rounded shadow-sm">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent"></div>
                    <span>Carregando série histórica do Banco Central...</span>
                  </div>
                )}
                {fetchError && (
                  <div className="inline-flex items-center gap-2 p-2 px-3 bg-red-50 border border-red-100 text-red-700 text-xs font-medium rounded shadow-sm">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fetchError}</span>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <FileText className="w-3 h-3" />
                    Cole os dados brutos
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Estrutura esperada: <strong className="text-slate-700">SIH | Último Mês de Entrada | Último Preço</strong>.
                  </p>
                  <textarea
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    className="w-full h-32 p-3 text-sm font-mono border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-slate-50 text-slate-700 shadow-inner"
                    placeholder={"1292\t03/03/2026\t0,04\n1293\t08/08/2024\t1,118\n1295\t03/03/2026\t14,2"}
                    disabled={loading}
                  />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Data Final (Mês/Ano)
                    </label>
                    <input
                      type="month"
                      value={finalYearMonth}
                      onChange={(e) => setFinalYearMonth(e.target.value)}
                      className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm text-slate-700"
                      disabled={loading}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {rows.length > 0 && (
                      <button
                        onClick={exportToExcel}
                        className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Baixar Excel
                      </button>
                    )}
                    <button
                      onClick={processAndCalculate}
                      disabled={loading || !!fetchError || !rawInput.trim() || !finalYearMonth}
                      className="bg-indigo-600 text-white text-xs font-semibold px-6 py-2.5 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" fill="currentColor" /> Processar Dados
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-x-auto overflow-y-auto bg-slate-50">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 shadow-sm">
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3 w-24">SIH</th>
                      <th className="p-3 w-32">Último Mês de Entrada</th>
                      <th className="p-3 w-32 text-right">Último Preço</th>
                      <th className="p-3 w-32 text-right">IPCA (%)</th>
                      <th className="p-3 w-40 text-right">Preço Corrigido</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-mono text-slate-700">
                    {rows.map((row, index) => (
                      <tr 
                        key={row.id} 
                        onClick={() => setSelectedRowId(row.id)}
                        className={`border-b border-slate-200 transition-colors cursor-pointer ${selectedRowId === row.id ? 'bg-indigo-50/70' : 'bg-white hover:bg-slate-50'}`}
                      >
                        <td className="p-2.5 text-center text-slate-400 text-xs">
                          {index + 1}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {row.sih}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {row.initialDateRaw}
                        </td>
                        <td className="p-2.5 text-right text-slate-600">
                          {row.valRaw}
                        </td>
                        <td className="p-2.5 text-right">
                          {row.error ? (
                            <span className="text-red-500 text-xs flex items-center justify-end gap-1" title={row.error}>
                              <AlertCircle className="w-3 h-3" /> Erro
                            </span>
                          ) : row.result ? (
                            <span className={row.result.percentage >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                              {row.result.percentage > 0 ? '+' : ''}{row.result.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}%
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          {row.result ? (
                            <span className="font-bold text-slate-900 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                              {row.result.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 text-sm bg-white">
                          Nenhum registro processado. Cole os dados e clique em "Processar Dados".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Right Panel: Analysis & Documentation */}
          <aside className="w-full md:w-80 bg-white flex flex-col shrink-0 overflow-y-auto">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 shrink-0">
              <h3 className="text-sm font-semibold mb-1">Row Analysis</h3>
              <p className="text-xs text-slate-500">
                Deep insights for <code className="bg-white border border-slate-200 px-1 rounded text-indigo-600">{selectedRow?.sih || 'selected_sih'}</code>
              </p>
            </div>
            
            <div className="flex-1 p-4 flex flex-col gap-6">
              {!selectedRow ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 h-full">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100">
                    <Hash className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-xs max-w-[200px] leading-relaxed">
                    Select a row in the table to view detailed execution metrics.
                  </p>
                </div>
              ) : selectedRow.error ? (
                 <div className="bg-red-50 rounded-lg p-4 border border-red-100 shadow-sm flex flex-col gap-2">
                   <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                     <AlertCircle className="w-4 h-4" /> Falha no Cálculo
                   </div>
                   <p className="text-sm text-red-900">{selectedRow.error}</p>
                 </div>
              ) : selectedRow.result ? (
                <div className="animate-in fade-in duration-300 flex flex-col gap-6">
                  {/* Result Metric */}
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor Corrigido</span>
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> SUCCESS
                      </span>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-2xl font-bold tracking-tight text-slate-800">
                        {selectedRow.result.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 pb-1 flex items-center gap-1">
                      Base: {selectedRow.val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>

                  {/* Percentage Metric */}
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IPCA Acumulado</span>
                      <span className={selectedRow.result.percentage >= 0 ? "px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded" : "px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded"}>
                        {selectedRow.result.percentage >= 0 ? 'HIGH' : 'LOW'}
                      </span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold text-slate-800 tracking-tight">
                        {selectedRow.result.percentage > 0 ? '+' : ''}{selectedRow.result.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}%
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${selectedRow.result.percentage >= 0 ? 'bg-indigo-500' : 'bg-red-500'}`} 
                        style={{ width: `${Math.min(Math.abs(selectedRow.result.percentage), 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Dependencies */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Row Details</h4>
                    <ul className="space-y-2">
                      <li className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                        <span className="text-slate-600 font-medium">SIH</span>
                        <span className="text-indigo-600 font-mono font-bold bg-indigo-50 px-1.5 rounded">{selectedRow.sih}</span>
                      </li>
                      <li className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                        <span className="text-slate-600 font-medium">Período</span>
                        <span className="text-slate-500">{selectedRow.initialDateRaw} → {finalYearMonth.split('-').reverse().join('/')}</span>
                      </li>
                      <li className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Data Source</span>
                        <span className="text-slate-400">BCB SGS 433</span>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer Status Bar for Right Panel */}
            <footer className="h-6 bg-indigo-600 text-white flex items-center justify-between px-3 text-[10px] mt-auto shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 font-medium">
                  main
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 opacity-90">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span>
                  {ipcaData.length > 0 ? 'API Sync Active' : 'Waiting...'}
                </div>
              </div>
            </footer>
          </aside>
        </main>
      </div>
    </div>
  );
}
