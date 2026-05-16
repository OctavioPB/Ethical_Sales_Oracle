class STTError(Exception):
    def __init__(self, message: str, provider: str, call_id: str = "") -> None:
        super().__init__(message)
        self.provider = provider
        self.call_id = call_id


class STTTimeoutError(STTError):
    pass


class STTUnsupportedFormatError(STTError):
    pass
