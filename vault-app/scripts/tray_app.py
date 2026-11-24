"""Vault System Tray Application and Server Orchestrator.

Provides a Windows system tray icon with menu options (Open, Show Logs, Open Folder, Exit),
starts the backend server in background without desktop CLI clutter, and automatically
launches the web interface in the user's default browser once healthy.
Listens on 0.0.0.0 so both PC localhost and local Wi-Fi devices (Android/Termux) can connect.
"""

import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from PIL import Image
import pystray
from pystray import MenuItem as item


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
WORKSPACE_ROOT = os.path.dirname(PROJECT_ROOT)

VENV_PYTHON = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = sys.executable

ICON_PATH = os.path.join(WORKSPACE_ROOT, "vault.ico")
if not os.path.exists(ICON_PATH):
    ICON_PATH = os.path.join(SCRIPT_DIR, "vault.ico")

LOG_FILE = os.path.join(BACKEND_DIR, "vault_server.log")
PID_FILE = os.path.join(BACKEND_DIR, ".vault.pid")
SESSION_FILE = os.path.join(WORKSPACE_ROOT, "vault_session.json")


def get_lan_ip():
    """Detect LAN IPv4 address for local network access."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class VaultTrayApp:
    def __init__(self, host="0.0.0.0", port=8000, vault_path=None, no_browser=False):
        self.host = host
        self.port = port
        self.no_browser = no_browser
        self.lan_ip = get_lan_ip()
        self.local_url = f"http://127.0.0.1:{self.port}"
        self.lan_url = f"http://{self.lan_ip}:{self.port}"
        self.url = self.local_url
        
        # Determine vault directory: CLI override -> persistent session -> environment -> defaults
        if vault_path:
            self.vault_path = os.path.abspath(vault_path)
        elif os.environ.get("VAULT_DIRECTORY"):
            self.vault_path = os.path.abspath(os.environ["VAULT_DIRECTORY"])
        else:
            persisted = None
            if os.path.exists(SESSION_FILE):
                try:
                    with open(SESSION_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        p = data.get("active_vault_path")
                        if p and os.path.exists(p) and os.path.isdir(p):
                            persisted = os.path.abspath(p)
                except Exception:
                    pass
            
            if persisted:
                self.vault_path = persisted
            else:
                sample_vault = os.path.join(WORKSPACE_ROOT, "VaultSample")
                if os.path.exists(sample_vault):
                    self.vault_path = sample_vault
                else:
                    self.vault_path = os.path.join(WORKSPACE_ROOT, "VaultData")

        os.makedirs(self.vault_path, exist_ok=True)
        self.server_process = None
        self.log_handle = None
        self.icon = None
        self._is_shutting_down = False

    def is_server_healthy(self, timeout=1.5):
        try:
            req = urllib.request.Request(f"{self.local_url}/health", headers={"User-Agent": "Vault-Tray/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.status == 200
        except Exception:
            return False

    def start_server(self):
        env = os.environ.copy()
        env["VAULT_DIRECTORY"] = self.vault_path
        env["HOST"] = self.host
        env["PORT"] = str(self.port)
        env["ALLOW_LAN"] = "true"

        # Open log file in append mode
        self.log_handle = open(LOG_FILE, "a", encoding="utf-8")
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        self.log_handle.write(f"\n--- Vault Session Started at {timestamp} ---\n")
        self.log_handle.write(f"Active Vault Path: {self.vault_path}\n")
        self.log_handle.write(f"Listening Address: {self.host}:{self.port}\n")
        self.log_handle.write(f"Local Access URL : {self.local_url}\n")
        self.log_handle.write(f"Phone / LAN URL  : {self.lan_url}\n")
        self.log_handle.flush()

        creation_flags = 0x08000000 if os.name == "nt" else 0  # CREATE_NO_WINDOW

        self.server_process = subprocess.Popen(
            [
                VENV_PYTHON,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                self.host,
                "--port",
                str(self.port),
                "--log-level",
                "info",
            ],
            cwd=BACKEND_DIR,
            env=env,
            stdout=self.log_handle,
            stderr=subprocess.STDOUT,
            creationflags=creation_flags,
        )

        try:
            with open(PID_FILE, "w", encoding="utf-8") as f:
                f.write(str(self.server_process.pid))
        except Exception:
            pass

    def stop_server(self):
        self._is_shutting_down = True
        if self.server_process:
            try:
                if os.name == "nt":
                    # Force terminate process tree cleanly
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(self.server_process.pid)],
                        capture_output=True,
                    )
                else:
                    self.server_process.terminate()
            except Exception:
                pass
            self.server_process = None

        if self.log_handle:
            try:
                self.log_handle.write(f"\n--- Vault Session Terminated at {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
                self.log_handle.close()
            except Exception:
                pass
            self.log_handle = None

        if os.path.exists(PID_FILE):
            try:
                os.remove(PID_FILE)
            except Exception:
                pass

    def restart_server(self, icon=None, item_menu=None):
        if self.icon:
            try:
                self.icon.notify("Restarting Vault server...", "Vault PKM")
            except Exception:
                pass
        self.stop_server()
        time.sleep(1)
        self.start_server()
        threading.Thread(target=self._wait_and_notify_restart, daemon=True).start()

    def _wait_and_notify_restart(self):
        for _ in range(30):
            time.sleep(0.3)
            if self.is_server_healthy():
                if self.icon:
                    try:
                        self.icon.notify(f"Vault server is back online at {self.local_url}\nPhone access: {self.lan_url}", "Vault PKM")
                    except Exception:
                        pass
                break

    def open_browser(self, icon=None, item_menu=None):
        webbrowser.open(self.local_url)

    def open_vault_folder(self, icon=None, item_menu=None):
        try:
            if os.name == "nt":
                os.startfile(self.vault_path)
            else:
                subprocess.Popen(["xdg-open", self.vault_path])
        except Exception as e:
            print(f"Failed to open vault directory: {e}")

    def show_console_logs(self, icon=None, item_menu=None):
        """Open a live streaming console log window for server inspection."""
        if os.name == "nt":
            cmd = f"$host.UI.RawUI.WindowTitle = 'Vault Server Logs - {self.local_url} | {self.lan_url}'; Write-Host 'Tailing Vault Server Logs (Close this window to return to tray)...' -ForegroundColor Cyan; Write-Host 'PC: {self.local_url} | Phone/LAN: {self.lan_url}' -ForegroundColor Green; Get-Content -Path '{LOG_FILE}' -Wait -Tail 40"
            subprocess.Popen(["powershell.exe", "-NoExit", "-Command", cmd])
        else:
            subprocess.Popen(["xterm", "-e", f"tail -f '{LOG_FILE}'"])

    def copy_url_to_clipboard(self, icon=None, item_menu=None):
        try:
            if os.name == "nt":
                subprocess.run(
                    ["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Value '{self.local_url}'"],
                    check=False,
                )
                if self.icon:
                    self.icon.notify(f"Copied {self.local_url} to clipboard!", "Vault PKM")
        except Exception:
            pass

    def copy_lan_url_to_clipboard(self, icon=None, item_menu=None):
        try:
            if os.name == "nt":
                subprocess.run(
                    ["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Value '{self.lan_url}'"],
                    check=False,
                )
                if self.icon:
                    self.icon.notify(f"Copied LAN Address: {self.lan_url} (for Phone/Termux)", "Vault PKM")
        except Exception:
            pass

    def exit_app(self, icon=None, item_menu=None):
        self.stop_server()
        if self.icon:
            self.icon.stop()
        sys.exit(0)

    def _monitor_health_and_launch_browser(self):
        """Wait until backend responds healthy, then launch browser directly."""
        max_attempts = 40
        for _ in range(max_attempts):
            if self._is_shutting_down:
                return
            time.sleep(0.25)
            if self.is_server_healthy():
                if not self.no_browser:
                    webbrowser.open(self.local_url)
                if self.icon:
                    try:
                        self.icon.notify(
                            f"Vault is online at {self.local_url}\nPhone / Wi-Fi Sync: {self.lan_url}",
                            "Vault PKM",
                        )
                    except Exception:
                        pass
                return

    def run(self):
        # 1. Check if an instance is already running
        if self.is_server_healthy():
            print(f"[INFO] Vault is already running at {self.local_url} (LAN: {self.lan_url})")
            if not self.no_browser:
                self.open_browser()
            sys.exit(0)

        # 2. Start the server in background
        self.start_server()

        # 3. Launch thread to poll and open browser
        launcher_thread = threading.Thread(
            target=self._monitor_health_and_launch_browser, daemon=True
        )
        launcher_thread.start()

        # 4. Load the icon
        image = None
        if os.path.exists(ICON_PATH):
            try:
                image = Image.open(ICON_PATH)
            except Exception:
                pass

        if image is None:
            image = Image.new("RGBA", (64, 64), (99, 102, 241, 255))

        # 5. Build system tray menu
        menu = pystray.Menu(
            item("🌐 Open Vault in Browser", self.open_browser, default=True),
            item(f"📱 Copy Phone / LAN URL ({self.lan_ip}:{self.port})", self.copy_lan_url_to_clipboard),
            item("📂 Open Vault Folder", self.open_vault_folder),
            item("🖥️ Show Server Logs / CLI", self.show_console_logs),
            item("📋 Copy PC Address to Clipboard", self.copy_url_to_clipboard),
            pystray.Menu.SEPARATOR,
            item("🔄 Restart Server", self.restart_server),
            item("❌ Exit Vault", self.exit_app),
        )

        self.icon = pystray.Icon(
            "Vault",
            image,
            f"Vault — Personal Knowledge Graph\nPC: {self.local_url}\nPhone: {self.lan_url}",
            menu=menu,
        )

        def signal_handler(sig, frame):
            self.exit_app()

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        try:
            self.icon.run()
        finally:
            self.stop_server()


def main():
    parser = argparse.ArgumentParser(description="Vault System Tray Application")
    parser.add_argument("--host", default="0.0.0.0", help="Host IP address (default: 0.0.0.0 for LAN access)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    parser.add_argument("--vault-path", default="", help="Path to vault notes directory")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser on startup")
    args = parser.parse_args()

    app = VaultTrayApp(
        host=args.host,
        port=args.port,
        vault_path=args.vault_path or None,
        no_browser=args.no_browser,
    )
    app.run()


if __name__ == "__main__":
    main()
