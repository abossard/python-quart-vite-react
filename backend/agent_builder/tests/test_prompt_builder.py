"""Tests for prompt builder — pure calculations, no I/O."""

from agent_builder.engine.prompt_builder import (
    append_markdown_instruction,
    append_output_instructions,
    build_chat_system_prompt,
)


class TestAppendMarkdownInstruction:
    def test_appends_to_existing_prompt(self):
        result = append_markdown_instruction("You are helpful")
        assert result.startswith("You are helpful")
        assert "GitHub-flavored Markdown" in result

    def test_empty_prompt_returns_instruction_only(self):
        result = append_markdown_instruction("")
        assert "GitHub-flavored Markdown" in result
        assert not result.startswith("\n")

    def test_none_prompt_returns_instruction(self):
        result = append_markdown_instruction(None)
        assert "GitHub-flavored Markdown" in result

    def test_whitespace_only_returns_instruction(self):
        result = append_markdown_instruction("   ")
        assert "GitHub-flavored Markdown" in result


class TestAppendOutputInstructions:
    def test_custom_instructions(self):
        result = append_output_instructions("Be helpful", "Always respond in JSON")
        assert result.startswith("Be helpful")
        assert "Always respond in JSON" in result
        assert "GitHub-flavored Markdown" not in result

    def test_empty_instructions_uses_default(self):
        result = append_output_instructions("Be helpful", "")
        assert "GitHub-flavored Markdown" in result

    def test_none_instructions_uses_default(self):
        result = append_output_instructions("Be helpful", None)
        assert "GitHub-flavored Markdown" in result

    def test_empty_prompt_with_custom_instructions(self):
        result = append_output_instructions("", "Respond in CSV")
        assert result == "Respond in CSV"

    def test_schema_takes_priority_over_instructions(self):
        schema = {"type": "object", "properties": {"count": {"type": "integer"}}}
        result = append_output_instructions("Be helpful", "Use markdown", schema)
        assert "MUST respond with valid JSON" in result
        assert "count" in result
        assert "Use markdown" not in result

    def test_schema_without_properties_ignored(self):
        schema = {"type": "object"}
        result = append_output_instructions("Be helpful", "", schema)
        assert "GitHub-flavored Markdown" in result

    def test_empty_schema_ignored(self):
        result = append_output_instructions("Be helpful", "", {})
        assert "GitHub-flavored Markdown" in result


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
