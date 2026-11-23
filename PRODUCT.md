# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Carmen developers / ops engineers**: technical users who repair data, clean up
  business units and tenant schemas, and run platform migrations on dev, UAT and
  prod.
- **Support staff and implementers**: less technical than the engineers. They use
  the same tool to fix customer data and provision or clean up tenants, so the
  interface has to explain what an operation will do and guard against mistakes
  without assuming database expertise.

Access requires a Carmen platform super-admin (gateway login with
`is_super_admin === true`). A shared-secret login (`GOD_MODE_PASSWORD`) is the
fallback.

## Product Purpose

Carmen Inventory God Mode is a direct admin console over the live Carmen
inventory PostgreSQL database: one database, a `CARMEN_SYSTEM` registry schema,
and one tenant schema per business unit. It exists for the jobs the everyday
platform (carmen-backstage) can't or won't do: hard deletes, cascade deletes
across the FK graph, schema drops, raw SQL, and running the shared-schema
package's migrations and seeds.

Success means the operator finishes the job correctly the first time. Every write
is permanent and there is no undo. The audit log is the only recovery record.

## Positioning

God Mode is the deliberately dangerous sibling of carmen-backstage. It sits in
the same product family and hides none of the destructive power. Each
irreversible action shows a blast-radius preview and requires typing a
confirmation phrase, and every write is audited.

## Operating Context

- Core workflows, all used regularly:
  - Cleaning up business units and tenant schemas: cascade delete, "Delete BU
    only", optional `DROP SCHEMA`, and the protected/shared-schema guards on
    `/schemas`.
  - Row-level data repair: browse, edit, insert, delete and batch delete in any
    table.
  - Platform migrations and seeds on `/platform-migrations`, including the
    catalog drift checks.
  - SQL console (read-only by default; a write needs a preview, then an explicit
    Commit) and audit-log review.
- The same build is pointed at different environments (`.env.local`, `.env.uat`,
  `.env.prod`). The operator must always know which live target they are writing
  to.
- Long operations stream their progress as NDJSON to the UI.

## Capabilities and Constraints

- Desktop only. There is no mobile or small-screen requirement.
- Schema-agnostic: tables are discovered by catalog introspection at runtime, so
  the UI has to cope with arbitrary columns, types and row counts.
- Safety mechanics are product truth and must be kept:
  - type-to-confirm phrases
  - blast-radius previews
  - `CASCADE_MAX_ROWS` / `CASCADE_MAX_DEPTH` caps
  - `PROTECTED_SCHEMAS`
  - the `ALLOW_DANGER_OPS` gate on the danger zone
  - re-auth and confirm re-validation on streaming ops
- Terminology: business unit (BU), cluster, tenant schema, system schema
  (`CARMEN_SYSTEM`), cascade delete, blast radius, calculation method.
- Undecided: UI language. The current copy is English, and whether Thai
  localization is needed has not been decided.

## Brand Commitments

- **The same family as carmen-backstage** (formerly carmen-platform). Its look
  is adopted so operators who use both recognise one product family.
- **One deliberate exception: safety.** The persistent live-target indicator and
  the destructive-flow confirm ceremony stay loud and specific to God Mode, so
  the tool is never mistaken for the everyday platform.

## Evidence on Hand

- Design history: `docs/superpowers/specs/` (the original spec is
  `2026-06-25-inventory-god-mode-design.md`; the current visual direction is
  `2026-07-06-platform-aligned-hybrid-redesign-design.md`).
- Safety and setup facts: `README.md`.
- There are no customer-facing claims, testimonials or metrics. This is an
  internal tool, and none should be invented.

## Product Principles

1. **Irreversibility is visible.** Before anything permanent runs, the operator
   sees what it touches, where it lands (environment and schema), and how much it
   affects.
2. **Friction scales with blast radius.** Low-risk reads stay fast, and
   destructive operations get escalating confirmation.
3. **Explain for the less technical operator.** Support staff use this too.
   State consequences in plain terms, not just SQL.
4. **Family resemblance with one exception.** Match carmen-backstage everywhere
   except the safety signals.
5. **Audit everything.** Every write leaves a record, because that record is the
   only way back.
