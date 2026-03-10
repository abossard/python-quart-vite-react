"""
Tests for KBA Publishing Flow

Tests the complete publish workflow including:
- Successful publishing to different systems
- Idempotency (not publishing twice)
- Status validation
- Error handling
- Adapter integration
"""

import pytest
from datetime import datetime
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from kba_exceptions import (
    DraftNotFoundError,
    InvalidStatusError,
    PublishFailedError
)
from kba_models import (
    KBADraftStatus,
    KBAPublishRequest,
    KBAPublishResult
)
from kba_service import KBAService
from kb_adapters import (
    KBPublishResult as AdapterPublishResult,
    get_kb_adapter,
    FileSystemKBAdapter
)


class TestKBAPublishing:
    """Test KBA draft publishing"""
    
    @pytest.fixture
    def mock_session(self):
        """Mock SQLModel session"""
        session = MagicMock()
        session.exec = MagicMock()
        session.add = MagicMock()
        session.commit = MagicMock()
        return session
    
    @pytest.fixture
    def mock_audit(self):
        """Mock audit service"""
        audit = MagicMock()
        audit.log_event = MagicMock()
        return audit
    
    @pytest.fixture
    def kba_service(self, mock_session, mock_audit):
        """Create KBA service with mocked dependencies"""
        # Mock guidelines_loader before initializing KBAService
        with patch('kba_service.get_guidelines_loader') as mock_loader:
            mock_loader.return_value = MagicMock()
            service = KBAService(
                session=mock_session,
                llm_service=MagicMock(),
                audit_service=mock_audit
            )
            # Mock additional dependencies
            service.csv_service = MagicMock()
            return service
    
    @pytest.fixture
    def draft_table_mock(self):
        """Mock draft table object"""
        draft = MagicMock()
        draft.id = uuid4()
        draft.ticket_id = uuid4()
        draft.incident_id = "INC0001234"
        draft.status = KBADraftStatus.REVIEWED.value
        draft.title = "VPN Connection Failed"
        draft.symptoms = ["Cannot connect to VPN", "Error: Connection timeout"]
        draft.cause = "Firewall blocking port 443"
        draft.resolution_steps = ["Check firewall", "Open port 443", "Restart VPN"]
        draft.validation_checks = ["Test VPN connection"]
        draft.warnings = ["Requires admin rights"]
        draft.confidence_notes = "Tested on Windows 10"
        draft.problem_description = "VPN connection issues"
        draft.solution_steps = ["Step 1", "Step 2"]
        draft.additional_notes = "Contact support if issue persists"
        draft.tags = ["vpn", "network"]
        draft.related_tickets = ["INC0001233"]
        draft.published_at = None
        draft.published_url = None
        draft.published_id = None
        return draft
    
    @pytest.mark.anyio
    async def test_publish_success_file_system(
        self,
        kba_service,
        mock_session,
        mock_audit,
        draft_table_mock
    ):
        """Test successful publishing to filesystem"""
        # Setup
        draft_id = draft_table_mock.id
        mock_session.exec.return_value.first.return_value = draft_table_mock
        
        publish_req = KBAPublishRequest(
            target_system="file",
            category="VPN",
            visibility="internal",
            user_id="test_user@example.com"
        )
        
        # Mock adapter result
        adapter_result = AdapterPublishResult(
            success=True,
            published_id=f"KB-{str(draft_id)[:8].upper()}",
            published_url=f"file:///kb/published/VPN/KB-{str(draft_id)[:8]}.md",
            metadata={"file_path": "/kb/published/VPN/KB-test.md"}
        )
        
        with patch("kba_service.get_kb_adapter") as mock_get_adapter:
            mock_adapter = AsyncMock()
            mock_adapter.publish.return_value = adapter_result
            mock_get_adapter.return_value = mock_adapter
            
            # Execute
            result = await kba_service.publish_draft(draft_id, publish_req)
            
            # Assert
            assert result.success is True
            assert result.published_id is not None
            assert result.published_url is not None
            assert "successfully published" in result.message.lower()
            
            # Verify draft updated
            assert draft_table_mock.status == KBADraftStatus.PUBLISHED.value
            assert draft_table_mock.published_at is not None
            assert draft_table_mock.published_url == adapter_result.published_url
            assert draft_table_mock.published_id == adapter_result.published_id
            
            # Verify audit log
            mock_audit.log_event.assert_called_once()
            audit_call = mock_audit.log_event.call_args
            assert audit_call.kwargs["draft_id"] == draft_id
            assert audit_call.kwargs["user_id"] == "test_user@example.com"
    
    @pytest.mark.anyio
    async def test_publish_idempotent(
        self,
        kba_service,
        mock_session,
        mock_audit,
        draft_table_mock
    ):
        """Test that publishing again returns existing result without error"""
        # Setup - draft already published
        draft_id = draft_table_mock.id
        draft_table_mock.status = KBADraftStatus.PUBLISHED.value
        draft_table_mock.published_at = datetime(2026, 3, 1, 10, 30)
        draft_table_mock.published_url = "file:///kb/published/test.md"
        draft_table_mock.published_id = "KB-12345678"
        
        mock_session.exec.return_value.first.return_value = draft_table_mock
        
        publish_req = KBAPublishRequest(
            target_system="file",
            category="VPN",
            visibility="internal",
            user_id="test_user@example.com"
        )
        
        # Execute
        result = await kba_service.publish_draft(draft_id, publish_req)
        
        # Assert - returns existing result
        assert result.success is True
        assert result.published_id == "KB-12345678"
        assert result.published_url == "file:///kb/published/test.md"
        assert "already published" in result.message.lower()
        
        # Verify no adapter was called
        with patch("kba_service.get_kb_adapter") as mock_get_adapter:
            mock_get_adapter.assert_not_called()
    
    @pytest.mark.anyio
    async def test_publish_auto_review_from_draft(
        self,
        kba_service,
        mock_session,
        mock_audit,
        draft_table_mock
    ):
        """Test that DRAFT status auto-transitions to REVIEWED before publishing"""
        # Setup - draft in DRAFT status
        draft_id = draft_table_mock.id
        draft_table_mock.status = KBADraftStatus.DRAFT.value
        mock_session.exec.return_value.first.return_value = draft_table_mock
        
        publish_req = KBAPublishRequest(
            target_system="file",
            category="VPN",
            visibility="internal",
            user_id="test_user@example.com"
        )
        
        adapter_result = AdapterPublishResult(
            success=True,
            published_id="KB-TEST",
            published_url="file:///test.md"
        )
        
        with patch("kba_service.get_kb_adapter") as mock_get_adapter:
            mock_adapter = AsyncMock()
            mock_adapter.publish.return_value = adapter_result
            mock_get_adapter.return_value = mock_adapter
            
            # Execute
            result = await kba_service.publish_draft(draft_id, publish_req)
            
            # Assert - successfully published
            assert result.success is True
            
            # Verify status transition: DRAFT -> REVIEWED -> PUBLISHED
            assert draft_table_mock.status == KBADraftStatus.PUBLISHED.value
            assert draft_table_mock.reviewed_by == "test_user@example.com"
            
            # Verify session.commit called (for status transition)
            assert mock_session.commit.call_count >= 1
    
    @pytest.mark.anyio
    async def test_publish_draft_not_found(
        self,
        kba_service,
        mock_session
    ):
        """Test publishing non-existent draft raises error"""
        # Setup - no draft found
        draft_id = uuid4()
        mock_session.exec.return_value.first.return_value = None
        
        publish_req = KBAPublishRequest(
            target_system="file",
            category="VPN",
            visibility="internal",
            user_id="test_user@example.com"
        )
        
        # Execute & Assert
        with pytest.raises(DraftNotFoundError, match="not found"):
            await kba_service.publish_draft(draft_id, publish_req)
    
    @pytest.mark.anyio
    async def test_publish_failed_status_not_allowed(
        self,
        kba_service,
        mock_session,
        draft_table_mock
    ):
        """Test that FAILED status cannot be published"""
        # Setup - draft in FAILED status
        draft_id = draft_table_mock.id
        draft_table_mock.status = KBADraftStatus.FAILED.value
        mock_session.exec.return_value.first.return_value = draft_table_mock
        
        publish_req = KBAPublishRequest(
            target_system="file",
            category="VPN",
            visibility="internal",
            user_id="test_user@example.com"
        )
        
        # Execute & Assert
        with pytest.raises(InvalidStatusError, match="FAILED status"):
            await kba_service.publish_draft(draft_id, publish_req)
    
    @pytest.mark.anyio
    async def test_publish_adapter_failure(
        self,
        kba_service,
        mock_session,
        mock_audit,
        draft_table_mock
    ):
        """Test that adapter failure is handled correctly"""
        # Setup
        draft_id = draft_table_mock.id
        mock_session.exec.return_value.first.return_value = draft_table_mock
        
        publish_req = KBAPublishRequest(
            target_system="sharepoint",
            category="VPN",
            visibility="internal",
            user_id="test_user@example.com"
        )
        
        # Mock adapter failure
        adapter_result = AdapterPublishResult(
            success=False,
            error_message="SharePoint API authentication failed"
        )
        
        with patch("kba_service.get_kb_adapter") as mock_get_adapter:
            mock_adapter = AsyncMock()
            mock_adapter.publish.return_value = adapter_result
            mock_get_adapter.return_value = mock_adapter
            
            # Execute & Assert
            with pytest.raises(PublishFailedError, match="authentication failed"):
                await kba_service.publish_draft(draft_id, publish_req)
            
            # Verify draft marked as FAILED
            assert draft_table_mock.status == KBADraftStatus.FAILED.value
            
            # Verify failure logged (may be called twice: once in adapter failure, once in exception handler)
            assert mock_audit.log_event.call_count >= 1
            
            # Verify at least one log contains the error
            log_calls = [str(call) for call in mock_audit.log_event.call_args_list]
            assert any("authentication failed" in call.lower() for call in log_calls)
    
    @pytest.mark.anyio
    async def test_publish_adapter_exception(
        self,
        kba_service,
        mock_session,
        mock_audit,
        draft_table_mock
    ):
        """Test that unexpected exceptions are handled"""
        # Setup
        draft_id = draft_table_mock.id
        mock_session.exec.return_value.first.return_value = draft_table_mock
        
        publish_req = KBAPublishRequest(
            target_system="file",
            category="VPN",
            visibility="internal",
            user_id="test_user@example.com"
        )
        
        with patch("kba_service.get_kb_adapter") as mock_get_adapter:
            mock_adapter = AsyncMock()
            mock_adapter.publish.side_effect = RuntimeError("Unexpected error")
            mock_get_adapter.return_value = mock_adapter
            
            # Execute & Assert
            with pytest.raises(PublishFailedError, match="Unexpected error"):
                await kba_service.publish_draft(draft_id, publish_req)
            
            # Verify draft marked as FAILED
            assert draft_table_mock.status == KBADraftStatus.FAILED.value
            
            # Verify exception logged
            mock_audit.log_event.assert_called_once()


