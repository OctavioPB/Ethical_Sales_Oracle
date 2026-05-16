class DiarizationError(Exception):
    def __init__(self, message: str, call_id: str = "") -> None:
        super().__init__(message)
        self.call_id = call_id


class DiarizationModelNotFoundError(DiarizationError):
    """Raised when the pyannote model cannot be loaded (missing HF token, no internet)."""
