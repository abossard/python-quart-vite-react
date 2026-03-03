"""
Test KBA Schema Validation

Validates the JSON schema (kba_schemas.py) for documentation purposes.

NOTE: The actual KBA Drafter now uses Pydantic models (kba_output_models.py)
with OpenAI's native structured output. These tests validate the legacy
JSON Schema which is kept for backward compatibility and documentation.

For current validation tests, see test_llm_service.py TestKBAOutputSchemaValidation.

Run from backend directory:
    python -m pytest tests/test_kba_schema.py -v
"""

import json
import jsonschema
import pytest

from kba_schemas import KBA_OUTPUT_SCHEMA, KBA_OUTPUT_EXAMPLE


def test_schema_validates_example():
    """Example output should pass validation"""
    try:
        jsonschema.validate(KBA_OUTPUT_EXAMPLE, KBA_OUTPUT_SCHEMA)
    except jsonschema.ValidationError as e:
        pytest.fail(f"Example failed validation: {e.message}")


def test_schema_requires_structured_fields():
    """Schema should require new structured fields"""
    required_fields = KBA_OUTPUT_SCHEMA["required"]
    
    assert "title" in required_fields
    assert "symptoms" in required_fields
    assert "resolution_steps" in required_fields
    assert "tags" in required_fields
    
    # Optional fields should NOT be required
    assert "cause" not in required_fields
    assert "validation_checks" not in required_fields
    assert "warnings" not in required_fields
    assert "confidence_notes" not in required_fields


def test_valid_output_with_all_fields():
    """Valid output with all fields should pass"""
    valid_output = {
        "title": "Test KBA Title for VPN Issues",
        "symptoms": [
            "VPN connection drops",
            "Error message: Connection timeout"
        ],
        "cause": "Firewall blocks UDP port 1194",
        "resolution_steps": [
            "Step 1: Open firewall settings",
            "Step 2: Add UDP 1194 rule"
        ],
        "validation_checks": [
            "Check VPN connection stability",
            "Test intranet access"
        ],
        "warnings": [
            "Requires admin rights",
            "Create firewall backup first"
        ],
        "confidence_notes": "Solution tested on Windows 11 only",
        "tags": ["vpn", "firewall", "windows"],
        "related_tickets": []
    }
    
    try:
        jsonschema.validate(valid_output, KBA_OUTPUT_SCHEMA)
    except jsonschema.ValidationError as e:
        pytest.fail(f"Valid output failed: {e.message}")


def test_minimal_valid_output():
    """Minimal valid output (only required fields) should pass"""
    minimal_output = {
        "title": "Basic KBA Title for Testing",
        "symptoms": ["One symptom description here"],
        "resolution_steps": ["Step one with enough characters"],
        "tags": ["test", "minimal"]
    }
    
    try:
        jsonschema.validate(minimal_output, KBA_OUTPUT_SCHEMA)
    except jsonschema.ValidationError as e:
        pytest.fail(f"Minimal valid output failed: {e.message}")


def test_invalid_missing_required_field():
    """Output missing required field should fail"""
    invalid_output = {
        "title": "Test Title",
        # Missing 'symptoms'
        "resolution_steps": ["Step 1"],
        "tags": ["test"]
    }
    
    with pytest.raises(jsonschema.ValidationError) as exc_info:
        jsonschema.validate(invalid_output, KBA_OUTPUT_SCHEMA)
    
    assert "symptoms" in str(exc_info.value).lower()


def test_invalid_empty_symptoms():
    """Empty symptoms array should fail (minItems: 1)"""
    invalid_output = {
        "title": "Test Title",
        "symptoms": [],  # Empty array
        "resolution_steps": ["Step 1"],
        "tags": ["test", "tag"]
    }
    
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(invalid_output, KBA_OUTPUT_SCHEMA)


def test_invalid_short_title():
    """Title shorter than 10 chars should fail"""
    invalid_output = {
        "title": "Short",  # Too short
        "symptoms": ["Symptom 1"],
        "resolution_steps": ["Step 1"],
        "tags": ["test", "tag"]
    }
    
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(invalid_output, KBA_OUTPUT_SCHEMA)