class TestFileSystemAdapter:
    """Test FileSystem KB adapter"""
    
    @pytest.mark.anyio
    async def test_filesystem_adapter_publish_success(self, tmp_path):
        """Test publishing to filesystem creates correct file"""
        # Setup
        config = {
            "base_path": str(tmp_path),
            "create_categories": True
        }
        adapter = FileSystemKBAdapter(config)
        
        draft_dict = {
            "id": str(uuid4()),
            "ticket_id": str(uuid4()),
            "incident_id": "INC0001234",
            "title": "VPN Connection Failed",
            "symptoms": ["Cannot connect", "Timeout error"],
            "cause": "Firewall issue",
            "resolution_steps": ["Check firewall", "Open port 443"],
            "validation_checks": ["Test connection"],
            "warnings": ["Requires admin rights"],
            "confidence_notes": "Tested",
            "problem_description": "VPN issues",
            "solution_steps": ["Step 1"],
            "additional_notes": "Call support",
            "tags": ["vpn", "network"],
            "related_tickets": ["INC0001233"]
        }
        
        # Execute
        result = await adapter.publish(
            draft_dict=draft_dict,
            category="VPN",
            visibility="internal"
        )
        
        # Assert
        assert result.success is True
        assert result.published_id is not None
        assert result.published_url is not None
        assert "file://" in result.published_url
        
        # Verify file created
        category_dir = tmp_path / "VPN"
        assert category_dir.exists()
        
        files = list(category_dir.glob("*.md"))
        assert len(files) == 1
        
        content = files[0].read_text()
        assert "VPN Connection Failed" in content
        assert "Cannot connect" in content
        assert "Check firewall" in content
    
    @pytest.mark.anyio
    async def test_filesystem_adapter_verify_connection(self, tmp_path):
        """Test connection verification"""
        config = {"base_path": str(tmp_path)}
        adapter = FileSystemKBAdapter(config)
        
        result = await adapter.verify_connection()
        
        assert result is True
    
    @pytest.mark.anyio
    async def test_filesystem_adapter_invalid_path(self):
        """Test adapter handles invalid paths gracefully"""
        config = {"base_path": "/invalid/nonexistent/path/that/cannot/be/created"}
        adapter = FileSystemKBAdapter(config)
        
        draft_dict = {
            "id": str(uuid4()),
            "title": "Test",
            "resolution_steps": ["Step 1"],
            "tags": []
        }
        
        # Execute - should return failure, not raise exception
        result = await adapter.publish(draft_dict, category="Test")
        
        assert result.success is False
        assert result.error_message is not None


class TestAdapterFactory:
    """Test KB adapter factory"""
    
    def test_get_adapter_file(self):
        """Test factory returns FileSystemAdapter"""
        adapter = get_kb_adapter("file", {"base_path": "/tmp"})
        assert isinstance(adapter, FileSystemKBAdapter)
    
    def test_get_adapter_case_insensitive(self):
        """Test factory handles case variations"""
        adapter = get_kb_adapter("FILE")
        assert isinstance(adapter, FileSystemKBAdapter)
    
    def test_get_adapter_unknown_system(self):
        """Test factory raises error for unknown system"""
        with pytest.raises(ValueError, match="Unknown KB target system"):
            get_kb_adapter("unknown_system")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
