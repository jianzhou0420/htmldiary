#!/usr/bin/env python3
"""htmldiary server: a local, file-backed journal in the spirit of Day One.

Zero dependencies (Python 3.8+ standard library only).

Storage layout (``--data`` directory, default ``./data``):

    journals.json, settings.json, templates.json, prompts.json
    entries/<journal-id>/<YYYY>/<YYYY-MM-DD>_<HHMM>_<id>.md   Markdown + YAML front matter
    trash/<id>.md                                             soft-deleted entries
    media/<YYYY>/<MM>/<hash>_<name>                            photos / videos / files

Run:  python3 server.py --port 8120 --data ./data
"""
import argparse
import datetime as _dt
import hashlib
import io
import json
import mimetypes
import os
import re
import shutil
import sys
import threading
import time
import urllib.parse
import urllib.request
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:  # Python 3.9+
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover
    ZoneInfo = None

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
VERBOSE = False

# --------------------------------------------------------------------------------------
# Defaults written on first run (then editable as JSON files in the data dir)
# --------------------------------------------------------------------------------------
DEFAULT_JOURNALS = [
    {"id": "journal", "name": "Journal", "color": "#2d7ff9", "description": "Everyday life."},
]

DEFAULT_SETTINGS = {
    "theme": "system",            # system | light | dark
    "defaultJournal": "journal",
    "contentFont": "sans",        # sans | serif | mono
    "fontSize": 17,
    "passcodeHash": "",           # sha256 hex, empty = no lock
    "autoLockMinutes": 0,
    "reminderEnabled": False,
    "reminderTime": "21:00",
    "sortOrder": "newest",        # newest | oldest
    "firstDayOfWeek": 1,          # 0 = Sunday, 1 = Monday
    "showWordCount": True,
    "temperatureUnit": "C",       # C | F
    "dateFormat": "long",
}

DEFAULT_TEMPLATES = [
    {"id": "daily", "name": "Daily Reflection", "icon": "\U0001F305",
     "body": "# Daily Reflection\n\n**Highlights**\n- \n\n**What I learned**\n- \n\n**What I could do better**\n- \n\n**Tomorrow**\n- [ ] \n"},
    {"id": "gratitude", "name": "Gratitude", "icon": "\U0001F64F",
     "body": "# Three things I'm grateful for\n\n1. \n2. \n3. \n\n**Why they mattered today**\n\n"},
    {"id": "weekly", "name": "Weekly Review", "icon": "\U0001F4C5",
     "body": "# Weekly Review\n\n## Wins\n- \n\n## Struggles\n- \n\n## Lessons\n- \n\n## Next week\n- [ ] \n- [ ] \n- [ ] \n"},
    {"id": "travel", "name": "Travel Log", "icon": "✈️",
     "body": "# Travel Log\n\n**Where:** \n**With:** \n\n## What we did\n\n\n## Best moment\n\n\n## Food\n\n"},
    {"id": "dream", "name": "Dream Journal", "icon": "\U0001F319",
     "body": "# Dream\n\n**Vividness:** /5\n\n**What happened**\n\n\n**Feelings on waking**\n\n"},
    {"id": "meeting", "name": "Meeting Notes", "icon": "\U0001F4DD",
     "body": "# Meeting\n\n**Attendees:** \n\n## Agenda\n- \n\n## Decisions\n- \n\n## Action items\n- [ ] \n"},
]

DEFAULT_PROMPTS = [
    "What made you smile today?",
    "Describe a moment today you want to remember.",
    "What is something you are looking forward to?",
    "What is a small win you had this week?",
    "Who did you talk to today, and what did you learn from them?",
    "What is worrying you right now, and what is one step you can take?",
    "Write about a place that feels like home.",
    "What did you eat today that you enjoyed?",
    "What would you tell yourself one year ago?",
    "What is a habit you want to build, and why?",
    "Describe your morning in detail.",
    "What is the best advice you have received recently?",
    "Which song is stuck in your head, and why?",
    "What did you do today purely for yourself?",
    "What is one thing you would change about today?",
    "Write a letter to someone you miss.",
    "What are you proud of this month?",
    "Describe the weather and how it affected your mood.",
    "What is a question you keep coming back to?",
    "What did you read, watch, or listen to recently that stuck with you?",
    "What are three things within reach right now, and what do they mean to you?",
    "What is something you have been avoiding?",
    "Who inspired you this week?",
    "What is your favourite part of the day, and why?",
    "Write about a mistake that taught you something.",
    "What does a perfect weekend look like?",
    "What skill are you getting better at?",
    "What is a memory from childhood that surfaced recently?",
    "What are you grateful for in your work or study?",
    "Describe a conversation that changed your mind.",
    "What did you notice today that you usually overlook?",
    "What would you do with a free afternoon?",
    "What are you reading right now?",
    "What is a goal for next month?",
    "How did you take care of your body today?",
    "Write about someone who helped you recently.",
    "What is a tradition you love?",
    "What did you build, fix, or finish today?",
    "What is the kindest thing someone did for you this week?",
    "What is a fear you have outgrown?",
    "What is your current favourite object, and where did it come from?",
    "Describe the view from where you are sitting.",
    "What are you curious about lately?",
    "What is something you know now that you wish you knew earlier?",
    "What was the hardest part of today?",
    "What does rest look like for you this week?",
    "Which person do you want to thank, and for what?",
    "What is a decision you are weighing?",
    "What do you want more of in your life?",
    "What do you want less of in your life?",
    "Describe a sound, smell, or texture from today.",
    "What made today different from yesterday?",
]