def test_invalid_tags_format():
    """Tags with uppercase should fail (pattern validation)"""
    invalid_output = {
        "title": "Test KBA Title",
        "symptoms": ["Symptom 1"],
        "resolution_steps": ["Step 1"],
        "tags": ["ValidTag", "UPPERCASE"]  # Should be lowercase
    }
    
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(invalid_output, KBA_OUTPUT_SCHEMA)


def test_invalid_too_few_tags():
    """Less than 2 tags should fail"""
    invalid_output = {
        "title": "Test KBA Title",
        "symptoms": ["Symptom 1"],
        "resolution_steps": ["Step 1"],
        "tags": ["onetag"]  # Need at least 2
    }
    
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(invalid_output, KBA_OUTPUT_SCHEMA)


def test_validation_checks_optional():
    """validation_checks is optional"""
    valid_output = {
        "title": "Test KBA Title Here",
        "symptoms": ["Symptom description"],
        "resolution_steps": ["Step with enough characters"],
        "tags": ["test", "tag"]
        # No validation_checks
    }
    
    try:
        jsonschema.validate(valid_output, KBA_OUTPUT_SCHEMA)
    except jsonschema.ValidationError as e:
        pytest.fail(f"Output without validation_checks failed: {e.message}")


def test_warnings_optional():
    """warnings is optional"""
    valid_output = {
        "title": "Test KBA Title Here",
        "symptoms": ["Symptom description"],
        "resolution_steps": ["Step with enough characters"],
        "tags": ["test", "tag"]
        # No warnings
    }
    
    try:
        jsonschema.validate(valid_output, KBA_OUTPUT_SCHEMA)
    except jsonschema.ValidationError as e:
        pytest.fail(f"Output without warnings failed: {e.message}")


def test_confidence_notes_optional():
    """confidence_notes is optional"""
    valid_output = {
        "title": "Test KBA Title Here",
        "symptoms": ["Symptom description"],
        "resolution_steps": ["Step with enough characters"],
        "tags": ["test", "tag"]
        # No confidence_notes
    }
    
    try:
        jsonschema.validate(valid_output, KBA_OUTPUT_SCHEMA)
    except jsonschema.ValidationError as e:
        pytest.fail(f"Output without confidence_notes failed: {e.message}")


def test_cause_max_length():
    """cause exceeding 1000 chars should fail"""
    invalid_output = {
        "title": "Test KBA Title",
        "symptoms": ["Symptom"],
        "cause": "x" * 1001,  # Too long
        "resolution_steps": ["Step"],
        "tags": ["test", "tag"]
    }
    
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(invalid_output, KBA_OUTPUT_SCHEMA)


def test_resolution_steps_min_length():
    """resolution_steps with short items should fail"""
    invalid_output = {
        "title": "Test KBA Title",
        "symptoms": ["Symptom"],
        "resolution_steps": ["Short"],  # Less than 10 chars
        "tags": ["test", "tag"]
    }
    
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(invalid_output, KBA_OUTPUT_SCHEMA)


def test_example_has_all_new_fields():
    """Example should demonstrate all new structured fields"""
    assert "symptoms" in KBA_OUTPUT_EXAMPLE
    assert "cause" in KBA_OUTPUT_EXAMPLE
    assert "resolution_steps" in KBA_OUTPUT_EXAMPLE
    assert "validation_checks" in KBA_OUTPUT_EXAMPLE
    assert "warnings" in KBA_OUTPUT_EXAMPLE
    assert "confidence_notes" in KBA_OUTPUT_EXAMPLE
    
    # Check types
    assert isinstance(KBA_OUTPUT_EXAMPLE["symptoms"], list)
    assert isinstance(KBA_OUTPUT_EXAMPLE["cause"], str)
    assert isinstance(KBA_OUTPUT_EXAMPLE["resolution_steps"], list)
    assert isinstance(KBA_OUTPUT_EXAMPLE["validation_checks"], list)
    assert isinstance(KBA_OUTPUT_EXAMPLE["warnings"], list)
    assert isinstance(KBA_OUTPUT_EXAMPLE["confidence_notes"], str)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
