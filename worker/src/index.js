/**
 * BuscaVenezuela — Cloudflare Workers API
 * Replaces the Python demo server. Uses D1 for DB, R2 for photos.
 *
 * Bindings expected in wrangler.toml:
 *   [[d1_databases]]
 *   binding = "DB"
 *   database_name = "buscavenezuela"
 *   database_id = "..."
 *
 *   [[r2_buckets]]
 *   binding = "BUCKET"
 *   bucket_name = "buscavenezuela-photos"
 *
 * D1 schema: worker/src/schema.sql (run once via `wrangler d1 execute`)
 */

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function addCors(headers) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    if (k !== "Access-Control-Max-Age") headers.set(k, v);
  }
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonResponse(data, status = 200, extraHeaders = {}) {
  const body = JSON.stringify(data, null, 2);
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(new TextEncoder().encode(body).length),
    ...CORS_HEADERS,
    ...extraHeaders,
  });
  // Remove Access-Control-Max-Age from non-OPTIONS; it's harmless but tidy
  if (status !== 204) headers.delete("Access-Control-Max-Age");
  return new Response(body, { status, headers });
}

function jsonError(message, status = 400) {
  const payload = Array.isArray(message) ? { errors: message } : { error: message };
  return jsonResponse(payload, status);
}

async function readJsonBody(request) {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Row serialization
// ---------------------------------------------------------------------------

function parseFotos(fotosRaw) {
  if (!fotosRaw) return [];
  try {
    const arr = JSON.parse(fotosRaw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function serializeReporte(row) {
  return {
    id: row.id,
    persona_id: row.persona_id,
    tipo: row.tipo,
    descripcion: row.descripcion || null,
    contacto_info: row.contacto_info || null,
    contacto_whatsapp: row.contacto_whatsapp || null,
    contacto_instagram: row.contacto_instagram || null,
    contacto_email: row.contacto_email || null,
    fotos: parseFotos(row.fotos),
    created_at: row.created_at,
  };
}

function serializePersona(row, fotoThumb) {
  return {
    id: row.id,
    name: row.name,
    ciudad: row.ciudad,
    ultima_zona: row.ultima_zona || null,
    descripcion: row.descripcion || null,
    contacto_info: row.contacto_info || null,
    contacto_whatsapp: row.contacto_whatsapp || null,
    contacto_instagram: row.contacto_instagram || null,
    contacto_email: row.contacto_email || null,
    foto_thumb: fotoThumb || null,
    created_at: row.created_at,
  };
}

async function getFotoThumb(db, personaId) {
  const r = await db
    .prepare(
      `SELECT fotos FROM reportes
       WHERE persona_id = ? AND fotos IS NOT NULL AND fotos != '[]'
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(personaId)
    .first();
  if (r && r.fotos) {
    const fotosList = parseFotos(r.fotos);
    if (fotosList.length > 0) return fotosList[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function validatePersonaBody(data) {
  const errors = [];
  if (!data) return { errors: ["Cuerpo JSON requerido"], cleaned: null };

  const name = (data.name || "").trim();
  if (!name) errors.push("El campo 'name' es obligatorio");

  const ciudad = (data.ciudad || "").trim();
  if (!ciudad) errors.push("El campo 'ciudad' es obligatorio");

  const tipo = data.tipo || "";
  if (tipo !== "estoy_bien" && tipo !== "desaparecido") {
    errors.push("El campo 'tipo' debe ser 'estoy_bien' o 'desaparecido'");
  }

  const fotos = data.fotos;
  if (fotos !== undefined && fotos !== null) {
    if (!Array.isArray(fotos)) {
      errors.push("El campo 'fotos' debe ser un arreglo");
    } else if (fotos.length > 3) {
      errors.push("Máximo 3 fotos permitidas");
    }
  }

  if (errors.length > 0) return { errors, cleaned: null };

  return {
    errors: [],
    cleaned: {
      name,
      ciudad: ciudad.toLowerCase(),
      ultima_zona: (data.ultima_zona || "").trim() || null,
      descripcion: (data.descripcion || "").trim() || null,
      contacto_info: (data.contacto_info || "").trim() || null,
      contacto_whatsapp: (data.contacto_whatsapp || "").trim() || null,
      contacto_instagram: (data.contacto_instagram || "").trim() || null,
      contacto_email: (data.contacto_email || "").trim() || null,
      tipo,
      fotos: Array.isArray(fotos) ? fotos : [],
    },
  };
}

function validateReporteBody(data) {
  const errors = [];
  if (!data) return { errors: ["Cuerpo JSON requerido"], cleaned: null };

  const personaId = data.persona_id;
  if (personaId === undefined || personaId === null) {
    errors.push("El campo 'persona_id' es obligatorio");
  }

  const tipo = data.tipo || "";
  if (tipo !== "estoy_bien" && tipo !== "desaparecido" && tipo !== "encontrado") {
    errors.push("El campo 'tipo' debe ser 'estoy_bien', 'desaparecido' o 'encontrado'");
  }

  const fotos = data.fotos;
  if (fotos !== undefined && fotos !== null) {
    if (!Array.isArray(fotos)) {
      errors.push("El campo 'fotos' debe ser un arreglo");
    } else if (fotos.length > 3) {
      errors.push("Máximo 3 fotos permitidas");
    }
  }

  if (errors.length > 0) return { errors, cleaned: null };

  return {
    errors: [],
    cleaned: {
      persona_id: personaId,
      tipo,
      descripcion: (data.descripcion || "").trim() || null,
      contacto_info: (data.contacto_info || "").trim() || null,
      contacto_whatsapp: (data.contacto_whatsapp || "").trim() || null,
      contacto_instagram: (data.contacto_instagram || "").trim() || null,
      contacto_email: (data.contacto_email || "").trim() || null,
      fotos: Array.isArray(fotos) ? fotos : [],
    },
  };
}

// ---------------------------------------------------------------------------
// Route matching
// ---------------------------------------------------------------------------

function matchRoute(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";

  // GET /api/health or /health
  if (path === "/api/health" || path === "/health") return { name: "health" };

  // GET /api/cities
  if (path === "/api/cities") return { name: "cities" };

  // GET /api/personas
  if (path === "/api/personas") return { name: "personas" };

  // GET /api/personas/:id
  const personaMatch = path.match(/^\/api\/personas\/(\d+)$/);
  if (personaMatch) return { name: "personaById", id: parseInt(personaMatch[1], 10) };

  // POST /api/reports
  if (path === "/api/reports") return { name: "reports" };

  // POST /api/upload
  if (path === "/api/upload") return { name: "upload" };

  return null;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleHealth() {
  return jsonResponse({ status: "ok", service: "BuscaVenezuela API" });
}

async function handleCities(db) {
  const { results } = await db
    .prepare("SELECT * FROM ciudades ORDER BY affected_count DESC, name ASC")
    .all();
  return jsonResponse({ data: results });
}

async function handleListPersonas(db, url) {
  const qs = url.searchParams;

  const search = (qs.get("search") || "").trim();
  const ciudad = (qs.get("ciudad") || "").trim().toLowerCase();
  const tipo = (qs.get("tipo") || "").trim();
  let limit = parseInt(qs.get("limit") || "50", 10);
  let offset = parseInt(qs.get("offset") || "0", 10);

  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  if (isNaN(offset) || offset < 0) offset = 0;

  // Build WHERE clauses
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push("p.name LIKE ?");
    params.push(`%${search}%`);
  }

  if (ciudad) {
    clauses.push("p.ciudad = ?");
    params.push(ciudad);
  }

  if (tipo) {
    clauses.push("p.id IN (SELECT r.persona_id FROM reportes r WHERE r.tipo = ?)");
    params.push(tipo);
  }

  const whereSQL = clauses.length > 0 ? "WHERE " + clauses.join(" AND ") : "";

  // Count total
  let countStmt = db.prepare(
    `SELECT COUNT(*) as total FROM personas p ${whereSQL}`
  );
  for (const p of params) countStmt = countStmt.bind(p);
  const countResult = await countStmt.first();
  const total = countResult ? countResult.total : 0;

  // Fetch page
  let queryStmt = db.prepare(
    `SELECT p.* FROM personas p
     ${whereSQL}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`
  );
  for (const p of params) queryStmt = queryStmt.bind(p);
  queryStmt = queryStmt.bind(limit, offset);
  const { results } = await queryStmt.all();

  // Serialize with foto_thumb and latest tipo
  const data = [];
  for (const row of results) {
    const fotoThumb = await getFotoThumb(db, row.id);
    const d = serializePersona(row, fotoThumb);

    // Latest report tipo
    const latest = await db
      .prepare(
        "SELECT tipo FROM reportes WHERE persona_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .bind(row.id)
      .first();
    d.tipo = latest ? latest.tipo : null;

    data.push(d);
  }

  return jsonResponse({ data, total });
}

async function handleGetPersona(db, id) {
  const row = await db
    .prepare("SELECT * FROM personas WHERE id = ?")
    .bind(id)
    .first();

  if (!row) return jsonError("Persona no encontrada", 404);

  const persona = serializePersona(row, null);

  // Fetch all reports
  const { results: reportesRows } = await db
    .prepare("SELECT * FROM reportes WHERE persona_id = ? ORDER BY created_at DESC")
    .bind(id)
    .all();

  persona.reports = reportesRows.map(serializeReporte);

  return jsonResponse(persona);
}

async function handleCreatePersona(db, request) {
  const data = await readJsonBody(request);
  if (data === null) return jsonError("Cuerpo JSON inválido", 400);

  const { errors, cleaned } = validatePersonaBody(data);
  if (errors.length > 0) return jsonError(errors, 400);

  const fotosJSON = JSON.stringify(cleaned.fotos);

  // Insert persona
  const personaResult = await db
    .prepare(
      `INSERT INTO personas (name, ciudad, ultima_zona, descripcion, contacto_info,
       contacto_whatsapp, contacto_instagram, contacto_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      cleaned.name,
      cleaned.ciudad,
      cleaned.ultima_zona,
      cleaned.descripcion,
      cleaned.contacto_info,
      cleaned.contacto_whatsapp,
      cleaned.contacto_instagram,
      cleaned.contacto_email
    )
    .run();

  const personaId = personaResult.meta.last_row_id;

  // Create initial report
  await db
    .prepare(
      `INSERT INTO reportes (persona_id, tipo, descripcion, contacto_info,
       contacto_whatsapp, contacto_instagram, contacto_email, fotos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      personaId,
      cleaned.tipo,
      cleaned.descripcion,
      cleaned.contacto_info,
      cleaned.contacto_whatsapp,
      cleaned.contacto_instagram,
      cleaned.contacto_email,
      fotosJSON
    )
    .run();

  // Bump affected_count if desaparecido
  if (cleaned.tipo === "desaparecido") {
    await db
      .prepare("UPDATE ciudades SET affected_count = affected_count + 1 WHERE name = ?")
      .bind(cleaned.ciudad)
      .run();
  }

  // Fetch back created record
  const personaRow = await db
    .prepare("SELECT * FROM personas WHERE id = ?")
    .bind(personaId)
    .first();

  const persona = serializePersona(personaRow, null);

  // Get the report we just created
  const reportRow = await db
    .prepare(
      "SELECT * FROM reportes WHERE persona_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .bind(personaId)
    .first();

  persona.reports = reportRow ? [serializeReporte(reportRow)] : [];

  return jsonResponse(persona, 201);
}

async function handleCreateReporte(db, request) {
  const data = await readJsonBody(request);
  if (data === null) return jsonError("Cuerpo JSON inválido", 400);

  const { errors, cleaned } = validateReporteBody(data);
  if (errors.length > 0) return jsonError(errors, 400);

  // Verify persona exists
  const persona = await db
    .prepare("SELECT * FROM personas WHERE id = ?")
    .bind(cleaned.persona_id)
    .first();

  if (!persona) return jsonError("Persona no encontrada", 404);

  const fotosJSON = JSON.stringify(cleaned.fotos);

  const result = await db
    .prepare(
      `INSERT INTO reportes (persona_id, tipo, descripcion, contacto_info,
       contacto_whatsapp, contacto_instagram, contacto_email, fotos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      cleaned.persona_id,
      cleaned.tipo,
      cleaned.descripcion,
      cleaned.contacto_info,
      cleaned.contacto_whatsapp,
      cleaned.contacto_instagram,
      cleaned.contacto_email,
      fotosJSON
    )
    .run();

  const reporteId = result.meta.last_row_id;

  // Bump affected_count if desaparecido
  if (cleaned.tipo === "desaparecido") {
    await db
      .prepare("UPDATE ciudades SET affected_count = affected_count + 1 WHERE name = ?")
      .bind(persona.ciudad)
      .run();
  }

  // Fetch back the created report
  const row = await db
    .prepare("SELECT * FROM reportes WHERE id = ?")
    .bind(reporteId)
    .first();

  return jsonResponse(serializeReporte(row), 201);
}

async function handleUpload(bucket, request, env) {
  // Parse multipart form data
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("No se pudo leer el formulario multipart", 400);
  }

  const photo = formData.get("photo");
  if (!photo) return jsonError("El campo 'photo' es requerido", 400);

  // Must be a File
  if (typeof photo === "string") return jsonError("El campo 'photo' debe ser un archivo", 400);

  // Validate size (max 5 MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (photo.size > MAX_SIZE) return jsonError("La foto excede el tamaño máximo de 5 MB", 400);

  // Validate content type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!allowedTypes.includes(photo.type)) {
    return jsonError("Formato no permitido. Usa JPG, PNG o WebP", 400);
  }

  // Generate a unique filename
  const uuid = crypto.randomUUID();
  const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
  const key = `personas/${uuid}.${ext}`;

  // Upload to R2
  await bucket.put(key, photo.stream(), {
    httpMetadata: {
      contentType: photo.type,
    },
    customMetadata: {
      originalName: photo.name || "upload",
    },
  });

  // Construct public URL
  // Uses the default r2.dev domain pattern if no custom domain is configured.
  // If a R2_PUBLIC_URL env var is set, use that; otherwise fall back to r2.dev.
  const publicBase =
    env.R2_PUBLIC_URL ||
    `https://pub-${env.R2_ACCOUNT_ID || "REPLACE_ACCOUNT_ID"}.r2.dev`;

  const url = `${publicBase.replace(/\/+$/, "")}/${key}`;

  return jsonResponse({ url }, 201);
}

// ---------------------------------------------------------------------------
// Main Worker entry point (ES module format)
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Match route
    const route = matchRoute(url.pathname);

    // 404
    if (!route) {
      return jsonError("Ruta no encontrada", 404);
    }

    try {
      // Dispatch
      switch (route.name) {
        case "health":
          if (method !== "GET") return jsonError("Método no permitido", 405);
          return await handleHealth();

        case "cities":
          if (method !== "GET") return jsonError("Método no permitido", 405);
          return await handleCities(env.DB);

        case "personas":
          if (method === "GET") {
            return await handleListPersonas(env.DB, url);
          }
          if (method === "POST") {
            return await handleCreatePersona(env.DB, request);
          }
          return jsonError("Método no permitido", 405);

        case "personaById":
          if (method !== "GET") return jsonError("Método no permitido", 405);
          return await handleGetPersona(env.DB, route.id);

        case "reports":
          if (method !== "POST") return jsonError("Método no permitido", 405);
          return await handleCreateReporte(env.DB, request);

        case "upload":
          if (method !== "POST") return jsonError("Método no permitido", 405);
          return await handleUpload(env.BUCKET, request, env);

        default:
          return jsonError("Ruta no encontrada", 404);
      }
    } catch (err) {
      // Log the error for debugging
      console.error(`[${method} ${url.pathname}]`, err);

      return jsonError(
        `Error interno del servidor: ${err.message || "Error desconocido"}`,
        500
      );
    }
  },
};
