class SourceUnavailable(Exception):
    def __init__(self, source: str, reason: str):
        self.source, self.reason = source, reason
        super().__init__(f'{source}: {reason}')
