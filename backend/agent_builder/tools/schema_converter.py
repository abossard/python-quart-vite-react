"""
Agent Builder — Schema Converter

Pure calculations: convert JSON Schema to Pydantic models for LangChain tool args.
No I/O, no side effects — easily testable.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field, create_model


def json_type_to_python(json_type: str) -> type:
    """Map a JSON Schema type string to a Python type."""
    mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list,
        "object": dict,
    }
    return mapping.get(json_type, str)


def schema_to_pydantic(name: str, schema: dict) -> type[BaseModel]:
    """
    Convert a JSON Schema dict to a Pydantic model class.

    Used to give LangChain StructuredTools a typed args_schema.
    """
    properties = schema.get("properties", {})
    required = set(schema.get("required", []))

    fields: dict[str, Any] = {}
    for field_name, field_schema in properties.items():
        field_type = json_type_to_python(field_schema.get("type", "string"))
        field_desc = field_schema.get("description", f"{field_name} parameter")

        if field_name in required:
            fields[field_name] = (field_type, Field(description=field_desc))
        else:
            default = field_schema.get("default")
            fields[field_name] = (
                Optional[field_type],
                Field(default=default, description=field_desc),
            )

    model_name = f"{name.title().replace('_', '').replace('-', '')}Args"
    return create_model(model_name, **fields)
