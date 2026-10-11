"""
Unified LLM Client for Revora AI Agents.
Integrates with OpenRouter (OpenAI-compatible chat completion API)
with automatic fallback, robust JSON extraction, and rate-limit safety.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("revora.llm_client")


class LLMClient:
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY or ""
        self.model = settings.OPENROUTER_MODEL or "openai/gpt-4o-mini"
        self.base_url = settings.OPENROUTER_BASE_URL or "https://openrouter.ai/api/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Revora Revenue Defense Copilot",
            "Content-Type": "application/json"
        }

    def is_available(self) -> bool:
        """Returns True if an OpenRouter or Gemini API key is configured."""
        return bool(self.api_key and self.api_key.strip())

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        json_mode: bool = False,
        temperature: float = 0.2,
        timeout: float = 30.0
    ) -> Optional[str]:
        """
        Sends a chat completion request to OpenRouter.
        """
        if not self.is_available():
            return None

        url = f"{self.base_url.rstrip('/')}/chat/completions"
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(url, headers=self.headers, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        return choices[0]["message"].get("content", "").strip()
                    logger.warning(f"OpenRouter response missing choices: {data}")
                else:
                    logger.warning(
                        f"OpenRouter returned status {response.status_code}: {response.text[:300]}"
                    )
        except Exception as e:
            logger.error(f"Error calling OpenRouter API: {e}")

        return None

    def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        timeout: float = 30.0
    ) -> Optional[Dict[str, Any]]:
        """
        Requests structured JSON from OpenRouter and cleanly parses the result.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        raw_text = self.chat_completion(messages, json_mode=True, timeout=timeout)
        if not raw_text:
            return None

        # Clean markdown fences if any returned (```json ... ```)
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as err:
            logger.warning(f"Failed to parse JSON from OpenRouter output: {err}. Raw text:\n{raw_text[:200]}")
            return None

    def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        timeout: float = 30.0
    ) -> Optional[str]:
        """
        Requests plain text completion from OpenRouter.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        return self.chat_completion(messages, json_mode=False, timeout=timeout)


# Global singleton instance
llm_client = LLMClient()
