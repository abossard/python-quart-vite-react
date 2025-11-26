/**
 * End-to-End Tests for Ollama LLM Integration
 *
 * These tests verify the Ollama integration:
 * - Model listing
 * - Chat completion
 * - Error handling
 * 
 * Note: These tests require Ollama to be running with llama3.2:1b model.
 * Run: ollama pull llama3.2:1b && ollama serve
 */

import { expect, test } from "@playwright/test";

const BACKEND_URL = process.env.E2E_BACKEND_URL || "http://localhost:5001";

// Helper to check if Ollama is available
async function isOllamaAvailable() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ollama/models`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// MODEL LISTING TESTS
// ============================================================================

test.describe("Ollama Model Management", () => {
  test.skip(({ }, testInfo) => {
    // Skip tests in CI or when Ollama is not available
    return process.env.CI === "true";
  });

  test("lists available Ollama models", async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/ollama/models`);
    
    if (response.status() === 503) {
      test.skip(true, "Ollama server not available");
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty("models");
    expect(Array.isArray(data.models)).toBeTruthy();

    // If llama3.2:1b is installed, it should be in the list
    if (data.models.length > 0) {
      const model = data.models[0];
      expect(model).toHaveProperty("name");
      
      // Check if our target model exists
      const hasTargetModel = data.models.some(
        m => m.name.includes("llama3.2")
      );
      
      if (!hasTargetModel) {
        console.log("⚠️  llama3.2:1b not found. Run: ollama pull llama3.2:1b");
      }
    }
  });

  test("handles model listing error when Ollama is not running", async ({ request }) => {
    // This test verifies error handling
    // We can't easily stop Ollama mid-test, so we just verify the error structure
    const response = await request.get(`${BACKEND_URL}/api/ollama/models`);
    
    // Either success (200) or service unavailable (503)
    expect([200, 503]).toContain(response.status());
    
    if (response.status() === 503) {
      const data = await response.json();
      expect(data).toHaveProperty("error");
      expect(data.error).toContain("Ollama");
    }
  });
});

// ============================================================================
// CHAT COMPLETION TESTS
// ============================================================================

