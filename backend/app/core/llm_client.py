"""
Unified LLM Client for Revora AI Agents.
Integrates with OpenRouter (OpenAI-compatible chat completion API)
with automatic fallback, robust JSON extraction, rate-limit safety,
transient retry handling, and in-memory response caching.
"""

import hashlib
import json
import logging
import re
import time
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
        self._cache: Dict[str, str] = {}

    def is_available(self) -> bool:
        """Returns True if an OpenRouter API key is configured."""
        return bool(self.api_key and self.api_key.strip())

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        json_mode: bool = False,
        temperature: float = 0.2,
        timeout: float = 30.0,
        max_retries: int = 2
    ) -> Optional[str]:
        """
        Sends a chat completion request to OpenRouter with caching and transient retries.
        """
        if not self.is_available():
            return None

        # Cache lookup to avoid redundant calls and save tokens
        cache_key = hashlib.sha256(
            json.dumps({"messages": messages, "json_mode": json_mode, "model": self.model}, sort_keys=True).encode()
        ).hexdigest()
        if cache_key in self._cache:
            return self._cache[cache_key]

        url = f"{self.base_url.rstrip('/')}/chat/completions"
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        for attempt in range(max_retries):
            try:
                with httpx.Client(timeout=timeout) as client:
                    response = client.post(url, headers=self.headers, json=payload)
                    if response.status_code == 200:
                        data = response.json()
                        choices = data.get("choices", [])
                        if choices and "message" in choices[0]:
                            content = choices[0]["message"].get("content", "").strip()
                            self._cache[cache_key] = content
                            return content
                        logger.warning(f"OpenRouter response missing choices: {data}")
                    else:
                        logger.warning(
                            f"OpenRouter returned status {response.status_code}: {response.text[:300]}"
                        )
            except Exception as e:
                logger.debug(f"OpenRouter API call attempt {attempt + 1} error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(0.5)

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
