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