test.describe("Ollama Chat Completion", () => {
  test.skip(({ }, testInfo) => {
    return process.env.CI === "true";
  });

  test("generates a simple chat response", async ({ request }) => {
    const chatRequest = {
      messages: [
        {
          role: "user",
          content: "Say 'Hello' and nothing else."
        }
      ],
      model: "llama3.2:1b",
      temperature: 0.1
    };

    const response = await request.post(`${BACKEND_URL}/api/ollama/chat`, {
      data: chatRequest
    });

    if (response.status() === 503) {
      test.skip(true, "Ollama server not available");
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty("message");
    expect(data.message).toHaveProperty("role", "assistant");
    expect(data.message).toHaveProperty("content");
    expect(data.message.content.length).toBeGreaterThan(0);
    
    expect(data).toHaveProperty("model");
    expect(data).toHaveProperty("done", true);

    console.log(`✅ Ollama response: "${data.message.content.substring(0, 50)}..."`);
  });

  test("handles conversation history", async ({ request }) => {
    const chatRequest = {
      messages: [
        {
          role: "user",
          content: "My name is Alice."
        },
        {
          role: "assistant",
          content: "Hello Alice! Nice to meet you."
        },
        {
          role: "user",
          content: "What is my name?"
        }
      ],
      model: "llama3.2:1b",
      temperature: 0.3
    };

    const response = await request.post(`${BACKEND_URL}/api/ollama/chat`, {
      data: chatRequest
    });

    if (response.status() === 503) {
      test.skip(true, "Ollama server not available");
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // The model should reference "Alice" in the response
    expect(data.message.content.toLowerCase()).toContain("alice");
  });

  test("respects temperature parameter", async ({ request }) => {
    // Low temperature should give more focused responses
    const lowTempRequest = {
      messages: [
        {
          role: "user",
          content: "What is 2+2? Answer with just the number."
        }
      ],
      model: "llama3.2:1b",
      temperature: 0.0
    };

    const response = await request.post(`${BACKEND_URL}/api/ollama/chat`, {
      data: lowTempRequest
    });

    if (response.status() === 503) {
      test.skip(true, "Ollama server not available");
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // With temp=0, should give deterministic answer
    expect(data.message.content).toContain("4");
  });
});

// ============================================================================
// VALIDATION AND ERROR HANDLING TESTS
// ============================================================================

test.describe("Ollama Request Validation", () => {
  test("rejects empty messages array", async ({ request }) => {
    const invalidRequest = {
      messages: [],
      model: "llama3.2:1b"
    };

    const response = await request.post(`${BACKEND_URL}/api/ollama/chat`, {
      data: invalidRequest
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  test("rejects messages with empty content", async ({ request }) => {
    const invalidRequest = {
      messages: [
        {
          role: "user",
          content: "   "  // Just whitespace
        }
      ],
      model: "llama3.2:1b"
    };

    const response = await request.post(`${BACKEND_URL}/api/ollama/chat`, {
      data: invalidRequest
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  test("rejects invalid role", async ({ request }) => {
    const invalidRequest = {
      messages: [
        {
          role: "invalid_role",
          content: "Hello"
        }
      ],
      model: "llama3.2:1b"
    };

    const response = await request.post(`${BACKEND_URL}/api/ollama/chat`, {
      data: invalidRequest
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  test("rejects temperature out of range", async ({ request }) => {
    const invalidRequest = {
      messages: [
        {
          role: "user",
          content: "Hello"
        }
      ],
      model: "llama3.2:1b",
      temperature: 3.0  // Out of range (max is 2.0)
    };

    const response = await request.post(`${BACKEND_URL}/api/ollama/chat`, {
      data: invalidRequest
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  test("uses default values when optional fields omitted", async ({ request }) => {
    const minimalRequest = {
      messages: [
        {
          role: "user",
          content: "Test"
        }
      ]
      // No model or temperature specified - should use defaults
    };

    const response = await request.post(`${BACKEND_URL}/api/ollama/chat`, {
      data: minimalRequest
    });

    if (response.status() === 503) {
      test.skip(true, "Ollama server not available");
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Should default to llama3.2:1b
    expect(data.model).toContain("llama3.2");
  });
});

// ============================================================================
// MCP INTEGRATION TESTS
// ============================================================================

test.describe("Ollama MCP Tools", () => {
  test.skip(({ }, testInfo) => {
    return process.env.CI === "true";
  });

  test("exposes ollama_chat as MCP tool", async ({ request }) => {
    const mcpRequest = {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 1
    };

    const response = await request.post(`${BACKEND_URL}/mcp`, {
      data: mcpRequest
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty("result");
    expect(data.result).toHaveProperty("tools");
    
    const ollamaChat = data.result.tools.find(
      tool => tool.name === "ollama_chat"
    );
    
    expect(ollamaChat).toBeDefined();
    expect(ollamaChat.description).toContain("chat");
    expect(ollamaChat.inputSchema).toBeDefined();
    expect(ollamaChat.inputSchema.properties).toHaveProperty("messages");
  });

  test("exposes list_ollama_models as MCP tool", async ({ request }) => {
    const mcpRequest = {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 1
    };

    const response = await request.post(`${BACKEND_URL}/mcp`, {
      data: mcpRequest
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    const listModels = data.result.tools.find(
      tool => tool.name === "list_ollama_models"
    );
    
    expect(listModels).toBeDefined();
    expect(listModels.description).toContain("models");
  });

  test("calls ollama_chat via MCP", async ({ request }) => {
    const mcpRequest = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "ollama_chat",
        arguments: {
          messages: [
            {
              role: "user",
              content: "Say hi"
            }
          ],
          model: "llama3.2:1b",
          temperature: 0.1
        }
      },
      id: 1
    };

    const response = await request.post(`${BACKEND_URL}/mcp`, {
      data: mcpRequest
    });

    if (response.status() !== 200) {
      const errorData = await response.json();
      if (errorData.error?.message?.includes("Ollama")) {
        test.skip(true, "Ollama server not available");
        return;
      }
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty("result");
    expect(data.result).toHaveProperty("content");
    expect(Array.isArray(data.result.content)).toBeTruthy();
    expect(data.result.content[0]).toHaveProperty("text");
    
    // Parse the JSON response text
    const resultText = data.result.content[0].text;
    const parsedResult = JSON.parse(resultText);
    
    expect(parsedResult).toHaveProperty("message");
    expect(parsedResult.message.role).toBe("assistant");
  });
});
