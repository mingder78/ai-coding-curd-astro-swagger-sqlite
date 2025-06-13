# ai-coding-curd-astro-swagger-sqlite 

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## new webauthn API

* to get register options API

```
curl --location 'localhost:3000/register/options' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "test@gmail.com"
}' | jq
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100   546  100   515  100    31    456     27  0:00:01  0:00:01 --:--:--   491
{
  "challenge": "wr18CrsFesVMG1zvASGO6EO_ShkgZsYwBzUT_mxZB8c",
  "rp": {
    "name": "YourAppName",
    "id": "localhost"
  },
  "user": {
    "id": "Y3VzdG9tVXNlcklESGVyZQ",
    "name": "test@gmail.com",
    "displayName": ""
  },
  "pubKeyCredParams": [
    {
      "alg": -8,
      "type": "public-key"
    },
    {
      "alg": -7,
      "type": "public-key"
    },
    {
      "alg": -257,
      "type": "public-key"
    }
  ],
  "timeout": 60000,
  "attestation": "none",
  "excludeCredentials": [],
  "authenticatorSelection": {
    "residentKey": "preferred",
    "userVerification": "preferred",
    "requireResidentKey": false
  },
  "extensions": {
    "credProps": true
  },
  "hints": []
}
```

* to do register verify API, where response should be a credential ID from passkey register.

```
curl --location 'localhost:3000/register/verify' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "test@gmail.com",
  "response": "asdfadsfdsfadsfasdfasdfadsf"
}'
Missing credential ID
```

* to get login options API

```
curl --location 'localhost:3000/login/options' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "test@gmail.com"
}' | jq
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:-- --:--:-100    31    0     0  100    31      0     25  0:00:01  0:00:0100   178  100   147  100    31    105     22  0:00:01  0:00:0100   178  100   147  100    31    105     22  0:00:01  0:00:01 --:--:--   128
{
  "rpId": "localhost",
  "challenge": "_SUUYe1rCBQ6Cbvsl9XX4c_mY3tuQ8nmFkcIBNRuJYg",
  "allowCredentials": [],
  "timeout": 60000,
  "userVerification": "preferred"
}
```



## test

This project was created using `bun init` in bun v1.1.20. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
* if you have no authorization to login
```
ming-ders-MacBook.local💩➜  curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user2", "password": "password123"}'
{"success":false,"message":"Invalid credentials"}
```

* register as a new user for yourself
```bash
ming-ders-MacBook.local💩➜  curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123"}'
{"success":true,"id":1}
```
* try to post a new item
```
ming-ders-MacBook.local💩➜  curl -X POST http://localhost:3000/items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "description": "This is a test item"}'
{"error":"Unauthorized"}
```
* you need to login and get a JWT token first.
```
ming-ders-MacBook.local💩➜  curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123"}'
{"success":true,"token":"eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyMSJ9.hsMADKLxricZDq1Eu3mHKQH7fjRu8VFqjqmhfWvk2GA"}
```
* your token is eyJhbGciOiJIUzI1NiJ ... jqmhfWvk2GA
* use this token as a Authorization header to add a new item for yourself.
```
ming-ders-MacBook.local💩➜  curl -X POST http://localhost:3000/items \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyMSJ9.hsMADKLxricZDq1Eu3mHKQH7fjRu8VFqjqmhfWvk2GA" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "description": "This is a test item"}'
{"success":true,"id":1,"name":"Test Item","description":"This is a test item","user_id":1}
```
* to query your own items
```
ming-ders-MacBook.local💩➜  curl -X GET http://localhost:3000/items \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyMSJ9.hsMADKLxricZDq1Eu3mHKQH7fjRu8VFqjqmhfWvk2GA" \
| jq
[
  {
    "id": 1,
    "name": "Test Item",
    "description": "This is a test item",
    "user_id": 1,
    "created_at": "2025-03-06 08:21:47"
  },
  {
    "id": 10,
    "name": "Test Item",
    "description": "This is a test item",
    "user_id": 1,
    "created_at": "2025-06-12 08:17:11"
  }
]
```

## cloud db

* add your xata API KEY, DATABASE_URL, and BRANCH in .env
```
cat .env.example
XATA_API_KEY=<your xata api key>
XATA_DATABASE_URL=https://<your workspace name>.us-east-1.xata.sh/db/<your database name>

# Xata branch that will be used
# if there's not a xata branch with
# the same name as your git branch
XATA_BRANCH=main
```
* get your own xata API key from [https://xata.io/](https://xata.io/)
## links

Claude won, [https://claude.ai/share/12c19487-c220-439e-a053-5d66f00ab6b0](https://claude.ai/share/12c19487-c220-439e-a053-5d66f00ab6b0)
* tiny error in rate limiting
* better than [Grok 3 (beta)](https://grok.com/share/bGVnYWN5_f85d5448-fc22-4a72-bc3e-335e89fffea2)
* much much batter than [Azure OpenAI (GTP-4o)](https://github.com/copilot/share/80055284-40c0-80b6-9100-084900084045)
