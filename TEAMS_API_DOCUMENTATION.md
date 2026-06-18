# Teams Module - API Endpoints

## Base URL
`/teams`

All endpoints are protected with `CombinedAuthGuard`.

---

## 1. JOIN TEAM
**POST** `/teams/join`

### Description
User requests to join a team using a team code.

### Request Body
```json
{
  "code": "string"
}
```

### Response (200)
```json
{
  "message": "Solicitud enviada",
  "status": "PENDING"
}
```

### Error Cases
- **400 Bad Request**: Invalid team code
- **400 Bad Request**: User already approved as member
- **403 Forbidden**: User account has been suspended
- **409 Conflict**: Invalid format

---

## 2. GET MY STATUS
**GET** `/teams/my-status`

### Description
Get the current user's team membership status.

### Response (200)
```json
{
  "status": "NONE" | "PENDING" | "APPROVED" | "REJECTED",
  "rejectionCount": 0,
  "banned": false,
  "team": {
    "name": "Team Name"
  } | null
}
```

---

## 3. GET PENDING REQUESTS
**GET** `/teams/requests`

### Description
Get all pending join requests for the admin's team. (ADMIN ONLY)

### Response (200)
```json
[
  {
    "userId": "uuid",
    "userName": "John Doe",
    "userEmail": "john@example.com",
    "status": "PENDING",
    "createdAt": "2026-06-14T10:30:00Z"
  }
]
```

### Error Cases
- **403 Forbidden**: User is not an admin of any team

---

## 4. APPROVE MEMBER REQUEST
**PATCH** `/teams/requests/:userId/approve`

### Description
Approve a pending team join request. (ADMIN ONLY)

### Path Parameters
- `userId` (string): UUID of the user

### Response (200)
```json
{
  "message": "Solicitud aprobada",
  "member": {
    "userId": "uuid",
    "userName": "John Doe",
    "status": "APPROVED"
  }
}
```

### Error Cases
- **403 Forbidden**: User is not an admin
- **404 Not Found**: Request not found

---

## 5. REJECT MEMBER REQUEST
**PATCH** `/teams/requests/:userId/reject`

### Description
Reject a pending team join request. Increments rejection count and bans user if threshold reached. (ADMIN ONLY)

### Path Parameters
- `userId` (string): UUID of the user

### Response (200)
```json
{
  "message": "Solicitud rechazada",
  "userRejectionCount": 1,
  "banned": false
}
```

### Business Logic
- Rejection count increments
- User is automatically **banned** when `rejectionCount >= 3`
- `banned: true` prevents future login attempts

### Error Cases
- **403 Forbidden**: User is not an admin
- **404 Not Found**: Request not found

---

## Additional Endpoints (Legacy)

### Get Team by ID
**GET** `/teams/:id`

### Get Team Members
**GET** `/teams/:id/members`

### Update Member Role
**PATCH** `/teams/:id/members/:userId/role`

### Remove Member
**DELETE** `/teams/:id/members/:userId`

### Get Team Projects
**GET** `/teams/:id/projects`

### Get Team Activity
**GET** `/teams/:id/activity`

