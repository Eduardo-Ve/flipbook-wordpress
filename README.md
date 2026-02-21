# Flipbook PDF WordPress — Visor Interactivo con Compresión

Plugin de WordPress que convierte PDFs en flipbooks interactivos estilo revista, con compresión automática vía la API de **iLovePDF** para optimizar el peso de tus archivos sin perder calidad visual.

---

##  Características

- **Flipbook interactivo** — Navegación con efecto de paso de páginas usando StPageFlip + PDF.js
- **Compresión automática** — Reduce el peso del PDF al subirlo a la Biblioteca de Medios (vía iLovePDF API)
- **Compresión manual** — Botón para comprimir PDFs ya subidos, directamente desde la Biblioteca de Medios
- **Columna de estado** — La Biblioteca de Medios muestra el porcentaje de ahorro conseguido por cada PDF
- **Estadísticas globales** — Contador de PDFs comprimidos y espacio total ahorrado en el panel de ajustes
- **Metabox en Series** — Asigna un PDF a cualquier entrada de tipo `vlogger_serie` con un selector visual
- **Shortcode** — Inserta el flipbook en cualquier página o post
- **Inyección automática** — El flipbook aparece al final del contenido de la serie sin código adicional
- **100 % responsive** — Se adapta a móviles y tablets
- **Tres niveles de compresión** — Baja, Recomendada y Extrema

---

##  Requisitos

| Requisito | Versión mínima |
|-----------|----------------|
| WordPress | 5.8 |
| PHP | 7.4 |
| Extensión cURL | Habilitada (recomendado) |
| Cuenta iLovePDF | Plan gratuito (250 archivos/mes) |

> La extensión **cURL** no es obligatoria, pero mejora la fiabilidad de la subida de archivos a la API. Si no está disponible, el plugin usará `wp_remote_post` como alternativa automática.

---

##  Obtener las claves de API de iLovePDF

