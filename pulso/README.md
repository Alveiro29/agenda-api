# Pulso — métricas, metas y crecimiento (app para Mac)

App de escritorio para que **dos personas** sigan las cuentas de negocio en un mismo lugar:
Instagram, Facebook, TikTok, Meta Ads, el sitio web (SEO) y LinkedIn personal.
No es solo un tablero. Explica cada número, detecta problemas, convierte metas en
presupuesto publicitario y arma planes de crecimiento con las tasas reales de tus cuentas.

| Sección | Qué hace |
|---|---|
| **Resumen** | KPIs de todas las cuentas contra el período anterior (7/28/90 días), tarjetas por cuenta con tendencia, alertas prioritarias y metas. Filtro por persona. |
| **Cuenta** | *Métricas* agrupadas (audiencia, distribución, interacción, perfil, video, publicidad, SEO), cada una calificada contra una referencia del sector · *Tendencias* con período anterior y regresión (pendiente por semana + R²) · *Contenido*: mejor formato, mejor día, ranking de posts · *Diagnóstico* con acciones · *Campañas* (CPM, CTR, CPC, CPL y frecuencia por campaña) · *Datos*: CSV, registro manual y sincronización. |
| **Metas** | Metas de seguidores, alcance, impresiones, clics, leads, CTR, CPL, etc. Muestra el % logrado frente al % de tiempo transcurrido, el ritmo actual y el necesario, la proyección al cierre y el estado (en ruta / en riesgo / fuera de ruta). **Anclar a publicidad**: si el ritmo orgánico no llega, calcula cuánto presupuesto hace falta para cubrir la diferencia, y con qué objetivo de campaña, usando tu CPM, CTR y conversión reales. |
| **Estratega** | Planificador por embudo (leads, seguidores, alcance o impresiones), con alcance, impresiones, clics y presupuesto total, diario y semanal, reparto TOFU/MOFU/BOFU y tácticas. También trae el **Analista IA** (Claude), que lee el resumen y devuelve un diagnóstico y un plan de 30 días con experimentos A/B. |
| **SEO** | *Auditor on-page* de ~30 factores con puntaje y vista previa del resultado en Google · *Search Console*: palabras en "distancia de impacto" (posiciones 4–20) con los clics que ganarías, CTR real frente al esperado por posición, marca frente a no-marca y canibalización · *Rastreo*: robots.txt, sitemaps y redirección a https. |
| **Academia de métricas** | Las 32 métricas con fórmula, qué significan, referencia y la trampa típica al leerlas, más 7 reglas para leer números como analista. Cada ⓘ de la app abre esta misma explicación. |

## Instalar

**Opción A: compilar en tu Mac (2 minutos)**
```bash
xcode-select --install          # solo la primera vez
git clone https://github.com/Alveiro29/agenda-api && cd agenda-api/pulso
./build-app.sh --install        # compila y la deja en /Aplicaciones
```

**Opción B: descargar la compilada.** En GitHub → Actions → "Pulso (app de Mac)" → última ejecución
→ artefacto **Pulso-mac**. Descomprime y mueve `Pulso.app` a Aplicaciones. Como está firmada
localmente y no por Apple, la primera vez ábrela con clic derecho → **Abrir**, o en la Terminal:
`xattr -dr com.apple.quarantine /Applications/Pulso.app`.

Requiere macOS 12 o superior, en Apple Silicon o Intel.

## Primeros pasos

1. **Explora con datos de demostración**: al abrirla por primera vez, pulsa *Ver con datos de demostración*.
   Son 6 cuentas con 120 días de datos. Se quitan en Ajustes.
2. **Equipo**: en Ajustes pon los dos nombres. Cada cuenta y cada meta tiene responsable, y en
   "Viendo como" filtras lo tuyo.
3. **Compartir entre los dos**: en Ajustes → *Datos compartidos* → **Elegir carpeta…**. Escoge una
   carpeta compartida de iCloud Drive (o Dropbox o Google Drive) y la misma en las dos Macs. Pulso
   guarda todo en `pulso-data.json`. Si los dos guardan a la vez, **fusiona** los cambios en lugar de
   pisarlos, y cada minuto trae lo que cambió la otra persona.
