---
sidebar_label: Database Schema
sidebar_position: 10
---

# Database Schema

Agon uses SQLite (WAL mode) as its local database. All datetime values are stored in UTC (timezone-naive).

## Entity Relationship Diagram

```mermaid
erDiagram
    users {
        int id PK
        string email UK
        string password_hash
        string full_name
        string role
        bool is_active
        datetime created_at
        datetime updated_at
    }

    clients {
        int id PK
        int location_id
        string email UK
        string password_hash
        string full_name
        string phone
        date dob
        string notes
        string push_token
        bool is_active
        datetime created_at
        datetime updated_at
    }

    instructors {
        int id PK
        int user_id FK
        int location_id
        string bio
        string specialties
        datetime created_at
        datetime updated_at
    }

    class_templates {
        int id PK
        int location_id
        string name
        string description
        int duration_minutes
        int default_capacity
        string color
        int default_instructor_id FK
        bool is_active
        datetime created_at
        datetime updated_at
    }

    scheduled_classes {
        int id PK
        int template_id FK
        int instructor_id FK
        int location_id
        datetime starts_at
        datetime ends_at
        int capacity
        string status
        string meeting_url
        datetime created_at
        datetime updated_at
    }

    bookings {
        int id PK
        int client_id FK
        int scheduled_class_id FK
        int location_id
        string status
        datetime created_at
        datetime updated_at
    }

    checkins {
        int id PK
        int booking_id FK
        int client_id FK
        int scheduled_class_id FK
        int checked_in_by FK
        string method
        datetime checked_in_at
    }

    waitlist {
        int id PK
        int client_id FK
        int scheduled_class_id FK
        int position
        string status
        datetime expires_at
        datetime created_at
        datetime updated_at
    }

    membership_types {
        int id PK
        int location_id
        string name
        string type
        float price
        string currency
        int credits
        int duration_days
        bool is_active
        datetime created_at
        datetime updated_at
    }

    memberships {
        int id PK
        int client_id FK
        int membership_type_id FK
        int location_id
        string status
        date starts_at
        date expires_at
        int credits_remaining
        int credits_used
        string stripe_subscription_id
        datetime created_at
        datetime updated_at
    }

    payments {
        int id PK
        int client_id FK
        int membership_id FK
        float amount
        string currency
        string status
        string provider
        string provider_payment_id
        datetime paid_at
        datetime created_at
        datetime updated_at
    }

    locations {
        int id PK
        string name
        string address
        string phone
        bool is_active
        datetime created_at
        datetime updated_at
    }

    studio_settings {
        int id PK
        string studio_name
        string timezone
        string currency
        string stripe_public_key
        string stripe_secret_key
        string cloudflare_tunnel_token
        int booking_cancellation_hours
        bool waitlist_enabled
        datetime created_at
        datetime updated_at
    }

    consent_log {
        int id PK
        int client_id FK
        string type
        bool granted
        string ip_address
        datetime created_at
    }

    email_templates {
        int id PK
        string name
        string subject
        string body_html
        string variables
        bool is_active
        datetime created_at
        datetime updated_at
    }

    email_event_assignments {
        int id PK
        string event_type
        int template_id FK
    }

    smart_lists {
        int id PK
        string name
        string filters_json
        datetime created_at
        datetime updated_at
    }

    users ||--o{ instructors : "has profile"
    clients ||--o{ bookings : "makes"
    clients ||--o{ memberships : "holds"
    clients ||--o{ waitlist : "joins"
    clients ||--o{ payments : "makes"
    clients ||--o{ consent_log : "logs"
    scheduled_classes ||--o{ bookings : "receives"
    scheduled_classes ||--o{ waitlist : "has"
    scheduled_classes ||--o{ checkins : "records"
    class_templates ||--o{ scheduled_classes : "spawns"
    instructors ||--o{ scheduled_classes : "teaches"
    instructors |o--o{ class_templates : "default for"
    bookings ||--o| checkins : "has"
    memberships ||--o{ payments : "paid via"
    membership_types ||--o{ memberships : "defines"
    email_templates |o--o{ email_event_assignments : "assigned to"
```

## Key Tables

| Table | Purpose |
|---|---|
| `users` | Studio manager and instructor accounts (login credentials) |
| `clients` | Gym members who book classes via the mobile app |
| `instructors` | One-to-one profile linked to a `users` row |
| `class_templates` | Reusable class definition (Yoga, HIIT, Pilates…) |
| `scheduled_classes` | A specific occurrence of a template at a date/time |
| `bookings` | A client's reservation for a scheduled class |
| `checkins` | Confirmed attendance record for a booking |
| `waitlist` | Queue entry when a class is full |
| `memberships` | A client's active subscription or credit pack |
| `membership_types` | Template for recurring plans or credit packs |
| `payments` | Payment records (Stripe or manual) |
| `locations` | Physical studio location (V1: always `id=1`) |
| `studio_settings` | Singleton row with studio configuration |
| `consent_log` | GDPR consent events |
| `email_templates` | Custom transactional email bodies |
| `email_event_assignments` | Maps lifecycle events to custom templates |
| `smart_lists` | Saved client filter queries for targeted messaging |

## Design Notes

### UTC-naive datetimes
All `DateTime` columns store UTC values **without timezone info**. The application layer always compares with `utcnow()` from `app.utils`. Never insert timezone-aware datetimes into the database.

### location_id convention
Every business entity carries `location_id` (default `1`). Location 1 (`Main Studio`) is seeded at migration time. This column is the hook for V2 multi-location support — no schema change needed.

### Soft delete vs hard delete
- **Soft delete** (status/is_active): clients, instructors, class templates, membership types, bookings, memberships, scheduled classes.
- **Hard delete**: Only on explicit GDPR erasure request. Personal data is anonymised in-place; booking/payment history rows are retained for audit purposes.

See [ARCHITECTURE.md](https://github.com/agon-studio/agon/blob/main/ARCHITECTURE.md) for the full delete strategy and cascade rules.

### Composite indexes
Performance-critical query patterns are covered by composite indexes:

| Index | Columns | Query pattern |
|---|---|---|
| `idx_booking_class_status` | `scheduled_class_id, status` | All confirmed bookings for a class |
| `idx_booking_client_status` | `client_id, status` | Client's booking history |
| `idx_membership_client_status` | `client_id, status` | Client's active membership lookup |
| `idx_class_starts_at_location_status` | `starts_at, location_id, status` | Calendar date-range queries |
