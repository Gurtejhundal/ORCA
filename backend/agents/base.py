import logging
from abc import ABC, abstractmethod
from backend.agents.schemas import AgentInput, AgentOutput

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for all specialized marine agents enforcing strict action allowlists."""

    name: str = 'base_agent'
    allowed_actions: list[str] = []

    def validate_action(self, action: str) -> None:
        if action not in self.allowed_actions:
            raise ValueError(
                f"Action '{action}' is not permitted for agent '{self.name}'. "
                f"Permitted actions: {self.allowed_actions}"
            )

    async def run(self, input_data: AgentInput) -> AgentOutput:
        try:
            self.validate_action(input_data.task.action)
            return await self.execute(input_data)
        except Exception as exc:
            logger.error(
                "agent_execution_failed agent=%s action=%s error=%s",
                self.name,
                input_data.task.action,
                exc,
                exc_info=True,
            )
            return AgentOutput(
                agent=self.name,
                status='failed',
                errors=[str(exc)],
                confidence=0.0,
            )

    @abstractmethod
    async def execute(self, input_data: AgentInput) -> AgentOutput:
        """Core execution logic implemented by specialized agents."""
        pass
