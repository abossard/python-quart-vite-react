"""Tests for schema converter — pure calculations, no I/O."""

from pydantic import BaseModel

from agent_builder.tools.schema_converter import json_type_to_python, schema_to_pydantic


class TestJsonTypeToPython:
    def test_string(self):
        assert json_type_to_python("string") is str

    def test_integer(self):
        assert json_type_to_python("integer") is int

    def test_number(self):
        assert json_type_to_python("number") is float

    def test_boolean(self):
        assert json_type_to_python("boolean") is bool

    def test_array(self):
        assert json_type_to_python("array") is list

    def test_object(self):
        assert json_type_to_python("object") is dict

    def test_unknown_defaults_to_str(self):
        assert json_type_to_python("foobar") is str


class TestSchemaToPydantic:
    def test_creates_model_with_required_fields(self):
        schema = {
            "properties": {
                "name": {"type": "string", "description": "The name"},
                "count": {"type": "integer", "description": "A count"},
            },
            "required": ["name"],
        }
        Model = schema_to_pydantic("test_tool", schema)
        assert issubclass(Model, BaseModel)

        # Required field works
        instance = Model(name="hello")
        assert instance.name == "hello"
        assert instance.count is None  # optional, no default

    def test_creates_model_with_defaults(self):
        schema = {
            "properties": {
                "limit": {"type": "integer", "description": "Max results", "default": 50},
            },
            "required": [],
        }
        Model = schema_to_pydantic("my_tool", schema)
        instance = Model()
        assert instance.limit == 50

    def test_model_name_formatting(self):
        Model = schema_to_pydantic("csv_list_tickets", {"properties": {}})
        assert "CsvListTickets" in Model.__name__

    def test_empty_schema(self):
        Model = schema_to_pydantic("empty", {})
        instance = Model()
        assert instance is not None
