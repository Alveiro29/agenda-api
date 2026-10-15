# agenda-api — Worker de agenda · Dra Katherin Almonte Skin Lab

Cloudflare Worker que conecta el sitio con Google Calendar (cuenta de
servicio) y con la base de datos D1 de pacientes y consentimientos.

`worker.js` es el código completo que corre en
`agenda-api.josea-yuasen.workers.dev`.

## Cómo se despliega

A mano, desde el dashboard de Cloudflare (Workers → agenda-api → Edit
code): se pega el contenido de `worker.js` y se le da **Deploy**. No hay
integración de Git: un push aquí **no** despliega nada.

De ahí la única regla importante de este repo: **si cambias algo en el
dashboard, tráelo aquí el mismo día.** Son dos copias que pueden
separarse, y cuando se separan no hay forma de saber cuál es la buena.
Para comprobarlo, descarga el worker desplegado y compáralo:

    diff worker.js worker-descargado.js

Los secrets, las variables y el binding de D1 que necesita están
documentados en la cabecera de `worker.js`.

## Los dos recursos de la clínica

Todo el cálculo de disponibilidad sale de aquí, y conviene tenerlo claro
antes de tocar nada:

- **Cabinas** — cuartos físicos por sucursal (`CUPOS_GAZCUE`,
  `CUPOS_SDN`, 2 por defecto). Es el único límite del total simultáneo.
  No hay límite por número de colaboradoras: una cubre las dos cabinas en
  paralelo, porque los faciales tienen tiempo muerto que aprovecha para
  alternar.

- **La Dra.** — recurso global de 1. Es la única que hace inyectables y
  tratamientos íntimos, y no puede estar en dos sucursales a la vez.

Tres constantes gobiernan lo segundo, y solo aplican a **sus**
procedimientos (`SERVICIOS_DRA` / `PALABRAS_DRA`):

| Constante | Hoy | Qué hace |
|---|---|---|
| `TRASLADO_MIN` | 95 | minutos mínimos entre citas suyas en sedes distintas |
| `MAX_CAMBIOS_SEDE` | 1 | cambios de sucursal que puede hacer en un día |
| `BUFFER_DRA_MIN` | 15 | limpieza tras un procedimiento suyo |
| `MAX_A_LA_VEZ_DRA` | 2 | citas suyas a la vez en la misma sede (una por cabina) |

Ninguna cierra nada por adelantado: un día vacío tiene las dos sucursales
100% disponibles. El bloqueo lo genera la propia reserva.

`/api/salud` publica esos tres números en `reglasDeLaDra`, y el panel de
citas del sitio los lee de ahí en vez de repetirlos. **Si los cambias
aquí, el panel se entera solo** — no hay que tocar el front.

## Quién lo llama

El sitio [`sitio-katherin`](https://github.com/Alveiro29/sitio-katherin):

- `js/booking.js` → `/api/disponibilidad`, `/api/reservar`
- `js/citas.js` y `js/seguimiento.js` → `/api/citas`, `/api/citas/todas`, `/api/citas/nota`, `/api/citas/editar`, `/api/citas/cancelar`,
  `/api/citas/confirmar`,
  `/api/bloqueos`, `/api/bloqueos/crear`, `/api/bloqueos/borrar`, `/api/salud`,
  `/api/pacientes/recuperacion`
- `js/mi-cita.js` → `/api/cita`, `/api/cita/horarios`, `/api/cita/cancelar`, `/api/cita/mover`
- `js/consent.js` → `/api/consentimientos*`, `/api/pacientes*`
- `js/encuesta.js` → `/api/encuesta`, `/api/encuesta/responder`, `/api/encuesta/google`
- `js/opiniones.js` (panel oculto `/opiniones`) → `/api/encuestas*`, `/api/resenas*`

## Encuestas y Google Maps

Al terminar cada cita la paciente recibe un enlace a una encuesta de
1–5 estrellas (por WhatsApp desde el panel `/opiniones`, o solo por correo
si se configura Resend + un Cron Trigger). La tabla `encuestas` se crea sola
en D1 la primera vez.

Google no permite publicar reseñas en nombre de nadie: la encuesta le deja
el comentario copiado y le abre el formulario de reseña de la sucursal que
eligió (se le ofrece a todas, no solo a las de 4–5★: pedírsela solo a las
contentas va contra las políticas de Google). Las reseñas que ya están en
Maps se leen y se responden desde el panel vía Google Business Profile.
Las variables necesarias están en la cabecera de `worker.js`.

## Comprobar que lo desplegado es lo correcto

Abre `https://agenda-api.josea-yuasen.workers.dev/api/salud` en el
navegador. Responde con la versión, la cuenta de servicio, el horario,
las cabinas por sucursal, `reglasDeLaDra` y si los dos calendarios
responden. Es la forma más rápida de confirmar un deploy.

## Probarlo sin desplegar

El final del archivo exporta las funciones de cálculo (`conflictoDra`,
`freeSlots`, `citasDraDelDia`, `esServicioDra`…) para poder ejercitarlas
desde node sin tocar Google Calendar ni Cloudflare:

    cp worker.js /tmp/w.mjs
    node --input-type=module -e "
      import('/tmp/w.mjs').then(W => console.log(W.esServicioDra('Mesoterapia AcneHeal')))
    "

Esos exports no le estorban a Cloudflare: usa el `export default`.
