# Archive identification · 14 October 2026

The owner requested the exact label «Архивный Нэйдань» for the published archive articles. The existing archive section uses that name; every material in `archive:archive-neidan` also shows it in catalog/recent/bookmark card captions and the reader kicker. Existing layout, normal article labels and routes are retained. Article prose, revisions, timestamps and source pins are unchanged.

Validation: 17 shared-web tests, web build, and 43 archive/public backend tests pass. Synthetic Chrome catalog and reader checks at 390/768/1440 preserve the existing reference hierarchy with no horizontal overflow; recent captions show the label and a legacy reader retains «Занятие». Before/runtime pairs remain in private QA storage.

Production deployment `5990879b-1ec8-4feb-922b-12533f05129d` reached SUCCESS on 14 October at 12:18:48 UTC. Its 60-file stage preserves all 58 unrelated files from `3d177cb2-efab-46ad-a69f-ab1f8789ed6b`; only the archive category renderer and bundled web reader changed. No content import, invitation creation, native release or access cutover is included.

Post-deployment checks pass: all 57 archive graph materials use the collection label; all 70 article and 34 concept bodies are byte-equivalent as parsed DTOs to the verified publication baseline. The graph differs only in the requested section label and its derived version. Live JavaScript/CSS hashes match the tested stage; anonymous private graph still returns 401. No temporary production QA grant was created. Detailed evidence remains private.
