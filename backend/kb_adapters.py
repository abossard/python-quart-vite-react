"""
Knowledge Base Adapters

Adapter pattern for publishing KBA drafts to different KB systems.
Each adapter handles system-specific publishing logic (authentication, API calls, formatting).

Following "Deep Modules" philosophy:
- Simple interface: KBAdapter.publish(draft_dict) → PublishResult
- Complex implementation: System-specific auth, API, error handling

Supported systems:
- FileSystem: Simple markdown files (MVP, no auth needed)
- SharePoint: Microsoft SharePoint Online (requires M365 auth)
- ITSM: ServiceNow KB API (requires ITSM credentials)
- Confluence: Atlassian Confluence (requires API token)

Usage:
    adapter = get_kb_adapter("file", base_path="/kb/published")
    result = await adapter.publish(draft_dict)
"""

import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


# ============================================================================
# BASE ADAPTER (INTERFACE)
# ============================================================================

class KBPublishResult:
    """Result from KB publishing operation"""
    def __init__(
        self,
        success: bool,
        published_id: Optional[str] = None,
        published_url: Optional[str] = None,
        error_message: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None
    ):
        self.success = success
        self.published_id = published_id
        self.published_url = published_url
        self.error_message = error_message
        self.metadata = metadata or {}


class BaseKBAdapter(ABC):
    """Abstract base adapter for Knowledge Base publishing"""
    
    def __init__(self, config: dict[str, Any]):
        """
        Initialize adapter with configuration
        
        Args:
            config: System-specific configuration (credentials, URLs, etc.)
        """
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    async def publish(
        self,
        draft_dict: dict[str, Any],
        category: Optional[str] = None,
        visibility: str = "internal"
    ) -> KBPublishResult:
        """
        Publish KBA draft to target system
        
        Args:
            draft_dict: Complete draft data (title, symptoms, resolution_steps, etc.)
            category: KB category/folder (system-specific)
            visibility: Access level (internal/public/restricted)
            
        Returns:
            KBPublishResult with success status, ID, URL
            
        Raises:
            PublishFailedError: If publishing fails
        """
        pass
    
    @abstractmethod
    async def verify_connection(self) -> bool:
        """
        Verify adapter can connect to target system
        
        Returns:
            True if connection successful
        """
        pass


# ============================================================================
# FILE SYSTEM ADAPTER (MVP)
# ============================================================================

class FileSystemKBAdapter(BaseKBAdapter):
    """
    Publish KBAs as Markdown files to local/network filesystem
    
    MVP implementation - no authentication needed, direct file I/O.
    Suitable for:
    - Development/testing
    - Simple file-based KB systems
    - Network shares (SMB/NFS)
    
    Config:
        base_path: Root directory for KB files
        create_categories: Whether to create category subdirectories
    """
    
    async def publish(
        self,
        draft_dict: dict[str, Any],
        category: Optional[str] = None,
        visibility: str = "internal"
    ) -> KBPublishResult:
        """Publish draft as Markdown file"""
        try:
            base_path = Path(self.config.get("base_path", "./kb_published"))
            base_path.mkdir(parents=True, exist_ok=True)
            
            # Create category subdirectory if needed
            if category and self.config.get("create_categories", True):
                kb_path = base_path / category
                kb_path.mkdir(parents=True, exist_ok=True)
            else:
                kb_path = base_path
            
            # Generate filename from draft ID and title
            draft_id = draft_dict["id"]
            title_slug = self._slugify(draft_dict["title"])
            filename = f"KB-{str(draft_id)[:8].upper()}-{title_slug}.md"
            file_path = kb_path / filename
            
            # Generate Markdown content
            content = self._generate_markdown(draft_dict, visibility)
            
            # Write file
            file_path.write_text(content, encoding="utf-8")
            
            published_id = f"KB-{str(draft_id)[:8].upper()}"
            published_url = f"file://{file_path.absolute()}"
            
            self.logger.info(f"Published KBA to filesystem: {file_path}")
            
            return KBPublishResult(
                success=True,
                published_id=published_id,
                published_url=published_url,
                metadata={
                    "file_path": str(file_path),
                    "category": category,
                    "visibility": visibility
                }
            )
            
        except Exception as e:
            self.logger.error(f"Failed to publish to filesystem: {e}")
            return KBPublishResult(
                success=False,
                error_message=f"Filesystem publish failed: {str(e)}"
            )
    
    async def verify_connection(self) -> bool:
        """Verify filesystem path is writable"""
        try:
            base_path = Path(self.config.get("base_path", "./kb_published"))
            base_path.mkdir(parents=True, exist_ok=True)
            test_file = base_path / ".write_test"
            test_file.write_text("test", encoding="utf-8")
            test_file.unlink()
            return True
        except Exception as e:
            self.logger.error(f"Filesystem not writable: {e}")
            return False
    
    def _slugify(self, text: str) -> str:
        """Convert title to filesystem-safe slug"""
        import re
        slug = text.lower()
        slug = re.sub(r'[^\w\s-]', '', slug)
        slug = re.sub(r'[-\s]+', '-', slug)
        return slug[:50]
    
    def _generate_markdown(self, draft: dict[str, Any], visibility: str) -> str:
        """Generate Markdown content from draft"""
        lines = [
            f"# {draft['title']}",
            "",
            "---",
            f"**KB-ID:** KB-{str(draft['id'])[:8].upper()}",
            f"**Ticket:** {draft.get('incident_id', draft['ticket_id'])}",
            f"**Published:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            f"**Visibility:** {visibility}",
            f"**Tags:** {', '.join(draft.get('tags', []))}",
            "---",
            ""
        ]
        
        # Search Questions (after header, before symptoms)
        if draft.get("search_questions"):
            lines.extend([
                "## Häufige Suchanfragen",
                "",
                "*Benutzer suchen häufig nach:*",
                ""
            ])
            for question in draft["search_questions"]:
                lines.append(f"- {question}")
            lines.extend(["", "---", ""])
        
        # Symptoms
        if draft.get("symptoms"):
            lines.extend([
                "## Symptome / Fehlerbild",
                ""
            ])
            for symptom in draft["symptoms"]:
                lines.append(f"- {symptom}")
            lines.append("")
        
        # Cause
        if draft.get("cause"):
            lines.extend([
                "## Ursache",
                "",
                draft["cause"],
                ""
            ])
        
        # Resolution Steps
        lines.extend([
            "## Lösung",
            ""
        ])
        for i, step in enumerate(draft["resolution_steps"], 1):
            lines.append(f"{i}. {step}")
        lines.append("")
        
        # Validation
        if draft.get("validation_checks"):
            lines.extend([
                "## Validierung",
                ""
            ])
            for check in draft["validation_checks"]:
                lines.append(f"- {check}")
            lines.append("")
        
        # Warnings
        if draft.get("warnings"):
            lines.extend([
                "## ⚠️ Wichtige Hinweise",
                ""
            ])
            for warning in draft["warnings"]:
                lines.append(f"- {warning}")
            lines.append("")
        
        # Additional Notes
        if draft.get("additional_notes"):
            lines.extend([
                "## Zusätzliche Informationen",
                "",
                draft["additional_notes"],
                ""
            ])
        
        # Related Tickets
        if draft.get("related_tickets"):
            lines.extend([
                "## Verwandte Tickets",
                ""
            ])
            for ticket in draft["related_tickets"]:
                lines.append(f"- {ticket}")
            lines.append("")
        
        return "\n".join(lines)


