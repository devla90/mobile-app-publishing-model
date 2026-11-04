# Ejemplo: qué cambia respecto al modelo base

Perfil regulatorio: PR-<SECTOR>-<PAIS>

## Carriles
| Carril | Base | Cliente |
| --- | --- | --- |
| L1 | Canal Digital | Canales Digitales |
| L2 | TI | Equipo técnico de Canales Digitales |
| L3 | Ejecutor técnico | Proveedor X |
| L4 | Seguridad | Ciberseguridad |
| L5 | Cumplimiento, Legal y Riesgos | Legal, Cumplimiento y Riesgos |
| L7 | Externos | Apple, Google, D&B |

## Variantes elegidas
| Variante | Opción |
| --- | --- |
| V1 Tipo de cuenta | a) Organización |
| V2 Titularidad de las cuentas | a) Cuenta propia del titular |
| V3 Dónde se compila | c) CI operado por un tercero |
| V7 Cómo se sube | c) API automatizada |
| V8 Push en iOS | a) Clave APNs (token) |
| V13 Canal de distribución | a) Tiendas públicas (modelado) |
| V14 Modelo de ejecución tecnológica | b) Un tercero gobernado por TI |
| V11 Origen de la app | a) App nueva (modelado) |
| V15 Plataformas objetivo | a) iOS y Android |

Sin elegir: V4, V5, V6, V9, V10, V12

## Alertas de segregación de roles
Ninguna.

## Decisiones abiertas
| ID | Decisión | Responsable | Fecha límite | Frena |
| --- | --- | --- | --- | --- |
| D1 | Quién custodia el original de las claves | Ciberseguridad | 2026-11-06 | 13 |

## Pasos movidos
| Paso | En el modelo | En el cliente |
| --- | --- | --- |
| S1.5 | 3 | 5 |

## Notas por actividad

**5**
- El nombre legal de la organización debe escribirse **exactamente como figura en el D-U-N-S**; si no coincide, la verificación de la entidad se detiene.

## Pasos que no aplican
| Paso | En el modelo | Motivo |
| --- | --- | --- |
| S5.5 | 10 | se eligió V11 a) App nueva (modelado) |
| S3.5 | 7 | La app no se distribuye en la Unión Europea |

## Riesgos
| ID | Riesgo | Severidad | Afecta | Responsable |
| --- | --- | --- | --- | --- |
| RG1 | La verificación de la entidad tarda más de lo planificado | Media | 6 | Canales Digitales |

## Decisiones
| Fecha | Decisión | Responsable | Motivo |
| --- | --- | --- | --- |
| 2026-10-14 | El titular de las cuentas es la entidad, no el proveedor | Canales Digitales | Apple exige que las apps financieras las publique la propia entidad (guía 3.2.1) |

## Plan
Fecha de inicio: 2026-11-02

| Actividad | Días | Espera a | Hecha |
| --- | --- | --- | --- |
| 21 Decide Go / No-Go | 3 | 20, 18, X1 |  |
| X1 Piloto interno con colaboradores (propia del cliente) | 14 | 19 | |
