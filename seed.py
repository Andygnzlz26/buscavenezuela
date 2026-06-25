#!/usr/bin/env python3
"""Seed script for BuscaVenezuela — populates demo data with 7 personas across cities."""
import json, sqlite3, os, sys

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "buscavenezuela.db")

if not os.path.exists(DB_PATH):
    print("❌ Database not found. Start the server first (python3 server.py)")
    sys.exit(1)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA foreign_keys=ON")

# Check if we already have data
count = conn.execute("SELECT COUNT(*) as c FROM personas").fetchone()["c"]
if count > 0:
    print(f"⚠️  Database already has {count} personas. Skipping seed.")
    conn.close()
    sys.exit(0)

seeds = [
    {
        "name": "Ana Martínez",
        "ciudad": "caracas",
        "ultima_zona": "Sabana Grande, cerca del Hotel Hilton",
        "descripcion": "Camisa roja, jeans azules, 25 años, pelo largo castaño, tatuaje de mariposa en el brazo derecho",
        "contacto_info": "Hermano: José Martínez",
        "contacto_whatsapp": "+58 412 555 0101",
        "contacto_instagram": "@anitamartinez",
        "contacto_email": "familia.martinez@email.com",
        "tipo": "desaparecido",
    },
    {
        "name": "Carlos Pérez",
        "ciudad": "la-guaira",
        "ultima_zona": "Catia La Mar, sector El Trébol",
        "descripcion": "Llegó a casa de su hermana en la madrugada. Está bien, sin lesiones.",
        "contacto_info": "Hermana: María Pérez",
        "contacto_whatsapp": "+58 412 555 0102",
        "tipo": "estoy_bien",
    },
    {
        "name": "María Rodríguez",
        "ciudad": "miranda",
        "ultima_zona": "Los Teques, Calle Bolívar",
        "descripcion": "Última vez vista el día del terremoto. Vestía uniforme de enfermería blanco.",
        "contacto_info": "Hijo: Pedro Rodríguez",
        "contacto_whatsapp": "+58 414 555 0103",
        "contacto_instagram": "@mrodriguez",
        "tipo": "desaparecido",
    },
    {
        "name": "José Hernández",
        "ciudad": "caracas",
        "ultima_zona": "Petare, barrio San José",
        "descripcion": "Hombre de 60 años, camisa a cuadros azul, pantalón beige. Puede estar desorientado.",
        "contacto_info": "Hija: Carmen Hernández",
        "contacto_whatsapp": "+58 416 555 0104",
        "tipo": "desaparecido",
    },
    {
        "name": "Luisa Fernández",
        "ciudad": "aragua",
        "ultima_zona": "Maracay, Las Delicias",
        "descripcion": "Estoy bien, en casa de mi tía en Maracay. Mi teléfono no tiene señal pero estoy segura.",
        "contacto_info": "Prima: Andrea",
        "contacto_whatsapp": "+58 424 555 0105",
        "contacto_instagram": "@luisafern",
        "tipo": "estoy_bien",
    },
    {
        "name": "Roberto Salazar",
        "ciudad": "carabobo",
        "ultima_zona": "Valencia, Naguanagua",
        "descripcion": "Fue encontrado en un refugio temporal. Está bien, solo golpes leves. Ya se comunicó con su familia.",
        "contacto_info": "Hermano: Miguel Salazar",
        "contacto_email": "salazar.familia@email.com",
        "tipo": "encontrado",
    },
    {
        "name": "Diana Rivas",
        "ciudad": "sucre",
        "ultima_zona": "Cumaná, centro histórico",
        "descripcion": "Niña de 7 años, vestido amarillo, mochila azul. Fue vista por última vez cerca de la plaza.",
        "contacto_info": "Madre: Elena Rivas",
        "contacto_whatsapp": "+58 412 555 0106",
        "contacto_instagram": "@elenarivas",
        "tipo": "desaparecido",
    },
]

with conn:
    for s in seeds:
        # Insert persona
        cur = conn.execute(
            """INSERT INTO personas (name, ciudad, ultima_zona, descripcion, contacto_info, contacto_whatsapp, contacto_instagram, contacto_email)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (s["name"], s["ciudad"], s["ultima_zona"], s["descripcion"], s["contacto_info"], 
             s.get("contacto_whatsapp"), s.get("contacto_instagram"), s.get("contacto_email"))
        )
        pid = cur.lastrowid

        # Insert report
        conn.execute(
            """INSERT INTO reportes (persona_id, tipo, descripcion, contacto_info, contacto_whatsapp, contacto_instagram, contacto_email, fotos)
               VALUES (?, ?, ?, ?, ?, ?, ?, '[]')""",
            (pid, s["tipo"], s["descripcion"], s["contacto_info"],
             s.get("contacto_whatsapp"), s.get("contacto_instagram"), s.get("contacto_email"))
        )

        # Bump affected count for desaparecidos
        if s["tipo"] == "desaparecido":
            conn.execute("UPDATE ciudades SET affected_count = affected_count + 1 WHERE name = ?", (s["ciudad"],))

conn.close()
print(f"✅ Seed complete: {len(seeds)} personas inserted (3 desaparecidos, 2 estoy bien, 1 encontrado, 1 reporte adicional)")
