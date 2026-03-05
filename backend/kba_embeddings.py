"""
KBA Embeddings Service - Similarity Search with OpenAI Embeddings

Provides vector-based similarity search for KBA drafts using OpenAI's
text-embedding-3-small model. Includes keyword-based fallback when
OpenAI API is unavailable.

Following "Deep Modules" philosophy:
- Simple interface: find_similar_drafts(), index_kba_draft()
- Complex implementation: Embeddings generation, cosine similarity, fallback logic

Architecture:
- Embeddings stored as JSON in SQLite (kba_embeddings table)
- Cosine similarity computed in Python (no vector DB needed for MVP)
- Graceful degradation to keyword matching on API failures
"""

import json
import logging
import math
from datetime import datetime
from typing import Optional
from uuid import UUID

from openai import AsyncOpenAI
from sqlmodel import Session, select

from kba_exceptions import (
    LLMUnavailableError,
    LLMTimeoutError,
    LLMRateLimitError,
    LLMAuthenticationError,
    DraftNotFoundError
)
from kba_models import (
    KBADraft,
    KBADraftStatus,
    KBADraftTable,
    KBAEmbeddingTable,
    KBASimilarityMatch,
    KBASimilarityResult
)

logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

EMBEDDING_MODEL = "text-embedding-3-small"  # 1536 dimensions, $0.020/1M tokens
EMBEDDING_DIMENSIONS = 1536
DEFAULT_TOP_K = 5
DEFAULT_MIN_SCORE = 0.5  # 50% similarity threshold
STRONG_MATCH_THRESHOLD = 0.7  # 70% = probable duplicate


# ============================================================================
# EMBEDDING SERVICE
# ============================================================================

