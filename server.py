#!/usr/bin/env python3
"""
BuscaVenezuela — Demo REST API Server
Venezuelan earthquake missing-persons registry (7.5 earthquake)
Stdlib only: http.server + sqlite3 + json
"""

import http.server
import json
import sqlite3
import os
import re
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "buscavenezuela.db")
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
HOST = "0.0.0.0"
PORT = 8081


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db():
    """Return a new sqlite3 connection with row_factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize the database from schema.sql."""
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH) as f:
        script = f.read()
    # Execute each statement individually so we can gracefully skip
    # "duplicate column name" errors from ALTER TABLE statements
    for statement in script.split(";"):
        stmt = statement.strip()
        if not stmt:
            continue
        try:
            conn.execute(stmt)
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                pass  # column already exists, skip
            else:
                raise
    conn.commit()
    conn.close()
    print(f"[init] Database ready at {DB_PATH}")


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------

def json_response(handler, data, status=200):
    """Send a JSON response with CORS headers."""
    body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    # CORS
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.end_headers()
    handler.wfile.write(body)


def json_error(handler, message, status=400):
    """Send a JSON error response."""
    json_response(handler, {"error": message}, status)


def read_json_body(handler):
    """Read and parse the JSON body from the request."""
    try:
        length = int(handler.headers.get("Content-Length", 0))
        if length == 0:
            return None
        raw = handler.rfile.read(length)
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError) as e:
        return None


# ---------------------------------------------------------------------------
# Row serialization
# ---------------------------------------------------------------------------

def serialize_persona(row, include_foto_thumb=False):
    """Convert a persona Row to a dict."""
    d = dict(row)
    if include_foto_thumb:
        # Grab the first foto from the most recent report that has one
        conn = get_db()
        try:
            cur = conn.execute(
                """SELECT fotos FROM reportes
                   WHERE persona_id = ? AND fotos IS NOT NULL AND fotos != '[]'
                   ORDER BY created_at DESC LIMIT 1""",
                (d["id"],),
            )
            r = cur.fetchone()
            if r and r["fotos"]:
                try:
                    fotos_list = json.loads(r["fotos"])
                    if fotos_list:
                        d["foto_thumb"] = fotos_list[0]
                except json.JSONDecodeError:
                    d["foto_thumb"] = None
            else:
                d["foto_thumb"] = None
        finally:
            conn.close()
    return d


def serialize_reporte(row):
    """Convert a reporte Row to a dict, parsing fotos JSON."""
    d = dict(row)
    if d.get("fotos"):
        try:
            d["fotos"] = json.loads(d["fotos"])
        except json.JSONDecodeError:
            d["fotos"] = []
    else:
        d["fotos"] = []
    return d


def serialize_ciudad(row):
    """Convert a ciudad Row to a dict."""
    return dict(row)


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

def validate_persona_body(data):
    """Validate /api/personas POST body. Returns (errors, cleaned)."""
    errors = []
    if not data:
        return ["Cuerpo JSON requerido"], None

    name = (data.get("name") or "").strip()
    if not name:
        errors.append("El campo 'name' es obligatorio")

    ciudad = (data.get("ciudad") or "").strip()
    if not ciudad:
        errors.append("El campo 'ciudad' es obligatorio")

    tipo = data.get("tipo", "")
    if tipo not in ("estoy_bien", "desaparecido"):
        errors.append("El campo 'tipo' debe ser 'estoy_bien' o 'desaparecido'")

    fotos = data.get("fotos")
    if fotos is not None:
        if not isinstance(fotos, list):
            errors.append("El campo 'fotos' debe ser un arreglo")
        elif len(fotos) > 3:
            errors.append("Máximo 3 fotos permitidas")

    if errors:
        return errors, None

    cleaned = {
        "name": name,
        "ciudad": ciudad.lower(),
        "ultima_zona": (data.get("ultima_zona") or "").strip() or None,
        "descripcion": (data.get("descripcion") or "").strip() or None,
        "contacto_info": (data.get("contacto_info") or "").strip() or None,
        "contacto_whatsapp": (data.get("contacto_whatsapp") or "").strip() or None,
        "contacto_instagram": (data.get("contacto_instagram") or "").strip() or None,
        "contacto_email": (data.get("contacto_email") or "").strip() or None,
        "tipo": tipo,
        "fotos": fotos if fotos else [],
    }
    return [], cleaned


