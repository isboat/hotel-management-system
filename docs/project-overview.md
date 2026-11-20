# Hotel Management System project overview

A **Hotel Management System (HMS)** is software that streamlines, automates, and manages daily operations and administrative tasks for hotels, resorts, and other hospitality businesses. It gives staff a central place to manage reservations, coordinate room readiness, record charges, and review performance, reducing reliance on separate spreadsheets, paper logs, and phone calls between departments.

This project is designed for small and medium-sized hotels and guest houses in Ghana. A shared view of bookings, room status, and guest balances helps staff coordinate daily work, especially where the same team handles several duties. For example, staff can record a phone booking alongside online reservations, see when housekeeping marks the assigned room ready, and combine room and restaurant charges on a guest's bill in Ghanaian cedis (GHS).

## Key features

- **Front desk and reservations management.** Record bookings, maintain guest profiles, assign rooms, and handle check-ins and check-outs. A shared, up-to-date availability calendar helps staff spot conflicting reservations and prevent double-booking.
- **Room management.** Managers maintain room inventory, room types, and closures for their property.
- **User management.** Managers create, edit, deactivate, remove, and initiate password resets for eligible staff at their property.
- **Housekeeping.** Track whether each room is dirty, clean, or inspected. When housekeeping updates a room's status, front desk staff can see which rooms are ready for arriving guests. A vacant room can still be awaiting cleaning.
- **Billing and point of sale (POS).** Maintain guest folios, which are itemised records of charges and cash payments, and generate invoices and cash receipts. Staff can post charges from services such as restaurants, spas, or room service to a guest's folio.
- **Channel manager.** Automatically synchronise room availability and rates with connected online travel agencies (OTAs) and booking platforms such as Booking.com, Expedia, and Airbnb. When a reservation is recorded, the channel manager updates inventory across connected channels to reduce the risk of overbooking.
- **Reporting and analytics.** Generate financial reports and track room performance. Occupancy is rooms sold divided by rooms available, expressed as a percentage. Average daily rate (ADR) is room revenue divided by rooms sold. Revenue per available room (RevPAR) is room revenue divided by rooms available. Use figures from the same reporting period when comparing these metrics.
- **Guest relationship management (CRM) and marketing.** Keep guest contact details, preferences, and stay history so staff can personalise service and support loyalty programmes or marketing campaigns. Record marketing preferences so staff can respect guests' communication choices.

- **User activity audit log.** Keep a searchable record of every user action across all modules, including reads, changes, exports, and unsuccessful attempts.

## Primary users and responsibilities

| Role | Responsibilities |
| --- | --- |
| Front desk agents and receptionists | Check guests in and out, assign rooms, handle walk-in reservations, collect cash, issue receipts, and issue room keys. |
| Housekeeping staff and supervisors | Update room status and report maintenance issues. Staff mark rooms clean after servicing them, and supervisors mark rooms inspected after checking them. |
| Hotel managers and general managers (GMs) | Perform all front desk duties and manage rooms and eligible staff accounts at their property. Oversee daily operations, adjust room pricing, monitor staff performance, and review financial and occupancy reports. |
| Administrators | Configure assigned properties and manage staff access within those properties, including manager and housekeeping accounts. |
| System administrators | Manage platform-wide configuration, deployments, monitoring, backups, and recovery. Access to hotel operational records requires a separate property role. |

## Manager workflows

### Room management

- Add and edit rooms with a property-unique room number, room type, floor, capacity, amenities, and default rate. Filter inventory by room type, readiness, and availability.
- Schedule out-of-service periods for maintenance and return rooms to service when work is complete. Reflect closures in availability and channel updates. Require staff to resolve overlapping bookings before confirming a closure.
- Delete rooms that have never been used and have no dependent records. Archive rooms with booking or operational history so they disappear from new booking searches while remaining visible in historical reports. Require active stays and future bookings to be resolved before deletion or archival.
- Enforce booking and inventory changes together on the server so a room cannot be booked concurrently with a conflicting closure or removal. Audit room creation, updates, closures, and removals.

### User management

- List and filter staff by role and account status. Invite staff, edit their profile and eligible role, suspend or reactivate property access, and remove users from the property. Managers and GMs can manage front desk and housekeeping users at their assigned property. Property administrators manage manager accounts and supervisor appointments.
- Preserve user identifiers referenced by bookings, payments, and audit records when access is removed. Remove the property membership and invalidate existing access for that property. Keep memberships at other properties intact.
- Initiate a password reset by sending a short-lived, single-use link to the user's verified contact channel, or submit a reset request to a property administrator when staff cannot use that channel. The user sets their own password and the system revokes existing sessions after a successful reset. Record reset requests and outcomes in the audit log.

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
| `POST /api/v1/properties/{propertyId}/folios/{folioId}/payments` | Record a cash payment using an idempotency key so a retry returns the original receipt. |
| `GET /api/v1/properties/{propertyId}/reports/occupancy` | Return occupancy, ADR, and RevPAR for the selected period. |

Process OTA updates in background jobs after the reservation transaction commits. Record external reservation identifiers to deduplicate inbound events and surface repeated synchronisation failures to staff.

### Cash payments

