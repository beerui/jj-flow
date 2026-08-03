#!/usr/bin/env python3
"""Extract task requirements and delivery claims from a local Codex session."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Iterable


THREAD_ID_PATTERN = re.compile(r"^[0-9a-fA-F-]{36}$")


def parse_args() -> argparse.Namespace:
    default_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
    parser = argparse.ArgumentParser()
    parser.add_argument("--thread-id", required=True)
    parser.add_argument("--codex-home", type=Path, default=default_home)
    parser.add_argument("--max-message-chars", type=int, default=6000)
    args = parser.parse_args()
    if not THREAD_ID_PATTERN.fullmatch(args.thread_id):
        parser.error(f"invalid Codex thread ID: {args.thread_id}")
    if not 500 <= args.max_message_chars <= 20000:
        parser.error("--max-message-chars must be between 500 and 20000")
    return args


def find_session_files(codex_home: Path, thread_id: str) -> list[Path]:
    roots = [codex_home / "sessions", codex_home / "archived_sessions"]
    files = {
        path.resolve()
        for root in roots
        if root.is_dir()
        for path in root.rglob(f"*{thread_id}*.jsonl")
        if path.is_file()
    }
    if not files:
        raise RuntimeError(f"no local session JSONL found for thread: {thread_id}")
    return sorted(files)


def read_records(files: Iterable[Path]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for path in files:
        with path.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as error:
                    raise RuntimeError(
                        f"invalid JSONL at {path}:{line_number}: {error.msg}"
                    ) from error
                records.append(record)
    return records


def message_text(payload: dict[str, Any]) -> str:
    parts = [
        item.get("text", "")
        for item in payload.get("content", [])
        if isinstance(item, dict) and item.get("text")
    ]
    return "\n".join(parts).strip()


def is_task_user_message(text: str) -> bool:
    trimmed = text.lstrip()
    if not trimmed:
        return False
    return not trimmed.startswith(
        ("# AGENTS.md instructions", "<environment_context>", "<turn_aborted>")
    )


def unique_messages(
    records: Iterable[dict[str, Any]], role: str, phase: str | None = None
) -> list[tuple[str, str]]:
    messages: list[tuple[str, str]] = []
    seen: set[str] = set()
    for record in sorted(records, key=lambda item: item.get("timestamp", "")):
        if record.get("type") != "response_item":
            continue
        payload = record.get("payload", {})
        if payload.get("type") != "message" or payload.get("role") != role:
            continue
        if phase is not None and payload.get("phase") != phase:
            continue
        text = message_text(payload)
        if role == "user" and not is_task_user_message(text):
            continue
        if not text or text in seen:
            continue
        seen.add(text)
        messages.append((record.get("timestamp", ""), text))
    return messages


def limited(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}\n[truncated]"


def print_indented(text: str) -> None:
    for line in text.splitlines() or [""]:
        print(f"    {line}")


def main() -> int:
    args = parse_args()
    files = find_session_files(args.codex_home, args.thread_id)
    records = read_records(files)

    session_ids = {
        record.get("payload", {}).get("id")
        for record in records
        if record.get("type") == "session_meta"
        and record.get("payload", {}).get("id")
    }
    if session_ids and args.thread_id not in session_ids:
        raise RuntimeError(
            f"session filename matched but metadata did not contain: {args.thread_id}"
        )

    workdirs = sorted(
        {
            record.get("payload", {}).get("cwd")
            for record in records
            if record.get("type") in {"session_meta", "turn_context"}
            and record.get("payload", {}).get("cwd")
        }
    )
    user_messages = unique_messages(records, role="user")
    final_messages = unique_messages(
        records, role="assistant", phase="final_answer"
    )

    print("# Codex session evidence\n")
    print(f"- Thread: `{args.thread_id}`")
    for path in files:
        print(f"- Session file: `{path}`")
    for cwd in workdirs:
        print(f"- Working directory: `{cwd}`")

    print("\n## User requirement sequence\n")
    if not user_messages:
        print("- No task-level user messages found.")
    for index, (timestamp, text) in enumerate(user_messages, start=1):
        print(f"### U{index} {timestamp}\n")
        print_indented(limited(text, args.max_message_chars))
        print()

    print("## Assistant delivery claims\n")
    if not final_messages:
        print("- No final-answer messages found.")
    for index, (timestamp, text) in enumerate(final_messages, start=1):
        print(f"### A{index} {timestamp}\n")
        print_indented(limited(text, args.max_message_chars))
        print()

    print("## Interpretation rules\n")
    print(
        "- Treat the latest explicit user correction as stronger than earlier requirements."
    )
    print(
        "- Treat assistant delivery text as a locator, not proof; verify commits, diffs, and current code."
    )
    print(
        "- Combine this evidence with the current user request before building the migration ledger."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
