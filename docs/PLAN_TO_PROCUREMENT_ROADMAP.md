# Plan-to-procurement roadmap

BuildMate must describe only capabilities that are actually operating. A rules-based or human-reviewed result must never be presented as AI-generated professional advice.

## Version 1 — assisted procurement (implemented foundation)

- Customers can upload BOQs, plans, spreadsheets and plan images to private storage.
- Uploads are tenant-scoped, size/type validated and queued for review.
- The customer identifies the project type and current construction stage.
- Stage templates explain the likely material groups without claiming measured quantities.
- Calculators produce explicitly preliminary estimates and can hand results to quote requests or marketplace search.

The upload queue is the secure foundation for a human quantity-surveyor review workflow. Automated plan interpretation is not yet implemented.

## Version 2 — structured extraction (spreadsheet workflow implemented)

- CSV and XLSX BOQs are extracted into structured rows (implemented).
- Customers must review, edit, confirm or exclude every extracted requirement (implemented).
- Deterministic catalogue suggestions discard low-confidence matches (implemented).
- Worksheet and row provenance plus match confidence are retained in each RFQ item (implemented).
- Confirmed rows generate an idempotent, comparison-ready RFQ (implemented).
- Text-PDF extraction remains pending evaluation; PDFs, drawings and images continue through assisted review.

## Version 3 — plan intelligence

- Use a separately evaluated vision pipeline for plans and drawings.
- Detect scale, dimensions, symbols and construction elements with confidence thresholds.
- Route low-confidence output to qualified human review.
- Maintain version history, reviewer identity and complete audit trails.
- Add regional building assumptions only after professional and legal validation.

## Safety gates

Before any automated quantity is released, the system needs representative evaluation data, accuracy thresholds, unit and currency validation, model/version traceability, tenant-isolation tests, secure deletion/retention controls, monitoring and a qualified-professional review policy.
