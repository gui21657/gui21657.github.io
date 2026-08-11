/* ============================================================
   POPOROPO — CONFIG.JS

   Este archivo es una PLANTILLA. Los valores __ASI__ los sustituye
   el workflow .github/workflows/deploy.yml con los GitHub Secrets
   en cada deploy, así que las claves reales nunca se commitean.

   Para probar en local: pon tus valores aquí temporalmente y ejecuta
   `git checkout config.js` ANTES de commitear, para no volver a subir
   las claves al repositorio.

   AVISO IMPORTANTE sobre el TMDB_API_KEY:
   este es un sitio estático, así que la clave que use el navegador
   SIEMPRE será visible para quien abra las DevTools. Los Secrets la
   sacan del repositorio (que es donde la rastrean los bots), pero no
   la vuelven privada. Para eso hace falta un proxy — ver README-SETUP.md.
   ============================================================ */

window.POPOROPO_CONFIG = {
  TMDB_API_KEY:        '__TMDB_API_KEY__',
  GOOGLE_CLIENT_ID:    '__GOOGLE_CLIENT_ID__',

  /* Firebase — necesarios para likes y comentarios.
     Ambos son identificadores públicos por diseño: la seguridad real
     vive en firestore.rules, no en ocultar estos valores. */
  FIREBASE_PROJECT_ID: '__FIREBASE_PROJECT_ID__',
  FIREBASE_API_KEY:    '__FIREBASE_API_KEY__'
};
