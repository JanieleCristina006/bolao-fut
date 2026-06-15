import { useEffect, useMemo, useState } from "react";
import { Download, FileDown, KeyRound, RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PagamentoTable } from "../components/pagamentos/PagamentoTable";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { Select } from "../components/ui/Select";
import { useDebounce } from "../hooks/useDebounce";
import { usePagamentos } from "../hooks/usePagamentos";
import { useToast } from "../components/ui/Toast";
import { api, isAdminWritesEnabled } from "../services/api";
import type { Pagamento } from "../types";
import { PIX_INFO } from "../constants";
import { filtrarPagamentos } from "../utils/filtros";
import { formatarMoeda } from "../utils/formatadores";
import { gerarPdfPagamentos } from "../utils/gerarPdfPagamentos";

function exportarCsv(pagamentos: Pagamento[]): void {
  const linhas = [
    ["Participante", "Pago", "Data", "Valor", "Situação"],
    ...pagamentos.map((pagamento) => [
      pagamento.participante,
      pagamento.pago ? "sim" : "não",
      pagamento.dataPagamento ?? "",
      String(pagamento.valor),
      pagamento.situacao
    ])
  ];
  const csv = linhas.map((linha) => linha.map((valor) => `"${valor.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pagamentos-bolao.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function Pagamentos() {
  const { data, isLoading, error, refetch } = usePagamentos();
  const { showToast } = useToast();
  const adminWritesEnabled = isAdminWritesEnabled();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get("busca") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "todos");
  const [dataPagamento, setDataPagamento] = useState(searchParams.get("data") ?? "");
  const [adminToken, setAdminToken] = useState(window.sessionStorage.getItem("bolao-admin-token") ?? "");
  const buscaDebounced = useDebounce(busca);

  useEffect(() => {
    const params = new URLSearchParams();
    if (buscaDebounced) params.set("busca", buscaDebounced);
    if (status !== "todos") params.set("status", status);
    if (dataPagamento) params.set("data", dataPagamento);
    setSearchParams(params, { replace: true });
  }, [buscaDebounced, dataPagamento, setSearchParams, status]);

  const filtrado = useMemo(() => filtrarPagamentos(data ?? [], buscaDebounced, status, dataPagamento), [buscaDebounced, data, dataPagamento, status]);
  const totalPago = filtrado.filter((pagamento) => pagamento.pago).length;
  const totalPendente = filtrado.length - totalPago;
  const valorArrecadado = filtrado.filter((pagamento) => pagamento.pago).reduce((total, pagamento) => total + pagamento.valor, 0);
  const valorReceber = filtrado.filter((pagamento) => !pagamento.pago).reduce((total, pagamento) => total + pagamento.valor, 0);

  async function alterarPagamento(pagamento: Pagamento) {
    if (!isAdminWritesEnabled()) {
      showToast("A planilha Excel direta é somente leitura. Use Google Apps Script para gravar alterações.");
      return;
    }
    if (!adminToken) {
      showToast("Informe o token administrativo antes de alterar pagamentos.");
      return;
    }
    const novoStatusPago = !pagamento.pago;
    const confirmacao = window.confirm(`Confirmar ${novoStatusPago ? "pagamento" : "pendência"} de ${pagamento.participante}?`);
    if (!confirmacao) return;

    const hoje = new Date().toISOString().slice(0, 10);
    const resposta = await api.atualizarPagamento({
      participante: pagamento.participante,
      pago: novoStatusPago,
      dataPagamento: novoStatusPago ? hoje : "",
      adminToken
    });
    showToast(resposta.message);
    await refetch();
  }

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (error || !data) return <ErrorState message={error ?? "Pagamentos indisponíveis."} onRetry={refetch} />;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Pagamentos</h2>
          <p className="text-sm font-bold text-brand-600">{PIX_INFO.texto}</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="secondary" icon={<FileDown className="h-4 w-4" aria-hidden />} onClick={() => exportarCsv(filtrado)}>
            Exportar CSV
          </Button>
          <Button icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => gerarPdfPagamentos(filtrado)}>
            Exportar pagamentos em PDF
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Participantes", filtrado.length],
          ["Total pago", totalPago],
          ["Total pendente", totalPendente],
          ["Arrecadado", formatarMoeda(valorArrecadado)],
          ["A receber", formatarMoeda(valorReceber)]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardBody>
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <strong className="mt-1 block text-2xl font-black text-slate-950">{value}</strong>
            </CardBody>
          </Card>
        ))}
      </section>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft no-print md:grid-cols-5">
        <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar participante" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">Todos</option>
          <option value="pago">Pagos</option>
          <option value="pendente">Pendentes</option>
        </Select>
        <Input type="date" value={dataPagamento} onChange={(event) => setDataPagamento(event.target.value)} />
        <Input
          type="password"
          value={adminToken}
          onChange={(event) => {
            setAdminToken(event.target.value);
            window.sessionStorage.setItem("bolao-admin-token", event.target.value);
          }}
          placeholder="Token administrativo"
          aria-label="Token administrativo"
        />
        <Button
          variant="ghost"
          icon={<RotateCcw className="h-4 w-4" aria-hidden />}
          onClick={() => {
            setBusca("");
            setStatus("todos");
            setDataPagamento("");
          }}
        >
          Limpar filtros
        </Button>
      </div>

      <Card className="no-print">
        <CardBody className="flex items-center gap-3 text-sm text-slate-600">
          <KeyRound className="h-5 w-5 text-brand-600" aria-hidden />
          {adminWritesEnabled
            ? "A edição usa token validado pelo Google Apps Script via PropertiesService."
            : "Modo Excel direto: leitura habilitada, escrita desativada no navegador."}
        </CardBody>
      </Card>

      {filtrado.length === 0 ? (
        <EmptyState />
      ) : (
        <PagamentoTable pagamentos={filtrado} canEdit={Boolean(adminToken) && adminWritesEnabled} onToggle={alterarPagamento} />
      )}
    </div>
  );
}
