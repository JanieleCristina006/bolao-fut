import { CircleDollarSign, Medal, Target } from "lucide-react";
import { PIX_INFO, PONTUACAO_LABELS } from "../constants";
import { Badge } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { formatarMoeda } from "../utils/formatadores";

const regras = [
  "Placar exato vale 5 pontos",
  "Vencedor correto vale 2 pontos",
  "Empate correto com placar diferente vale 1 ponto",
  "Palpite errado vale 0 pontos",
  "O ranking desempata pela quantidade de placares cravados",
  `Valor do bolão: ${formatarMoeda(PIX_INFO.valor)}`,
  "Prazo do PIX: 27/06"
];

const legenda = [
  { tipo: "exato", tone: "green", pontos: "5 pontos" },
  { tipo: "vencedor", tone: "blue", pontos: "2 pontos" },
  { tipo: "empate", tone: "yellow", pontos: "1 ponto" },
  { tipo: "erro", tone: "red", pontos: "0 pontos" },
  { tipo: "pendente", tone: "gray", pontos: "sem resultado" }
] as const;

export function Regulamento() {
  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div>
        <h2 className="text-2xl font-black text-slate-950">Regulamento</h2>
        <p className="text-sm text-slate-500">Critérios de pontuação, desempate e pagamentos.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader className="flex items-center gap-3">
            <Target className="h-5 w-5 text-brand-600" aria-hidden />
            <h2 className="text-lg font-black text-slate-950">Regras</h2>
          </CardHeader>
          <CardBody>
            <ul className="grid gap-3">
              {regras.map((regra) => (
                <li key={regra} className="rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">
                  {regra}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-3">
            <Medal className="h-5 w-5 text-brand-600" aria-hidden />
            <h2 className="text-lg font-black text-slate-950">Legenda dos palpites</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {legenda.map((item) => (
              <div key={item.tipo} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <strong className="text-slate-950">{PONTUACAO_LABELS[item.tipo]}</strong>
                  <p className="text-sm text-slate-500">{item.pontos}</p>
                </div>
                <Badge tone={item.tone}>{item.tipo}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardBody className="flex items-center gap-3">
          <CircleDollarSign className="h-6 w-6 text-brand-600" aria-hidden />
          <div>
            <strong className="text-slate-950">{PIX_INFO.texto}</strong>
            <p className="text-sm text-slate-500">A baixa administrativa de pagamentos fica protegida por token.</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
