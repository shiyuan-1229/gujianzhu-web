#!/usr/bin/env python3
"""支持 HTTP Range 请求的静态服务器（视频 scroll-scrub / seek 必需）。
用法: python serve_range.py [port]
默认端口 8771，根目录为本文件所在目录。
"""
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class RangeRequestHandler(SimpleHTTPRequestHandler):
    """在 SimpleHTTPRequestHandler 基础上增加 Range / 206 支持。"""

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_POST(self):
        # 调试用：页面把 canvas 截图 POST 到 /__shot?name=foo.png，服务器原样存盘
        if self.path.startswith("/__shot"):
            m = re.search(r"name=([\w.\-]+)", self.path)
            name = m.group(1) if m else "shot.png"
            length = int(self.headers.get("Content-Length", 0))
            data = self.rfile.read(length)
            root = self.translate_path("/").rstrip("/\\")
            with open(os.path.join(root, name), "wb") as f:
                f.write(data)
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"ok")
            return
        self.send_error(404)

    def send_head(self):
        rng = self.headers.get("Range")
        if rng is None:
            return super().send_head()

        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()

        m = re.match(r"bytes=(\d*)-(\d*)", rng.strip())
        if not m:
            return super().send_head()

        size = os.path.getsize(path)
        start_s, end_s = m.group(1), m.group(2)
        if start_s == "":
            # 后缀范围: bytes=-N
            length = int(end_s)
            start = max(0, size - length)
            end = size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s else size - 1
        end = min(end, size - 1)
        if start > end or start >= size:
            self.send_error(416, "Requested Range Not Satisfiable")
            return None

        length = end - start + 1
        ctype = self.guess_type(path)
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(length))
        self.end_headers()
        # copyfile 会读到 EOF；这里用 _remaining 限制读取长度
        self._send_range(f, length)
        return None

    def _send_range(self, f, length):
        bufsize = 64 * 1024
        try:
            while length > 0:
                chunk = f.read(min(bufsize, length))
                if not chunk:
                    break
                self.wfile.write(chunk)
                length -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            f.close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8771))
    root = os.path.dirname(os.path.abspath(__file__))
    handler = partial(RangeRequestHandler, directory=root)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print("Range-enabled server on http://127.0.0.1:%d (root=%s)" % (port, root))
    httpd.serve_forever()
