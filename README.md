# Bolão Futebol Inglês

Frontend completo em React + Vite + TypeScript para transformar uma planilha de bolão em um portal esportivo moderno, responsivo e com modo demonstração.

## Stack

- React puro com Vite
- TypeScript
- Tailwind CSS
- React Router DOM
- Lucide React
- Fetch API
- jsPDF e jspdf-autotable
- Leitura direta de arquivo Excel (`.xlsx`)
- Google Apps Script opcional para escrita administrativa

## Como executar localmente

```bash
npm install
npm run dev
```

Para validar a build:

```bash
npm run build
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e configure:

```env
VITE_EXCEL_FILE_URL=/data/BOLAO_FUTEBOL_INGLESS.xlsx

# Opcional: use Google Apps Script quando precisar gravar pagamentos/resultados/palpites.
# VITE_GOOGLE_SCRIPT_API_URL=https://script.google.com/macros/s/SEU_ID/exec
```

O arquivo Excel precisa estar disponível para o navegador. Neste projeto, a planilha foi copiada para:

```text
public/data/BOLAO_FUTEBOL_INGLESS.xlsx
```

Por isso a URL usada no `.env` é `/data/BOLAO_FUTEBOL_INGLESS.xlsx`.

Prioridade das fontes de dados:

1. `VITE_EXCEL_FILE_URL`
2. `VITE_GOOGLE_SCRIPT_API_URL`
3. `src/mocks/data.ts`

Enquanto nenhuma variável existir, o app usa `src/mocks/data.ts` automaticamente.

## Estrutura principal

```text
src/
  components/
    layout/
    dashboard/
    ranking/
    jogos/
    participantes/
    pagamentos/
    ui/
  pages/
  services/
  hooks/
  utils/
  types/
  constants/
  mocks/
google-apps-script/
  Code.gs
```

## Google Apps Script

1. Abra a planilha do bolão no Google Planilhas.
2. Vá em `Extensões > Apps Script`.
3. Cole o conteúdo de `google-apps-script/Code.gs`.
4. Em `Configurações do projeto > Propriedades do script`, adicione:

```text
ADMIN_TOKEN=uma-senha-segura
```

5. Clique em `Implantar > Nova implantação`.
6. Tipo: `Aplicativo da Web`.
7. Executar como: sua conta.
8. Quem tem acesso: conforme sua necessidade, normalmente `Qualquer pessoa com o link`.
9. Copie a URL `/exec` e coloque em `VITE_GOOGLE_SCRIPT_API_URL`.

O script procura as abas:

- `BOLÃO - PALPITES`
- `BOLÃO - TABELA`
- `BOLÃO - PAGAMENTO`
- `RANKING`

Também aceita aliases sem acento para reduzir risco de divergência de nome.

## API esperada

GET:

- `?action=dashboard`
- `?action=ranking`
- `?action=jogos`
- `?action=palpites`
- `?action=pagamentos`
- `?action=participantes`
- `?action=participante&nome=Nome`

POST:

```json
{
  "action": "atualizarPagamento",
  "participante": "Nome do participante",
  "pago": true,
  "dataPagamento": "2026-06-13",
  "adminToken": "uma-senha-segura"
}
```

```json
{
  "action": "atualizarResultado",
  "jogoId": "dia-1-mex-afs",
  "resultado": "2x1",
  "adminToken": "uma-senha-segura"
}
```

```json
{
  "action": "atualizarPalpite",
  "participante": "Nome",
  "jogoId": "dia-1-mex-afs",
  "palpite": "2x1",
  "adminToken": "uma-senha-segura"
}
```

O frontend envia POST como `text/plain;charset=utf-8` para evitar preflight CORS comum em Apps Script.

## Segurança administrativa

A visualização pode ser pública. Edição de pagamentos, resultados e palpites exige o token salvo em `PropertiesService` como `ADMIN_TOKEN`.

Essa é uma proteção simples. Para um bolão grande e público, o ideal é usar backend próprio com autenticação real, permissões por usuário e auditoria.

## Como testar

Leitura com Excel:

1. Configure `VITE_EXCEL_FILE_URL=/data/BOLAO_FUTEBOL_INGLESS.xlsx` no `.env`.
2. Rode `npm run dev`.
3. Abra Dashboard, Ranking, Jogos, Participantes e Pagamentos.
4. Use o botão `Atualizar dados` no Dashboard ou Ranking.

Escrita com Google Apps Script:

1. Configure `ADMIN_TOKEN` no Apps Script.
2. Configure `VITE_GOOGLE_SCRIPT_API_URL` no `.env`.
3. Remova ou comente `VITE_EXCEL_FILE_URL` se quiser que o app use a API como fonte principal.
4. Abra a página `Pagamentos`.
5. Digite o token administrativo.
6. Altere um pagamento.
7. Confira se apenas a célula de status/data foi atualizada na aba `BOLÃO - PAGAMENTO`.

Com `VITE_EXCEL_FILE_URL`, a planilha é lida diretamente pelo navegador e fica em modo somente leitura. Para gravar alterações em arquivo/planilha, é necessário Google Apps Script ou backend.

Para resultados e palpites, o Apps Script já possui ações preparadas. A interface atual expõe edição de pagamentos e mantém as demais rotas prontas para expansão administrativa.

## PDFs e impressão

O app gera PDFs A4 com cabeçalho, rodapé, data de emissão e paginação automática para:

- Ranking completo
- Palpites de um jogo
- Palpites filtrados
- Palpites de um participante
- Relatório individual
- Pagamentos
- Relatório geral

Também há botões de impressão nas páginas de Ranking e Jogos.

## Publicar na Vercel

1. Envie o projeto para um repositório Git.
2. Crie um projeto na Vercel.
3. Framework: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Configure `VITE_EXCEL_FILE_URL` nas variáveis de ambiente da Vercel se a planilha estiver em `public/data`.
7. Se for usar escrita administrativa, configure também `VITE_GOOGLE_SCRIPT_API_URL`.
8. Publique.

## Pontuação

A pontuação é calculada no frontend por `src/utils/calcularPontuacao.ts`:

- Placar exato: 5 pontos
- Vencedor correto: 2 pontos
- Empate correto com placar diferente: 1 ponto
- Erro: 0 pontos
- Sem resultado: pendente

O ranking desempata por pontos, depois cravadas, depois ordem original.
