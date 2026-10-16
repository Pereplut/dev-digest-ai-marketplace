# Architecture

`api/src/` has four rings. A file may import only from its own ring or a ring further in.

| Ring (inner to outer) | Directory | May import |
|---|---|---|
| Domain | `api/src/domain/` | nothing outside `domain/` |
| Application | `api/src/application/` | `domain/` |
| Infrastructure | `api/src/infrastructure/` | `domain/`, `application/` (to implement its ports) |
| HTTP | `api/src/http/` | `application/`, `domain/` |

- Use cases in `application/` receive their repositories as arguments (ports). They never import
  `infrastructure/`.
- `api/src/http/routes.js` is the composition root: the only file that wires infrastructure into use cases.
- An import from an inner ring to an outer ring is a blocking violation.
