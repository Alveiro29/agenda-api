# agenda-api — Worker de agenda · Dra Katherin Almonte Skin Lab

Cloudflare Worker que conecta el sitio con Google Calendar (cuenta de
servicio) y con la base de datos D1 de pacientes y consentimientos.

`worker.js` es el código completo que corre en
`agenda-api.josea-yuasen.workers.dev`.

## Cómo se despliega

Hoy se edita y publica desde el dashboard de Cloudflare
(Workers → agenda-api → Edit code): se pega el contenido de `worker.js`
y se le da a **Deploy**. Este repo es la copia versionada — si cambias
algo en el dashboard, tráelo aquí también para que las dos no se separen.

Los secrets, las variables y el binding de D1 que necesita están
documentados en la cabecera de `worker.js`.

## Quién lo llama

El sitio [`sitio-katherin`](https://github.com/Alveiro29/sitio-katherin):

- `js/booking.js` → `/api/disponibilidad`, `/api/reservar`
- `js/citas.js` → `/api/citas`, `/api/citas/nota`, `/api/citas/editar`, `/api/citas/cancelar`,
  `/api/bloqueos`, `/api/bloqueos/crear`, `/api/bloqueos/borrar`
- `js/consent.js` → `/api/consentimientos*`, `/api/pacientes*`
