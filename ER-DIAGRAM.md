# MediCare data model

<!-- The diagram mirrors the IndexedDB stores used by the application. -->

Patient identity fields (`name`, `address`, `telephone`, `dateOfBirth` and
`nhsNumber`) are encrypted with AES-256-GCM before they are stored in
IndexedDB. Passwords are stored as salted PBKDF2 hashes rather than plaintext.

```mermaid
erDiagram
  USERS ||--o| PATIENTS : authenticates
  USERS ||--o| DOCTORS : authenticates
  USERS ||--o| ADMINS : authenticates
  PATIENTS ||--o{ APPOINTMENTS : books
  DOCTORS ||--o{ APPOINTMENTS : attends
  PATIENTS ||--o{ NOTES : has
  DOCTORS ||--o{ NOTES : writes
  PATIENTS ||--o{ PRESCRIPTIONS : receives
  DOCTORS ||--o{ PRESCRIPTIONS : issues
  MEDICINES ||--o{ PRESCRIPTIONS : references
  PATIENTS ||--o{ PRESCRIPTION_REQUESTS : requests
  MEDICINES ||--o{ PRESCRIPTION_REQUESTS : concerns
  USERS ||--o{ AUDIT_LOGS : creates

  USERS {
    string id PK
    string name
    string email
    string username
    string role
    object passwordHash
  }
  PATIENTS {
    string id PK
    string name_encrypted
    string address_encrypted
    string telephone_encrypted
    date dateOfBirth_encrypted
    string nhsNumber_encrypted
  }
  DOCTORS {
    string id PK
    string name
    string email
  }
  ADMINS {
    string id PK
    string name
    string email
  }
  MEDICINES {
    string id PK
    string name
    string instructions
  }
  APPOINTMENTS {
    string id PK
    string patientId FK
    string doctorId FK
    datetime scheduledAt
  }
  NOTES {
    string id PK
    string patientId FK
    string doctorId FK
    string text
    datetime createdAt
  }
  PRESCRIPTIONS {
    string id PK
    string patientId FK
    string doctorId FK
    string medicineId FK
    string instructions
    datetime createdAt
  }
  PRESCRIPTION_REQUESTS {
    string id PK
    string patientId FK
    string medicineId FK
    string reason
    string status
    datetime createdAt
  }
  AUDIT_LOGS {
    string id PK
    string userId FK
    string role
    string action
    string store
    string recordId
    datetime createdAt
  }
```