4. **Conectar Meta** (Instagram profesional, Páginas y cuentas publicitarias). En Ajustes → *Meta*:
   - En developers.facebook.com crea una app de tipo **Empresa**.
   - En el Graph API Explorer genera un token con estos permisos: `pages_show_list, pages_read_engagement, read_insights, instagram_basic, instagram_manage_insights, ads_read, business_management`.
   - Extiéndelo a 60 días con el Depurador de tokens. Si quieres uno que no venza, genera un token de *usuario del sistema* en Business Manager.
   - Pégalo y pulsa **Guardar y buscar cuentas**, agrega las que quieras y en cada una pulsa **↻ Sincronizar**.
5. **TikTok y LinkedIn**: sus APIs de métricas exigen apps aprobadas, así que Pulso usa sus exportaciones.
   - TikTok Studio → Analíticas → Descargar datos.
   - LinkedIn → Analíticas → Exportar.

   Súbelas en la cuenta → *Datos e importación*. El importador reconoce encabezados en español o
   inglés, fechas DD/MM o MM/DD, fechas sin año y números como `1.234,5` o `1,234.5`.
6. **Sitio web**: agrega una cuenta *Sitio web / SEO* con la URL. En Search Console exporta
   *Rendimiento*: la pestaña **Fechas** se carga en la cuenta y la de **Consultas** en SEO → Search Console.
7. **Analista IA (opcional)**: pon tu API key de console.anthropic.com en Ajustes.

## Privacidad

- Los tokens de Meta y la API key de Claude se guardan en el **Llavero de cada Mac**, nunca en el archivo
  compartido ni en los respaldos.
- El Analista IA solo envía métricas agregadas, diagnósticos y textos de los posts. Nunca envía tokens.
- No hay servidor intermedio. Pulso habla directo con Meta y con Anthropic.

## Cómo está hecha

```
pulso/
├── mac/main.swift      shell nativo: ventana WKWebView, menú, puente de red sin CORS,
│                       Llavero, carpeta de datos con detección de conflictos, diálogos
├── mac/Info.plist, AppIcon.png
├── build-app.sh        compila con swiftc (sin proyecto de Xcode) → Pulso.app universal
├── web/                la app (HTML/CSS/JS sin dependencias ni compilación)
│   └── js/
│       ├── metrics.js     catálogo de métricas: fórmulas, referencias, explicaciones
│       ├── analysis.js    períodos, comparación, regresión, metas, anclaje a pauta,
│       │                  diagnóstico por reglas, planificador por embudo
│       ├── connectors.js  importador CSV + cliente de Meta Graph API
│       ├── seo.js         auditor on-page, robots/sitemap, oportunidades de Search Console
│       ├── store.js       estado, guardado y fusión entre dos personas
│       ├── ai.js          Analista IA (Claude)
│       ├── charts.js      gráficas SVG
│       ├── demo.js        datos de demostración
│       └── app.js         interfaz
└── tests/              node --test pulso/tests/unit.test.js · node pulso/tests/e2e.js
```

La interfaz también abre en un navegador (`web/index.html`) para probarla. En ese modo guarda en
`localStorage`, y el auditor SEO solo puede leer sitios que permitan CORS.

**Decisiones de métricas que conviene conocer:**

- **Tasa de interacción sobre alcance.** Es la que usa Pulso por defecto. La de seguidores existe para
  compararte con competidores y se calcula por publicación.
- **CTR de enlace, nunca "CTR (todos)".** El CTR que cuenta todos los clics infla el número porque suma
  clics en "ver más" o en el perfil.
- **Seguidores es un saldo, no un flujo.** Se toma el último valor del período, y el crecimiento se mide
  contra el cierre del período anterior.
- **El alcance de varios días no da personas únicas.** La suma diaria sirve para ver tendencia.
- **Posición en Google ponderada por impresiones.** Es como la calcula Search Console.
- **Las tasas se comparan en puntos porcentuales (pp)** y los totales en %.
- **Las referencias del sector son orientativas** (2025, con ajuste para LatAm y el sector financiero).
  Lo más útil es compararte contra tu propio histórico.
