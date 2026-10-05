FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY deploy/daychee/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY practice_api/__init__.py practice_api/daychee_app.py practice_api/wiki_app.py practice_api/invitations.py practice_api/schedule_source.py practice_api/schedule.py /app/practice_api/
COPY practice_api/invitation_web /app/practice_api/invitation_web
COPY practice_api/website /app/practice_api/website
COPY practice_api/downloads /app/practice_api/downloads
COPY practice_api/feedback.py /app/practice_api/feedback.py
COPY practice_api/admin.py /app/practice_api/admin.py
COPY practice_api/access_requests.py practice_api/access_request_api.py practice_api/access_request_notifications.py /app/practice_api/
COPY practice_api/admin_web /app/practice_api/admin_web
COPY practice_api/wiki_graph.py /app/practice_api/wiki_graph.py
COPY practice_api/wiki_content.py /app/practice_api/wiki_content.py
COPY practice_api/wiki_semantics.py /app/practice_api/wiki_semantics.py
COPY practice_api/public_wiki.py /app/practice_api/public_wiki.py
COPY practice_api/access_deletion.py /app/practice_api/access_deletion.py
COPY practice_api/public_pages.py /app/practice_api/public_pages.py
COPY practice_api/public_pages /app/practice_api/public_pages
COPY practice_api/wiki_graph_web /app/practice_api/wiki_graph_web
COPY scripts/daychee-invite.py /app/scripts/daychee-invite.py
COPY deploy/daychee/run.py /app/run.py
EXPOSE 8080
CMD ["python", "/app/run.py"]
