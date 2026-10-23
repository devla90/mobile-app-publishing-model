# Modelo de publicación de apps móviles

*English version: [README.md](README.md).*

Modelo base, neutro y reutilizable, de todo lo que existe para publicar una app en App Store y Google Play: actores, plataformas, credenciales, artefactos, pasos con dependencias, puntos de variación, renovaciones e hitos de seguimiento. Se instancia por cliente sin tocar el modelo.

**Fuente de verdad:** los archivos JSON de `model/`. Todo lo demás se genera.

**Idiomas.** El repositorio (estructura, claves, código, documentación, skills) está en inglés, como cualquier proyecto open source. El *contenido* del modelo (nombres de pasos, notas, descripciones de roles, la página y el diagrama generados) está en español, declarado con `"lang": "es"` en cada archivo de datos. Para agregar otro idioma de interfaz basta crear `generator/i18n/<lang>.json` y construir con `--lang`.

## Qué contiene

| Carpeta | Qué es | Quién la edita |
| --- | --- | --- |
| `model/` | El modelo base en JSON (10 archivos). | Personas o IA, con el skill `edit-model`. |
| `clients/<id>/instance.json` | Lo que cambia para un cliente: carriles, variantes, fechas, decisiones. | Una vez por cliente, con el skill `instantiate-client`. |
| `generator/` | `build.py`, `validate.py`, `check_sources.py`, plantillas de la página y textos de interfaz (`i18n/`). | Solo para cambiar cómo se ve o funciona la página. |
| `dist/` | Lo generado: página interactiva, diagrama SVG y PNG, diff por cliente. | Nadie. Se regenera con `build.py`. |
| `docs/` | Cómo está construido el modelo, convenciones, decisiones, validación de datos, despliegue. | Al cambiar el modelo. |
| `.claude/skills/` | Procedimientos para la IA: instanciar, editar el modelo, validar requisitos. | Al cambiar un procedimiento. |

## Uso

```bash
python3 generator/validate.py           # sintaxis, IDs y referencias cruzadas
python3 generator/build.py              # genera dist/ (el PNG requiere playwright)
python3 generator/build.py --no-png     # solo HTML, SVG y diff
```

Abre `dist/index.html` en el navegador. Publicarlo en GitHub Pages es opcional; ver [docs/deployment.md](docs/deployment.md#github-pages-optional).

## Dos lugares, dos usos

- **Este repositorio** es el modelo base: versionado, compartible, sin datos de clientes reales. La página que genera guarda el seguimiento solo en el navegador de quien la abre.
- **El artefacto de Claude** (opcional) es la herramienta de operación diaria: mismo modelo, con seguimiento compartido entre el equipo y roles de acceso. Se regenera desde aquí cuando el modelo cambia. Ver `docs/deployment.md`.

Las instanciaciones de clientes reales con información interna no deben subirse a un repositorio público. Mantén este repositorio como base y las instancias en un repositorio privado o en el artefacto. Ver [Private client instances](docs/deployment.md#private-client-instances).

## Mantenimiento con IA

Abre el repositorio con Claude Code. `CLAUDE.md` le dice qué leer según la tarea, para no cargar todo el repositorio. Los tres procedimientos habituales están como skills:

- `/instantiate-client`: crea `clients/<id>/instance.json` preguntando carriles y variantes.
- `/edit-model`: agrega o cambia un paso, rol, credencial o variante respetando IDs y dependencias.
- `/validate-requirements`: revisa en las páginas oficiales de Apple y Google los datos con plazo y actualiza `docs/validation.md`.

La acción `check-sources.yml` compara cada mes las páginas oficiales citadas con una referencia guardada y abre un issue si alguna cambió. `validate.yml` ejecuta la validación y el build en cada pull request a `main`.

## Primeros pasos en un repositorio nuevo

```bash
git init && git add . && git commit -m "Mobile app publishing model"
python3 generator/check_sources.py --update   # referencia inicial de las fuentes
git add generator/sources_hash.json && git commit -m "Add sources reference"
```

Opcionalmente, publica en GitHub Pages y protege `main`: ver [docs/deployment.md](docs/deployment.md#github-pages-optional) y [Branch protection](docs/deployment.md#branch-protection).

## Licencia

Apache License 2.0. Ver [LICENSE](LICENSE) y [NOTICE](NOTICE).

## Origen

Construido con Claude en octubre de 2026 para un área de canales digitales. Datos validados contra fuentes oficiales el 14 de octubre de 2026; ver `docs/validation.md`.
