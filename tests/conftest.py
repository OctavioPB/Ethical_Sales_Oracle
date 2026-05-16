"""
Shared pytest fixtures.
Adds service directories to sys.path so tests can import Python modules
without installing them as packages.
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).parent.parent

# Standard package services (valid Python identifiers)
sys.path.insert(0, str(_REPO_ROOT))               # enables: from services.shared import ...

# nlp-engine uses a hyphen — add directly to sys.path for flat imports
sys.path.insert(0, str(_REPO_ROOT / "services" / "nlp-engine"))
