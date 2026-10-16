"""Test-app CONNECT proxy. TLS stays encrypted; journal contains host/port only."""
import socket, socketserver, select, pathlib, json, datetime, threading

ROOT = pathlib.Path(__file__).parent
MODE = ROOT / 'proxy-mode'
JOURNAL = ROOT / 'proxy-hosts.jsonl'
LOCK = threading.Lock()
MODE.write_text('online')

def offline():
    return MODE.read_text().strip() == 'offline'

def log(event, **fields):
    record = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'event': event, **fields}
    with LOCK:
        with JOURNAL.open('a') as f:
            f.write(json.dumps(record) + '\n')

class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        upstream = None
        try:
            line = self.rfile.readline(4096).decode('ascii', 'replace').strip()
            parts = line.split(' ')
            if len(parts) != 3 or parts[0] != 'CONNECT':
                self.wfile.write(b'HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n')
                return
            host, port_string = parts[1].rsplit(':', 1)
            port = int(port_string)
            while self.rfile.readline(8192) not in (b'\r\n', b'\n', b''):
                pass
            is_offline = offline()
            log('connect', host=host, port=port, mode='offline' if is_offline else 'online')
            if is_offline:
                self.wfile.write(b'HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')
                return
            upstream = socket.create_connection((host, port), timeout=15)
            self.wfile.write(b'HTTP/1.1 200 Connection Established\r\n\r\n')
            self.wfile.flush()
            while True:
                if offline():
                    log('cut-existing-connection', host=host, port=port)
                    return
                ready, _, _ = select.select([self.connection, upstream], [], [], 0.2)
                for source in ready:
                    data = source.recv(65536)
                    if not data:
                        return
                    (upstream if source is self.connection else self.connection).sendall(data)
        except Exception as exc:
            log('transport-error', errorType=type(exc).__name__)
        finally:
            if upstream is not None:
                upstream.close()

class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

with Server(('127.0.0.1', 18088), Handler) as server:
    print('Test CONNECT proxy listening on 127.0.0.1:18088; TLS payloads are never logged.', flush=True)
    server.serve_forever()
