"""
API Decorators - Unified REST and MCP with Pydantic

This module provides decorators for defining operations that work with both
REST and MCP interfaces. It leverages Pydantic for automatic:
- Type validation
- Schema generation
- Documentation
- Serialization

Key principles:
- Define once, use everywhere
- Pydantic models provide schemas automatically
- Simple, clean decorator interface
- No duplication between REST and MCP
"""

import inspect
import json
from dataclasses import dataclass
from enum import Enum
from functools import wraps
from typing import (Any, Callable, Optional, Union, get_args, get_origin,
                    get_type_hints)

from pydantic import BaseModel


@dataclass
class Operation:
    """
    Unified operation definition.

    Instead of manually defining parameters, we extract them from:
    - Function signature (for simple types)
    - Pydantic models (for complex types)

    This eliminates duplication and leverages Python's type system.
    """
    name: str
    description: str
    handler: Callable

    # REST-specific
    http_method: str = "GET"
    http_path: Optional[str] = None

    # MCP-specific
    mcp_enabled: bool = True

    def __post_init__(self):
        """Extract parameter information from function signature."""
        if self.http_path is None:
            self.http_path = f"/api/{self.name}"

    def get_mcp_input_schema(self) -> dict:
        """
        Generate MCP input schema from function signature and Pydantic models.

        This automatically:
        - Extracts parameters from function signature
        - Uses Pydantic schemas for model parameters
        - Handles enums, unions, optionals
        - Generates proper JSON schema
        """
        sig = inspect.signature(self.handler)
        hints = get_type_hints(self.handler)

        properties = {}
        required = []

        for param_name, param in sig.parameters.items():
            if param_name == 'self':
                continue

            # Get type hint
            param_type = hints.get(param_name, Any)

            # Check if it's a Pydantic model
            if inspect.isclass(param_type) and issubclass(param_type, BaseModel):
                # Use Pydantic's schema generation
                model_schema = param_type.model_json_schema()
                properties[param_name] = model_schema

                # Pydantic models are usually required unless Optional
                if param.default == inspect.Parameter.empty:
                    required.append(param_name)

            # Check if it's an Enum
            elif inspect.isclass(param_type) and issubclass(param_type, Enum):
                properties[param_name] = {
                    "type": "string",
                    "enum": [e.value for e in param_type],
                    "description": f"{param_name} filter"
                }
                if param.default == inspect.Parameter.empty:
                    required.append(param_name)

            # Handle Optional types
            elif get_origin(param_type) is Union:
                args = get_args(param_type)
                if type(None) in args:
                    # It's Optional[X]
                    actual_type = [arg for arg in args if arg is not type(None)][0]
                    properties[param_name] = self._type_to_json_schema(actual_type, param_name)
                    # Optional parameters are not required

            # Simple types
            else:
                properties[param_name] = self._type_to_json_schema(param_type, param_name)
                if param.default == inspect.Parameter.empty:
                    required.append(param_name)

        schema = {
            "type": "object",
            "properties": properties
        }

        if required:
            schema["required"] = required

        return schema

    def _type_to_json_schema(self, python_type: type, param_name: str) -> dict:
        """Convert Python type to JSON schema type."""
        type_mapping = {
            str: {"type": "string", "description": f"{param_name} parameter"},
            int: {"type": "integer", "description": f"{param_name} parameter"},
            float: {"type": "number", "description": f"{param_name} parameter"},
            bool: {"type": "boolean", "description": f"{param_name} parameter"},
            list: {"type": "array", "description": f"{param_name} parameter"},
            dict: {"type": "object", "description": f"{param_name} parameter"},
        }

        return type_mapping.get(python_type, {"type": "string", "description": f"{param_name} parameter"})

    def to_mcp_tool(self) -> dict:
        """
        Convert operation to MCP tool definition.

        Automatically generates the schema from function signature + Pydantic models.
        """
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.get_mcp_input_schema()
        }

    def parse_arguments(self, arguments: dict) -> dict:
        """
        Parse MCP arguments into proper Python types.

        Automatically converts dict arguments into Pydantic models based on
        the handler's type annotations.

        Args:
            arguments: Raw arguments from MCP tool call

        Returns:
            Dict of parsed arguments ready to pass to the handler
        """
        sig = inspect.signature(self.handler)
        parsed_args = {}

        for param_name, param in sig.parameters.items():
            if param_name in arguments:
                param_type = param.annotation
                # If parameter type is a Pydantic model, instantiate it from the dict
                if inspect.isclass(param_type) and issubclass(param_type, BaseModel):
                    parsed_args[param_name] = param_type(**arguments[param_name])
                else:
                    parsed_args[param_name] = arguments[param_name]

        return parsed_args

    def serialize_result(self, result: Any) -> str:
        """
        Serialize operation result to JSON string for MCP responses.

        Handles Pydantic models with datetime fields by using mode='json'.

        Args:
            result: The result from the operation handler

        Returns:
            JSON string representation of the result
        """
        if isinstance(result, list):
            return json.dumps(
                [item.model_dump(mode='json') if hasattr(item, 'model_dump') else item for item in result],
                indent=2
            )
        elif hasattr(result, 'model_dump'):
            return json.dumps(result.model_dump(mode='json'), indent=2)
        elif isinstance(result, bool):
            return f"Success: {result}"
        else:
            return json.dumps(result, indent=2)


# Registry of all operations
_operations: dict[str, Operation] = {}


def operation(
    name: str,
    description: str,
    http_method: str = "GET",
    http_path: Optional[str] = None,
    mcp_enabled: bool = True
) -> Callable:
    """
    Decorator that registers an operation for both REST and MCP.

    Simplified usage with Pydantic:

        @operation(
            name="create_task",
            description="Create a new task",
            http_method="POST"
        )
        async def create_task(data: TaskCreate) -> Task:
            return service.create_task(data)

    The decorator automatically:
    - Extracts parameter types from function signature
    - Uses Pydantic schema for TaskCreate
    - Generates MCP tool schema
    - Validates input via Pydantic

    No need to manually define parameters - Python's type hints + Pydantic do it!
    """
    def decorator(func: Callable) -> Callable:
        # Create operation instance
        op = Operation(
            name=name,
            description=description,
            handler=func,
            http_method=http_method,
            http_path=http_path,
            mcp_enabled=mcp_enabled
        )

        # Register globally
        _operations[name] = op

        # Add operation metadata to function
        func._operation = op

        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)

        return wrapper

    return decorator


def get_operations() -> dict[str, Operation]:
    """Get all registered operations."""
    return _operations.copy()


def get_mcp_tools() -> list[dict]:
    """
    Get all MCP tool definitions.

    Automatically generates tool schemas from Pydantic models and type hints.
    """
    return [
        op.to_mcp_tool()
        for op in _operations.values()
        if op.mcp_enabled
    ]


def get_operation(name: str) -> Operation | None:
    """Get a specific operation by name."""
    return _operations.get(name)