1. Ve a [developer.ilovepdf.com](https://developer.ilovepdf.com/) y crea una cuenta gratuita.
2. Accede a **Projects → Create new project**.
3. Copia tu **Public Key** (`project_public_xxxxx`) y tu **Secret Key**.
4. Pégalas en **Ajustes → Flipbook PDF** dentro de tu WordPress.

> El plan gratuito de iLovePDF incluye **250 archivos/mes**. Para mayor volumen consulta sus planes de pago.

---

##  Instalación

1. Descarga o clona este repositorio.
2. Copia la carpeta `flipbook-wordpress` en `wp-content/plugins/`.
3. En el panel de WordPress, ve a **Plugins** y activa **Flipbook PDF WordPress - Compresión**.
4. Configura las claves de API (ver sección anterior).

### Estructura de archivos

```
flipbook-wordpress/
├── flipbook-wordpress.php      # Archivo principal del plugin
├── assets/
│   ├── css/
│   │   └── flipbook.css        # Estilos del visor
│   └── js/
│       ├── flipbook.js         # Lógica del flipbook
│       └── page-flip.browser.js # Librería StPageFlip (local)
└── README.md
```

---

##  Configuración

Ve a **Ajustes → Flipbook PDF** para configurar:

| Opción | Descripción | Valor por defecto |
|--------|-------------|-------------------|
| Public Key | Clave pública de iLovePDF | — |
| Secret Key | Clave secreta de iLovePDF | — |
| Compresión automática | Comprime todo PDF subido a la Biblioteca de Medios | Activada |
| Nivel de compresión | `low` / `recommended` / `extreme` | `recommended` |
| Tamaño máximo | PDFs más grandes que este límite no se comprimen | 50 MB |

El panel también muestra un **indicador de estado** de la conexión con la API y las estadísticas acumuladas de compresión.

### Niveles de compresión

| Nivel | Descripción | Ahorro estimado |
|-------|-------------|-----------------|
| **Baja** | Máxima calidad, menor compresión | 10–25 % |
| **Recomendada** | Balance óptimo entre calidad y tamaño | 30–60 % |
| **Extrema** | Mayor compresión, menor calidad | 60–80 % |

> El archivo solo se reemplaza si la compresión supera un **5 % de ahorro**. Por debajo de ese umbral, el original se conserva intacto.

---

## Cómo usar el flipbook

### Método 1 — Metabox en Series (automático)

1. **Sube el PDF** en **Medios → Añadir nuevo**. Si la compresión está activa, el archivo se comprimirá automáticamente durante la subida.
2. Edita una entrada de tipo **Serie** (`vlogger_serie`).
3. En la barra lateral encontrarás el metabox **"PDF Flipbook"**.
4. Haz clic en **"Seleccionar PDF"** y elige el archivo de la Biblioteca de Medios.
5. Ajusta el **ancho** y el **alto** en píxeles (recomendado: 450 × 600).
6. Publica o actualiza la entrada. El flipbook aparecerá automáticamente al final del contenido.

### Método 2 — Shortcode (manual)

Inserta el flipbook en cualquier página, post o widget de texto.

**Por ID de adjunto:**
```
[flipbook_pdf id="123" width="450" height="600"]
```

**Por URL directa:**
```
[flipbook_pdf url="https://tusitio.com/wp-content/uploads/2024/01/revista.pdf" width="800" height="600"]
```

| Parámetro | Requerido | Descripción |
|-----------|-----------|-------------|
| `id` | Opcional* | ID del PDF en la Biblioteca de Medios |
| `url` | Opcional* | URL directa al archivo PDF |
| `width` | No | Ancho en píxeles (por defecto: `450`) |
| `height` | No | Alto en píxeles (por defecto: `600`) |

*Se debe proporcionar `id` **o** `url`.

---

##  Compresión manual desde la Biblioteca de Medios

Si un PDF fue subido antes de activar el plugin (o sin API configurada), puedes comprimirlo manualmente:

1. Ve a **Medios → Biblioteca**.
2. Abre el PDF que quieras comprimir.
3. En el panel de detalles verás el botón **"Comprimir ahora"**.
4. Haz clic y espera. El resultado (porcentaje de ahorro) aparecerá en pantalla.

Los PDFs ya comprimidos muestran su porcentaje de ahorro en la columna **"Compresión"** de la Biblioteca de Medios en lugar del botón.

---

## Personalización

### Colores de los botones de navegación

Edita `/assets/css/flipbook.css`:

```css
.fbw-prev,
.fbw-next {
  background: #2c7570; /* Tu color aquí */
}
```

### Dimensiones del contenedor

```css
.fbw-flipbook-container {
  min-height: 900px;
  height: 900px;
}
```

### Dimensiones recomendadas por formato

| Formato | Ancho | Alto |
|---------|-------|------|
| Vertical (revista) | 450 px | 600 px |
| Horizontal (catálogo) | 600 px | 400 px |
| Grande (presentación) | 800 px | 600 px |

---

##  Solución de problemas

### El PDF no se comprime al subirlo
- Verifica que las API keys estén correctamente guardadas en **Ajustes → Flipbook PDF**.
- Comprueba que el PDF no supere el **tamaño máximo** configurado (por defecto 50 MB).
- Revisa que la compresión automática esté **activada**.
- Consulta el log de WordPress para mensajes con el prefijo `FBW:`.

### El flipbook no se muestra en el frontend
- Confirma que la entrada es de tipo `vlogger_serie` y tiene un PDF asignado.
- Abre la consola del navegador (F12) y busca errores de JavaScript.
- Verifica que PDF.js y StPageFlip se cargan correctamente.

### Error de conexión con la API
- El indicador de estado en **Ajustes → Flipbook PDF** mostrará el mensaje de error exacto.
- Comprueba que tu servidor tiene acceso saliente a `api.ilovepdf.com`.
- Verifica que las claves no tienen espacios extra al pegarlas.

### El archivo comprimido es mayor que el original
- Algunos PDFs ya están optimizados y no se benefician de más compresión. En ese caso el plugin conserva el original automáticamente.

### Activar modo debug de WordPress
```php
// En wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```
Revisa `/wp-content/debug.log` y filtra por el prefijo `FBW:`.

---

##  Seguridad

- Nonces de WordPress en todos los formularios y peticiones AJAX.
- Sanitización de entradas con `sanitize_text_field`, `absint` y `rest_sanitize_boolean`.
- Escape de salidas con `esc_attr`, `esc_url` y `esc_html`.
- Verificación de capacidades (`manage_options`, `upload_files`, `edit_post`).
- Validación de tipo MIME del archivo descargado antes de reemplazar el original.

---

## Compatibilidad con plugins de caché

Compatible con WP Super Cache, W3 Total Cache, WP Rocket y Autoptimize. No requiere configuración adicional.

---

##  Créditos y dependencias

| Librería | Versión | Origen |
|----------|---------|--------|
| [PDF.js](https://mozilla.github.io/pdf.js/) | 3.11.174 | CDN (cdnjs) |
| [StPageFlip](https://github.com/Nodlik/StPageFlip) | 2.0.7 | Local (`assets/js/`) |
| [iLovePDF API](https://developer.ilovepdf.com/) | v1 | API externa |

---

## Autor

**Eduardo Velasquez**  
[github.com](https://github.com/Eduardo-Ve/)
[contraplano.cl](https://contraplano.cl)
