# Hotel Management System project overview

A **Hotel Management System (HMS)** is software that streamlines, automates, and manages daily operations and administrative tasks for hotels, resorts, and other hospitality businesses. It gives staff a central place to manage reservations, coordinate room readiness, record charges, and review performance, reducing reliance on separate spreadsheets, paper logs, and phone calls between departments.

This project is designed for small and medium-sized hotels and guest houses in Ghana. A shared view of bookings, room status, and guest balances helps staff coordinate daily work, especially where the same team handles several duties. For example, staff can record a phone booking alongside online reservations, see when housekeeping marks the assigned room ready, and combine room and restaurant charges on a guest's bill in Ghanaian cedis (GHS).

## Key features

- **Front desk and reservations management.** Record bookings, maintain guest profiles, assign rooms, and handle check-ins and check-outs. A shared, up-to-date availability calendar helps staff spot conflicting reservations and prevent double-booking.
- **Housekeeping.** Track whether each room is dirty, clean, or inspected. When housekeeping updates a room's status, front desk staff can see which rooms are ready for arriving guests. A vacant room can still be awaiting cleaning.
- **Billing and point of sale (POS).** Maintain guest folios, which are itemised records of charges and payments, and generate invoices. Staff can post charges from services such as restaurants, spas, or room service to a guest's folio.
- **Channel manager.** Automatically synchronise room availability and rates with connected online travel agencies (OTAs) and booking platforms such as Booking.com, Expedia, and Airbnb. When a reservation is recorded, the channel manager updates inventory across connected channels to reduce the risk of overbooking.
- **Reporting and analytics.** Generate financial reports and track room performance. Occupancy is rooms sold divided by rooms available, expressed as a percentage. Average daily rate (ADR) is room revenue divided by rooms sold. Revenue per available room (RevPAR) is room revenue divided by rooms available. Use figures from the same reporting period when comparing these metrics.
- **Guest relationship management (CRM) and marketing.** Keep guest contact details, preferences, and stay history so staff can personalise service and support loyalty programmes or marketing campaigns. Record marketing preferences so staff can respect guests' communication choices.

- **User activity audit log.** Keep a searchable record of every user action across all modules, including reads, changes, exports, and unsuccessful attempts.

## Primary users and responsibilities

| Role | Responsibilities |
| --- | --- |
| Front desk agents and receptionists | Check guests in and out, assign rooms, handle walk-in reservations, process payments, and issue room keys. |
| Housekeeping staff and supervisors | Update room status and report maintenance issues. Staff mark rooms clean after servicing them, and supervisors mark rooms inspected after checking them. |
| Hotel managers and general managers (GMs) | Perform all front desk duties and create front desk agent and receptionist accounts for their property. Oversee daily operations, adjust room pricing, monitor staff performance, and review financial and occupancy reports. |
| Administrators | Configure assigned properties and manage staff access within those properties, including manager and housekeeping accounts. |
| System administrators | Manage platform-wide configuration, deployments, monitoring, backups, and recovery. Access to hotel operational records requires a separate property role. |

## Proposed web application design

Staff use the same web application on phones, tablets, and laptops. The dashboard shows today's arrivals and departures, rooms ready for check-in, and outstanding balances according to the signed-in staff member's role. Front desk staff can move from the reservation calendar to check-in and the guest folio. Housekeeping staff open a room list filtered by cleaning status and update it from the floor.

| Device | Layout and common tasks |
| --- | --- |
| Phone | A single-column layout and compact navigation provide quick access to room status, arrivals, and guest lookup. Bookings appear as a daily list. |
| Tablet | Touch-friendly lists and detail panels let staff review arrivals or room assignments and open the selected record alongside the list when space permits. |
| Laptop | A sidebar, multi-day booking calendar, and sortable tables support front desk planning, reconciliation, and reporting. |

Use responsive CSS Grid and Flexbox, labelled fields, visible keyboard focus, and text labels for room and booking statuses. Paginate long lists and keep assets small for slower connections. Show when a record was last refreshed and confirm a booking or payment only after the server accepts it.

## Technical architecture

| Layer | Proposed technology | Responsibility |
| --- | --- | --- |
| Frontend | React web application with TypeScript | Render the responsive interface, collect input, handle loading and error states, and call the API. |
| Backend | ASP.NET Core Web API on .NET 10 with C# | Expose a versioned REST API, enforce business rules and access permissions, and process integration jobs. |
| Database | Azure SQL Database | Store relational data and enforce integrity using SQL constraints, indexes, and transactions. |

### Backend

Organise the backend into modules for authentication, properties and staff, reservations, housekeeping, billing, channel integrations, reporting, and guest CRM. Use Entity Framework Core 10 with the SQL Server provider for database access and migrations. Serve the frontend and API from the same HTTPS origin. The API accepts and returns JSON, validates input on the server, and returns errors the frontend can use to explain conflicts or invalid requests.

