#!/usr/bin/env python3
"""Mock auth backend for the Maestro end-to-end suite.

The real API does not exist yet, so the flows run against this. It implements
only the endpoints the app calls today and mirrors the response envelope the
Dart models parse: `{ success, data: {...} }` on the way out and
`{ success: false, error: { code, message, details } }` on the way in.

Auth is two steps, matching the app:

  POST /auth/login  ->  tokens only, plus a top-level `mustChangePassword`
  GET  /auth/me     ->  the profile, flat, with `role` and `branch` as nested
                        objects, `fullName` for the name, and `permissions`
                        sitting beside the profile fields rather than under a
                        `user` wrapper

Run it with `python3 server.py --port 8787`. The Android emulator reaches the
host machine at 10.0.2.2, which is what the flows point the app at.
"""

import argparse
import copy
import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

API_PREFIX = "/api/v1"

# Every permission the bottom bar can gate on, so tab visibility is driven by
# the payload rather than by a role name.
# Copied verbatim from the backend catalogue (`permissions.catalogue.ts`). Do
# not invent codes here: a permission the server cannot grant is a gate that is
# closed for everyone, and inventing one is how the Reports tile went missing.
ALL_PERMISSIONS = [
    "audit.read",
    "branches.manage",
    "finance.budgets.manage",
    "finance.categories.manage",
    "finance.create",
    "finance.read",
    "finance.read.all",
    "finance.update",
    "finance.void",
    "machines.create",
    "machines.decommission",
    "machines.delete",
    "machines.import",
    "machines.read",
    "machines.read.all",
    "machines.update",
    "maintenance.close",
    "maintenance.create",
    "maintenance.read",
    "maintenance.set_cost",
    "maintenance.update",
    "merchants.create",
    "merchants.delete",
    "merchants.read",
    "merchants.read.all",
    "merchants.update",
    "reports.export",
    "reports.finance",
    "reports.machines",
    "reports.transfers",
    "reports.violations",
    "roles.manage",
    "settings.manage",
    "transfers.cancel",
    "transfers.confirm",
    "transfers.create",
    "transfers.read",
    "transfers.read.all",
    "transfers.reject",
    "users.create",
    "users.deactivate",
    "users.read",
    "users.update",
    "violations.create",
    "violations.read",
    "violations.read.all",
    "violations.resolve",
    "violations.waive",
]

# The other system roles' grants, again straight from the backend.
REPRESENTATIVE_PERMISSIONS = [
    "machines.read",
    "merchants.create",
    "merchants.read",
    "merchants.update",
    "transfers.confirm",
    "transfers.create",
    "transfers.read",
    "violations.read",
]

SUPERVISOR_PERMISSIONS = [
    "machines.read",
    "machines.update",
    "maintenance.create",
    "maintenance.read",
    "merchants.read",
    "reports.machines",
    "reports.transfers",
    "reports.violations",
    "transfers.cancel",
    "transfers.confirm",
    "transfers.create",
    "transfers.read",
    "transfers.reject",
    "users.read",
    "violations.create",
    "violations.read",
]

# Finance-heavy and deliberately narrow on operations: no transfers and no
# merchants, which is what makes this the smallest bottom bar of the three.
ACCOUNTANT_PERMISSIONS = [
    "finance.budgets.manage",
    "finance.categories.manage",
    "finance.create",
    "finance.read",
    "finance.read.all",
    "finance.update",
    "finance.void",
    "machines.read",
    "reports.export",
    "reports.finance",
]

