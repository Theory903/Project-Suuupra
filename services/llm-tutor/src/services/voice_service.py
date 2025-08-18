"""
Service for Voice Operations (ASR and TTS)
"""

import whisper
from fastapi import UploadFile
from tts.api import TTS

import tempfile
import os

class VoiceService:
    def __init__(self):
        self.asr_model = whisper.load_model("base")
        self.tts_model = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False, gpu=False)

    async def transcribe_audio(self, file: UploadFile) -> str:
        """Transcribes audio to text using Whisper."""
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        
        result = self.asr_model.transcribe(tmp_path)
        os.remove(tmp_path)
        return result["text"]

    async def text_to_speech(self, text: str) -> bytes:
        """Converts text to speech using TTS."""
        wav_bytes = self.tts_model.tts_to_wav(text)
        return wav_bytes
