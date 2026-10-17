# Cabinet web reader · local candidate

Uses the existing accepted Claude/article reader typography, layout, navigation
and responsive styles. No native UX or accepted reference is replaced.

| State | Presentation / transition |
| --- | --- |
| Checking | Existing «Загружаем вики…» shell, no protected content |
| Missing/invalid session | Existing centered card: «Войдите через кабинет школы», one Cabinet entry link; no invitation input |
| Valid | Existing library/article/concept/graph; before a cached route is shown, recheck current server authority |
| Blocked | Centered card says account access is restricted; Cabinet home and retry; no automatic login redirect |
| Unavailable/offline | Existing temporary-error card and retry; cookie retained, protected DOM cleared |
| Login | Full-page Cabinet entry with original path/query/hash; Cabinet owns sign-in and automatic return |
| Logout | Navigate to Cabinet /logout; no wiki mutation or cookie clearing |
| Background / pagehide / BFCache return | Clear protected DOM, abort reads, discard runtime; on return recheck and reload graph before restoring route |

URL routes, filters and browser Back remain navigation state; bookmarks/opened IDs
remain nonsecret preferences. No titles, text, recording URLs, cookies or profiles
are stored by this authentication layer. Delayed requests from a discarded runtime
cannot repopulate the reader. UI references and local synthetic runtime pairs are
recorded in the QA report; acceptance/publication remains a separate operator step.

Profile amendment, 13 October: deployment supplies one fixed production/staging
profile. Cabinet entry/home/logout links follow that server-selected profile;
reader requests remain same-origin. Staging uses its own backend and cookie, not
an alias to production. Browser query/hash never chooses a profile. The accepted
contract is now 25def59e25fc847764cc43de8d963bf62a16512e; local mock proof does
not establish either deployed lifecycle.
