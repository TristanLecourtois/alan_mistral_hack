#!/usr/bin/env python3
"""Fetch raw Thryve daily or epoch data for one user.

If --start-day/--end-day are omitted, defaults are 2026-03-11 and 2026-04-11.

Example:
  uv run python scripts/fetch_thryve_data.py \
    --end-user-id a463e0bf26d790d6afdfda0cfd161cf5 \
    --start-day 2026-04-01 \
    --end-day 2026-04-10 \
    --kind daily
"""

from __future__ import annotations

import argparse
import base64
import json
import os
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit


BASE_URL = "https://api-qa.thryve.de"
DEFAULT_START_DAY = "2026-03-11"
DEFAULT_END_DAY = "2026-04-11"
PROFILES = {
    "it_manager_withings": "a463e0bf26d790d6afdfda0cfd161cf5",
    "active_gym_whoop": "2bfaa7e6f9455ceafa0a59fd5b80496c",
    "student_samsung_oura_withings_huawei": "7f82fc3b0abba3a86b5e15c911fc5f6e",
    "cpo_withings": "65b1357f1ceb98f51de05d1cbeb81532",
    "work_from_home_apple": "1e2e53da12e0a9aebb3750af3c5857e1",
    "moderate_techie_samsung": "26158117728afa6083c58c958eed5d89",
    "active_tennis_garmin": "eb634efc4ac80c9ed6a355c8a99adb83",
    "senior_heart_withings": "79187771a36482f013203b32712e873d",
}


def load_dotenv(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip().strip("'\"")


def basic_header(username: str, password: str) -> str:
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {token}"


def auth_headers() -> dict[str, str]:
    authorization = os.getenv("THRYVE_AUTHORIZATION")
    app_authorization = os.getenv("THRYVE_APP_AUTHORIZATION")

    if not authorization and os.getenv("THRYVE_USERNAME") and os.getenv("THRYVE_PASSWORD"):
        authorization = basic_header(os.environ["THRYVE_USERNAME"], os.environ["THRYVE_PASSWORD"])
    if not app_authorization and os.getenv("THRYVE_AUTH_ID") and os.getenv("THRYVE_AUTH_SECRET"):
        app_authorization = basic_header(os.environ["THRYVE_AUTH_ID"], os.environ["THRYVE_AUTH_SECRET"])

    if not authorization or not app_authorization:
        raise SystemExit(
            "Missing Thryve credentials. Set THRYVE_AUTHORIZATION and THRYVE_APP_AUTHORIZATION, "
            "or THRYVE_USERNAME/THRYVE_PASSWORD and THRYVE_AUTH_ID/THRYVE_AUTH_SECRET."
        )

    return {"Authorization": authorization, "AppAuthorization": app_authorization}


def parse_day(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def utc_timestamp(day: date, end_of_day: bool = False) -> str:
    clock = time(23, 59, 59) if end_of_day else time.min
    return datetime.combine(day, clock, tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def day_chunks(start_day: date, end_day: date, max_days: int) -> list[tuple[date, date]]:
    chunks = []
    cursor = start_day
    while cursor <= end_day:
        chunk_end = min(cursor + timedelta(days=max_days - 1), end_day)
        chunks.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return chunks


def normalize_base_url(value: str) -> str:
    parsed = urlsplit(value.strip().rstrip("/"))
    if parsed.path in {"", "/v5", "/v5/accessToken", "/v5/dailyDynamicValues", "/v5/dynamicEpochValues"}:
        return urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
    return value.strip().rstrip("/")


def post(path: str, payload: dict[str, str], headers: dict[str, str], base_url: str) -> Any:
    try:
        import requests
    except ModuleNotFoundError as exc:
        raise SystemExit("Missing dependency: run `uv sync` or install `requests`.") from exc

    response = requests.post(
        f"{normalize_base_url(base_url)}{path}",
        headers={**headers, "Content-Type": "application/x-www-form-urlencoded"},
        data=payload,
        timeout=60,
    )
    if not response.ok:
        if response.status_code == 403 and "AuthenticationToken is invalid for given appID" in response.text:
            raise SystemExit(
                "403 Forbidden: this end-user-id does not belong to the Thryve app credentials being used. "
                "Check that .env has the hackathon credentials for this profile, or use an end-user-id created "
                "with the same THRYVE_AUTH_ID/THRYVE_AUTH_SECRET."
            )
        raise SystemExit(f"{response.status_code} {response.reason}: {response.text[:1000]}")
    return response.json()


def fetch_daily(args: argparse.Namespace, headers: dict[str, str]) -> Any:
    raw_chunks = []
    for start, end in day_chunks(parse_day(args.start_day), parse_day(args.end_day), max_days=365):
        raw_chunks.append(
            fetch_daily_range(
                args.authentication_token,
                start.isoformat(),
                end.isoformat(),
                headers,
                args.base_url,
            )
        )
    return raw_chunks[0] if len(raw_chunks) == 1 else raw_chunks


def fetch_daily_range(
    authentication_token: str,
    start_day: str,
    end_day: str,
    headers: dict[str, str],
    base_url: str,
) -> Any:
    return post(
        "/v5/dailyDynamicValues",
        {
            "authenticationToken": authentication_token,
            "startDay": start_day,
            "endDay": end_day,
            "detailed": "true",
            "displayTypeName": "true",
            "displayPartnerUserID": "true",
        },
        headers,
        base_url,
    )


def fetch_epoch(args: argparse.Namespace, headers: dict[str, str]) -> list[Any]:
    raw_chunks = []
    for start, end in day_chunks(parse_day(args.start_day), parse_day(args.end_day), max_days=30):
        raw_chunks.append(
            post(
                "/v5/dynamicEpochValues",
                {
                    "authenticationToken": args.authentication_token,
                    "startTimestamp": utc_timestamp(start),
                    "endTimestamp": utc_timestamp(end, end_of_day=True),
                    "detailed": "true",
                    "displayTypeName": "true",
                    "displayPartnerUserID": "true",
                },
                headers,
                args.base_url,
            )
        )
    return raw_chunks


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch raw Thryve JSON for one user.")
    parser.add_argument("--end-user-id", required=True)
    parser.add_argument("--start-day", default=DEFAULT_START_DAY, help=f"YYYY-MM-DD, default: {DEFAULT_START_DAY}")
    parser.add_argument("--end-day", default=DEFAULT_END_DAY, help=f"YYYY-MM-DD, default: {DEFAULT_END_DAY}")
    parser.add_argument("--kind", required=True, choices=["daily", "epoch"])
    parser.add_argument("--base-url", default=os.getenv("THRYVE_BASE_URL", BASE_URL))
    parser.add_argument("--output-dir", type=Path, default=Path("data/raw"))
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()
    args.authentication_token = PROFILES.get(args.end_user_id, args.end_user_id)
    headers = auth_headers()

    if parse_day(args.start_day) > parse_day(args.end_day):
        raise SystemExit("--start-day must be before or equal to --end-day")

    raw = fetch_daily(args, headers) if args.kind == "daily" else fetch_epoch(args, headers)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_path = args.output_dir / f"thryve_{args.kind}_{args.end_user_id}_{args.start_day}_{args.end_day}.json"
    output_path.write_text(json.dumps(raw, indent=2), encoding="utf-8")
    print(output_path)


if __name__ == "__main__":
    main()