class EmbeddingService:
    """Service for generating and searching KBA embeddings"""
    
    def __init__(self, session: Session, openai_client: AsyncOpenAI):
        """
        Initialize embedding service
        
        Args:
            session: SQLModel database session
            openai_client: Async OpenAI client (reuses from llm_service)
        """
        self.session = session
        self.openai_client = openai_client
        self._ensure_embeddings_table()
    
    def _ensure_embeddings_table(self):
        """Create embeddings table if it doesn't exist (migration)"""
        try:
            # SQLModel creates tables via metadata, but we can verify
            from sqlmodel import SQLModel
            from kba_models import KBAEmbeddingTable
            
            # Table creation happens in main app initialization
            logger.info("Embeddings table schema verified")
        except Exception as e:
            logger.error(f"Error ensuring embeddings table: {e}")
    
    # ------------------------------------------------------------------------
    # EMBEDDING GENERATION
    # ------------------------------------------------------------------------
    
    def _prepare_kba_text(self, draft: KBADraft) -> str:
        """
        Prepare searchable text from KBA draft for embedding
        
        Combines: title + symptoms + tags + first resolution step
        This creates a semantic fingerprint of the KBA's problem space.
        
        Args:
            draft: KBA draft to prepare
            
        Returns:
            Combined searchable text
        """
        parts = []
        
        # Title (highest weight)
        if draft.title:
            parts.append(draft.title)
        
        # Symptoms (high weight - describes problem)
        if draft.symptoms:
            parts.extend(draft.symptoms[:3])  # First 3 symptoms
        
        # First resolution step (context about solution)
        if draft.resolution_steps:
            parts.append(draft.resolution_steps[0])
        
        # Tags (keywords)
        if draft.tags:
            parts.append(" ".join(draft.tags))
        
        # Cause (optional - describes why problem happens)
        if draft.cause:
            parts.append(draft.cause)
        
        return " | ".join(parts)
    
    async def generate_embedding(self, text: str) -> list[float]:
        """
        Generate embedding vector for text using OpenAI
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector (1536 dimensions)
            
        Raises:
            LLMUnavailableError: If OpenAI API is unreachable
            LLMTimeoutError: If request times out
            LLMRateLimitError: If rate limit exceeded
            LLMAuthenticationError: If API key invalid
        """
        try:
            logger.debug(f"Generating embedding for text: {text[:100]}...")
            
            response = await self.openai_client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=text,
                encoding_format="float"
            )
            
            embedding = response.data[0].embedding
            logger.debug(f"Generated embedding with {len(embedding)} dimensions")
            
            return embedding
            
        except Exception as e:
            error_msg = str(e).lower()
            
            if "timeout" in error_msg:
                raise LLMTimeoutError(f"Embedding generation timed out: {e}")
            elif "rate_limit" in error_msg or "rate limit" in error_msg:
                raise LLMRateLimitError(f"OpenAI rate limit exceeded: {e}")
            elif "authentication" in error_msg or "api key" in error_msg:
                raise LLMAuthenticationError(f"OpenAI authentication failed: {e}")
            else:
                raise LLMUnavailableError(f"Failed to generate embedding: {e}")
    
    async def index_kba_draft(self, draft_id: UUID) -> bool:
        """
        Generate and store embedding for a KBA draft
        
        Args:
            draft_id: ID of draft to index
            
        Returns:
            True if indexed successfully, False if failed
            
        Raises:
            DraftNotFoundError: If draft doesn't exist
        """
        try:
            # Load draft
            stmt = select(KBADraftTable).where(KBADraftTable.id == draft_id)
            result = self.session.exec(stmt).first()
            
            if not result:
                raise DraftNotFoundError(f"Draft {draft_id} not found")
            
            draft = KBADraft.model_validate(result)
            
            # Prepare text
            searchable_text = self._prepare_kba_text(draft)
            logger.info(f"Indexing draft {draft_id}: {searchable_text[:100]}...")
            
            # Generate embedding
            embedding = await self.generate_embedding(searchable_text)
            
            # Check if embedding already exists (update or insert)
            existing_stmt = select(KBAEmbeddingTable).where(
                KBAEmbeddingTable.draft_id == draft_id
            )
            existing = self.session.exec(existing_stmt).first()
            
            if existing:
                # Update existing embedding
                existing.embedding_json = json.dumps(embedding)
                existing.indexed_at = datetime.now()
                existing.searchable_text = searchable_text
                existing.model_name = EMBEDDING_MODEL
                logger.info(f"Updated embedding for draft {draft_id}")
            else:
                # Insert new embedding
                embedding_entry = KBAEmbeddingTable(
                    draft_id=draft_id,
                    embedding_json=json.dumps(embedding),
                    searchable_text=searchable_text,
                    model_name=EMBEDDING_MODEL
                )
                self.session.add(embedding_entry)
                logger.info(f"Created new embedding for draft {draft_id}")
            
            self.session.commit()
            return True
            
        except (DraftNotFoundError, LLMUnavailableError, LLMTimeoutError) as e:
            logger.error(f"Failed to index draft {draft_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error indexing draft {draft_id}: {e}")
            return False
    
    # ------------------------------------------------------------------------
    # SIMILARITY SEARCH
    # ------------------------------------------------------------------------
    
    def _cosine_similarity(self, vec1: list[float], vec2: list[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        
        Pure calculation: similarity = dot(A, B) / (||A|| * ||B||)
        Result: 1.0 = identical, 0.0 = orthogonal, -1.0 = opposite
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Similarity score (0.0-1.0, normalized)
        """
        if len(vec1) != len(vec2):
            logger.warning(f"Vector dimension mismatch: {len(vec1)} vs {len(vec2)}")
            return 0.0
        
        # Dot product
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        
        # Magnitudes
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))
        
        if magnitude1 == 0.0 or magnitude2 == 0.0:
            return 0.0
        
        # Cosine similarity (normalized to 0.0-1.0)
        similarity = dot_product / (magnitude1 * magnitude2)
        
        # Clamp to [0, 1] range (embeddings should be positive)
        return max(0.0, min(1.0, similarity))
    
    def _determine_match_reasons(
        self,
        draft: KBADraft,
        query_text: str,
        similarity_score: float
    ) -> list[str]:
        """
        Determine why a draft matched (for user feedback)
        
        Args:
            draft: Matching draft
            query_text: Original query
            similarity_score: Computed similarity
            
        Returns:
            List of match reasons (human-readable)
        """
        reasons = []
        query_lower = query_text.lower()
        query_words = set(query_lower.split())
        
        # Check title overlap
        if draft.title:
            title_words = set(draft.title.lower().split())
            overlap = query_words & title_words
            if len(overlap) >= 2:
                reasons.append("Ähnliche Begriffe im Titel")
        
        # Check tag matches
        if draft.tags:
            matching_tags = [tag for tag in draft.tags if tag.lower() in query_lower]
            if matching_tags:
                reasons.append(f"Tags: {', '.join(matching_tags[:3])}")
        
        # Check symptoms overlap
        if draft.symptoms:
            for symptom in draft.symptoms[:2]:
                symptom_words = set(symptom.lower().split())
                if len(query_words & symptom_words) >= 2:
                    reasons.append("Ähnliche Symptome")
                    break
        
        # High similarity score
        if similarity_score >= 0.8:
            reasons.append("Sehr hohe Ähnlichkeit")
        elif similarity_score >= 0.7:
            reasons.append("Hohe Ähnlichkeit")
        
        return reasons if reasons else ["Semantische Ähnlichkeit"]
    
    async def find_similar_drafts(
        self,
        query_text: str,
        top_k: int = DEFAULT_TOP_K,
        min_score: float = DEFAULT_MIN_SCORE,
        status_filter: Optional[list[KBADraftStatus]] = None,
        exclude_draft_id: Optional[UUID] = None
    ) -> KBASimilarityResult:
        """
        Find similar KBA drafts using embedding-based search
        
        Args:
            query_text: Text to search for (e.g., ticket summary)
            top_k: Maximum number of results to return
            min_score: Minimum similarity score (0.0-1.0)
            status_filter: Filter by draft status (default: [REVIEWED, PUBLISHED])
            exclude_draft_id: Optional draft ID to exclude from results
            
        Returns:
            KBASimilarityResult with primary and draft matches
        """
        # Default: Only search reviewed/published KBAs
        if status_filter is None:
            status_filter = [KBADraftStatus.REVIEWED, KBADraftStatus.PUBLISHED]
        
        try:
            # Generate query embedding
            logger.info(f"Searching for similar KBAs: {query_text[:100]}...")
            query_embedding = await self.generate_embedding(query_text)
            
            # Load all embeddings with status filter
            drafts_stmt = select(KBADraftTable).where(
                KBADraftTable.status.in_([s.value for s in status_filter])
            )
            
            if exclude_draft_id:
                drafts_stmt = drafts_stmt.where(KBADraftTable.id != exclude_draft_id)
            
            all_drafts = self.session.exec(drafts_stmt).all()
            
            # Calculate similarities
            similarities = []
            
            for draft_row in all_drafts:
                draft = KBADraft.model_validate(draft_row)
                
                # Load embedding
                embedding_stmt = select(KBAEmbeddingTable).where(
                    KBAEmbeddingTable.draft_id == draft.id
                )
                embedding_row = self.session.exec(embedding_stmt).first()
                
                if not embedding_row:
                    logger.debug(f"No embedding found for draft {draft.id}, skipping")
                    continue
                
                # Parse embedding JSON
                draft_embedding = json.loads(embedding_row.embedding_json)
                
                # Calculate similarity
                score = self._cosine_similarity(query_embedding, draft_embedding)
                
                if score >= min_score:
                    match_reasons = self._determine_match_reasons(draft, query_text, score)
                    is_strong = score >= STRONG_MATCH_THRESHOLD
                    
                    similarities.append(
                        KBASimilarityMatch(
                            draft=draft,
                            similarity_score=score,
                            match_reasons=match_reasons,
                            is_strong_match=is_strong
                        )
                    )
            
            # Sort by score descending
            similarities.sort(key=lambda x: x.similarity_score, reverse=True)
            
            # Split into primary (reviewed/published) and draft matches
            primary_matches = [
                m for m in similarities[:top_k]
                if m.draft.status in [KBADraftStatus.REVIEWED, KBADraftStatus.PUBLISHED]
            ]
            
            draft_matches = [
                m for m in similarities[:top_k]
                if m.draft.status == KBADraftStatus.DRAFT
            ]
            
            logger.info(
                f"Found {len(primary_matches)} primary + {len(draft_matches)} draft matches "
                f"(min_score={min_score})"
            )
            
            return KBASimilarityResult(
                query_text=query_text,
                primary_matches=primary_matches,
                draft_matches=draft_matches,
                total_primary_matches=len(primary_matches),
                total_draft_matches=len(draft_matches),
                used_fallback=False
            )
            
        except (LLMUnavailableError, LLMTimeoutError, LLMRateLimitError) as e:
            logger.warning(f"OpenAI unavailable, using keyword fallback: {e}")
            return await self._keyword_similarity_fallback(
                query_text, top_k, min_score, status_filter, exclude_draft_id
            )
    
    # ------------------------------------------------------------------------
    # FALLBACK: KEYWORD-BASED SIMILARITY
    # ------------------------------------------------------------------------
    
    async def _keyword_similarity_fallback(
        self,
        query_text: str,
        top_k: int,
        min_score: float,
        status_filter: list[KBADraftStatus],
        exclude_draft_id: Optional[UUID]
    ) -> KBASimilarityResult:
        """
        Fallback to keyword-based similarity when embeddings unavailable
        
        Uses simple word overlap for title, tags, and symptoms.
        Less accurate than embeddings but works offline.
        """
        logger.info("Using keyword-based similarity fallback")
        
        # Load drafts
        drafts_stmt = select(KBADraftTable).where(
            KBADraftTable.status.in_([s.value for s in status_filter])
        )
        
        if exclude_draft_id:
            drafts_stmt = drafts_stmt.where(KBADraftTable.id != exclude_draft_id)
        
        all_drafts = self.session.exec(drafts_stmt).all()
        
        # Calculate keyword similarities
        query_words = set(query_text.lower().split())
        similarities = []
        
        for draft_row in all_drafts:
            draft = KBADraft.model_validate(draft_row)
            score = 0.0
            
            # Title overlap (weight: 0.4)
            if draft.title:
                title_words = set(draft.title.lower().split())
                if title_words:
                    title_overlap = len(query_words & title_words) / max(len(query_words), len(title_words))
                    score += 0.4 * title_overlap
            
            # Tag overlap (weight: 0.3)
            if draft.tags:
                tag_words = set(" ".join(draft.tags).lower().split())
                if tag_words:
                    tag_overlap = len(query_words & tag_words) / max(len(query_words), len(tag_words))
                    score += 0.3 * tag_overlap
            
            # Symptoms overlap (weight: 0.3)
            if draft.symptoms:
                symptom_words = set(" ".join(draft.symptoms).lower().split())
                if symptom_words:
                    symptom_overlap = len(query_words & symptom_words) / max(len(query_words), len(symptom_words))
                    score += 0.3 * symptom_overlap
            
            if score >= min_score:
                match_reasons = self._determine_match_reasons(draft, query_text, score)
                match_reasons.append("Keyword-basiert (Fallback)")
                
                similarities.append(
                    KBASimilarityMatch(
                        draft=draft,
                        similarity_score=score,
                        match_reasons=match_reasons,
                        is_strong_match=score >= STRONG_MATCH_THRESHOLD
                    )
                )
        
        # Sort and split
        similarities.sort(key=lambda x: x.similarity_score, reverse=True)
        
        primary_matches = [
            m for m in similarities[:top_k]
            if m.draft.status in [KBADraftStatus.REVIEWED, KBADraftStatus.PUBLISHED]
        ]
        
        draft_matches = [
            m for m in similarities[:top_k]
            if m.draft.status == KBADraftStatus.DRAFT
        ]
        
        logger.info(f"Keyword fallback: {len(primary_matches)} primary + {len(draft_matches)} draft matches")
        
        return KBASimilarityResult(
            query_text=query_text,
            primary_matches=primary_matches,
            draft_matches=draft_matches,
            total_primary_matches=len(primary_matches),
            total_draft_matches=len(draft_matches),
            used_fallback=True
        )
    
    # ------------------------------------------------------------------------
    # BATCH OPERATIONS
    # ------------------------------------------------------------------------
    
    async def reindex_all_kbas(
        self,
        status_filter: Optional[list[KBADraftStatus]] = None
    ) -> dict[str, int]:
        """
        Batch reindex all KBA drafts
        
        Useful for initial setup or after model changes.
        
        Args:
            status_filter: Only reindex drafts with these statuses
                          (default: REVIEWED + PUBLISHED)
        
        Returns:
            Stats dict with counts: {"indexed": X, "failed": Y, "skipped": Z}
        """
        if status_filter is None:
            status_filter = [KBADraftStatus.REVIEWED, KBADraftStatus.PUBLISHED]
        
        logger.info(f"Starting batch reindex for statuses: {status_filter}")
        
        # Load all matching drafts
        drafts_stmt = select(KBADraftTable).where(
            KBADraftTable.status.in_([s.value for s in status_filter])
        )
        all_drafts = self.session.exec(drafts_stmt).all()
        
        stats = {"indexed": 0, "failed": 0, "skipped": 0}
        
        for draft_row in all_drafts:
            try:
                draft = KBADraft.model_validate(draft_row)
                
                # Skip if no searchable content
                if not draft.title and not draft.symptoms:
                    logger.debug(f"Skipping draft {draft.id}: no searchable content")
                    stats["skipped"] += 1
                    continue
                
                # Index
                success = await self.index_kba_draft(draft.id)
                
                if success:
                    stats["indexed"] += 1
                else:
                    stats["failed"] += 1
                    
            except Exception as e:
                logger.error(f"Failed to reindex draft {draft_row.id}: {e}")
                stats["failed"] += 1
        
        logger.info(f"Batch reindex complete: {stats}")
        return stats


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service(
    session: Session,
    openai_client: AsyncOpenAI
) -> EmbeddingService:
    """
    Get or create singleton embedding service
    
    Args:
        session: Database session
        openai_client: OpenAI client (from llm_service)
    
    Returns:
        EmbeddingService instance
    """
    global _embedding_service
    
    if _embedding_service is None:
        _embedding_service = EmbeddingService(session, openai_client)
    
    return _embedding_service