USERS = {
    "01000000001": {
        "password": "Password1",
        "user": {
            "id": "u-001",
            "fullName": "أحمد ناصر",
            "phone": "01000000001",
            "email": "ahmed@example.com",
            "role": {"code": "DIRECTOR", "name": "Director"},
            "branch": {"id": "b-001", "name": "الفرع الرئيسي"},
            "mustChangePassword": False,
        },
        "permissions": ALL_PERMISSIONS,
    },
    "01000000002": {
        "password": "Password1",
        "user": {
            "id": "u-002",
            "fullName": "منى سعيد",
            "phone": "01000000002",
            "email": "mona@example.com",
            "role": {"code": "BRANCH_SUPERVISOR", "name": "Branch supervisor"},
            "branch": {"id": "b-002", "name": "فرع طنطا"},
            "mustChangePassword": True,
        },
        "permissions": SUPERVISOR_PERMISSIONS,
    },
    "01000000003": {
        "password": "Password1",
        "user": {
            "id": "u-003",
            "fullName": "محمود توباي",
            "phone": "01000000003",
            # Company-level staff have no branch, and the parser has to cope
            # with the field being absent rather than an empty object.
            "role": {"code": "REPRESENTATIVE", "name": "Representative"},
            "branch": {"id": "b-003", "name": "فرع المنصورة"},
            "mustChangePassword": False,
        },
        "permissions": REPRESENTATIVE_PERMISSIONS,
    },
    "01000000005": {
        "password": "Password1",
        "user": {
            "id": "u-005",
            "fullName": "سمير المحاسب",
            "phone": "01000000005",
            "role": {"code": "ACCOUNTANT", "name": "Accountant"},
            # Company-level: the parser has to cope with a missing branch.
            "mustChangePassword": False,
        },
        "permissions": ACCOUNTANT_PERMISSIONS,
    },
}

# Phone that always answers 400 so the flows can exercise inline field errors.
FIELD_ERROR_PHONE = "01000000009"

# Changing a password mutates USERS, so every flow resets first and the suite
# can be re-run without a stale password leaking between flows.
_PRISTINE_USERS = copy.deepcopy(USERS)

_lock = threading.Lock()

# Flipped by POST /test/network. While down, every app-facing endpoint answers
# 503 so the flows can exercise the cached-profile fallback without needing to
# toggle airplane mode on the device.
_state = {"network_down": False}


def access_token_for(phone):
    return "access-token-" + phone


def refresh_token_for(phone):
    return "refresh-token-" + phone


