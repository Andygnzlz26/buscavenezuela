# BuscaVenezuela

Plataforma comunitaria de registro de personas afectadas por el terremoto del 25 de junio de 2026 en Venezuela.

## Estado Actual

El sitio está totalmente construido y funcional. La API demo con SQLite corre en el servidor Python para pruebas inmediatas.

## Archivos del Proyecto

```
buscavenezuela/
├── index.html          ← Página principal
├── buscar.html         ← Búsqueda de personas
├── persona.html        ← Página por persona
├── reportar.html       ← Formulario reportar desaparecido
├── estoy-bien.html     ← Formulario estoy bien
├── css/style.css       ← Estilos (dark theme, colores de la bandera)
├── js/
│   ├── app.js          ← Core: API, helpers, utilidades
│   └── pages/
│       ├── home.js     ← Lógica de página principal
│       ├── buscar.js   ← Búsqueda con filtros
│       ├── persona.js  ← Detalle de persona + timeline
│       ├── reportar.js ← Envío de reporte desaparecido
│       └── estoy-bien.js ← Envío reporte estoy bien
├── server.py           ← Demo API server (Python stdlib + SQLite)
├── schema.sql          ← Esquema SQLite
├── supabase-schema.sql ← Esquema PostgreSQL / Supabase
├── netlify.toml        ← Config Netlify
└── _redirects          ← SPA redirects
```

## Para probar AHORA (demo local)

```bash
cd /home/andygnzlz26/buscavenezuela
python3 server.py
# Servidor corre en http://localhost:8081
```

Abre los HTML directamente en el navegador (file://) o desde un pequeño servidor HTTP:

```bash
python3 -m http.server 3000
# Sitio: http://localhost:3000
```

## Para poner en producción

### 1. Registrar dominio busca-venezuela.com

### 2. Configurar Supabase

1. Ir a https://supabase.com/dashboard/project/klmobvvetkvzgrqiqlph
2. SQL Editor → pegar contenido de `supabase-schema.sql` → Ejecutar
3. Project Settings > API → copiar anon/public key
4. Storage → crear bucket `personas_fotos` (público)

### 3. Configurar app.js

Editar `/js/app.js` y cambiar:

```js
const CONFIG = {
  apiUrl: 'https://klmobvvetkvzgrqiqlph.supabase.co/rest/v1',
  supabaseAnonKey: 'ey...tu-anon-key-aqui...',
  supabaseUrl: 'https://klmobvvetkvzgrqiqlph.supabase.co',
  siteUrl: 'https://busca-venezuela.com'
};
```

### 4. Desplegar a Netlify

```bash
# Usando Netlify CLI o conectando el repo a Netlify
netlify deploy --prod --dir=/home/andygnzlz26/buscavenezuela
```

### 5. Conectar dominio

En Netlify: Site Settings > Domain Management > Add custom domain → busca-venezuela.com

## Próximas mejoras

- [ ] Integración con Supabase (anon key pendiente)
- [ ] Notificaciones SMS/WhatsApp cuando encuentran a alguien
- [ ] Mapa de zonas afectadas
- [ ] Código de verificación para que familias reclamen perfiles
- [ ] Analytics básicos
- [ ] SEO / Open Graph para compartir en redes

## Contacto

Andy — hecho con ❤️ para Venezuela
