"""Tests for prompt builder — pure calculations, no I/O."""

from agent_builder.engine.prompt_builder import (
    append_markdown_instruction,
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
