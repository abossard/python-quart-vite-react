"""
Tests for Search Questions Generation and Validation
"""

import pytest
from kba_output_models import (
    SearchQuestionsSchema,
    validate_and_clean_search_questions
)
from pydantic import ValidationError


class TestSearchQuestionsSchema:
    """Test SearchQuestionsSchema Pydantic model"""
    
    def test_valid_questions(self):
        """Test valid question list"""
        data = {
            "questions": [
                "Wie behebe ich VPN-Probleme?",
                "VPN bricht ab was tun",
                "OpenVPN Timeout Error",
                "Warum funktioniert VPN nicht?",
                "Windows Firewall blockiert VPN"
            ]
        }
        schema = SearchQuestionsSchema(**data)
        assert len(schema.questions) == 5
        assert schema.questions[0] == "Wie behebe ich VPN-Probleme?"
    
    def test_empty_list_fails(self):
        """Test that empty list fails validation"""
        with pytest.raises(ValidationError) as exc_info:
            SearchQuestionsSchema(questions=[])
        error_msg = str(exc_info.value).lower()
        assert "empty" in error_msg or "at least 5" in error_msg
    
    def test_too_few_questions_fails(self):
        """Test that less than 5 questions fails"""
        with pytest.raises(ValidationError):
            SearchQuestionsSchema(questions=[
                "Frage 1 - lang genug",
                "Frage 2 - lang genug",
                "Frage 3 - lang genug"
            ])
    
    def test_too_short_question_fails(self):
        """Test that questions under 10 chars fail"""
        with pytest.raises(ValidationError) as exc_info:
            SearchQuestionsSchema(questions=[
                "VPN fix",  # Too short
                "Wie behebe ich VPN-Probleme?",
                "VPN bricht ab was tun",
                "OpenVPN Timeout Error",
                "Warum funktioniert VPN nicht?"
            ])
        assert "too short" in str(exc_info.value).lower()
    
    def test_too_long_question_fails(self):
        """Test that questions over 200 chars fail"""
        long_question = "x" * 201
        with pytest.raises(ValidationError) as exc_info:
            SearchQuestionsSchema(questions=[
                long_question,
                "Wie behebe ich VPN-Probleme?",
                "VPN bricht ab was tun",
                "OpenVPN Timeout Error",
                "Warum funktioniert VPN nicht?"
            ])
        assert "too long" in str(exc_info.value).lower()
    
    def test_max_15_questions(self):
        """Test maximum 15 questions allowed"""
        questions = [f"Frage Nummer {i} lang genug" for i in range(20)]
        with pytest.raises(ValidationError):
            SearchQuestionsSchema(questions=questions)
    
    def test_empty_string_fails(self):
        """Test that empty strings fail validation"""
        with pytest.raises(ValidationError) as exc_info:
            SearchQuestionsSchema(questions=[
                "",  # Empty
                "Wie behebe ich VPN-Probleme?",
                "VPN bricht ab was tun",
                "OpenVPN Timeout Error",
                "Warum funktioniert VPN nicht?"
            ])
        assert "empty" in str(exc_info.value).lower()