# ============================================================================
# STUB ADAPTERS (FOR FUTURE IMPLEMENTATION)
# ============================================================================

class SharePointKBAdapter(BaseKBAdapter):
    """Publish to Microsoft SharePoint Online (stub)"""
    
    async def publish(
        self,
        draft_dict: dict[str, Any],
        category: Optional[str] = None,
        visibility: str = "internal"
    ) -> KBPublishResult:
        """Stub implementation"""
        self.logger.warning("SharePoint adapter not yet implemented")
        return KBPublishResult(
            success=False,
            error_message="SharePoint publishing not yet implemented. Use 'file' adapter for MVP."
        )
    
    async def verify_connection(self) -> bool:
        return False


class ITSMKBAdapter(BaseKBAdapter):
    """Publish to ITSM (ServiceNow) Knowledge Base (stub)"""
    
    async def publish(
        self,
        draft_dict: dict[str, Any],
        category: Optional[str] = None,
        visibility: str = "internal"
    ) -> KBPublishResult:
        """Stub implementation"""
        self.logger.warning("ITSM adapter not yet implemented")
        return KBPublishResult(
            success=False,
            error_message="ITSM publishing not yet implemented. Use 'file' adapter for MVP."
        )
    
    async def verify_connection(self) -> bool:
        return False


class ConfluenceKBAdapter(BaseKBAdapter):
    """Publish to Atlassian Confluence (stub)"""
    
    async def publish(
        self,
        draft_dict: dict[str, Any],
        category: Optional[str] = None,
        visibility: str = "internal"
    ) -> KBPublishResult:
        """Stub implementation"""
        self.logger.warning("Confluence adapter not yet implemented")
        return KBPublishResult(
            success=False,
            error_message="Confluence publishing not yet implemented. Use 'file' adapter for MVP."
        )
    
    async def verify_connection(self) -> bool:
        return False


# ============================================================================
# ADAPTER FACTORY
# ============================================================================

def get_kb_adapter(
    target_system: str,
    config: Optional[dict[str, Any]] = None
) -> BaseKBAdapter:
    """
    Factory function to get appropriate KB adapter
    
    Args:
        target_system: One of: file, sharepoint, itsm, confluence
        config: System-specific configuration
        
    Returns:
        Configured adapter instance
        
    Raises:
        ValueError: If target_system is unknown
    """
    if config is None:
        config = {}
    
    adapters = {
        "file": FileSystemKBAdapter,
        "sharepoint": SharePointKBAdapter,
        "itsm": ITSMKBAdapter,
        "confluence": ConfluenceKBAdapter,
    }
    
    adapter_class = adapters.get(target_system.lower())
    if not adapter_class:
        raise ValueError(
            f"Unknown KB target system: {target_system}. "
            f"Supported: {', '.join(adapters.keys())}"
        )
    
    return adapter_class(config)
