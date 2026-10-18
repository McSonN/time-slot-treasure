<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Booking privacy: non-admins read other users' bookings only via the `get_busy_slots` RPC (anonymised); full rows are RLS-limited to owner/admin. Why: users must not see others' request details.
- Overlaps are blocked by a DB trigger on `bookings`, not just UI. Why: concurrent requests can't double-book.
- Booking request and purpose-template writes use authenticated server functions with shared Zod schemas; why: client and server validation must agree and ownership comes from the session.
- Store reusable meeting purposes in an owner-scoped table and request-specific NGO, equipment and consent values on bookings; why: templates persist across devices and submitted requests retain their own snapshot.
- Interim NGO and venue-equipment fixtures live in the shared booking-request module; why: form defaults and server equipment validation must use the same source until real profiles and venue inventory are connected.
- The homepage own-request list explicitly filters by session user ID and request kind, including all statuses; why: admin privileges must not turn a personal list into other users' requests.
