# ai-coding-curd-astro-swagger-sqlite 

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.1.20. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

```bash
ming-ders-MacBook.local💩➜  z curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123"}'
{"success":true,"id":1}%
ming-ders-MacBook.local💩➜  z curl -X POST http://localhost:3000/items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "description": "This is a test item"}'
{"error":"Unauthorized"}%
ming-ders-MacBook.local💩➜  z curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123"}'
{"success":true,"token":"eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyMSJ9.hsMADKLxricZDq1Eu3mHKQH7fjRu8VFqjqmhfWvk2GA"}%
ming-ders-MacBook.local💩➜  z curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user2", "password": "password123"}'
{"success":false,"message":"Invalid credentials"}%
ming-ders-MacBook.local💩➜  z curl -X POST http://localhost:3000/items \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyMSJ9.hsMADKLxricZDq1Eu3mHKQH7fjRu8VFqjqmhfWvk2GA" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "description": "This is a test item"}'
{"success":true,"id":1,"name":"Test Item","description":"This is a test item","user_id":1}%
ming-ders-MacBook.local💩➜  z curl -X GET http://localhost:3000/items \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyMSJ9.hsMADKLxricZDq1Eu3mHKQH7fjRu8VFqjqmhfWvk2GA" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "description": "This is a test item"}'
[{"id":1,"name":"Test Item","description":"This is a test item","user_id":1,"created_at":"2025-02-28 02:05:57"}]%
```

## links

Claude won, [https://claude.ai/share/12c19487-c220-439e-a053-5d66f00ab6b0](https://claude.ai/share/12c19487-c220-439e-a053-5d66f00ab6b0)
* tiny error in rate limiting
* better than [Grok 3 (beta)](https://grok.com/share/bGVnYWN5_f85d5448-fc22-4a72-bc3e-335e89fffea2)
* much much batter than [Azure OpenAI (GTP-4o)](https://github.com/copilot/share/80055284-40c0-80b6-9100-084900084045)
