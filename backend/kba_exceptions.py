"""
KBA Drafter Custom Exceptions

Clear exception hierarchy for error handling in KBA generation and publishing.

Exception hierarchy:
    KBAError (base)
    ├── TicketNotFoundError
    ├── LLMUnavailableError (from llm_service)
    ├── LLMTimeoutError (from llm_service)
    ├── LLMRateLimitError (from llm_service)
    ├── LLMAuthenticationError (from llm_service)
    ├── InvalidLLMOutputError
    ├── PublishFailedError
    └── InvalidStatusError
"""


class KBAError(Exception):
    """Base exception for KBA Drafter errors"""
    pass


class TicketNotFoundError(KBAError):
    """Ticket with given ID does not exist"""
    pass


# LLM Service Exceptions
class LLMUnavailableError(KBAError):
    """LLM service is not reachable"""
    pass


class LLMTimeoutError(KBAError):
    """LLM request timed out"""
    pass


class LLMRateLimitError(KBAError):
    """LLM rate limit exceeded"""
    pass


class LLMAuthenticationError(KBAError):
    """LLM authentication failed (invalid API key)"""
    pass


class InvalidLLMOutputError(KBAError):
    """LLM output could not be parsed or validated"""
    pass


class PublishFailedError(KBAError):
    """Publishing KBA to target system failed"""
    pass


class InvalidStatusError(KBAError):
    """Operation not allowed in current draft status"""
    pass


class DraftNotFoundError(KBAError):
    """KBA draft with given ID does not exist"""
    pass


class DuplicateKBADraftError(KBAError):
    """KBA draft(s) already exist for this ticket"""
    def __init__(self, message: str, existing_drafts: list[dict]):
        super().__init__(message)
        self.existing_drafts = existing_drafts
