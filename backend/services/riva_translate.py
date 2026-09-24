"""
NVIDIA Riva Translate 4B Instruct v2 Client
────────────────────────────────────────────
OpenAI-compatible chat completions client for neural machine translation.
Supports 37 languages including English→Hindi (en-hi).

Model: nvidia/riva-translate-4b-instruct-v2
Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any
from openai import OpenAI
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("mediscribe.riva_translate")


class RivaTranslateSettings(BaseSettings):
    """Settings for Riva Translate integration."""
    NVIDIA_API_KEY: str = ""
    RIVA_TRANSLATE_MODEL: str = "nvidia/riva-translate-4b-instruct-v2"
    RIVA_TRANSLATE_URL: str = "https://integrate.api.nvidia.com/v1"
    ENABLE_RIVA_TRANSLATE: bool = True
    RIVA_TRANSLATE_TIMEOUT: float = 30.0
    RIVA_TRANSLATE_MAX_TOKENS: int = 512
    RIVA_TRANSLATE_TEMPERATURE: float = 0.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


_settings = RivaTranslateSettings()

# Language pair codes for Riva Translate (system prompt)
LANGUAGE_PAIRS = {
    "en-hi": "en-hi",      # English → Hindi
    "hi-en": "hi-en",      # Hindi → English
    "en-mr": "en-mr",      # English → Marathi
    "mr-en": "mr-en",      # Marathi → English
    "en-ta": "en-ta",      # English → Tamil
    "ta-en": "ta-en",      # Tamil → English
    "en-te": "en-te",      # English → Telugu
    "te-en": "te-en",      # Telugu → English
    "en-bn": "en-bn",      # English → Bengali
    "bn-en": "bn-en",      # Bengali → English
    "en-gu": "en-gu",      # English → Gujarati
    "gu-en": "gu-en",      # Gujarati → English
    "en-kn": "en-kn",      # English → Kannada
    "kn-en": "kn-en",      # Kannada → English
    "en-ml": "en-ml",      # English → Malayalam
    "ml-en": "ml-en",      # Malayalam → English
    "en-or": "en-or",      # English → Odia
    "or-en": "or-en",      # Odia → English
    "en-pa": "en-pa",      # English → Punjabi
    "pa-en": "pa-en",      # Punjabi → English
}

# Default language pair for Hindi summarizer
DEFAULT_LANG_PAIR = "en-hi"


class RivaTranslateClient:
    """Client for NVIDIA Riva Translate 4B Instruct v2 via OpenAI-compatible API."""

    def __init__(self):
        self.api_key = _settings.NVIDIA_API_KEY
        self.model = _settings.RIVA_TRANSLATE_MODEL
        self.base_url = _settings.RIVA_TRANSLATE_URL
        self.enabled = _settings.ENABLE_RIVA_TRANSLATE
        self.timeout = _settings.RIVA_TRANSLATE_TIMEOUT
        self.max_tokens = _settings.RIVA_TRANSLATE_MAX_TOKENS
        self.temperature = _settings.RIVA_TRANSLATE_TEMPERATURE
        self._client: Optional[OpenAI] = None

        if self.enabled and self.api_key and self.api_key not in ("", "placeholder-dev"):
            try:
                self._client = OpenAI(
                    api_key=self.api_key,
                    base_url=self.base_url,
                    timeout=self.timeout,
                )
                logger.info(f"[RivaTranslate] Initialized — model: {self.model}, endpoint: {self.base_url}")
            except Exception as e:
                logger.error(f"[RivaTranslate] Failed to initialize client: {e}")
                self._client = None
        else:
            logger.warning("[RivaTranslate] Not configured — NVIDIA_API_KEY missing or disabled")

    def is_available(self) -> bool:
        """Check if the translation service is available."""
        return self._client is not None

    def _get_language_pair(self, source_lang: str = "en", target_lang: str = "hi") -> str:
        """Get the language pair code for the system prompt."""
        pair = f"{source_lang}-{target_lang}"
        return LANGUAGE_PAIRS.get(pair, DEFAULT_LANG_PAIR)

    def translate(
        self,
        text: str,
        source_lang: str = "en",
        target_lang: str = "hi",
    ) -> str:
        """
        Translate text from source language to target language.

        Args:
            text: Text to translate
            source_lang: Source language code (e.g., 'en')
            target_lang: Target language code (e.g., 'hi')

        Returns:
            Translated text, or original text if translation fails
        """
        if not text or not text.strip():
            return text

        if not self.is_available():
            logger.warning("[RivaTranslate] Service not available, returning original text")
            return text

        lang_pair = self._get_language_pair(source_lang, target_lang)

        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": lang_pair},
                    {"role": "user", "content": text.strip()},
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=False,
            )

            translated = response.choices[0].message.content
            if translated and translated.strip():
                logger.debug(f"[RivaTranslate] Translated: '{text[:50]}...' → '{translated[:50]}...'")
                return translated.strip()
            else:
                logger.warning("[RivaTranslate] Empty translation returned")
                return text

        except Exception as e:
            logger.error(f"[RivaTranslate] Translation failed: {e}")
            return text

    def translate_batch(
        self,
        texts: List[str],
        source_lang: str = "en",
        target_lang: str = "hi",
    ) -> List[str]:
        """
        Translate multiple texts sequentially.

        Args:
            texts: List of texts to translate
            source_lang: Source language code
            target_lang: Target language code

        Returns:
            List of translated texts (same order)
        """
        if not self.is_available():
            logger.warning("[RivaTranslate] Service not available, returning original texts")
            return texts

        results = []
        for text in texts:
            translated = self.translate(text, source_lang, target_lang)
            results.append(translated)
        return results

    def translate_structured(
        self,
        data: Dict[str, Any],
        fields_to_translate: List[str],
        source_lang: str = "en",
        target_lang: str = "hi",
    ) -> Dict[str, Any]:
        """
        Translate specific fields in a structured dictionary.

        Args:
            data: Dictionary with fields to translate
            fields_to_translate: List of field names to translate
            source_lang: Source language code
            target_lang: Target language code

        Returns:
            New dictionary with translated fields
        """
        if not self.is_available():
            logger.warning("[RivaTranslate] Service not available, returning original data")
            return data

        result = dict(data)
        for field in fields_to_translate:
            value = data.get(field)
            if value and isinstance(value, str) and value.strip():
                result[field] = self.translate(value, source_lang, target_lang)
            elif value and isinstance(value, list):
                # Handle list of strings or dicts
                translated_list = []
                for item in value:
                    if isinstance(item, str) and item.strip():
                        translated_list.append(self.translate(item, source_lang, target_lang))
                    elif isinstance(item, dict):
                        # Recursively translate dict fields
                        translated_list.append(self.translate_structured(item, fields_to_translate, source_lang, target_lang))
                    else:
                        translated_list.append(item)
                result[field] = translated_list
            elif value and isinstance(value, dict):
                result[field] = self.translate_structured(value, fields_to_translate, source_lang, target_lang)
        return result


# Singleton instance
_riva_translate_client: Optional[RivaTranslateClient] = None


def get_riva_translate_client() -> RivaTranslateClient:
    """Get or create the singleton Riva Translate client."""
    global _riva_translate_client
    if _riva_translate_client is None:
        _riva_translate_client = RivaTranslateClient()
    return _riva_translate_client


# Convenience function for simple translations
def translate_to_hindi(text: str, source_lang: str = "en") -> str:
    """Quick translation to Hindi using Riva Translate."""
    client = get_riva_translate_client()
    return client.translate(text, source_lang, "hi")


def translate_to_english(text: str, source_lang: str = "hi") -> str:
    """Quick translation to English using Riva Translate."""
    client = get_riva_translate_client()
    return client.translate(text, source_lang, "en")