The HMS supports cash as the sole payment method. Staff receive physical cash in Ghanaian cedis (GHS) and enter the amount to apply to the folio and the amount tendered. The system calculates change, records only the amount applied as the payment, and updates the outstanding balance. Staff can record partial payments and print or reprint a numbered receipt. A receipt includes the property, folio reference, cashier, date, amount applied, amount tendered, change, and remaining balance.

Save the payment, receipt reference, and audit event in one transaction. An authorised manager records any cash refund or payment correction as a separate entry linked to the original payment, with a reason. At shift close, staff record the cash counted. Managers reconcile the count against the opening float plus cash payments minus cash refunds and review any variance.

### SQL data model

- **Properties and staff.** `properties`, `users`, and `property_memberships` associate staff accounts with their assigned properties and roles. Store system administrator assignments separately from property memberships.
- **Rooms, guests, and stays.** `room_types`, `rooms`, `guests`, `reservations`, and `room_allocations` capture room inventory, contact details, stay dates, and room assignments. Store one row per active booked night in `room_nights`, with a unique constraint on `(property_id, room_id, stay_date)`. Write the reservation, allocations, and room nights in one transaction. Roll back on a uniqueness conflict and return HTTP 409. Release room nights in the same transaction as a cancellation or reassignment. Include arrival and exclude departure when generating room nights so another guest can arrive on the departure date.
- **Operations and billing.** `housekeeping_events`, `folios`, `folio_items`, `payments`, and `cash_shifts` record room status changes, charges, cash receipts, refunds, and shift reconciliation. Link cash entries to the folio, cashier, and shift, and enforce receipt number uniqueness per property. Store monetary amounts as integer pesewas with a currency code. Use GHS and the `Africa/Accra` time zone for local business dates and reports.
- **Channel integrations.** `channel_connections`, `channel_reservations`, and `integration_jobs` track external channels, their reservation references, and synchronisation attempts.

Use foreign keys that preserve property boundaries, indexes for property-scoped date and status queries, and versioned migrations. Test backup restoration as part of deployment readiness.

### JWT authentication and authorisation

Staff sign in with a password verified against an Argon2id hash. The API issues a signed, short-lived JWT access token and a rotating refresh token. The frontend keeps the access token in memory and sends it in the `Authorization: Bearer` header. The refresh token is stored in a Secure, HttpOnly, SameSite cookie, with server-side session state for rotation, revocation, and reuse detection. Check the request origin on cookie-backed refresh and logout endpoints. Logout revokes the refresh session and clears the cookie.

ASP.NET Core JWT bearer authentication validates the token signature, expected algorithm, issuer, audience, and expiry on every protected request. Authorisation policies check the user's active session, current property membership, and role for hotel operations, and a separate system administrator role for platform operations. Staff management policies check both the caller's authority and the target user's role and property before allowing account or reset actions. Record staff management actions in the audit log. An access token contains a user identifier and session claims. Guest details and other personal data stay in the database.

### User activity audit log

Record every user action across all roles and modules. Capture sign-in attempts, sign-outs, views, searches, exports, record changes, payments, and administrative actions, including denied and failed attempts. Capture user actions that occur entirely in React through an audit endpoint. Record API-backed actions on the server using the authenticated identity and actual outcome.

Store events in an append-only `audit_events` table in Azure SQL Database. Each event includes a UTC timestamp, the user ID when known, property or platform scope, action, resource type and ID when applicable, outcome, and request correlation ID. For changes, include changed field names and approved before-and-after values. Exclude passwords, JWTs, refresh tokens, payment card details, and sensitive guest data from audit entries.

Write audit events for successful data changes in the same transaction as the change. Record reads and failed or denied requests independently so a rolled-back business transaction preserves the audit record of the attempt. Surface audit write failures to operators. Provide an audit view with filters for date, user, action, and outcome. Grant audit access through an explicit permission within the user's property or platform scope, and log audit views and exports. The application database role can append audit events and read them through authorised queries. Restrict retention and archival operations to a separate database role.

### Verification

Verify that room closures and removals cannot conflict with bookings and that archived rooms remain visible in historical reports. Verify that managers can manage eligible staff only at their own property, that removing membership blocks the user's existing access to that property, and that password reset links expire, work once, and revoke prior sessions on completion.

Verify that successful, failed, and denied actions generate accurate audit events, including reads and exports. Test that a rolled-back change leaves a failed-attempt event, unauthorised users cannot access audit records, and audit entries exclude sensitive values.

Test booking, room status updates, and folio review at phone, tablet, and laptop widths. Run API integration tests against a dedicated Azure SQL test database to verify that concurrent bookings cannot allocate the same room for the same night, retried cash payments produce one payment and one receipt, and staff cannot access records at another property. Verify partial cash payments, change calculation, refunds, and shift reconciliation. Exercise expired JWTs, refresh token rotation, and logout.

## Further reading

- [Oracle Hospitality guidance on hotel property management systems](https://www.oracle.com/hospitality/what-is-hotel-pms/)
- [SiteMinder guidance on hotel channel management](https://www.siteminder.com/r/channel-manager/)
- [STR hospitality industry glossary](https://str.com/data-insights/resources/glossary)