class TestValidateAndCleanSearchQuestions:
    """Test validation and cleaning logic"""
    
    def test_trim_whitespace(self):
        """Test that questions are trimmed"""
        questions = [
            "  Wie behebe ich VPN-Probleme?  ",
            "\tVPN bricht ab\n",
            " OpenVPN Timeout  ",
            "  Warum VPN nicht?  ",
            "  Windows Firewall blockiert  "
        ]
        cleaned = validate_and_clean_search_questions(questions)
        assert len(cleaned) == 5
        assert cleaned[0] == "Wie behebe ich VPN-Probleme?"
        assert cleaned[1] == "VPN bricht ab"
    
    def test_remove_duplicates_case_insensitive(self):
        """Test deduplication (case-insensitive)"""
        questions = [
            "Wie behebe ich VPN-Probleme?",
            "VPN bricht ab was tun",
            "WIE BEHEBE ICH VPN-PROBLEME?",  # Duplicate (different case)
            "vpn bricht ab was tun",  # Duplicate (lowercase)
            "OpenVPN Timeout Error",
            "Warum VPN nicht?",
            "Windows Firewall blockiert"
        ]
        cleaned = validate_and_clean_search_questions(questions)
        assert len(cleaned) == 5  # 2 duplicates removed
        # Original casing preserved
        assert "Wie behebe ich VPN-Probleme?" in cleaned
        assert "VPN bricht ab was tun" in cleaned
    
    def test_filter_short_questions(self):
        """Test that questions under 10 chars are filtered out"""
        questions = [
            "VPN",  # Too short
            "Wie behebe ich VPN-Probleme?",
            "short",  # Too short
            "VPN bricht ab was tun",
            "OpenVPN Timeout Error",
            "Warum VPN nicht?",
            "Windows Firewall blockiert"
        ]
        cleaned = validate_and_clean_search_questions(questions)
        assert len(cleaned) == 5
        assert "VPN" not in cleaned
        assert "short" not in cleaned
    
    def test_filter_long_questions(self):
        """Test that questions over 200 chars are filtered out"""
        long_question = "x" * 201
        questions = [
            "Wie behebe ich VPN-Probleme?",
            long_question,  # Too long
            "VPN bricht ab was tun",
            "OpenVPN Timeout Error",
            "Warum VPN nicht?",
            "Windows Firewall blockiert"
        ]
        cleaned = validate_and_clean_search_questions(questions)
        assert len(cleaned) == 5
        assert long_question not in cleaned
    
    def test_filter_empty_strings(self):
        """Test that empty strings are filtered out"""
        questions = [
            "Wie behebe ich VPN-Probleme?",
            "",  # Empty
            "VPN bricht ab was tun",
            "   ",  # Whitespace only
            "OpenVPN Timeout Error",
            "Warum VPN nicht?",
            "Windows Firewall blockiert"
        ]
        cleaned = validate_and_clean_search_questions(questions)
        assert len(cleaned) == 5
        assert "" not in cleaned
    
    def test_too_few_after_cleaning_fails(self):
        """Test that validation fails if less than min after cleaning"""
        questions = [
            "Wie behebe ich VPN-Probleme?",
            "VPN",  # Too short
            "short",  # Too short
            "",  # Empty
            "   "  # Whitespace
        ]
        with pytest.raises(ValueError) as exc_info:
            validate_and_clean_search_questions(questions, min_questions=5)
        assert "Only 1 valid questions" in str(exc_info.value)
        assert "required: 5" in str(exc_info.value)
    
    def test_truncate_to_max(self):
        """Test that list is truncated to max_questions"""
        questions = [f"Frage Nummer {i} lang genug" for i in range(20)]
        cleaned = validate_and_clean_search_questions(questions, max_questions=10)
        assert len(cleaned) == 10
    
    def test_normalize_whitespace_in_dedup(self):
        """Test that extra whitespace is normalized for deduplication"""
        questions = [
            "Wie   behebe   ich   VPN-Probleme?",  # Extra spaces
            "Wie behebe ich VPN-Probleme?",  # Normal spacing
            "VPN bricht ab was tun",
            "OpenVPN Timeout Error",
            "Warum VPN nicht?",
            "Windows Firewall blockiert"
        ]
        cleaned = validate_and_clean_search_questions(questions)
        assert len(cleaned) == 5  # Duplicate removed
    
    def test_exact_5_questions(self):
        """Test with exactly 5 questions (minimum)"""
        questions = [
            "Wie behebe ich VPN-Probleme?",
            "VPN bricht ab was tun",
            "OpenVPN Timeout Error",
            "Warum VPN nicht?",
            "Windows Firewall blockiert"
        ]
        cleaned = validate_and_clean_search_questions(questions)
        assert len(cleaned) == 5
    
    def test_exact_15_questions(self):
        """Test with exactly 15 questions (maximum)"""
        questions = [f"Frage Nummer {i} - lang genug fuer Validierung" for i in range(15)]
        cleaned = validate_and_clean_search_questions(questions)
        assert len(cleaned) == 15
    
    def test_mixed_invalid_and_valid(self):
        """Test with mix of valid and invalid questions"""
        questions = [
            "Wie behebe ich VPN-Probleme?",  # Valid
            "VPN",  # Too short
            "VPN bricht ab was tun",  # Valid
            "",  # Empty
            "OpenVPN Timeout Error",  # Valid
            "x" * 201,  # Too long
            "Warum VPN nicht?",  # Valid
            "   ",  # Whitespace
            "Windows Firewall blockiert",  # Valid
            "Wie BEHEBE ich VPN-Probleme?",  # Duplicate (case-insensitive)
        ]
        cleaned = validate_and_clean_search_questions(questions)
        assert len(cleaned) == 5  # Only valid unique questions
    
    def test_custom_min_max(self):
        """Test with custom min/max values"""
        questions = [
            "Frage 1 lang genug",
            "Frage 2 lang genug",
            "Frage 3 lang genug"
        ]
        # Should work with min=3
        cleaned = validate_and_clean_search_questions(questions, min_questions=3, max_questions=10)
        assert len(cleaned) == 3
        
        # Should fail with min=5
        with pytest.raises(ValueError):
            validate_and_clean_search_questions(questions, min_questions=5, max_questions=10)
