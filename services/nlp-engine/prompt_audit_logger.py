"""
Prompt audit logger.

Writes a hashed record of every LLM API call to the llm_prompt_audits table.
Only hashes are stored — never the prompt text, response text, or transcript content.

Regulatory rationale: MiFID II and FCA SUP 10C require firms to retain records of
automated decision-support tools. Storing the hash lets compliance prove which prompt
version and model were used for a given score without retaining regulated data.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Generator

import psycopg2

from risk_types import LLMScoreResult


class PromptAuditLogger:
    """
    Append-only audit trail for LLM scoring calls.
    One row per scored call — never updates or deletes.
    """

    def __init__(self, database_url: str) -> None:
        self._db_url = database_url

    def log(self, call_id: str, result: LLMScoreResult) -> None:
        """
        Persists prompt and response hashes for a scored call.
        Raises psycopg2.Error on DB failure — caller should catch and alert.
        """
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO llm_prompt_audits
                        (call_id, prompt_hash, response_hash, prompt_version,
                         model, score, latency_ms, rationale_text)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        call_id,
                        result.prompt_hash,
                        result.response_hash,
                        result.prompt_version,
                        result.model,
                        result.score,
                        result.latency_ms,
                        result.rationale,
                    ),
                )

    @contextmanager
    def _conn(self) -> Generator[Any, None, None]:
        conn = psycopg2.connect(self._db_url)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