def phone_from_token(token):
    for prefix in ("access-token-", "refresh-token-"):
        if token.startswith(prefix):
            return token[len(prefix) :]
    return None


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # ── plumbing ─────────────────────────────────────────────────────────────

    def log_message(self, fmt, *args):
        print("[mock] " + (fmt % args), flush=True)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length == 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}

    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _ok(self, data):
        self._send(200, {"success": True, "data": data})

    def _fail(self, status, code, message, details=None):
        error = {"code": code, "message": message}
        if details is not None:
            error["details"] = details
        self._send(status, {"success": False, "error": error})

    def _bearer_user(self):
        header = self.headers.get("Authorization") or ""
        if not header.startswith("Bearer "):
            return None
        phone = phone_from_token(header[len("Bearer ") :].strip())
        return USERS.get(phone) if phone else None

    def _path(self):
        path = self.path.split("?", 1)[0]
        if path.startswith(API_PREFIX):
            path = path[len(API_PREFIX) :]
        return path.rstrip("/")

    # ── routes ───────────────────────────────────────────────────────────────

    def _is_unavailable(self, path):
        return _state["network_down"] and not path.startswith("/test")

    def do_GET(self):
        path = self._path()

        if path == "/health":
            self._ok({"status": "up"})
            return

        if self._is_unavailable(path):
            self._fail(503, "SERVICE_UNAVAILABLE", "الخدمة مش متاحة دلوقتي.")
            return

        if path == "/auth/me":
            record = self._bearer_user()
            if record is None:
                self._fail(401, "UNAUTHORIZED", "انتهت الجلسة، سجّل دخول تاني.")
                return
            # Flat: permissions sit beside the profile fields.
            profile = dict(record["user"])
            profile["permissions"] = record["permissions"]
            self._ok(profile)
            return

        self._fail(404, "NOT_FOUND", "Endpoint not found: " + path)

    def do_POST(self):
        path = self._path()
        body = self._read_json()

        if path == "/test/reset":
            with _lock:
                USERS.clear()
                USERS.update(copy.deepcopy(_PRISTINE_USERS))
                _state["network_down"] = False
            self._ok({"reset": True})
            return

        if path == "/test/network":
            with _lock:
                _state["network_down"] = bool(body.get("down"))
            self._ok({"down": _state["network_down"]})
            return

        if self._is_unavailable(path):
            self._fail(503, "SERVICE_UNAVAILABLE", "الخدمة مش متاحة دلوقتي.")
            return

        if path == "/auth/login":
            self._login(body)
        elif path == "/auth/refresh":
            self._refresh(body)
        elif path == "/auth/change-password":
            self._change_password(body)
        elif path == "/auth/logout":
            self._ok({"loggedOut": True})
        else:
            self._fail(404, "NOT_FOUND", "Endpoint not found: " + path)

    # ── handlers ─────────────────────────────────────────────────────────────

    def _login(self, body):
        phone = str(body.get("phone") or "").strip()
        password = str(body.get("password") or "")

        if phone == FIELD_ERROR_PHONE:
            self._fail(
                400,
                "VALIDATION_ERROR",
                "فيه بيانات ناقصة.",
                [{"field": "phone", "message": "رقم الموبايل ده مش مسجل."}],
            )
            return

        if not re.fullmatch(r"01[0-2,5]\d{8}", phone):
            self._fail(
                400,
                "VALIDATION_ERROR",
                "فيه بيانات ناقصة.",
                [{"field": "phone", "message": "رقم الموبايل مش صحيح."}],
            )
            return

        record = USERS.get(phone)
        if record is None or record["password"] != password:
            self._fail(
                401,
                "INVALID_CREDENTIALS",
                "رقم الموبايل أو كلمة السر غلط.",
            )
            return

        # Tokens only. The profile comes from the /auth/me call the app makes
        # immediately afterwards.
        self._ok(
            {
                "accessToken": access_token_for(phone),
                "refreshToken": refresh_token_for(phone),
                "expiresIn": 900,
                "refreshExpiresAt": "2099-01-01T00:00:00Z",
                "mustChangePassword": record["user"]["mustChangePassword"],
            }
        )

    def _refresh(self, body):
        phone = phone_from_token(str(body.get("refreshToken") or ""))
        record = USERS.get(phone) if phone else None
        if record is None:
            self._fail(401, "UNAUTHORIZED", "انتهت الجلسة، سجّل دخول تاني.")
            return
        self._ok(
            {
                "accessToken": access_token_for(phone),
                "refreshToken": refresh_token_for(phone),
            }
        )

    def _change_password(self, body):
        record = self._bearer_user()
        if record is None:
            self._fail(401, "UNAUTHORIZED", "انتهت الجلسة، سجّل دخول تاني.")
            return

        current = str(body.get("currentPassword") or "")
        new_password = str(body.get("newPassword") or "")

        if current != record["password"]:
            self._fail(
                400,
                "VALIDATION_ERROR",
                "كلمة السر الحالية غلط.",
                [
                    {
                        "field": "currentPassword",
                        "message": "كلمة السر الحالية غلط.",
                    }
                ],
            )
            return

        if new_password == current:
            self._fail(
                422,
                "PASSWORD_REUSED",
                "لازم كلمة السر الجديدة تكون مختلفة عن القديمة.",
            )
            return

        # Persist so a later login in the same run uses the new password and
        # no longer lands on the forced-change screen.
        with _lock:
            record["password"] = new_password
            record["user"]["mustChangePassword"] = False

        self._ok({"changed": True})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(
        "[mock] listening on http://{}:{}{}".format(
            args.host, args.port, API_PREFIX
        ),
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