# WMO weather interpretation codes -> (description, emoji)
WMO = {
    0: ("Clear sky", "☀️"), 1: ("Mainly clear", "\U0001F324️"), 2: ("Partly cloudy", "⛅"),
    3: ("Overcast", "☁️"), 45: ("Fog", "\U0001F32B️"), 48: ("Rime fog", "\U0001F32B️"),
    51: ("Light drizzle", "\U0001F326️"), 53: ("Drizzle", "\U0001F326️"), 55: ("Heavy drizzle", "\U0001F327️"),
    56: ("Freezing drizzle", "\U0001F328️"), 57: ("Freezing drizzle", "\U0001F328️"),
    61: ("Light rain", "\U0001F326️"), 63: ("Rain", "\U0001F327️"), 65: ("Heavy rain", "\U0001F327️"),
    66: ("Freezing rain", "\U0001F328️"), 67: ("Freezing rain", "\U0001F328️"),
    71: ("Light snow", "\U0001F328️"), 73: ("Snow", "❄️"), 75: ("Heavy snow", "❄️"),
    77: ("Snow grains", "\U0001F328️"), 80: ("Rain showers", "\U0001F326️"), 81: ("Rain showers", "\U0001F327️"),
    82: ("Violent rain showers", "⛈️"), 85: ("Snow showers", "\U0001F328️"), 86: ("Snow showers", "❄️"),
    95: ("Thunderstorm", "⛈️"), 96: ("Thunderstorm with hail", "⛈️"), 99: ("Thunderstorm with hail", "⛈️"),
}

# --------------------------------------------------------------------------------------
# Tiny YAML subset: front matter writer / parser
# --------------------------------------------------------------------------------------
_NUMLIKE = re.compile(r"^[-+]?(\d[\d_]*(\.\d*)?|\.\d+)([eE][-+]?\d+)?$")
_RESERVED = {"true", "false", "null", "yes", "no", "on", "off", "~", ""}


def _scalar_out(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v) if isinstance(v, float) else str(v)
    s = str(v)
    needs = (
        s.lower() in _RESERVED
        or _NUMLIKE.match(s)
        or s != s.strip()
        or s[0] in "[]{}\"'#&*!|>%@`,?-"
        or ": " in s or " #" in s or s.endswith(":") or "\n" in s or "\t" in s
    )
    return json.dumps(s, ensure_ascii=False) if needs else s


def dump_front(meta):
    lines = []

    def emit(k, v, indent):
        pad = "  " * indent
        if isinstance(v, dict):
            if not v:
                return
            lines.append("%s%s:" % (pad, k))
            for kk, vv in v.items():
                emit(kk, vv, indent + 1)
        elif isinstance(v, list):
            if all(not isinstance(x, (dict, list)) for x in v):
                lines.append("%s%s: [%s]" % (pad, k, ", ".join(_scalar_out(x) for x in v)))
            else:
                lines.append("%s%s: %s" % (pad, k, json.dumps(v, ensure_ascii=False)))
        else:
            lines.append("%s%s: %s" % (pad, k, _scalar_out(v)))

    for k, v in meta.items():
        emit(k, v, 0)
    return "---\n" + "\n".join(lines) + "\n---\n"


def _scalar_in(s):
    s = s.strip()
    if s == "" or s in ("null", "~"):
        return None
    if s.startswith('"'):
        try:
            return json.loads(s)
        except Exception:
            return s.strip('"')
    if s.startswith("'") and s.endswith("'") and len(s) >= 2:
        return s[1:-1].replace("''", "'")
    low = s.lower()
    if low in ("true", "yes", "on"):
        return True
    if low in ("false", "no", "off"):
        return False
    if _NUMLIKE.match(s):
        try:
            return int(s.replace("_", "")) if re.match(r"^[-+]?\d+$", s) else float(s.replace("_", ""))
        except Exception:
            return s
    return s


def _split_flow(s):
    out, cur, q, esc = [], "", None, False
    for ch in s:
        if q:
            cur += ch
            if esc:
                esc = False
            elif ch == "\\" and q == '"':
                esc = True
            elif ch == q:
                q = None
        elif ch in "\"'":
            q = ch
            cur += ch
        elif ch == ",":
            out.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return [_scalar_in(x) for x in out]


def _value_in(v):
    v = v.strip()
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        return _split_flow(inner) if inner else []
    if v.startswith("{"):
        try:
            return json.loads(v)
        except Exception:
            return v
    return _scalar_in(v)


def parse_front(src):
    """Return (meta, body). Handles a small, indentation-based YAML subset."""
    m = re.match(r"---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|$)", src, re.S)
    if not m:
        return {}, src
    lines = m.group(1).split("\n")
    body = src[m.end():]

    def indent_of(line):
        return len(line) - len(line.lstrip(" "))

    def parse_block(i, indent):
        d = {}
        while i < len(lines):
            line = lines[i].rstrip("\r")
            if not line.strip() or line.lstrip().startswith("#"):
                i += 1
                continue
            cur = indent_of(line)
            if cur < indent:
                break
            if cur > indent or line.strip().startswith("- "):
                i += 1
                continue
            k, _, v = line.strip().partition(":")
            k = k.strip()
            v = v.strip()
            if v == "":
                j = i + 1
                while j < len(lines) and not lines[j].strip():
                    j += 1
                if j < len(lines) and indent_of(lines[j]) > indent:
                    ni = indent_of(lines[j])
                    if lines[j].strip().startswith("- "):
                        items = []
                        while j < len(lines):
                            l2 = lines[j]
                            if not l2.strip():
                                j += 1
                                continue
                            if indent_of(l2) != ni or not l2.strip().startswith("- "):
                                break
                            items.append(_value_in(l2.strip()[2:]))
                            j += 1
                        d[k] = items
                        i = j
                        continue
                    sub, j2 = parse_block(j, ni)
                    d[k] = sub
                    i = j2
                    continue
                d[k] = None
                i += 1
                continue
            d[k] = _value_in(v)
            i += 1
        return d, i

    meta, _ = parse_block(0, 0)
    return meta, body


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------
def now_iso():
    return _dt.datetime.now().astimezone().replace(microsecond=0).isoformat()


