"""
Tests for Guidelines Loader Service

Tests loading of system and category-specific guidelines,
frontmatter parsing, and category detection from tickets.
"""

import pytest
from pathlib import Path
from unittest.mock import Mock

from guidelines_loader import GuidelinesLoader
from tickets import Ticket


@pytest.fixture
def loader():
    """Create GuidelinesLoader instance for testing"""
    # Test is run from backend/, guidelines are in ../docs/kba_guidelines
    return GuidelinesLoader(guidelines_dir="../docs/kba_guidelines")


@pytest.fixture
def sample_ticket():
    """Create sample ticket for testing category detection"""
    from datetime import datetime
    
    return Ticket(
        id="550e8400-e29b-41d4-a716-446655440000",
        incident_id="INC0001234",
        summary="VPN connection timeout on Windows 11",
        description="User reports VPN connection timeout",
        status="assigned",
        priority="high",
        requester_name="John Doe",
        requester_email="john.doe@example.com",
        operational_categorization_tier_1="Network Access",
        operational_categorization_tier_2="VPN",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


class TestGuidelinesLoader:
    """Test GuidelinesLoader class"""
    
    def test_loader_initialization(self, loader):
        """Test that loader initializes correctly"""
        assert loader.guidelines_dir.exists()
        assert loader.system_dir.exists()
        assert loader.categories_dir.exists()
    
    def test_loader_with_invalid_directory(self):
        """Test loader with non-existent directory"""
        with pytest.raises(FileNotFoundError):
            GuidelinesLoader(guidelines_dir="invalid/path")
    
    def test_load_system_guidelines(self, loader):
        """Test loading all system guidelines"""
        system_content = loader.load_system_guidelines()
        
        assert system_content is not None
        assert len(system_content) > 0
        assert "System Role" in system_content or "system_role" in system_content
        
        # Should contain content from multiple files
        assert "=" * 80 in system_content  # Separator between files
    
    def test_load_system_guidelines_ordered(self, loader):
        """Test that system guidelines are loaded in alphabetical order"""
        system_content = loader.load_system_guidelines()
        
        # System role (00_) should appear before structure (10_)
        role_pos = system_content.find("System Role")
        structure_pos = system_content.find("Structure")
        
        if role_pos > 0 and structure_pos > 0:
            assert role_pos < structure_pos, "Guidelines should be loaded in order"
    
    def test_load_category_guideline(self, loader):
        """Test loading a specific category guideline"""
        vpn_content = loader.load_guideline("VPN", subdir="categories")
        
        assert vpn_content is not None
        assert len(vpn_content) > 0
        assert "VPN" in vpn_content.upper()
    
    def test_load_nonexistent_guideline(self, loader):
        """Test loading non-existent guideline returns None"""
        content = loader.load_guideline("NONEXISTENT", subdir="categories")
        assert content is None
    
    def test_list_available_categories(self, loader):
        """Test listing available category guidelines"""
        categories = loader.list_available(subdir="categories")
        
        assert isinstance(categories, list)
        assert len(categories) > 0
        
        # Should include standard categories
        expected = ["GENERAL", "VPN", "PASSWORD_RESET", "NETWORK"]
        for category in expected:
            assert category in categories
    
    def test_list_available_system(self, loader):
        """Test listing available system guidelines"""
        system_files = loader.list_available(subdir="system")
        
        assert isinstance(system_files, list)
        assert len(system_files) >= 5  # Should have at least 5 system guidelines
    
    def test_parse_frontmatter(self, loader):
        """Test YAML frontmatter parsing"""
        content_with_frontmatter = """---
title: Test Guideline
version: 1.0.0
enabled: true
priority: 10
---

# Test Content

This is a test.
"""
        
        frontmatter, content = loader._parse_frontmatter(content_with_frontmatter)
        
        assert frontmatter["title"] == "Test Guideline"
        assert frontmatter["version"] == "1.0.0"
        assert frontmatter["enabled"] is True
        assert frontmatter["priority"] == 10
        assert "Test Content" in content
        assert "---" not in content  # Frontmatter should be removed
    
    def test_parse_frontmatter_disabled(self, loader):
        """Test that disabled guidelines are skipped"""
        # Create a temporary disabled guideline
        test_file = loader.categories_dir / "TEST_DISABLED.md"
        
        try:
            test_file.write_text("""---
enabled: false
---

# This should not be loaded
""")
            
            content = loader.load_guideline("TEST_DISABLED", subdir="categories")
            assert content is None  # Should return None for disabled guidelines
        
        finally:
            if test_file.exists():
                test_file.unlink()
    
    def test_detect_categories_from_ticket(self, loader, sample_ticket):
        """Test category detection from ticket categorization"""
        categories = loader.detect_categories_from_ticket(sample_ticket)
        
        assert isinstance(categories, list)
        assert "GENERAL" in categories  # Always included
        assert "VPN" in categories  # Based on tier2
    
    def test_detect_categories_from_summary(self, loader):
        """Test category detection from ticket summary"""
        from datetime import datetime
        from uuid import uuid4
        
        ticket = Ticket(
            id=str(uuid4()),
            incident_id="INC0001235",
            summary="Cannot access WiFi network",
            description="WiFi network not accessible",
            status="new",
            priority="medium",
            requester_name="Jane Doe",
            requester_email="jane.doe@example.com",
            operational_categorization_tier_1=None,
            operational_categorization_tier_2=None,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        
        categories = loader.detect_categories_from_ticket(ticket)
        
        assert "GENERAL" in categories
        assert "NETWORK" in categories  # Detected from "network" in summary
    
    def test_get_combined_guidelines(self, loader):
        """Test combining multiple guidelines"""
        categories = ["GENERAL", "VPN"]
        combined = loader.get_combined(categories, subdir="categories")
        
        assert combined is not None
        assert len(combined) > 0
        assert "GENERAL" in combined
        assert "VPN" in combined
        assert "=" * 80 in combined  # Separator
    
    def test_get_guidelines_for_ticket(self, loader, sample_ticket):
        """Test getting guidelines for a specific ticket"""
        guidelines = loader.get_guidelines_for_ticket(sample_ticket)
        
        assert guidelines is not None
        assert len(guidelines) > 0
        assert "GENERAL" in guidelines
        assert "VPN" in guidelines
    
    def test_get_full_context(self, loader, sample_ticket):
        """Test getting full context (system + categories)"""
        full_context = loader.get_full_context(sample_ticket)
        
        assert full_context is not None
        assert len(full_context) > 0
        
        # Should include system guidelines
        assert "SYSTEM GUIDELINES" in full_context
        
        # Should include category guidelines
        assert "CATEGORY-SPECIFIC GUIDELINES" in full_context
        assert "GENERAL" in full_context
        assert "VPN" in full_context
    
    def test_get_full_context_structure(self, loader, sample_ticket):
        """Test that full context has correct structure"""
        full_context = loader.get_full_context(sample_ticket)
        
        # System guidelines should come before category guidelines
        system_pos = full_context.find("SYSTEM GUIDELINES")
        category_pos = full_context.find("CATEGORY-SPECIFIC GUIDELINES")
        
        assert system_pos >= 0
        assert category_pos > 0
        from datetime import datetime
        from uuid import uuid4
        
        ticket = Ticket(
            id=str(uuid4()),
            incident_id="INC0001",
            summary="Test",
            description="Test description",
            status="new",
            priority="low",
            requester_name="Test User",
            requester_email="test@example.com",
            operational_categorization_tier_1="Network Access",
            operational_categorization_tier_2="VPN",
            created_at=datetime.now(),
            updated_at=datetime.now()ideline"""
        ticket = Ticket(
            id="test-1",
            incident_id="INC0001",
            summary="Test",
            status="draft",
            priority="low",
            operational_categorization_tier_1="Network Access",
        from datetime import datetime
        from uuid import uuid4
        
        ticket = Ticket(
            id=str(uuid4()),
            incident_id="INC0002",
            summary="Test",
            description="Test description",
            status="new",
            priority="low",
            requester_name="Test User",
            requester_email="test@example.com",
            operational_categorization_tier_1="Security",
            operational_categorization_tier_2="Password Reset",
            created_at=datetime.now(),
            updated_at=datetime.now()ET guideline"""
        ticket = Ticket(
            id="test-2",
            incident_id="INC0002",
            summary="Test",
            status="draft",
            priority="low",
            operational_categorization_tier_1="Security",
        from datetime import datetime
        from uuid import uuid4
        
        ticket = Ticket(
            id=str(uuid4()),
            incident_id="INC0003",
            summary="Test",
            description="Test description",
            status="new",
            priority="low",
            requester_name="Test User",
            requester_email="test@example.com",
            operational_categorization_tier_1="Network",
            operational_categorization_tier_2="Internet",
            created_at=datetime.now(),
            updated_at=datetime.now()line"""
        ticket = Ticket(
            id="test-3",
            incident_id="INC0003",
            summary="Test",
            status="draft",
            priority="low",
            operational_categorization_tier_1="Network",
            operational_categorization_tier_2="Internet",
        )
        
        categories = loader.detect_categories_from_ticket(ticket)
        assert "NETWORK" in categories


class TestFrontmatterParsing:
    """Test frontmatter parsing edge cases"""
    
    def test_no_frontmatter(self, loader):
        """Test content without frontmatter"""
        content = "# Regular Markdown\n\nNo frontmatter here."
        frontmatter, parsed_content = loader._parse_frontmatter(content)
        
        assert frontmatter == {}
        assert parsed_content == content
    
    def test_frontmatter_with_colon_in_value(self, loader):
        """Test frontmatter value containing colon"""
        content = """---
title: Test: A Guide
url: https://example.com
---

Content
"""
        frontmatter, _ = loader._parse_frontmatter(content)
        
        assert frontmatter["title"] == "Test: A Guide"
        assert frontmatter["url"] == "https://example.com"
    
    def test_frontmatter_boolean_values(self, loader):
        """Test boolean parsing in frontmatter"""
        content = """---
enabled: true
disabled: false
active: yes
inactive: no
---

Content
"""
        frontmatter, _ = loader._parse_frontmatter(content)
        
        assert frontmatter["enabled"] is True
        assert frontmatter["disabled"] is False
        assert frontmatter["active"] is True
        assert frontmatter["inactive"] is False
    
    def test_frontmatter_numeric_values(self, loader):
        """Test numeric parsing in frontmatter"""
        content = """---
priority: 10
version: 1.5
count: 42
---

Content
"""
        frontmatter, _ = loader._parse_frontmatter(content)
        
        assert frontmatter["priority"] == 10
        assert frontmatter["version"] == 1.5
        assert frontmatter["count"] == 42


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