def validate_reporte_body(data):
    """Validate /api/reports POST body. Returns (errors, cleaned)."""
    errors = []
    if not data:
        return ["Cuerpo JSON requerido"], None

    persona_id = data.get("persona_id")
    if persona_id is None:
        errors.append("El campo 'persona_id' es obligatorio")

    tipo = data.get("tipo", "")
    if tipo not in ("estoy_bien", "desaparecido", "encontrado"):
        errors.append("El campo 'tipo' debe ser 'estoy_bien', 'desaparecido' o 'encontrado'")

    fotos = data.get("fotos")
    if fotos is not None:
        if not isinstance(fotos, list):
            errors.append("El campo 'fotos' debe ser un arreglo")
        elif len(fotos) > 3:
            errors.append("Máximo 3 fotos permitidas")

    if errors:
        return errors, None

    cleaned = {
        "persona_id": persona_id,
        "tipo": tipo,
        "descripcion": (data.get("descripcion") or "").strip() or None,
        "contacto_info": (data.get("contacto_info") or "").strip() or None,
        "contacto_whatsapp": (data.get("contacto_whatsapp") or "").strip() or None,
        "contacto_instagram": (data.get("contacto_instagram") or "").strip() or None,
        "contacto_email": (data.get("contacto_email") or "").strip() or None,
        "fotos": fotos if fotos else [],
    }
    return [], cleaned


# ---------------------------------------------------------------------------
# Request handler
# ---------------------------------------------------------------------------

class BuscaVenezuelaHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler for BuscaVenezuela API."""

    # Silence per-request log lines (we log our own)
    def log_message(self, format, *args):
        pass

    # ── CORS preflight ─────────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    # ── GET ────────────────────────────────────────────────────────────
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        qs = parse_qs(parsed.query)

        # GET /api/personas — list all or filter
        if path == "/api/personas":
            self.list_personas(qs)
            return

        # GET /api/personas/:id — single person with reports
        m = re.match(r"^/api/personas/(\d+)$", path)
        if m:
            self.get_persona(int(m.group(1)))
            return

        # GET /api/cities — list cities
        if path == "/api/cities":
            self.list_cities()
            return

        # Health check
        if path in ("/api/health", "/health"):
            json_response(self, {"status": "ok", "service": "BuscaVenezuela API"})
            return

        json_error(self, "Ruta no encontrada", 404)

    # ── POST ───────────────────────────────────────────────────────────
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/personas":
            self.create_persona()
            return

        if path == "/api/reports":
            self.create_reporte()
            return

        json_error(self, "Ruta no encontrada", 404)

    # ── Handler methods ────────────────────────────────────────────────

    def list_personas(self, qs):
        """GET /api/personas — List persons with search/filter/pagination."""
        search = (qs.get("search", [""])[0] or "").strip()
        ciudad = (qs.get("ciudad", [""])[0] or "").strip().lower()
        tipo = (qs.get("tipo", [""])[0] or "").strip()
        try:
            limit = int(qs.get("limit", ["50"])[0])
        except ValueError:
            limit = 50
        try:
            offset = int(qs.get("offset", ["0"])[0])
        except ValueError:
            offset = 0

        # Clamp limit
        limit = max(1, min(limit, 200))

        conn = get_db()
        try:
            where_clauses = []
            params = []

            if search:
                where_clauses.append("p.name LIKE ?")
                params.append(f"%{search}%")

            if ciudad:
                where_clauses.append("p.ciudad = ?")
                params.append(ciudad)

            if tipo:
                # tipo filter: check if any report has this tipo
                where_clauses.append(
                    "p.id IN (SELECT r.persona_id FROM reportes r WHERE r.tipo = ?)"
                )
                params.append(tipo)

            where_sql = ""
            if where_clauses:
                where_sql = "WHERE " + " AND ".join(where_clauses)

            # Count total
            count_sql = f"SELECT COUNT(*) as total FROM personas p {where_sql}"
            total = conn.execute(count_sql, params).fetchone()["total"]

            # Fetch page
            query_sql = f"""
                SELECT p.* FROM personas p
                {where_sql}
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?
            """
            rows = conn.execute(query_sql, params + [limit, offset]).fetchall()

            data = []
            for row in rows:
                d = serialize_persona(row, include_foto_thumb=True)
                # Also get latest report tipo for display
                latest = conn.execute(
                    "SELECT tipo FROM reportes WHERE persona_id = ? ORDER BY created_at DESC LIMIT 1",
                    (d["id"],),
                ).fetchone()
                d["tipo"] = latest["tipo"] if latest else None
                data.append(d)

            json_response(self, {"data": data, "total": total})
        finally:
            conn.close()

    def get_persona(self, persona_id):
        """GET /api/personas/:id — Single persona with all reports."""
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT * FROM personas WHERE id = ?", (persona_id,)
            ).fetchone()
            if not row:
                json_error(self, "Persona no encontrada", 404)
                return

            persona = serialize_persona(row)

            # Fetch all reports for this person
            reportes_rows = conn.execute(
                "SELECT * FROM reportes WHERE persona_id = ? ORDER BY created_at DESC",
                (persona_id,),
            ).fetchall()

            persona["reports"] = [serialize_reporte(r) for r in reportes_rows]

            json_response(self, persona)
        finally:
            conn.close()

    def create_persona(self):
        """POST /api/personas — Create a new person record."""
        data = read_json_body(self)
        if data is None:
            json_error(self, "Cuerpo JSON inválido", 400)
            return

        errors, cleaned = validate_persona_body(data)
        if errors:
            json_error(self, errors, 400)
            return

        conn = get_db()
        try:
            # Convert fotos list to JSON string for the initial report
            fotos_json = json.dumps(cleaned["fotos"])

            with conn:
                cur = conn.execute(
                    """INSERT INTO personas (name, ciudad, ultima_zona, descripcion, contacto_info,
                       contacto_whatsapp, contacto_instagram, contacto_email)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        cleaned["name"],
                        cleaned["ciudad"],
                        cleaned["ultima_zona"],
                        cleaned["descripcion"],
                        cleaned["contacto_info"],
                        cleaned["contacto_whatsapp"],
                        cleaned["contacto_instagram"],
                        cleaned["contacto_email"],
                    ),
                )
                persona_id = cur.lastrowid

                # Create initial report
                conn.execute(
                    """INSERT INTO reportes (persona_id, tipo, descripcion, contacto_info,
                       contacto_whatsapp, contacto_instagram, contacto_email, fotos)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        persona_id,
                        cleaned["tipo"],
                        cleaned["descripcion"],
                        cleaned["contacto_info"],
                        cleaned["contacto_whatsapp"],
                        cleaned["contacto_instagram"],
                        cleaned["contacto_email"],
                        fotos_json,
                    ),
                )

                # Bump affected_count for the ciudad if tipo is desaparecido
                if cleaned["tipo"] == "desaparecido":
                    conn.execute(
                        """UPDATE ciudades SET affected_count = affected_count + 1
                           WHERE name = ?""",
                        (cleaned["ciudad"],),
                    )

            # Fetch back the created record
            row = conn.execute(
                "SELECT * FROM personas WHERE id = ?", (persona_id,)
            ).fetchone()
            persona = serialize_persona(row)

            # Get the report we just created
            report_row = conn.execute(
                "SELECT * FROM reportes WHERE persona_id = ? ORDER BY created_at DESC LIMIT 1",
                (persona_id,),
            ).fetchone()
            persona["reports"] = [serialize_reporte(report_row)] if report_row else []

            json_response(self, persona, 201)
        finally:
            conn.close()

    def create_reporte(self):
        """POST /api/reports — Add a report to an existing person."""
        data = read_json_body(self)
        if data is None:
            json_error(self, "Cuerpo JSON inválido", 400)
            return

        errors, cleaned = validate_reporte_body(data)
        if errors:
            json_error(self, errors, 400)
            return

        conn = get_db()
        try:
            # Verify persona exists
            persona = conn.execute(
                "SELECT * FROM personas WHERE id = ?", (cleaned["persona_id"],)
            ).fetchone()
            if not persona:
                json_error(self, "Persona no encontrada", 404)
                return

            fotos_json = json.dumps(cleaned["fotos"])

            with conn:
                cur = conn.execute(
                    """INSERT INTO reportes (persona_id, tipo, descripcion, contacto_info,
                       contacto_whatsapp, contacto_instagram, contacto_email, fotos)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        cleaned["persona_id"],
                        cleaned["tipo"],
                        cleaned["descripcion"],
                        cleaned["contacto_info"],
                        cleaned["contacto_whatsapp"],
                        cleaned["contacto_instagram"],
                        cleaned["contacto_email"],
                        fotos_json,
                    ),
                )
                reporte_id = cur.lastrowid

                # Bump affected_count for the ciudad if tipo is desaparecido
                if cleaned["tipo"] == "desaparecido":
                    conn.execute(
                        """UPDATE ciudades SET affected_count = affected_count + 1
                           WHERE name = ?""",
                        (persona["ciudad"],),
                    )

            # Fetch back the created report
            row = conn.execute(
                "SELECT * FROM reportes WHERE id = ?", (reporte_id,)
            ).fetchone()

            json_response(self, serialize_reporte(row), 201)
        finally:
            conn.close()

    def list_cities(self):
        """GET /api/cities — List affected cities."""
        conn = get_db()
        try:
            rows = conn.execute(
                "SELECT * FROM ciudades ORDER BY affected_count DESC, name ASC"
            ).fetchall()
            data = [serialize_ciudad(r) for r in rows]
            json_response(self, {"data": data})
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Init DB
    if not os.path.exists(DB_PATH):
        init_db()
    else:
        print(f"[init] Database already exists at {DB_PATH}")

    server = http.server.HTTPServer((HOST, PORT), BuscaVenezuelaHandler)
    print(f"[server] BuscaVenezuela API running on http://{HOST}:{PORT}")
    print(f"[server] Endpoints:")
    print(f"         GET  /api/health")
    print(f"         GET  /api/cities")
    print(f"         GET  /api/personas")
    print(f"         GET  /api/personas/:id")
    print(f"         POST /api/personas")
    print(f"         POST /api/reports")
    print(f"[server] Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[server] Shutting down...")
        server.server_close()
        print("[server] Goodbye.")


if __name__ == "__main__":
    main()