def local_tz_name():
    for cand in (os.environ.get("TZ"),):
        if cand:
            return cand
    try:
        with open("/etc/timezone") as f:
            return f.read().strip()
    except Exception:
        pass
    try:
        p = os.path.realpath("/etc/localtime")
        if "zoneinfo/" in p:
            return p.split("zoneinfo/", 1)[1]
    except Exception:
        pass
    return _dt.datetime.now().astimezone().tzname() or ""


def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "journal"


def safe_name(name):
    name = os.path.basename(name or "file")
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._") or "file"
    return name[:80]


def read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def write_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


MEDIA_REF = re.compile(r"\((/media/[^)\s]+)\)|src=\"(/media/[^\"]+)\"")


def photos_from_text(text):
    out = []
    for m in MEDIA_REF.finditer(text or ""):
        p = m.group(1) or m.group(2)
        if p and p not in out:
            out.append(p)
    return out


# --------------------------------------------------------------------------------------
# Store
# --------------------------------------------------------------------------------------
ENTRY_KEYS = ["id", "journal", "created", "modified", "timezone", "starred", "pinned",
              "tags", "location", "weather", "photos", "template", "prompt"]


class Store:
    def __init__(self, data_dir):
        self.dir = os.path.abspath(data_dir)
        self.entries_dir = os.path.join(self.dir, "entries")
        self.trash_dir = os.path.join(self.dir, "trash")
        self.media_dir = os.path.join(self.dir, "media")
        for d in (self.dir, self.entries_dir, self.trash_dir, self.media_dir):
            os.makedirs(d, exist_ok=True)
        self.lock = threading.RLock()
        self.entries = {}    # id -> entry dict
        self.paths = {}      # id -> file path
        self.mtimes = {}     # path -> mtime
        self.version = 0
        self._ensure_defaults()
        self.scan(full=True)

    # ---- config files ----
    def _p(self, name):
        return os.path.join(self.dir, name)

    def _ensure_defaults(self):
        for name, default in (("journals.json", DEFAULT_JOURNALS), ("settings.json", DEFAULT_SETTINGS),
                              ("templates.json", DEFAULT_TEMPLATES), ("prompts.json", DEFAULT_PROMPTS)):
            if not os.path.exists(self._p(name)):
                write_json(self._p(name), default)

    def journals(self):
        js = read_json(self._p("journals.json"), DEFAULT_JOURNALS)
        return js if isinstance(js, list) and js else list(DEFAULT_JOURNALS)

    def set_journals(self, js):
        with self.lock:
            write_json(self._p("journals.json"), js)
            self.version += 1

    def settings(self):
        s = dict(DEFAULT_SETTINGS)
        s.update(read_json(self._p("settings.json"), {}))
        return s

    def set_settings(self, s):
        with self.lock:
            write_json(self._p("settings.json"), s)
            self.version += 1

    def templates(self):
        return read_json(self._p("templates.json"), DEFAULT_TEMPLATES)

    def set_templates(self, t):
        with self.lock:
            write_json(self._p("templates.json"), t)
            self.version += 1

    def prompts(self):
        return read_json(self._p("prompts.json"), DEFAULT_PROMPTS)

    def set_prompts(self, p):
        with self.lock:
            write_json(self._p("prompts.json"), p)
            self.version += 1

    # ---- entries ----
    def _entry_path(self, e):
        c = e["created"]
        fname = "%s_%s%s_%s.md" % (c[:10], c[11:13], c[14:16], e["id"])
        return os.path.join(self.entries_dir, e["journal"], c[:4], fname)

    def _load_file(self, path, journal_hint=None):
        with open(path, "r", encoding="utf-8") as f:
            src = f.read()
        meta, body = parse_front(src)
        e = {}
        e["id"] = str(meta.get("id") or re.sub(r"\.md$", "", os.path.basename(path)).split("_")[-1])
        e["journal"] = str(meta.get("journal") or journal_hint or "journal")
        e["created"] = str(meta.get("created") or _dt.datetime.fromtimestamp(os.path.getmtime(path)).astimezone().isoformat())
        e["modified"] = str(meta.get("modified") or e["created"])
        e["timezone"] = meta.get("timezone") or ""
        e["starred"] = bool(meta.get("starred"))
        e["pinned"] = bool(meta.get("pinned"))
        tags = meta.get("tags") or []
        e["tags"] = [str(t) for t in tags] if isinstance(tags, list) else [str(tags)]
        loc = meta.get("location")
        e["location"] = loc if isinstance(loc, dict) else None
        wx = meta.get("weather")
        e["weather"] = wx if isinstance(wx, dict) else None
        e["template"] = meta.get("template") or ""
        e["prompt"] = meta.get("prompt") or ""
        e["text"] = body.rstrip("\n") + ("\n" if body.strip() else "")
        e["photos"] = photos_from_text(e["text"])
        return e

    def scan(self, full=False):
        """Re-read files that changed on disk (so edits in an editor are picked up)."""
        with self.lock:
            seen = set()
            changed = False
            for jdir in sorted(os.listdir(self.entries_dir)):
                jpath = os.path.join(self.entries_dir, jdir)
                if not os.path.isdir(jpath):
                    continue
                for root, _dirs, files in os.walk(jpath):
                    for fn in files:
                        if not fn.endswith(".md"):
                            continue
                        path = os.path.join(root, fn)
                        try:
                            mt = os.path.getmtime(path)
                        except OSError:
                            continue
                        seen.add(path)
                        if not full and self.mtimes.get(path) == mt:
                            continue
                        try:
                            e = self._load_file(path, journal_hint=jdir)
                        except Exception as ex:  # skip unreadable
                            sys.stderr.write("skip %s: %s\n" % (path, ex))
                            continue
                        old = self.paths.get(e["id"])
                        if old and old != path and old in seen:
                            # duplicate id in two files: keep the first seen
                            continue
                        self.entries[e["id"]] = e
                        self.paths[e["id"]] = path
                        self.mtimes[path] = mt
                        changed = True
            gone = [i for i, p in self.paths.items() if p not in seen]
            for i in gone:
                self.mtimes.pop(self.paths[i], None)
                self.paths.pop(i, None)
                self.entries.pop(i, None)
                changed = True
            if changed:
                self.version += 1
            return changed

    def all_entries(self):
        with self.lock:
            return sorted(self.entries.values(), key=lambda e: e["created"], reverse=True)

    def get(self, eid):
        with self.lock:
            return self.entries.get(eid)

    def normalize(self, e, existing=None):
        out = dict(existing) if existing else {}
        for k in ENTRY_KEYS + ["text"]:
            if k in e:
                out[k] = e[k]
        out.setdefault("id", uuid.uuid4().hex[:12])
        out["id"] = str(out["id"])
        out.setdefault("journal", self.settings().get("defaultJournal", "journal"))
        if not out.get("created"):
            out["created"] = now_iso()
        out["created"] = str(out["created"])[:25]
        out["modified"] = now_iso()
        out.setdefault("timezone", local_tz_name())
        out["starred"] = bool(out.get("starred"))
        out["pinned"] = bool(out.get("pinned"))
        tags = out.get("tags") or []
        out["tags"] = sorted({str(t).strip() for t in tags if str(t).strip()}, key=str.lower)
        out["location"] = out.get("location") if isinstance(out.get("location"), dict) and out.get("location") else None
        out["weather"] = out.get("weather") if isinstance(out.get("weather"), dict) and out.get("weather") else None
        out["template"] = out.get("template") or ""
        out["prompt"] = out.get("prompt") or ""
        out["text"] = out.get("text") or ""
        out["photos"] = photos_from_text(out["text"])
        return out

    def save(self, e):
        with self.lock:
            ids = {j["id"] for j in self.journals()}
            if e["journal"] not in ids:
                raise ValueError("unknown journal: %s" % e["journal"])
            meta = {k: e.get(k) for k in ENTRY_KEYS}
            meta = {k: v for k, v in meta.items() if v not in (None, "", [], False) or k in ("id", "journal", "created", "modified")}
            src = dump_front(meta) + "\n" + (e["text"].rstrip("\n") + "\n" if e["text"].strip() else "")
            path = self._entry_path(e)
            old = self.paths.get(e["id"])
            write_text(path, src)
            if old and old != path and os.path.exists(old):
                os.remove(old)
                self.mtimes.pop(old, None)
                self._prune_empty_dirs(os.path.dirname(old))
            self.entries[e["id"]] = e
            self.paths[e["id"]] = path
            self.mtimes[path] = os.path.getmtime(path)
            self.version += 1
            return e

    def _prune_empty_dirs(self, d):
        try:
            while d.startswith(self.entries_dir) and d != self.entries_dir and not os.listdir(d):
                os.rmdir(d)
                d = os.path.dirname(d)
        except OSError:
            pass

    def delete(self, eid, permanent=False):
        with self.lock:
            e = self.entries.pop(eid, None)
            path = self.paths.pop(eid, None)
            if not e or not path:
                return False
            self.mtimes.pop(path, None)
            if permanent:
                os.remove(path)
            else:
                os.makedirs(self.trash_dir, exist_ok=True)
                shutil.move(path, os.path.join(self.trash_dir, "%s.md" % eid))
            self._prune_empty_dirs(os.path.dirname(path))
            self.version += 1
            return True

    def trash(self):
        out = []
        for fn in sorted(os.listdir(self.trash_dir)):
            if fn.endswith(".md"):
                try:
                    e = self._load_file(os.path.join(self.trash_dir, fn))
                    e["deletedAt"] = _dt.datetime.fromtimestamp(os.path.getmtime(os.path.join(self.trash_dir, fn))).astimezone().isoformat()
                    out.append(e)
                except Exception:
                    pass
        out.sort(key=lambda e: e["created"], reverse=True)
        return out

    def restore(self, eid):
        with self.lock:
            p = os.path.join(self.trash_dir, "%s.md" % eid)
            if not os.path.exists(p):
                return None
            e = self._load_file(p)
            ids = {j["id"] for j in self.journals()}
            if e["journal"] not in ids:
                e["journal"] = self.settings().get("defaultJournal", "journal")
            e = self.normalize(e)
            e["id"] = eid
            self.save(e)
            os.remove(p)
            return e

    def purge(self, eid=None):
        with self.lock:
            n = 0
            for fn in os.listdir(self.trash_dir):
                if fn.endswith(".md") and (eid is None or fn == "%s.md" % eid):
                    os.remove(os.path.join(self.trash_dir, fn))
                    n += 1
            self.version += 1
            return n

    # ---- media ----
    def save_media(self, filename, data, subdir=None):
        filename = safe_name(filename)
        h = hashlib.sha1(data).hexdigest()[:10]
        if subdir:
            rel = os.path.join(subdir, "%s_%s" % (h, filename))
        else:
            now = _dt.datetime.now()
            rel = os.path.join("%04d" % now.year, "%02d" % now.month, "%s_%s" % (h, filename))
        path = os.path.join(self.media_dir, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if not os.path.exists(path):
            with open(path, "wb") as f:
                f.write(data)
        return "/media/" + rel.replace(os.sep, "/")

    # ---- import / export ----
    def export_zip(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            for eid, path in self.paths.items():
                z.write(path, os.path.relpath(path, self.dir))
            for root, _d, files in os.walk(self.media_dir):
                for fn in files:
                    p = os.path.join(root, fn)
                    z.write(p, os.path.relpath(p, self.dir))
            for name in ("journals.json", "settings.json", "templates.json", "prompts.json"):
                if os.path.exists(self._p(name)):
                    z.write(self._p(name), name)
            z.writestr("htmldiary.json", json.dumps(self.export_json(), ensure_ascii=False, indent=1))
        return buf.getvalue()

    def export_json(self):
        return {"app": "htmldiary", "version": 1, "exportedAt": now_iso(),
                "journals": self.journals(), "entries": self.all_entries()}

    def import_htmldiary_json(self, obj):
        n = 0
        journals = self.journals()
        ids = {j["id"] for j in journals}
        for j in obj.get("journals", []):
            if j.get("id") and j["id"] not in ids:
                journals.append(j)
                ids.add(j["id"])
        self.set_journals(journals)
        for e in obj.get("entries", []):
            if not e.get("id") or e["id"] in self.entries:
                continue
            if e.get("journal") not in ids:
                e["journal"] = self.settings().get("defaultJournal", "journal")
            self.save(self.normalize(e))
            n += 1
        return n

    def import_dayone_zip(self, data):
        """Import a Day One JSON export (zip with <Journal>.json + photos/ + videos/)."""
        z = zipfile.ZipFile(io.BytesIO(data))
        names = z.namelist()
        media = {}
        for n in names:
            parts = n.split("/")
            if len(parts) >= 2 and parts[-2] in ("photos", "videos", "audios", "pdfAttachments") and parts[-1]:
                media[os.path.splitext(parts[-1])[0]] = n
        journals = self.journals()
        by_name = {j["name"].lower(): j for j in journals}
        counts = {"entries": 0, "journals": 0, "media": 0, "skipped": 0}
        palette = ["#2d7ff9", "#30a46c", "#f76b15", "#8e4ec6", "#e5484d", "#12a594", "#f5b300", "#e93d82"]
        for n in names:
            if not n.lower().endswith(".json") or "/" in n.strip("/").rstrip("/")[:-5] and n.count("/") > 1:
                continue
            try:
                doc = json.loads(z.read(n).decode("utf-8"))
            except Exception:
                continue
            if not isinstance(doc, dict) or "entries" not in doc:
                continue
            jname = os.path.splitext(os.path.basename(n))[0] or "Journal"
            j = by_name.get(jname.lower())
            if not j:
                jid = slugify(jname)
                base, k = jid, 2
                while any(x["id"] == jid for x in journals):
                    jid = "%s-%d" % (base, k)
                    k += 1
                j = {"id": jid, "name": jname, "color": palette[len(journals) % len(palette)], "description": "Imported from Day One"}
                journals.append(j)
                by_name[jname.lower()] = j
                counts["journals"] += 1
                self.set_journals(journals)
            for raw in doc.get("entries", []):
                e = self._convert_dayone_entry(raw, j["id"], z, media, counts)
                if e is None:
                    counts["skipped"] += 1
                    continue
                self.save(e)
                counts["entries"] += 1
        return counts

    def _convert_dayone_entry(self, raw, journal_id, z, media, counts):
        eid = re.sub(r"[^a-z0-9]", "", (raw.get("uuid") or uuid.uuid4().hex).lower()) or uuid.uuid4().hex
        if eid in self.entries:
            return None
        text = raw.get("text") or ""
        # date: Day One stores UTC + IANA zone
        created = raw.get("creationDate") or now_iso()
        tz = raw.get("timeZone") or ""
        created = self._dayone_to_local(created, tz)
        modified = self._dayone_to_local(raw.get("modifiedDate") or created, tz)
        # media
        ref_map = {}
        for kind in ("photos", "videos", "audios", "pdfAttachments"):
            for m in raw.get(kind) or []:
                md5 = m.get("md5") or ""
                ident = m.get("identifier") or ""
                src = media.get(md5) or media.get(ident)
                if not src:
                    continue
                try:
                    blob = z.read(src)
                except KeyError:
                    continue
                url = self.save_media(os.path.basename(src), blob, subdir="dayone")
                counts["media"] += 1
                ref_map[ident] = url
                ref_map[md5] = url
        def repl(m):
            key = m.group(2)
            return "(%s)" % ref_map.get(key, m.group(0)[1:-1])
        text = re.sub(r"\((dayone-moment:/?/?(?:video/|audio/|pdfAttachment/)?)([A-Za-z0-9]+)\)", repl, text)
        for ident, url in ref_map.items():
            if url not in text:
                text = text.rstrip("\n") + "\n\n![](%s)\n" % url
        # de-dupe appended photos that map to the same url
        # location
        loc = raw.get("location") or {}
        location = None
        if loc:
            parts = [loc.get("localityName"), loc.get("administrativeArea"), loc.get("country")]
            location = {
                "name": loc.get("placeName") or loc.get("localityName") or "",
                "address": ", ".join([p for p in parts if p]),
                "lat": loc.get("latitude"), "lon": loc.get("longitude"),
            }
        wx = raw.get("weather") or {}
        weather = None
        if wx and wx.get("temperatureCelsius") is not None:
            desc = wx.get("conditionsDescription") or ""
            weather = {"temp": round(float(wx.get("temperatureCelsius")), 1), "desc": desc,
                       "icon": _dayone_weather_icon(wx.get("weatherCode") or desc)}
        e = {
            "id": eid, "journal": journal_id, "created": created, "modified": modified, "timezone": tz,
            "starred": bool(raw.get("starred")), "pinned": bool(raw.get("isPinned")),
            "tags": raw.get("tags") or [], "location": location, "weather": weather, "text": text,
        }
        e = self.normalize(e)
        e["modified"] = modified
        return e

    @staticmethod
    def _dayone_to_local(iso, tz):
        try:
            s = iso.replace("Z", "+00:00")
            d = _dt.datetime.fromisoformat(s)
        except Exception:
            return now_iso()
        if d.tzinfo is None:
            d = d.replace(tzinfo=_dt.timezone.utc)
        if tz and ZoneInfo:
            try:
                return d.astimezone(ZoneInfo(tz)).replace(microsecond=0).isoformat()
            except Exception:
                pass
        return d.astimezone().replace(microsecond=0).isoformat()


def _dayone_weather_icon(code):
    c = (code or "").lower()
    table = [
        ("thunder", "⛈️"), ("snow", "❄️"), ("sleet", "\U0001F328️"), ("hail", "\U0001F328️"),
        ("rain", "\U0001F327️"), ("drizzle", "\U0001F326️"), ("shower", "\U0001F326️"),
        ("fog", "\U0001F32B️"), ("haz", "\U0001F32B️"), ("mist", "\U0001F32B️"), ("wind", "\U0001F32C️"),
        ("partly", "⛅"), ("mostly-cloudy", "\U0001F325️"), ("cloud", "☁️"), ("overcast", "☁️"),
        ("clear-night", "\U0001F319"), ("clear", "☀️"), ("sun", "☀️"),
    ]
    for k, v in table:
        if k in c:
            return v
    return "\U0001F324️"


# --------------------------------------------------------------------------------------
# External lookups (weather + geocoding). Local-only proxies so the browser needs no CORS.
# --------------------------------------------------------------------------------------
def _fetch_json(url, timeout=12):
    req = urllib.request.Request(url, headers={"User-Agent": "htmldiary/1.0 (local personal journal)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def weather_lookup(lat, lon, when_iso=None):
    """Return {temp, desc, icon, code} for the given place/time via Open-Meteo."""
    date = (when_iso or now_iso())[:10]
    hour = int((when_iso or now_iso())[11:13] or 12)
    today = _dt.date.today()
    d = _dt.date.fromisoformat(date)
    q = urllib.parse.urlencode({"latitude": lat, "longitude": lon, "timezone": "auto",
                                "hourly": "temperature_2m,weather_code", "start_date": date, "end_date": date})
    if d == today:
        cur = _fetch_json("https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(
            {"latitude": lat, "longitude": lon, "timezone": "auto", "current": "temperature_2m,weather_code"}))
        c = cur.get("current") or {}
        code = int(c.get("weather_code", 3))
        temp = c.get("temperature_2m")
    else:
        base = "https://api.open-meteo.com/v1/forecast?" if (today - d).days <= 85 else "https://archive-api.open-meteo.com/v1/archive?"
        data = _fetch_json(base + q)
        h = data.get("hourly") or {}
        temps = h.get("temperature_2m") or []
        codes = h.get("weather_code") or []
        idx = min(hour, len(temps) - 1) if temps else -1
        if idx < 0 or temps[idx] is None:
            return None
        temp = temps[idx]
        code = int(codes[idx] if codes and codes[idx] is not None else 3)
    desc, icon = WMO.get(code, ("Unknown", "\U0001F324️"))
    return {"temp": round(float(temp), 1), "desc": desc, "icon": icon, "code": code}


def geo_reverse(lat, lon):
    data = _fetch_json("https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode(
        {"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 16}))
    a = data.get("address") or {}
    name = (a.get("amenity") or a.get("building") or a.get("road") or a.get("neighbourhood") or a.get("suburb")
            or a.get("city") or a.get("town") or a.get("village") or data.get("name") or "")
    locality = a.get("city") or a.get("town") or a.get("village") or a.get("suburb") or a.get("county") or ""
    parts = [locality, a.get("state"), a.get("country")]
    return {"name": name, "address": ", ".join([p for p in parts if p]), "lat": float(lat), "lon": float(lon),
            "display": data.get("display_name", "")}


def geo_search(q):
    data = _fetch_json("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": q, "format": "jsonv2", "limit": 8, "addressdetails": 1}))
    out = []
    for r in data:
        a = r.get("address") or {}
        locality = a.get("city") or a.get("town") or a.get("village") or a.get("suburb") or a.get("county") or ""
        parts = [locality, a.get("state"), a.get("country")]
        out.append({"name": r.get("name") or r.get("display_name", "").split(",")[0],
                    "address": ", ".join([p for p in parts if p]), "lat": float(r["lat"]), "lon": float(r["lon"]),
                    "display": r.get("display_name", "")})
    return out


# --------------------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------------------
STORE = None  # type: Store


class Handler(BaseHTTPRequestHandler):
    server_version = "htmldiary/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        if VERBOSE:
            BaseHTTPRequestHandler.log_message(self, fmt, *args)

    # ---- plumbing ----
    def _send(self, status, body, ctype="application/json; charset=utf-8", extra=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        if STORE is not None:
            self.send_header("X-htmldiary-Version", str(STORE.version))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, obj, status=200):
        self._send(status, json.dumps(obj, ensure_ascii=False))

    def _err(self, status, msg):
        self._json({"error": msg}, status)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def _json_body(self):
        raw = self._body()
        return json.loads(raw.decode("utf-8")) if raw else {}

    def do_GET(self):
        self._route("GET")

    def do_HEAD(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def do_PUT(self):
        self._route("PUT")

    def do_DELETE(self):
        self._route("DELETE")

    def _route(self, method):
        u = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(u.path)
        qs = {k: v[-1] for k, v in urllib.parse.parse_qs(u.query).items()}
        try:
            for m, pat, fn in ROUTES:
                if m != method:
                    continue
                mm = re.fullmatch(pat, path)
                if mm:
                    return fn(self, mm, qs)
            if method == "GET":
                return self._static(path)
            self._err(404, "not found")
        except ValueError as ex:
            self._err(400, str(ex))
        except Exception as ex:  # noqa
            import traceback
            traceback.print_exc()
            self._err(500, "%s: %s" % (type(ex).__name__, ex))

    # ---- static ----
    def _static(self, path):
        if path.startswith("/media/"):
            base = STORE.media_dir
            rel = path[len("/media/"):]
        else:
            base = WEB
            rel = path.lstrip("/") or "index.html"
        full = os.path.normpath(os.path.join(base, rel))
        if not full.startswith(base) or not os.path.isfile(full):
            if base == WEB:
                full = os.path.join(WEB, "index.html")  # SPA fallback
            else:
                return self._err(404, "not found")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            data = f.read()
        cache = "public, max-age=86400" if base != WEB else "no-cache"
        self._send(200, data, ctype, {"Cache-Control": cache})

    # ---- api ----
    def api_bootstrap(self, m, qs):
        STORE.scan()
        self._json({
            "journals": STORE.journals(), "settings": STORE.settings(), "templates": STORE.templates(),
            "prompts": STORE.prompts(), "entries": STORE.all_entries(), "trash": STORE.trash(),
            "dataDir": STORE.dir, "version": STORE.version, "timezone": local_tz_name(), "now": now_iso(),
        })

    def api_version(self, m, qs):
        STORE.scan()
        self._json({"version": STORE.version})

    def api_entries(self, m, qs):
        STORE.scan()
        self._json(STORE.all_entries())

    def api_entry_get(self, m, qs):
        e = STORE.get(m.group(1))
        self._json(e) if e else self._err(404, "no such entry")

    def api_entry_create(self, m, qs):
        e = STORE.normalize(self._json_body())
        if e["id"] in STORE.entries:
            e["id"] = uuid.uuid4().hex[:12]
        self._json(STORE.save(e), 201)

    def api_entry_update(self, m, qs):
        cur = STORE.get(m.group(1))
        if not cur:
            return self._err(404, "no such entry")
        body = self._json_body()
        body.pop("id", None)
        e = STORE.normalize(body, existing=cur)
        self._json(STORE.save(e))

    def api_entry_delete(self, m, qs):
        ok = STORE.delete(m.group(1), permanent=qs.get("permanent") == "1")
        self._json({"ok": ok})

    def api_trash_list(self, m, qs):
        self._json(STORE.trash())

    def api_trash_restore(self, m, qs):
        e = STORE.restore(m.group(1))
        self._json(e) if e else self._err(404, "not in trash")

    def api_trash_purge_one(self, m, qs):
        self._json({"purged": STORE.purge(m.group(1))})

    def api_trash_purge_all(self, m, qs):
        self._json({"purged": STORE.purge()})

    def api_journals_get(self, m, qs):
        self._json(STORE.journals())

    def api_journals_put(self, m, qs):
        js = self._json_body()
        if not isinstance(js, list) or not js:
            raise ValueError("journals must be a non-empty list")
        seen = set()
        for j in js:
            if not j.get("id") or not j.get("name"):
                raise ValueError("journal needs id and name")
            if j["id"] in seen:
                raise ValueError("duplicate journal id")
            seen.add(j["id"])
        # move entries from removed journals to the first journal
        old_ids = {j["id"] for j in STORE.journals()}
        removed = old_ids - seen
        STORE.set_journals(js)
        if removed:
            target = qs.get("moveTo") or js[0]["id"]
            for e in list(STORE.entries.values()):
                if e["journal"] in removed:
                    if qs.get("deleteEntries") == "1":
                        STORE.delete(e["id"])
                    else:
                        e["journal"] = target
                        STORE.save(e)
        self._json(STORE.journals())

    def api_settings_get(self, m, qs):
        self._json(STORE.settings())

    def api_settings_put(self, m, qs):
        s = STORE.settings()
        s.update(self._json_body())
        STORE.set_settings(s)
        self._json(s)

    def api_templates_get(self, m, qs):
        self._json(STORE.templates())

    def api_templates_put(self, m, qs):
        t = self._json_body()
        if not isinstance(t, list):
            raise ValueError("templates must be a list")
        STORE.set_templates(t)
        self._json(t)

    def api_prompts_get(self, m, qs):
        self._json(STORE.prompts())

    def api_prompts_put(self, m, qs):
        p = self._json_body()
        if not isinstance(p, list):
            raise ValueError("prompts must be a list")
        STORE.set_prompts(p)
        self._json(p)

    def api_media_upload(self, m, qs):
        name = self.headers.get("X-Filename") or qs.get("name") or "upload.bin"
        name = urllib.parse.unquote(name)
        data = self._body()
        if not data:
            raise ValueError("empty upload")
        url = STORE.save_media(name, data)
        self._json({"url": url, "size": len(data)}, 201)

    def api_weather(self, m, qs):
        lat, lon = qs.get("lat"), qs.get("lon")
        if not lat or not lon:
            raise ValueError("lat and lon required")
        try:
            wx = weather_lookup(float(lat), float(lon), qs.get("when"))
        except Exception as ex:
            return self._err(502, "weather lookup failed: %s" % ex)
        self._json(wx or {})

    def api_geo_reverse(self, m, qs):
        try:
            self._json(geo_reverse(float(qs.get("lat")), float(qs.get("lon"))))
        except Exception as ex:
            self._err(502, "reverse geocode failed: %s" % ex)

    def api_geo_search(self, m, qs):
        q = (qs.get("q") or "").strip()
        if not q:
            return self._json([])
        try:
            self._json(geo_search(q))
        except Exception as ex:
            self._err(502, "geocode failed: %s" % ex)

    def api_export_zip(self, m, qs):
        data = STORE.export_zip()
        fn = "htmldiary-export-%s.zip" % _dt.date.today().isoformat()
        self._send(200, data, "application/zip", {"Content-Disposition": "attachment; filename=%s" % fn})

    def api_export_json(self, m, qs):
        fn = "htmldiary-export-%s.json" % _dt.date.today().isoformat()
        self._send(200, json.dumps(STORE.export_json(), ensure_ascii=False, indent=1),
                   "application/json; charset=utf-8", {"Content-Disposition": "attachment; filename=%s" % fn})

    def api_import_dayone(self, m, qs):
        data = self._body()
        if not data:
            raise ValueError("empty upload")
        if data[:2] == b"PK":
            counts = STORE.import_dayone_zip(data)
        else:
            # bare Day One JSON (no photos)
            doc = json.loads(data.decode("utf-8"))
            z = zipfile.ZipFile(io.BytesIO(b""), "w")
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w") as zz:
                zz.writestr((qs.get("name") or "Journal") + ".json", json.dumps(doc))
            counts = STORE.import_dayone_zip(buf.getvalue())
        self._json(counts)

    def api_import_htmldiary(self, m, qs):
        data = self._body()
        if data[:2] == b"PK":
            z = zipfile.ZipFile(io.BytesIO(data))
            doc = json.loads(z.read("htmldiary.json").decode("utf-8"))
            for n in z.namelist():
                if n.startswith("media/") and not n.endswith("/"):
                    dest = os.path.join(STORE.media_dir, n[len("media/"):])
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    if not os.path.exists(dest):
                        with open(dest, "wb") as f:
                            f.write(z.read(n))
        else:
            doc = json.loads(data.decode("utf-8"))
        n = STORE.import_htmldiary_json(doc)
        self._json({"entries": n})

    def api_reload(self, m, qs):
        STORE.scan(full=True)
        self._json({"version": STORE.version, "entries": len(STORE.entries)})


ROUTES = [
    ("GET", r"/api/bootstrap", Handler.api_bootstrap),
    ("GET", r"/api/version", Handler.api_version),
    ("POST", r"/api/reload", Handler.api_reload),
    ("GET", r"/api/entries", Handler.api_entries),
    ("POST", r"/api/entries", Handler.api_entry_create),
    ("GET", r"/api/entries/([A-Za-z0-9_-]+)", Handler.api_entry_get),
    ("PUT", r"/api/entries/([A-Za-z0-9_-]+)", Handler.api_entry_update),
    ("DELETE", r"/api/entries/([A-Za-z0-9_-]+)", Handler.api_entry_delete),
    ("GET", r"/api/trash", Handler.api_trash_list),
    ("POST", r"/api/trash/([A-Za-z0-9_-]+)/restore", Handler.api_trash_restore),
    ("DELETE", r"/api/trash/([A-Za-z0-9_-]+)", Handler.api_trash_purge_one),
    ("DELETE", r"/api/trash", Handler.api_trash_purge_all),
    ("GET", r"/api/journals", Handler.api_journals_get),
    ("PUT", r"/api/journals", Handler.api_journals_put),
    ("GET", r"/api/settings", Handler.api_settings_get),
    ("PUT", r"/api/settings", Handler.api_settings_put),
    ("GET", r"/api/templates", Handler.api_templates_get),
    ("PUT", r"/api/templates", Handler.api_templates_put),
    ("GET", r"/api/prompts", Handler.api_prompts_get),
    ("PUT", r"/api/prompts", Handler.api_prompts_put),
    ("POST", r"/api/media", Handler.api_media_upload),
    ("GET", r"/api/weather", Handler.api_weather),
    ("GET", r"/api/geo/reverse", Handler.api_geo_reverse),
    ("GET", r"/api/geo/search", Handler.api_geo_search),
    ("GET", r"/api/export\.zip", Handler.api_export_zip),
    ("GET", r"/api/export\.json", Handler.api_export_json),
    ("POST", r"/api/import/dayone", Handler.api_import_dayone),
    ("POST", r"/api/import/htmldiary", Handler.api_import_htmldiary),
]


def main():
    global STORE, VERBOSE
    ap = argparse.ArgumentParser(description="htmldiary: local Day One-style journal")
    ap.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8120")))
    ap.add_argument("--data", default=os.environ.get("HTMLDIARY_DATA", os.path.join(ROOT, "data")))
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    VERBOSE = args.verbose
    STORE = Store(args.data)
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    srv.daemon_threads = True
    print("htmldiary  http://%s:%d/   data: %s   entries: %d" % (args.host, args.port, STORE.dir, len(STORE.entries)))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
