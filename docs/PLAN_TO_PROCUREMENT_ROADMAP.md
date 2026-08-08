# Plan-to-procurement roadmap

BuildMate must describe only capabilities that are actually operating. A rules-based or human-reviewed result must never be presented as AI-generated professional advice.

## Version 1 — assisted procurement (implemented foundation)

- Customers can upload BOQs, plans, spreadsheets and plan images to private storage.
- Uploads are tenant-scoped, size/type validated and queued for review.
- The customer identifies the project type and current construction stage.
- Stage templates explain the likely material groups without claiming measured quantities.
- Calculators produce explicitly preliminary estimates and can hand results to quote requests or marketplace search.

The upload queue is the secure foundation for a human quantity-surveyor review workflow. Automated plan interpretation is not yet implemented.

## Version 2 — structured extraction

- Extract structured BOQ rows from supported spreadsheets and text PDFs.
- Require user confirmation for ambiguous units, quantities and duplicated lines.
- Match confirmed rows to catalogue products and supplier listings.
- Preserve source page/cell provenance and confidence for every extracted row.
- Generate editable procurement packages and comparison-ready RFQs.

## Version 3 — plan intelligence

- Use a separately evaluated vision pipeline for plans and drawings.
- Detect scale, dimensions, symbols and construction elements with confidence thresholds.
- Route low-confidence output to qualified human review.
- Maintain version history, reviewer identity and complete audit trails.
- Add regional building assumptions only after professional and legal validation.

## Safety gates

Before any automated quantity is released, the system needs representative evaluation data, accuracy thresholds, unit and currency validation, model/version traceability, tenant-isolation tests, secure deletion/retention controls, monitoring and a qualified-professional review policy.
