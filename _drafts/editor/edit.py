#!/usr/bin/env python3
"""Local text editor for the site. Not part of the website.

Run from Terminal:  python3 _drafts/editor/edit.py   (or double-click "Edit site.command")
Then use the Edit button in the bottom-left corner of any page.

How it works: this serves the site on http://localhost:8000, like a normal
web server, but while sending a page it marks the text blocks inside <main>
(headings, paragraphs, list items, captions, details) and adds editor.js.
Saving writes only the changed blocks back into the page's .html file, and
leaves every other character of the file as it was. The .html files on disk
never contain the editor, so there is nothing to remove before publishing.
"""
import hashlib, html.parser, http.server, json, os, socketserver, sys, webbrowser
from urllib.parse import unquote, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))   # the portfolio folder

EDITABLE = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "dt", "dd", "figcaption", "blockquote"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Blocks(html.parser.HTMLParser):
    """Finds editable text blocks inside <main> and where they sit in the source."""

    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.src = src
        self.lines = [0]
        for i, ch in enumerate(src):
            if ch == "\n":
                self.lines.append(i + 1)
        self.stack = []      # [tag, tag_start, inner_start]
        self.found = []      # (tag_start, tag_end_gt, inner_start, inner_end)
        self.feed(src)
        self.close()

    def _off(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def _in_main(self):
        return any(t[0] == "main" for t in self.stack)

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        start = self._off()
        raw = self.get_starttag_text()
        self.stack.append([tag, start, start + len(raw), self._in_main() or tag == "main"])

    def handle_endtag(self, tag):
        if not any(t[0] == tag for t in self.stack):
            return
        end = self._off()
        while self.stack:
            t = self.stack.pop()
            if t[0] == tag:
                name, start, inner, in_main = t
                if name in EDITABLE and in_main and name != "main":
                    self.found.append((start, inner, end))
                return
            # anything popped here was never closed: skip it (not editable)

    def blocks(self):
        found = sorted(self.found)
        out = []
        for i, (s, inner, e) in enumerate(found):
            # leaf blocks only: skip a block that contains another block (an <li> holding a <p>)
            if any(s < s2 and e2 <= e for (s2, _, e2) in found if (s2, e2) != (s, e)):
                continue
            if not self.src[inner:e].strip():
                continue
            out.append((s, inner, e))
        return out


def digest(src):
    return hashlib.sha1(src.encode("utf-8")).hexdigest()


def page_file(url_path):
    path = unquote(urlparse(url_path).path)
    full = os.path.realpath(os.path.join(ROOT, path.lstrip("/")))
    if os.path.isdir(full):
        full = os.path.join(full, "index.html")
    if not (full == ROOT or full.startswith(ROOT + os.sep)) or not full.endswith(".html"):
        return None
    return full


def marked(src):
    """The page as served: blocks get data-edit="n", and editor.js is added."""
    out = src
    blocks = Blocks(src).blocks()
    for n, (s, inner, e) in reversed(list(enumerate(blocks))):
        gt = inner - 1                                   # the '>' of the start tag
        at = gt - 1 if out[gt - 1] == "/" else gt
        out = out[:at] + f' data-edit="{n}"' + out[at:]
    tag = f'<script src="/__editor.js" data-hash="{digest(src)}" defer></script>'
    i = out.rfind("</body>")
    return out[:i] + tag + "\n" + out[i:] if i != -1 else out + tag


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype):
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.split("?")[0] == "/__editor.js":
            with open(os.path.join(HERE, "editor.js"), encoding="utf-8") as f:
                return self._send(200, f.read(), "text/javascript; charset=utf-8")
        path = urlparse(self.path).path
        if os.path.isdir(os.path.join(ROOT, unquote(path).lstrip("/"))) and not path.endswith("/"):
            return super().do_GET()                     # let it redirect to the trailing slash
        f = page_file(self.path)
        if f and os.path.isfile(f):
            with open(f, encoding="utf-8") as fh:
                return self._send(200, marked(fh.read()), "text/html; charset=utf-8")
        return super().do_GET()

    def do_POST(self):
        if self.path != "/__save":
            return self._send(404, "{}", "application/json")
        try:
            req = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            f = page_file(req["path"])
            if not f or not os.path.isfile(f):
                raise ValueError("Can't find that page's file.")
            with open(f, encoding="utf-8") as fh:
                src = fh.read()
            if digest(src) != req["hash"]:
                raise ValueError("The file changed on disk since this page loaded. "
                                 "Copy your edit, reload the page, and paste it back in.")
            blocks = Blocks(src).blocks()
            edits = {int(k): v for k, v in req["edits"].items()}
            for n in sorted(edits, reverse=True):
                _, inner, e = blocks[n]
                src = src[:inner] + edits[n] + src[e:]
            tmp = f + ".tmp"
            with open(tmp, "w", encoding="utf-8", newline="") as fh:
                fh.write(src)
            os.replace(tmp, f)
            print(f"  saved {os.path.relpath(f, ROOT)} ({len(edits)} change{'s' if len(edits) != 1 else ''})")
            self._send(200, json.dumps({"hash": digest(src)}), "application/json")
        except Exception as err:
            self._send(409, json.dumps({"error": str(err)}), "application/json")


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    for p in range(port, port + 20):
        try:
            srv = Server(("127.0.0.1", p), Handler)
            break
        except OSError:
            continue
    url = f"http://localhost:{srv.server_port}/"
    print(f"\n  Editing {ROOT}\n  Open {url}  (press Control-C here to stop)\n")
    webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
