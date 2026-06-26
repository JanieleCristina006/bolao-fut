# Bolão Futebol Inglês

Frontend completo em React + Vite + TypeScript conectado em tempo real a uma planilha do Google por Google Apps Script.

## Stack

- React puro com Vite
- TypeScript
- Tailwind CSS
- React Router DOM
- Lucide React
- Fetch API
- jsPDF e jspdf-autotable
- Google Apps Script para leitura e escrita
- PWA instalavel com manifest e service worker

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
# Fonte principal em tempo real via Google Apps Script.
VITE_GOOGLE_SCRIPT_API_URL=/api/sheets

# URL real do Apps Script usada pelo proxy local/Netlify/Vercel.
GOOGLE_SCRIPT_API_URL=https://script.google.com/macros/s/SEU_ID/exec

# Connection string do Neon usada pelo servidor para senha dos participantes.
DATABASE_URL=postgresql://usuario:senha@host/neondb?sslmode=require
```

O aplicativo usa somente a integração com o Google Planilhas. Se a integração ainda não estiver configurada, as telas exibem o erro de conexão; nenhum dado local ou demonstrativo é usado como substituto.

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
SPREADSHEET_ID=id-da-planilha-do-google
```

O `SPREADSHEET_ID` e o trecho da URL da planilha entre `/d/` e `/edit`.

5. Clique em `Implantar > Nova implantação`.
6. Tipo: `Aplicativo da Web`.
7. Executar como: sua conta.
8. Quem tem acesso: conforme sua necessidade, normalmente `Qualquer pessoa com o link`.
9. Copie a URL `/exec` e coloque em `GOOGLE_SCRIPT_API_URL`. Mantenha `VITE_GOOGLE_SCRIPT_API_URL=/api/sheets`.

Quando alterar o `Code.gs`, nao basta salvar: va em `Implantar > Gerenciar implantacoes`, clique no lapis, selecione `Nova versao` e implante novamente. Se a implantacao antiga continuar ativa, o frontend pode receber sucesso de uma versao anterior do script.

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

O frontend chama `/api/sheets` no mesmo domínio. Essa rota atua como proxy, chama o Apps Script pelo servidor e evita o bloqueio CORS causado pelo redirecionamento do `script.google.com`.

## Login de participantes com Neon

Os nomes dos participantes continuam vindo da planilha. O Neon guarda somente a senha numerica de 6 digitos escolhida por cada participante.

1. Crie um projeto no Neon.
2. No painel do Neon, clique em `Connect` e copie a connection string do banco.
3. Configure essa string como `DATABASE_URL` no `.env`, na Vercel ou na Netlify.
4. Rode o app. A tabela `participante_auth` sera criada automaticamente no primeiro login.

SQL criado automaticamente pela API:

```sql
create table if not exists participante_auth (
  participante_key text primary key,
  participante_nome text not null,
  pin text,
  pin_configurado_em timestamptz,
  ultimo_login_em timestamptz,
  tentativas_falhas integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
```

Essa senha e simples e fica salva pura no Neon, conforme escolhido para este projeto. Nao use esse modelo para dados sensiveis.

## Segurança administrativa

A visualização pode ser pública. Edição de pagamentos, resultados e palpites exige o token salvo em `PropertiesService` como `ADMIN_TOKEN`.

Essa é uma proteção simples. Para um bolão grande e público, o ideal é usar backend próprio com autenticação real, permissões por usuário e auditoria.

## Como testar

Leitura em tempo real com Google Apps Script:

1. Configure `VITE_GOOGLE_SCRIPT_API_URL=/api/sheets` e `GOOGLE_SCRIPT_API_URL=https://script.google.com/macros/s/SEU_ID/exec` no `.env`.
2. Rode `npm run dev`.
3. Abra Dashboard, Ranking, Jogos, Participantes e Pagamentos.
4. Altere algum dado na planilha do Google.
5. Aguarde até 1 minuto ou use o botão `Atualizar dados` para buscar a mudança na hora.

Escrita com Google Apps Script:

1. Configure `ADMIN_TOKEN` no Apps Script.
2. Configure `VITE_GOOGLE_SCRIPT_API_URL=/api/sheets` e `GOOGLE_SCRIPT_API_URL` no `.env`.
3. Abra a página `Pagamentos`.
4. Digite o token administrativo.
5. Altere um pagamento.
6. Confira se apenas a célula de status/data foi atualizada na aba `BOLÃO - PAGAMENTO`.

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
6. Configure `VITE_GOOGLE_SCRIPT_API_URL=/api/sheets` nas variáveis de ambiente da Vercel.
7. Configure `GOOGLE_SCRIPT_API_URL` com a URL `/exec` do Apps Script nas variáveis de ambiente da Vercel.
8. Publique.

## Publicar na Netlify

O projeto inclui `netlify.toml` e a Function `netlify/functions/sheets.js`. Na Netlify, `/api/sheets` é reescrito para essa Function, que chama o Google Apps Script pelo servidor e evita CORS.

1. Envie o projeto para um repositório Git.
2. Crie um projeto na Netlify.
3. Build command: `npm run build`.
4. Publish directory: `dist`.
5. Functions directory: `netlify/functions`.
6. Configure `GOOGLE_SCRIPT_API_URL` com a URL `/exec` do Apps Script nas variáveis de ambiente da Netlify.
7. Não precisa configurar `VITE_GOOGLE_SCRIPT_API_URL` na Netlify, porque `netlify.toml` já define `/api/sheets` no build.
8. Publique novamente depois de alterar as variáveis.

## PWA

O app possui `manifest.webmanifest`, service worker e icones PNG em `public/icons`, entao pode ser instalado pelo navegador como aplicativo.

Para testar localmente:

1. Rode `npm run build`.
2. Rode `npm run preview`.
3. Abra a URL do preview no Chrome/Edge.
4. Use o botao de instalar na barra do navegador ou no menu.

O service worker cacheia o shell do app e assets estaticos. As chamadas `/api/sheets` sempre usam rede para evitar dados antigos da planilha.

## Pontuação

A pontuação é calculada no frontend por `src/utils/calcularPontuacao.ts`:

- Placar exato: 5 pontos
- Vencedor correto: 2 pontos
- Empate correto com placar diferente: 2 pontos
- Erro: 0 pontos
- Sem resultado: pendente

O ranking desempata por pontos, depois cravadas, depois ordem original.
