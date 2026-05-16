# Re-export shim — real definitions live in risk_types.py.
# types.py is kept for backwards compatibility; prefer importing from risk_types directly.
from risk_types import (  # noqa: F401
    DisclaimerRuleDefinition,
    DisclaimerRuleSet,
    MatchType,
    PhrasePattern,
    RiskCategory,
    RiskEvent,
    RuleDefinition,
    RuleFixtures,
    RuleSet,
    Severity,
    Speaker,
)
