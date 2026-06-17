# Changelog

## v1.0.0 (2026-06-15)

### Features
- Core normalization engine (1FN through 5FN + BCNF)
- SQL DDL parser (30+ data types, constraints, indexes)
- CSV import with automatic FD discovery
- Database metadata import (information_schema)
- Interactive academy learning path
- Quests and achievements system
- Export to DBML, Mermaid, and HTML
- i18n support (es, en, pt-BR)
- Learning analytics dashboard
- Contextual glossary (30+ terms)
- Sandbox mode for offline practice

### Security
- Sanctum token + SPA cookie auth
- HttpOnly session cookies
- CSP + HSTS security headers
- Input validation on all endpoints
- Blocked terms name validation

### Performance
- Candidate key pruning with memoization
- Benchmark harness for engine performance

### Accessibility
- WCAG AA compliance (aria labels, focus management, keyboard nav)
- Screen reader announcements
- Skip links and focus traps

### Documentation
- Complete OpenAPI 3.0 specification
- Anti-drift CI tests
- API documentation with request/response examples

### Infrastructure
- CI pipeline (PHP lint + test, Node type-check + build)
- Docker + Nginx configuration
- Vercel deployment config
