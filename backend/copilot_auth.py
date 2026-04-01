"""
GitHub Copilot Authenticator

Handles OAuth device-flow authentication for the GitHub Copilot Chat API.
Token lifecycle:
  1. Check GITHUB_TOKEN env var (skips device flow if set)
  2. Otherwise read stored access-token from disk
  3. If missing, run OAuth device flow (interactive)
  4. Exchange access-token for short-lived API key via GitHub internal endpoint
  5. Cache API key on disk, refresh when expired
"""

import json
import logging
import os
import time
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98"
_GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code"
_GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
_GITHUB_API_KEY_URL = "https://api.github.com/copilot_internal/v2/token"

COPILOT_API_BASE = "https://api.githubcopilot.com"


class CopilotAuthError(Exception):
    """Raised when Copilot authentication fails."""


class CopilotAuthenticator:
    """Manages GitHub Copilot OAuth tokens with disk caching."""

    def __init__(self, token_dir: str | None = None) -> None:
        self._token_dir = token_dir or os.getenv(
            "COPILOT_TOKEN_DIR",
            os.path.expanduser("~/.config/copilot-llm"),
        )
        self._access_token_path = os.path.join(self._token_dir, "access-token")
        self._api_key_path = os.path.join(self._token_dir, "api-key.json")
        os.makedirs(self._token_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_api_key(self) -> str:
        """Return a valid Copilot Bearer token.

        Strategy:
        1. GITHUB_TOKEN env var → use directly as Bearer token (no exchange needed)
        2. Cached short-lived API key from disk → use if not expired
        3. Stored access token (from device flow) → exchange for API key
        4. No tokens → run interactive device flow
        """
        # 1) COPILOT_TOKEN is a Copilot-specific OAuth token (from device flow)
        #    that works directly as Bearer against api.githubcopilot.com.
        #    Note: regular GitHub PATs (GITHUB_TOKEN) do NOT work.
        env_token = os.getenv("COPILOT_TOKEN", "").strip()
        if env_token:
            return env_token

        # 2) Cached short-lived API key
        cached = self._read_cached_api_key()
        if cached:
            return cached

        # 3/4) Get access token (disk or device flow), exchange for API key
        access_token = self._get_access_token()
        return self._refresh_api_key(access_token)

    def get_api_base(self) -> str:
        """Return the API endpoint (may be overridden in api-key.json)."""
        try:
            with open(self._api_key_path) as f:
                data = json.load(f)
                endpoint = data.get("endpoints", {}).get("api")
                if endpoint:
                    return endpoint
        except (OSError, json.JSONDecodeError, KeyError):
            pass
        return COPILOT_API_BASE

    # ------------------------------------------------------------------
    # Access-token layer (long-lived GitHub OAuth token)
    # ------------------------------------------------------------------

    def _get_access_token(self) -> str:
        """Return a GitHub access token — from disk or device flow."""
        # Read from disk
        try:
            with open(self._access_token_path) as f:
                token = f.read().strip()
                if token:
                    return token
        except OSError:
            pass

        # Interactive device flow
        return self._run_device_flow()

    def _run_device_flow(self) -> str:
        """Run GitHub OAuth device-code flow. Prompts user to authenticate."""
        # Suppress noisy httpx INFO logs during device flow polling
        httpx_logger = logging.getLogger("httpx")
        prev_level = httpx_logger.level
        httpx_logger.setLevel(logging.WARNING)

        try:
            return self._do_device_flow()
        finally:
            httpx_logger.setLevel(prev_level)

    def _do_device_flow(self) -> str:
        """Internal: run the device-code flow with clear terminal output."""
        max_polls = 24
        poll_interval = 5

        with httpx.Client(timeout=30) as client:
            resp = client.post(
                _GITHUB_DEVICE_CODE_URL,
                headers=self._github_headers(),
                json={"client_id": _GITHUB_CLIENT_ID, "scope": "read:user"},
            )
            resp.raise_for_status()
            data = resp.json()

            device_code = data["device_code"]
            user_code = data["user_code"]
            verification_uri = data["verification_uri"]
            poll_interval = data.get("interval", poll_interval)

            print(  # noqa: T201
                "\n"
                "╔══════════════════════════════════════════════════╗\n"
                "║       🔑 GitHub Copilot Authentication          ║\n"
                "╠══════════════════════════════════════════════════╣\n"
                f"║  1. Open:  {verification_uri:<37s} ║\n"
                f"║  2. Enter: {user_code:<37s} ║\n"
                "╚══════════════════════════════════════════════════╝",
                flush=True,
            )

            for attempt in range(1, max_polls + 1):
                time.sleep(poll_interval)
                print(  # noqa: T201
                    f"   ⏳ Waiting for authentication… ({attempt}/{max_polls})",
                    flush=True,
                )
                poll_resp = client.post(
                    _GITHUB_ACCESS_TOKEN_URL,
                    headers=self._github_headers(),
                    json={
                        "client_id": _GITHUB_CLIENT_ID,
                        "device_code": device_code,
                        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    },
                )
                poll_resp.raise_for_status()
                poll_data = poll_resp.json()

                if "access_token" in poll_data:
                    token = poll_data["access_token"]
                    self._write_file(self._access_token_path, token)
                    print("   ✅ Authentication successful!\n", flush=True)  # noqa: T201
                    return token

                if poll_data.get("error") != "authorization_pending":
                    raise CopilotAuthError(
                        f"Device flow error: {poll_data.get('error_description', poll_data)}"
                    )

        raise CopilotAuthError("Timed out waiting for user authentication")

    # ------------------------------------------------------------------
    # API-key layer (short-lived JWT, ~30 min TTL)
    # ------------------------------------------------------------------

    def _read_cached_api_key(self) -> str | None:
        """Return cached API key if still valid, else None."""
        try:
            with open(self._api_key_path) as f:
                data = json.load(f)
                if data.get("expires_at", 0) > datetime.now().timestamp():
                    return data["token"]
        except (OSError, json.JSONDecodeError, KeyError):
            pass
        return None

    def _refresh_api_key(self, access_token: str) -> str:
        """Exchange access token for a short-lived Copilot API key."""
        headers = self._github_headers()
        headers["authorization"] = f"token {access_token}"

        with httpx.Client(timeout=30) as client:
            for attempt in range(3):
                try:
                    resp = client.get(_GITHUB_API_KEY_URL, headers=headers)
                    resp.raise_for_status()
                    data: dict[str, Any] = resp.json()

                    token = data.get("token")
                    if not token:
                        raise CopilotAuthError("API key response missing 'token'")

                    # Cache to disk
                    self._write_file(self._api_key_path, json.dumps(data))
                    return token
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code == 401:
                        # Access token may be revoked — clear it and re-auth
                        self._clear_access_token()
                        raise CopilotAuthError(
                            "Access token rejected (401). "
                            "Re-run to trigger device flow."
                        ) from exc
                    logger.warning("API key refresh attempt %d failed: %s", attempt + 1, exc)

        raise CopilotAuthError("Failed to refresh Copilot API key after 3 attempts")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _clear_access_token(self) -> None:
        try:
            os.remove(self._access_token_path)
        except OSError:
            pass

    @staticmethod
    def _github_headers() -> dict[str, str]:
        return {
            "accept": "application/json",
            "content-type": "application/json",
            "editor-version": "vscode/1.95.0",
            "editor-plugin-version": "copilot-chat/0.26.7",
            "user-agent": "GithubCopilotChat/0.26.7",
        }

    @staticmethod
    def _write_file(path: str, content: str) -> None:
        with open(path, "w") as f:
            f.write(content)


# Module-level singleton
_authenticator: CopilotAuthenticator | None = None


def get_copilot_authenticator() -> CopilotAuthenticator:
    global _authenticator
    if _authenticator is None:
        _authenticator = CopilotAuthenticator()
    return _authenticator
