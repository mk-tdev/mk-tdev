"""Preview both GitHub Pages entry points without installing Jekyll.

Run: python3 scripts/preview.py
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse

ROOT = Path(__file__).resolve().parents[1]


class Preview(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        if path == "/mk-tdev":
            self.send_response(302)
            self.send_header("Location", "/mk-tdev/")
            self.end_headers()
            return None
        if path.startswith("/mk-tdev/"):
            self.path = self.path.replace("/mk-tdev/", "/", 1)
            path = path[len("/mk-tdev"):]
        if path in ("/", "/index.html"):
            content = (ROOT / "mk/index.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(content)
            return None
        return super().send_head()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4174)
    args = parser.parse_args()
    print(f"Home: http://127.0.0.1:{args.port}/mk-tdev/", flush=True)
    print(f"Portfolio: http://127.0.0.1:{args.port}/mk-tdev/mk/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Preview).serve_forever()
