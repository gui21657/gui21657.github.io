# Configuración de POPOROPO

Guía para dejar funcionando likes, comentarios, el sitemap automático y el
manejo de claves. Los pasos 1 a 4 son obligatorios: sin ellos el sitio no
carga el catálogo.

---

## ⚠️ Primero lo urgente: rota la clave de TMDB

La clave `5f41e16316f1452122fe4d2c1234b068` estuvo commiteada en `script.js`.
**Sigue en el historial de git para siempre** y ese historial es público, así
que hay bots que ya la tienen indexada. Moverla a Secrets no la borra del
pasado.

Antes que nada, entra a
[TMDB → Settings → API](https://www.themoviedb.org/settings/api) y genera una
clave nueva. Usa la nueva en los Secrets y revoca la vieja.

---

## 1. GitHub Pages tiene que desplegar con Actions

Este es el paso que más se olvida y sin él **nada más funciona**: `config.js`
se publicaría con los placeholders `__TMDB_API_KEY__` sin sustituir y el sitio
saldría en blanco con un aviso rojo abajo.

`Settings → Pages → Build and deployment → Source` → cambiar de
**"Deploy from a branch"** a **"GitHub Actions"**.

---

## 2. Secrets del repositorio

`Settings → Secrets and variables → Actions → New repository secret`

Van como **Secrets**, no como Variables: las Variables se leen en texto plano
desde la interfaz y aparecen en los logs.

| Nombre del secret | Valor | De dónde sale |
|---|---|---|
| `TMDB_API_KEY` | tu clave **nueva** | TMDB → Settings → API |
| `GOOGLE_CLIENT_ID` | `810778080237-n4771dlmqes5h66jll7khffcf2vp1ntm.apps.googleusercontent.com` | el que ya usabas; sirve tal cual |
| `FIREBASE_PROJECT_ID` | ej. `poporopo-a1b2c` | paso 3 |
| `FIREBASE_API_KEY` | ej. `AIzaSy…` | paso 3 |

---

## 3. Firebase (necesario para likes y comentarios)

Los comentarios tienen que verse entre usuarios distintos, así que hacen falta
en un servidor. GitHub Pages solo sirve archivos estáticos, así que la parte de
datos vive en Firestore. El plan gratuito (50.000 lecturas y 20.000 escrituras
al día) aguanta de sobra al inicio.

1. Crea un proyecto en [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method → Google → Enable.**
   Dentro de la configuración del proveedor, en *Web SDK configuration*, agrega
   `810778080237-n4771dlmqes5h66jll7khffcf2vp1ntm.apps.googleusercontent.com`
   como client ID autorizado. Sin esto Firebase rechaza el token de Google y
   nadie puede comentar.
3. **Authentication → Settings → Authorized domains:** agrega `cinepoporopo.com`.
4. **Firestore Database → Create database → modo producción**, región cercana
   a tu público (`nam5` si es sobre todo EE. UU./Latinoamérica).
5. **Firestore → Rules:** pega el contenido de `firestore.rules` y publica.
   Ahí es donde de verdad se aplica que solo la gente con sesión pueda
   comentar — el navegador puede mentir, las reglas no.
6. **Project settings → General → Your apps → Web app**: de ahí copias
   `projectId` y `apiKey` para los Secrets del paso 2.

El `apiKey` de Firebase es público por diseño (va en el navegador de todos).
No es un secreto real; lo que protege los datos son las reglas. Lo pongo en
Secrets solo por consistencia.

---

## 4. og-image.jpg

**Ya está creada y commiteada en la raíz del repo.** No tienes que subirla a
ningún lado: `index.html` ya apuntaba a `https://cinepoporopo.com/og-image.jpg`
y ahora el archivo existe, así que las tarjetas de WhatsApp, Discord, Twitter y
Facebook dejan de salir vacías.

Para comprobarlo después del deploy:
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) —
  pega la URL y dale a *Scrape Again* para invalidar la caché.
- [X Card Validator](https://cards-dev.twitter.com/validator)

Si quieres cambiar el diseño, se genera con Pillow; el script está en el
historial de esta sesión y produce 1200×630 px.

---

## 5. Verificar que quedó bien

Después del primer deploy:

```bash
# config.js sin placeholders sin sustituir
curl -s https://cinepoporopo.com/config.js | grep -c '__TMDB_API_KEY__'   # → 0

# el sitemap trae miles de URLs, no una
curl -s https://cinepoporopo.com/sitemap.xml | grep -c '<loc>'

# una página por título responde 200
curl -sI https://cinepoporopo.com/movie/550/ | head -1
```

Y en el sitio: abre una serie, cambia de episodio y confirma que el encabezado
de comentarios dice `on <serie> · S1 E2` — los comentarios y likes son **por
episodio**, no por serie.

---

## Cómo funciona el sitemap

Un sitemap generado con JavaScript en el navegador no sirve: Googlebot pide
`/sitemap.xml` como archivo estático por HTTP y nunca ejecuta ese JS. Por eso
se genera en GitHub Actions.

`scripts/generate-sitemap.mjs` corre en cada push y **todos los días a las
05:00 UTC**. En cada corrida:

1. Baja los títulos más populares y mejor valorados de TMDB.
2. Escribe una página real en `/movie/{id}/` y `/tv/{id}/`, cada una con su
   propio `<title>`, description, Open Graph y JSON-LD.
3. Escribe `sitemap.xml` con todas esas URLs.

El paso 2 es lo que le da sentido al conjunto: sin páginas propias por título,
el sitemap apuntaría a URLs inexistentes y Google seguiría teniendo solo la
home que indexar. Esas páginas se construyen en Actions y se publican, pero no
se commitean (están en `.gitignore`), así que el repositorio no crece.

Para indexar más títulos, sube `PAGES_PER_LIST` en
`.github/workflows/deploy.yml`. Cada unidad son ~80 títulos más. El valor por
defecto (25) da unos 2.000.

---

## Sobre "proteger" la clave de TMDB

Conviene ser claro con lo que los Secrets sí y no consiguen, porque es fácil
quedarse con una falsa sensación de seguridad.

**Lo que sí:** la clave sale del repositorio. Los bots que rastrean GitHub
buscando claves filtradas ya no la encuentran, y deja de quedar registrada en
cada commit futuro.

**Lo que no:** el navegador de cada visitante necesita la clave para llamar a
TMDB. Cualquiera que abra las DevTools y mire la pestaña Network la ve. En un
sitio estático esto es inevitable — no es un fallo de esta implementación,
es cómo funciona el navegador.

Si en algún momento quieres protección real, la única vía es que la clave
nunca llegue al navegador: un proxy (Cloudflare Worker en plan gratuito, por
ejemplo) que guarde la clave del lado del servidor, reciba las peticiones del
sitio y las reenvíe a TMDB. El sitio llamaría a `tu-worker.workers.dev/movie/popular`
en vez de a TMDB directo. Son unas 30 líneas y te permite además limitar por
dominio de origen. Dímelo y lo monto.

Mientras tanto, mitigación práctica: las claves v3 de TMDB son gratuitas y se
regeneran en dos clics, así que si alguien te quema la cuota, rotar es barato.
