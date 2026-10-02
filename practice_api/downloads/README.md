# Signed Android downloads

Signed APKs are provided separately by the owner and are ignored by Git.
The existing service expects `daychee-android.apk` here; a fresh clone responds
404 for that download until the authorized artifact is supplied.
This directory is retained so the existing Docker COPY works in a clean clone.
Never commit signing keys, passwords, APKs, AABs or idsig files.
