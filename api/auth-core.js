import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
let sqlClient;
let setupPromise;

function getSql() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL nao configurada no servidor.");
  }
  if (!sqlClient) sqlClient = neon(DATABASE_URL);
  return sqlClient;
}

function normalizarChave(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_/.,;:()[\]{}!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureTable() {
  if (!setupPromise) {
    const sql = getSql();
    setupPromise = sql`
      create table if not exists participante_auth (
        participante_key text primary key,
        participante_nome text not null,
        pin text,
        pin_configurado_em timestamptz,
        ultimo_login_em timestamptz,
        tentativas_falhas integer not null default 0,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      )
    `;
  }
  await setupPromise;
}

function validarParticipante(participante) {
  const participanteNome = String(participante || "").trim().replace(/\s+/g, " ");
  const participanteKey = normalizarChave(participanteNome);
  if (!participanteNome || !participanteKey) {
    return { error: "Informe o participante." };
  }
  return { participanteNome, participanteKey };
}

function validarPin(pin) {
  const pinTexto = String(pin || "").trim();
  if (!/^\d{6}$/.test(pinTexto)) {
    return { error: "A senha deve ter exatamente 6 digitos." };
  }
  return { pinTexto };
}

export async function handleAuthPayload(payload) {
  await ensureTable();
  const sql = getSql();
  const action = String(payload?.action || "");
  const participante = validarParticipante(payload?.participante);

  if (participante.error) {
    return { statusCode: 400, payload: { ok: false, message: participante.error } };
  }

  const { participanteNome, participanteKey } = participante;

  if (action === "status") {
    const rows = await sql`
      select participante_nome, pin
      from participante_auth
      where participante_key = ${participanteKey}
      limit 1
    `;

    return {
      statusCode: 200,
      payload: {
        ok: true,
        participante: rows[0]?.participante_nome || participanteNome,
        hasPin: Boolean(rows[0]?.pin)
      }
    };
  }

  if (action === "setupPin") {
    const pin = validarPin(payload?.pin);
    if (pin.error) {
      return { statusCode: 400, payload: { ok: false, message: pin.error } };
    }

    const existing = await sql`
      select pin
      from participante_auth
      where participante_key = ${participanteKey}
      limit 1
    `;

    if (existing[0]?.pin) {
      return { statusCode: 409, payload: { ok: false, message: "Esse participante ja cadastrou senha." } };
    }

    await sql`
      insert into participante_auth (
        participante_key,
        participante_nome,
        pin,
        pin_configurado_em,
        ultimo_login_em,
        atualizado_em
      )
      values (
        ${participanteKey},
        ${participanteNome},
        ${pin.pinTexto},
        now(),
        now(),
        now()
      )
      on conflict (participante_key)
      do update set
        participante_nome = excluded.participante_nome,
        pin = excluded.pin,
        pin_configurado_em = now(),
        ultimo_login_em = now(),
        tentativas_falhas = 0,
        atualizado_em = now()
    `;

    return { statusCode: 200, payload: { ok: true, message: "Senha cadastrada.", participante: participanteNome } };
  }

  if (action === "login") {
    const pin = validarPin(payload?.pin);
    if (pin.error) {
      return { statusCode: 400, payload: { ok: false, message: pin.error } };
    }

    const rows = await sql`
      select participante_nome, pin, tentativas_falhas
      from participante_auth
      where participante_key = ${participanteKey}
      limit 1
    `;
    const auth = rows[0];

    if (!auth?.pin) {
      return { statusCode: 404, payload: { ok: false, message: "Esse participante ainda nao cadastrou senha." } };
    }

    if (auth.pin !== pin.pinTexto) {
      await sql`
        update participante_auth
        set tentativas_falhas = tentativas_falhas + 1,
            atualizado_em = now()
        where participante_key = ${participanteKey}
      `;
      return { statusCode: 401, payload: { ok: false, message: "Senha incorreta." } };
    }

    await sql`
      update participante_auth
      set ultimo_login_em = now(),
          tentativas_falhas = 0,
          atualizado_em = now()
      where participante_key = ${participanteKey}
    `;

    return {
      statusCode: 200,
      payload: {
        ok: true,
        message: "Login realizado.",
        participante: auth.participante_nome || participanteNome
      }
    };
  }

  return { statusCode: 400, payload: { ok: false, message: "Acao invalida." } };
}
