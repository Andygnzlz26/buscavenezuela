# Guía de Despliegue — BuscaVenezuela en Cloudflare

Esta guía te lleva paso a paso para publicar BuscaVenezuela usando los
servicios gratuitos de Cloudflare: Workers (API), Pages (sitio estático),
D1 (base de datos) y R2 (fotos).

---

## Requisitos previos

- Una cuenta de Cloudflare (gratuita): https://dash.cloudflare.com/sign-up
- Node.js 18+ instalado en tu computadora
- El código fuente de BuscaVenezuela (este repositorio)

---

## 1. Crear cuenta de Cloudflare (si aún no tienes)

1. Ve a https://dash.cloudflare.com/sign-up
2. Regístrate con tu email y una contraseña.
3. Cloudflare enviará un email de verificación — confírmalo.
4. Ya tienes acceso al dashboard. No necesitas añadir un dominio todavía;
   Workers y Pages funcionan con subdominios gratuitos de Cloudflare
   (`*.workers.dev` y `*.pages.dev`).

---

## 2. Instalar Wrangler CLI e iniciar sesión

Wrangler es la herramienta de línea de comandos oficial de Cloudflare.

```bash
# Instalar wrangler globalmente
npm install -g wrangler

# Iniciar sesión en Cloudflare (abre el navegador)
wrangler login
```

Sigue las instrucciones en el navegador para autorizar a Wrangler.
Cuando termines, verifica que funciona:

```bash
wrangler whoami
```

---

## 3. Crear la base de datos D1

D1 es la base de datos SQL de Cloudflare (compatible con SQLite).

```bash
# Desde la raíz del proyecto
cd buscavenezuela

# Crear la base de datos
wrangler d1 create buscavenezuela-db
```

El comando devolverá algo como:

```
✅ Successfully created DB 'buscavenezuela-db' in region WNAM
Created your database using D1's new storage subsystem.
[[d1_databases]]
binding = "DB"
database_name = "buscavenezuela-db"
database_id = "abc123-def456-ghi789"
```

**Importante:** copia el `database_id` y pégalo en `wrangler.toml`,
reemplazando el valor `"xxxx"`.

### Inicializar las tablas

```bash
# Ejecutar el schema SQL contra la base de datos
wrangler d1 execute buscavenezuela-db --file=worker/src/schema.sql
```

O usando el script npm:

```bash
npm run db:init
```

---

## 4. Crear el bucket R2 (fotos)

R2 es el almacenamiento de objetos de Cloudflare (similar a S3).

```bash
wrangler r2 bucket create buscavenezuela-fotos
```

Esto crea el bucket. No necesitas configurar nada adicional en
`wrangler.toml` — el nombre ya está referenciado allí.

---

## 5. Desplegar el Worker (API)

```bash
# Probar localmente primero (opcional)
npm run dev:api

# Desplegar a producción
npm run deploy:api
```

El Worker quedará disponible en:
`https://buscavenezuela-api.<tu-usuario>.workers.dev`

Anota esta URL — la necesitarás para configurar el frontend.

---

## 6. Desplegar el sitio estático en Pages

Cloudflare Pages sirve el HTML, CSS y JavaScript estático.

### Opción A: Desde el dashboard (recomendado la primera vez)

1. Ve a https://dash.cloudflare.com > Workers & Pages > Pages.
2. Haz clic en "Create a project" > "Upload assets".
3. Ponle nombre: `buscavenezuela`
4. Sube la carpeta raíz del proyecto (comprimida en .zip o arrastrando
   los archivos).
5. En "Build settings" deja el comando vacío (o pon `echo 'no build'`).
6. Haz clic en "Deploy".

### Opción B: Con Wrangler Pages

```bash
# Desplegar el directorio actual como proyecto Pages
wrangler pages deploy . --project-name=buscavenezuela
```

El sitio quedará en: `https://buscavenezuela.pages.dev`

---

## 7. Conectar el dominio busca-venezuela.com

Si tienes el dominio `busca-venezuela.com` (o el que uses), conéctalo:

### Para Pages (sitio principal):

1. En Cloudflare Dashboard > Pages > `buscavenezuela` > Custom domains.
2. Haz clic en "Set up a custom domain".
3. Escribe `busca-venezuela.com` y sigue las instrucciones.

### Para Workers (API — opcional, solo si quieres API en subdominio):

1. Ve a Workers & Pages > `buscavenezuela-api`.
2. Pestaña "Triggers" > "Custom Domains" > "Add Custom Domain".
3. Añade `api.busca-venezuela.com`.

Si el dominio no está en Cloudflare, primero debes añadirlo a tu cuenta
(Websites > Add a site) y cambiar los nameservers en tu registrador.

---

## 8. Configurar variables de entorno

### En el Worker (producción):

Edita `wrangler.toml` y ajusta `CORS_ORIGIN` al dominio real:

```toml
[env.production]
vars = { CORS_ORIGIN = "https://busca-venezuela.com" }
```

Luego vuelve a desplegar:

```bash
npm run deploy:api
```

También puedes configurarlas desde el dashboard o con wrangler:

```bash
wrangler secret put CORS_ORIGIN
# Ingresa: https://busca-venezuela.com
```

---

## 9. Verificar que todo funciona

1. API health check:
   ```bash
   curl https://buscavenezuela-api.<tu-usuario>.workers.dev/api/health
   # Debe responder: {"status":"ok","service":"BuscaVenezuela API"}
   ```

2. Abre el sitio Pages en el navegador y prueba:
   - Buscar una persona
   - Reportar una persona desaparecida
   - Registrar "Estoy bien"

3. Si usas el dominio personalizado, asegúrate de que `CORS_ORIGIN`
   esté configurado correctamente para evitar errores de CORS.

---

## Solución de problemas

| Problema | Posible solución |
|---|---|
| `wrangler login` falla | Asegúrate de tener Node.js 18+. Prueba `npx wrangler login`. |
| Error 404 en `/api/...` | Verifica que el Worker esté desplegado y la URL en `app.js` sea correcta. |
| Error CORS en el navegador | Revisa que `CORS_ORIGIN` en `wrangler.toml` coincida con el dominio del sitio. |
| D1: "table not found" | Ejecuta `npm run db:init` para crear las tablas. |
| R2: "bucket not found" | Crea el bucket con `wrangler r2 bucket create buscavenezuela-fotos`. |

---

## Resumen de URLs

| Servicio | URL |
|---|---|
| API (Worker) | `https://buscavenezuela-api.<usuario>.workers.dev` |
| Sitio (Pages) | `https://buscavenezuela.pages.dev` |
| Dominio final | `https://busca-venezuela.com` (cuando esté conectado) |

---

¿Dudas? Abre un issue en el repositorio o contacta al equipo de desarrollo.
