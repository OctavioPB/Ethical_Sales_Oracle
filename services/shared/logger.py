"""Structured JSON logger. Never log raw transcripts or PII — only call_id + metadata."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from typing import Any


def _emit(level: str, service: str, message: str, **context: Any) -> None:
    entry: dict[str, Any] = {
        "level": level,
        "service": service,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **context,
    }
    sys.stdout.write(json.dumps(entry) + "\n")
    sys.stdout.flush()


class StructuredLogger:
    def __init__(self, service: str) -> None:
        self._service = service

    def info(self, message: str, **context: Any) -> None:
        _emit("info", self._service, message, **context)

    def warn(self, message: str, **context: Any) -> None:
        _emit("warn", self._service, message, **context)

    def error(self, message: str, **context: Any) -> None:
        _emit("error", self._service, message, **context)
