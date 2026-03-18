"""Tests for prompt builder — pure calculations, no I/O."""

from agent_builder.engine.prompt_builder import (
    DEFAULT_OUTPUT_SCHEMA,
    append_markdown_instruction,
    append_output_instructions,
    build_chat_system_prompt,
    build_schema_instruction,
    resolve_output_schema,
)


class TestResolveOutputSchema:
    def test_custom_schema_returned(self):
        custom = {"type": "object", "properties": {"count": {"type": "integer"}}}
        result = resolve_output_schema(custom)
        assert result["properties"] == custom["properties"]
        assert result["title"] == "AgentOutput"  # title auto-added

    def test_custom_schema_with_title_preserved(self):
        custom = {"title": "MySchema", "type": "object", "properties": {"x": {"type": "string"}}}
        result = resolve_output_schema(custom)
        assert result["title"] == "MySchema"

    def test_empty_schema_returns_default(self):
        assert resolve_output_schema({}) is DEFAULT_OUTPUT_SCHEMA

    def test_none_returns_default(self):
        assert resolve_output_schema(None) is DEFAULT_OUTPUT_SCHEMA

    def test_schema_without_properties_returns_default(self):
        assert resolve_output_schema({"type": "object"}) is DEFAULT_OUTPUT_SCHEMA

    def test_default_has_message_and_tickets(self):
        props = DEFAULT_OUTPUT_SCHEMA["properties"]
        assert "message" in props
        assert "referenced_tickets" in props
        assert props["referenced_tickets"]["type"] == "array"


class TestAppendMarkdownInstruction:
    def test_appends_to_existing_prompt(self):
        result = append_markdown_instruction("You are helpful")
        assert result.startswith("You are helpful")
        assert "MUST respond with valid JSON" in result
        assert "message" in result

    def test_empty_prompt_returns_instruction_only(self):
        result = append_markdown_instruction("")
        assert "MUST respond with valid JSON" in result

    def test_none_prompt_returns_instruction(self):
        result = append_markdown_instruction(None)
        assert "MUST respond with valid JSON" in result


class TestAppendOutputInstructions:
    def test_custom_instructions_prepended(self):
        result = append_output_instructions("Be helpful", "Always respond in German")
        assert "Always respond in German" in result
        assert "MUST respond with valid JSON" in result

    def test_empty_instructions_uses_default_schema(self):
        result = append_output_instructions("Be helpful", "")
        assert "message" in result
        assert "referenced_tickets" in result

    def test_custom_schema_overrides_default(self):
        schema = {"type": "object", "properties": {"count": {"type": "integer"}}}
        result = append_output_instructions("Be helpful", "", schema)
        assert "count" in result
        assert "referenced_tickets" not in result

    def test_schema_takes_priority_over_instructions(self):
        schema = {"type": "object", "properties": {"count": {"type": "integer"}}}
        result = append_output_instructions("Be helpful", "Use markdown", schema)
        assert "MUST respond with valid JSON" in result
        assert "count" in result
        assert "Use markdown" in result  # instructions still prepended

    def test_schema_without_properties_uses_default(self):
        schema = {"type": "object"}
        result = append_output_instructions("Be helpful", "", schema)
        assert "message" in result

    def test_empty_schema_uses_default(self):
        result = append_output_instructions("Be helpful", "", {})
        assert "message" in result


class TestBuildChatSystemPrompt:
    def test_efficiency_mode_on(self):
        prompt = build_chat_system_prompt(efficiency_mode=True)
        assert "csv_*" in prompt
        assert "Plane möglichst" in prompt

    def test_efficiency_mode_off(self):
        prompt = build_chat_system_prompt(efficiency_mode=False)
        assert "csv_*" in prompt
        assert "Plane möglichst" not in prompt

    def test_contains_german(self):
        prompt = build_chat_system_prompt()
        assert "Deutsch" in prompt
