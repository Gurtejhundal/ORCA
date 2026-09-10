import logging
import re
from datetime import datetime, timezone
from typing import Any
from backend.conversation.context import ConversationContext, CandidatePFZ, LocationState
from backend.database.repository import Repository

logger = logging.getLogger(__name__)


class ConversationMemory:
    """Manages multi-turn conversation sessions with persistent DB storage and in-memory cache."""

    def __init__(self, repository: Repository | None = None):
        self.repo = repository
        self._in_memory: dict[str, ConversationContext] = {}

    async def get_context(self, session_id: str) -> ConversationContext:
        """Load context for session_id from memory or database."""
        if session_id in self._in_memory:
            return self._in_memory[session_id]

        if self.repo:
            try:
                row = await self.repo.get_session(session_id)
                if row:
                    ctx_data = row.get('context') or {}
                    candidates = [
                        CandidatePFZ.model_validate(c)
                        for c in ctx_data.get('pfz_candidates', [])
                    ]
                    selected_pfz = (
                        CandidatePFZ.model_validate(ctx_data['selected_pfz'])
                        if ctx_data.get('selected_pfz')
                        else None
                    )
                    current_loc = (
                        LocationState.model_validate(row['selected_location'])
                        if row.get('selected_location')
                        else None
                    )

                    context = ConversationContext(
                        session_id=session_id,
                        language=row.get('language') or 'en',
                        last_intent=ctx_data.get('last_intent'),
                        current_location=current_loc,
                        selected_pfz=selected_pfz,
                        pfz_candidates=candidates,
                        requested_time=ctx_data.get('requested_time'),
                        turn_count=ctx_data.get('turn_count', 0),
                        metadata=ctx_data.get('metadata', {}),
                    )
                    self._in_memory[session_id] = context
                    return context
            except Exception as exc:
                logger.warning("failed_to_load_session_from_db: %s", exc)

        # Default new context
        new_ctx = ConversationContext(session_id=session_id)
        self._in_memory[session_id] = new_ctx
        return new_ctx

    async def save_context(self, context: ConversationContext) -> None:
        """Save updated context to in-memory cache and database."""
        context.turn_count += 1
        context.updated_at = datetime.now(timezone.utc)
        self._in_memory[context.session_id] = context

        if self.repo:
            try:
                selected_loc = (
                    context.current_location.model_dump()
                    if context.current_location
                    else None
                )
                selected_pfz_id = (
                    context.selected_pfz.id if context.selected_pfz else None
                )
                ctx_payload = {
                    'last_intent': context.last_intent,
                    'selected_pfz': (
                        context.selected_pfz.model_dump()
                        if context.selected_pfz
                        else None
                    ),
                    'pfz_candidates': [
                        c.model_dump() for c in context.pfz_candidates
                    ],
                    'requested_time': context.requested_time,
                    'turn_count': context.turn_count,
                    'metadata': context.metadata,
                }
                await self.repo.save_session(
                    session_id=context.session_id,
                    language=context.language,
                    selected_location=selected_loc,
                    selected_pfz=selected_pfz_id,
                    context=ctx_payload,
                )
            except Exception as exc:
                logger.warning("failed_to_save_session_to_db: %s", exc)

    def resolve_candidate_reference(
        self, query: str, context: ConversationContext
    ) -> CandidatePFZ | None:
        """Resolve anaphoric ordinal references like 'second one', 'पहला वाला', 'zone 2'."""
        if not context.pfz_candidates:
            return None

        query_lower = query.lower()
        ordinals = [
            (1, ['first', '1st', 'पहला', 'pehla', '1']),
            (2, ['second', '2nd', 'दूसरा', 'dusra', '2']),
            (3, ['third', '3rd', 'तीसरा', 'tisra', '3']),
            (4, ['fourth', '4th', 'चौथा', 'chautha', '4']),
        ]

        for idx, keywords in ordinals:
            for kw in keywords:
                if re.search(r'\b' + re.escape(kw) + r'\b', query_lower):
                    if idx - 1 < len(context.pfz_candidates):
                        return context.pfz_candidates[idx - 1]

        return None