| Example API endpoint | Operation |
| --- | --- |
| `GET /api/v1/properties/{propertyId}/availability` | Find available rooms for a date range. |
| `POST /api/v1/properties/{propertyId}/reservations` | Create a reservation and allocate rooms in a single transaction. |
| `PATCH /api/v1/properties/{propertyId}/rooms/{roomId}/housekeeping` | Change a room's cleaning status and record who changed it. |
| `POST /api/v1/properties/{propertyId}/folios/{folioId}/payments` | Record a payment using an idempotency key to prevent duplicate entries when a request is retried. |
| `GET /api/v1/properties/{propertyId}/reports/occupancy` | Return occupancy, ADR, and RevPAR for the selected period. |

Process OTA updates in background jobs after the reservation transaction commits. Record external reservation identifiers to deduplicate inbound events and surface repeated synchronisation failures to staff.

### SQL data model

- **Properties and staff.** `properties`, `users`, and `property_memberships` associate staff accounts with their assigned properties and roles. Store system administrator assignments separately from property memberships.
- **Rooms, guests, and stays.** `room_types`, `rooms`, `guests`, `reservations`, and `room_allocations` capture room inventory, contact details, stay dates, and room assignments. Store one row per active booked night in `room_nights`, with a unique constraint on `(property_id, room_id, stay_date)`. Write the reservation, allocations, and room nights in one transaction. Roll back on a uniqueness conflict and return HTTP 409. Release room nights in the same transaction as a cancellation or reassignment. Include arrival and exclude departure when generating room nights so another guest can arrive on the departure date.
- **Operations and billing.** `housekeeping_events`, `folios`, `folio_items`, and `payments` record changes and financial activity. Store monetary amounts as integer pesewas with a currency code. Use GHS and the `Africa/Accra` time zone for local business dates and reports.
- **Channel integrations.** `channel_connections`, `channel_reservations`, and `integration_jobs` track external channels, their reservation references, and synchronisation attempts.

Use foreign keys that preserve property boundaries, indexes for property-scoped date and status queries, and versioned migrations. Test backup restoration as part of deployment readiness.

### JWT authentication and authorisation

Staff sign in with a password verified against an Argon2id hash. The API issues a signed, short-lived JWT access token and a rotating refresh token. The frontend keeps the access token in memory and sends it in the `Authorization: Bearer` header. The refresh token is stored in a Secure, HttpOnly, SameSite cookie, with server-side session state for rotation, revocation, and reuse detection. Check the request origin on cookie-backed refresh and logout endpoints. Logout revokes the refresh session and clears the cookie.

ASP.NET Core JWT bearer authentication validates the token signature, expected algorithm, issuer, audience, and expiry on every protected request. Authorisation policies check the user's current property membership and role for hotel operations, and a separate system administrator role for platform operations. The account creation policy allows managers to assign the front desk role at their own property. Record role changes and account creation in the audit log. An access token contains a user identifier and session claims. Guest details and other personal data stay in the database.

### User activity audit log

Record every user action across all roles and modules. Capture sign-in attempts, sign-outs, views, searches, exports, record changes, payments, and administrative actions, including denied and failed attempts. Capture user actions that occur entirely in React through an audit endpoint. Record API-backed actions on the server using the authenticated identity and actual outcome.

Store events in an append-only `audit_events` table in Azure SQL Database. Each event includes a UTC timestamp, the user ID when known, property or platform scope, action, resource type and ID when applicable, outcome, and request correlation ID. For changes, include changed field names and approved before-and-after values. Exclude passwords, JWTs, refresh tokens, payment card details, and sensitive guest data from audit entries.

Write audit events for successful data changes in the same transaction as the change. Record reads and failed or denied requests independently so a rolled-back business transaction preserves the audit record of the attempt. Surface audit write failures to operators. Provide an audit view with filters for date, user, action, and outcome. Grant audit access through an explicit permission within the user's property or platform scope, and log audit views and exports. The application database role can append audit events and read them through authorised queries. Restrict retention and archival operations to a separate database role.

### Verification

Verify that successful, failed, and denied actions generate accurate audit events, including reads and exports. Test that a rolled-back change leaves a failed-attempt event, unauthorised users cannot access audit records, and audit entries exclude sensitive values.

Test booking, room status updates, and folio review at phone, tablet, and laptop widths. Run API integration tests against a dedicated Azure SQL test database to verify that concurrent bookings cannot allocate the same room for the same night, retried payments produce one entry, and staff cannot access records at another property. Exercise expired JWTs, refresh token rotation, and logout.

## Further reading

- [Oracle Hospitality guidance on hotel property management systems](https://www.oracle.com/hospitality/what-is-hotel-pms/)
- [SiteMinder guidance on hotel channel management](https://www.siteminder.com/r/channel-manager/)
- [STR hospitality industry glossary](https://str.com/data-insights/resources/glossary)
