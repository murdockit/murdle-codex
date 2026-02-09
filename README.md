# Logic-Grid Mystery Builder

Run locally with Docker:

```sh
docker-compose up -d
```

Open:

```
http://localhost:3030
```

## Development notes
- API base: `/api`
- Data persists in Postgres via Docker volume.
- Grid interaction is client-only (not persisted).

## Entity descriptions
Suspects, locations, and weapons support separate description fields. Enter names in the main list
and add one description per line in the corresponding descriptions box. The app will warn if the
counts do not match, and descriptions are saved alongside each entity.
