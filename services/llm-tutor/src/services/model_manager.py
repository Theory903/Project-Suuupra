"""
Model Manager for LLM Tutor Service
Manages lifecycle of LLM, embedding, and other AI models
Handles model loading, inference, and resource management
"""

import asyncio
import logging
from typing import Optional, Dict, Any, List, AsyncGenerator
from datetime import datetime
import json
import os

import structlog
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, AutoModel
from sentence_transformers import SentenceTransformer
import httpx

from ..config.settings import Settings
from ..core.redis import get_cache_manager

logger = structlog.get_logger(__name__)


class ModelLoadError(Exception):
    """Exception raised when model loading fails"""
    pass


class InferenceError(Exception):
    """Exception raised during model inference"""
    pass


class LLMManager:
    """Manages Large Language Model inference"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = None
        self.tokenizer = None
        self.device = None
        self.is_ready = False
        self.model_name = settings.LLM_MODEL_NAME
        self.max_tokens = settings.LLM_MAX_TOKENS
        self.temperature = settings.LLM_TEMPERATURE
        
    async def initialize(self):
        """Initialize the LLM model"""
        try:
            logger.info("Initializing LLM model", model=self.model_name)
            
            # Set device
            if self.settings.GPU_ENABLED and torch.cuda.is_available():
                self.device = torch.device("cuda")
                logger.info("Using GPU for LLM inference", device=self.device)
            else:
                self.device = torch.device("cpu")
                logger.info("Using CPU for LLM inference", device=self.device)
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                cache_dir=self.settings.HUGGINGFACE_CACHE_DIR,
                token=self.settings.HUGGINGFACE_API_TOKEN
            )
            
            # Add padding token if missing
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Load model
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                cache_dir=self.settings.HUGGINGFACE_CACHE_DIR,
                token=self.settings.HUGGINGFACE_API_TOKEN,
                torch_dtype=torch.float16 if self.device.type == "cuda" else torch.float32,
                device_map="auto" if self.device.type == "cuda" else None,
                trust_remote_code=True,
            )
            
            if self.device.type == "cpu":
                self.model = self.model.to(self.device)
            
            # Set to evaluation mode
            self.model.eval()
            
            self.is_ready = True
            logger.info("LLM model initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize LLM model", error=str(e))
            raise ModelLoadError(f"LLM initialization failed: {str(e)}")
    
    async def generate(
        self, 
        prompt: str, 
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        stop_sequences: Optional[List[str]] = None
    ) -> str:
        """Generate text response from the LLM"""
        
        if not self.is_ready:
            raise InferenceError("LLM model not initialized")
        
        try:
            # Set generation parameters
            max_tokens = max_tokens or self.max_tokens
            temperature = temperature or self.temperature
            top_p = top_p or self.settings.LLM_TOP_P
            
            # Tokenize input
            inputs = self.tokenizer.encode(
                prompt, 
                return_tensors="pt", 
                truncation=True, 
                max_length=2048
            ).to(self.device)
            
            # Generate response
            with torch.no_grad():
                outputs = self.model.generate(
                    inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    do_sample=True,
                    pad_token_id=self.tokenizer.pad_token_id,
                    eos_token_id=self.tokenizer.eos_token_id,
                    repetition_penalty=1.1,
                    no_repeat_ngram_size=3,
                )
            
            # Decode response (remove input prompt)
            response = self.tokenizer.decode(
                outputs[0][inputs.shape[1]:], 
                skip_special_tokens=True,
                clean_up_tokenization_spaces=True
            )
            
            # Apply stop sequences
            if stop_sequences:
                for stop in stop_sequences:
                    if stop in response:
                        response = response[:response.find(stop)]
            
            return response.strip()
            
        except Exception as e:
            logger.error("LLM generation failed", error=str(e), prompt_preview=prompt[:100])
            raise InferenceError(f"Generation failed: {str(e)}")
    
    async def generate_stream(
        self, 
        prompt: str, 
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None
    ) -> AsyncGenerator[str, None]:
        """Generate streaming text response"""
        
        if not self.is_ready:
            raise InferenceError("LLM model not initialized")
        
        try:
            # For now, simulate streaming by yielding the full response
            # In production, this would use vLLM or similar for true streaming
            response = await self.generate(prompt, max_tokens, temperature)
            
            # Simulate streaming by yielding words
            words = response.split()
            for word in words:
                yield word + " "
                await asyncio.sleep(0.05)  # Simulate streaming delay
                
        except Exception as e:
            logger.error("Streaming generation failed", error=str(e))
            raise InferenceError(f"Streaming generation failed: {str(e)}")
    
    async def cleanup(self):
        """Cleanup model resources"""
        if self.model:
            del self.model
        if self.tokenizer:
            del self.tokenizer
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        self.is_ready = False
        logger.info("LLM model cleaned up")


class EmbeddingManager:
    """Manages embedding model for RAG pipeline"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = None
        self.is_ready = False
        self.model_name = settings.EMBEDDING_MODEL_NAME
        self.batch_size = settings.EMBEDDING_BATCH_SIZE
        
    async def initialize(self):
        """Initialize the embedding model"""
        try:
            logger.info("Initializing embedding model", model=self.model_name)
            
            # Load sentence transformer model
            device = "cuda" if self.settings.GPU_ENABLED and torch.cuda.is_available() else "cpu"
            
            self.model = SentenceTransformer(
                self.model_name,
                cache_folder=self.settings.HUGGINGFACE_CACHE_DIR,
                device=device
            )
            
            self.is_ready = True
            logger.info("Embedding model initialized successfully", device=device)
            
        except Exception as e:
            logger.error("Failed to initialize embedding model", error=str(e))
            raise ModelLoadError(f"Embedding model initialization failed: {str(e)}")
    
    async def encode(self, texts: List[str], normalize: bool = True) -> List[List[float]]:
        """Generate embeddings for texts"""
        
        if not self.is_ready:
            raise InferenceError("Embedding model not initialized")
        
        if not texts:
            return []
        
        try:
            # Generate embeddings in batches
            all_embeddings = []
            
            for i in range(0, len(texts), self.batch_size):
                batch_texts = texts[i:i + self.batch_size]
                
                # Generate embeddings
                embeddings = self.model.encode(
                    batch_texts,
                    convert_to_tensor=False,
                    normalize_embeddings=normalize,
                    show_progress_bar=False
                )
                
                all_embeddings.extend(embeddings.tolist())
            
            return all_embeddings
            
        except Exception as e:
            logger.error("Embedding generation failed", error=str(e), text_count=len(texts))
            raise InferenceError(f"Embedding generation failed: {str(e)}")
    
    async def encode_single(self, text: str, normalize: bool = True) -> List[float]:
        """Generate embedding for a single text"""
        embeddings = await self.encode([text], normalize=normalize)
        return embeddings[0] if embeddings else []
    
    async def cleanup(self):
        """Cleanup embedding model resources"""
        if self.model:
            del self.model
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        self.is_ready = False
        logger.info("Embedding model cleaned up")


class SafetyClassifier:
    """Content safety classification model"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.is_ready = False
        
    async def initialize(self):
        """Initialize safety classifier"""
        # For now, use a simple rule-based classifier
        # In production, this would be replaced with Llama Guard or similar
        self.is_ready = True
        logger.info("Safety classifier initialized")
    
    async def classify_input(self, text: str) -> Dict[str, Any]:
        """Classify input text for safety"""
        if not self.is_ready:
            return {"is_safe": True, "category": None, "confidence": 0.0}
        
        # Simple rule-based safety check
        unsafe_keywords = [
            "violence", "hate", "harassment", "self-harm", 
            "sexual", "illegal", "discrimination"
        ]
        
        text_lower = text.lower()
        for keyword in unsafe_keywords:
            if keyword in text_lower:
                return {
                    "is_safe": False,
                    "category": "inappropriate_content",
                    "confidence": 0.8,
                    "detected_keyword": keyword
                }
        
        return {"is_safe": True, "category": None, "confidence": 0.9}
    
    async def classify_output(self, text: str) -> Dict[str, Any]:
        """Classify output text for safety"""
        return await self.classify_input(text)
    
    async def cleanup(self):
        """Cleanup safety classifier"""
        self.is_ready = False


class ModelManager:
    """Central manager for all AI models"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.llm_manager = LLMManager(settings)
        self.embedding_manager = EmbeddingManager(settings)
        self.safety_classifier = SafetyClassifier(settings)
        self.cache_manager = None
        
    async def initialize(self):
        """Initialize all models"""
        logger.info("Initializing Model Manager...")
        
        # Initialize cache manager
        self.cache_manager = await get_cache_manager()
        
        # Initialize models based on configuration
        initialization_tasks = []
        
        # Always initialize embedding model for RAG
        initialization_tasks.append(self.embedding_manager.initialize())
        
        # Initialize LLM if not using external API
        if not self.settings.OPENAI_API_KEY:
            initialization_tasks.append(self.llm_manager.initialize())
        
        # Initialize safety classifier if enabled
        if self.settings.ENABLE_CONTENT_FILTER:
            initialization_tasks.append(self.safety_classifier.initialize())
        
        # Run initialization tasks concurrently
        try:
            await asyncio.gather(*initialization_tasks)
            logger.info("All models initialized successfully")
            
        except Exception as e:
            logger.error("Model initialization failed", error=str(e))
            raise
    
    async def generate_response(
        self, 
        prompt: str, 
        use_cache: bool = True,
        **kwargs
    ) -> str:
        """Generate text response with optional caching"""
        
        # Check cache first
        if use_cache and self.cache_manager:
            cache_key = f"llm_response:{hash(prompt + str(kwargs))}"
            cached_response = await self.cache_manager.get("llm", cache_key)
            if cached_response:
                return cached_response
        
        # Generate response
        if self.settings.OPENAI_API_KEY:
            response = await self._generate_openai_response(prompt, **kwargs)
        else:
            response = await self.llm_manager.generate(prompt, **kwargs)
        
        # Cache response
        if use_cache and self.cache_manager and response:
            cache_key = f"llm_response:{hash(prompt + str(kwargs))}"
            await self.cache_manager.set("llm", cache_key, response, ttl=3600)
        
        return response
    
    async def _generate_openai_response(self, prompt: str, **kwargs) -> str:
        """Generate response using OpenAI API as fallback"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.settings.OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.settings.OPENAI_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": kwargs.get("max_tokens", self.settings.LLM_MAX_TOKENS),
                        "temperature": kwargs.get("temperature", self.settings.LLM_TEMPERATURE),
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
        except Exception as e:
            logger.error("OpenAI API call failed", error=str(e))
            raise InferenceError(f"OpenAI API failed: {str(e)}")
    
    async def generate_embeddings(self, texts: List[str], use_cache: bool = True) -> List[List[float]]:
        """Generate embeddings with optional caching"""
        if not texts:
            return []
        
        embeddings = []
        uncached_texts = []
        uncached_indices = []
        
        # Check cache for each text
        if use_cache and self.cache_manager:
            for i, text in enumerate(texts):
                cache_key = f"embedding:{hash(text)}"
                cached_embedding = await self.cache_manager.get("embeddings", cache_key)
                
                if cached_embedding:
                    embeddings.append(cached_embedding)
                else:
                    embeddings.append(None)
                    uncached_texts.append(text)
                    uncached_indices.append(i)
        else:
            uncached_texts = texts
            uncached_indices = list(range(len(texts)))
            embeddings = [None] * len(texts)
        
        # Generate embeddings for uncached texts
        if uncached_texts:
            new_embeddings = await self.embedding_manager.encode(uncached_texts)
            
            # Cache new embeddings and update results
            for i, (text, embedding) in enumerate(zip(uncached_texts, new_embeddings)):
                original_index = uncached_indices[i]
                embeddings[original_index] = embedding
                
                if use_cache and self.cache_manager:
                    cache_key = f"embedding:{hash(text)}"
                    await self.cache_manager.set("embeddings", cache_key, embedding, ttl=86400)
        
        return embeddings
    
    async def check_content_safety(self, text: str, is_input: bool = True) -> Dict[str, Any]:
        """Check content safety"""
        if not self.settings.ENABLE_CONTENT_FILTER:
            return {"is_safe": True, "category": None, "confidence": 1.0}
        
        if is_input:
            return await self.safety_classifier.classify_input(text)
        else:
            return await self.safety_classifier.classify_output(text)
    
    def is_llm_ready(self) -> bool:
        """Check if LLM is ready for inference"""
        return self.llm_manager.is_ready or bool(self.settings.OPENAI_API_KEY)
    
    def is_embedding_ready(self) -> bool:
        """Check if embedding model is ready"""
        return self.embedding_manager.is_ready
    
    def is_safety_ready(self) -> bool:
        """Check if safety classifier is ready"""
        return self.safety_classifier.is_ready
    
    async def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded models"""
        return {
            "llm": {
                "model_name": self.settings.LLM_MODEL_NAME,
                "is_ready": self.is_llm_ready(),
                "using_openai": bool(self.settings.OPENAI_API_KEY),
            },
            "embedding": {
                "model_name": self.settings.EMBEDDING_MODEL_NAME,
                "is_ready": self.is_embedding_ready(),
                "dimension": getattr(self.embedding_manager.model, 'get_sentence_embedding_dimension', lambda: 384)() if self.embedding_manager.is_ready else None,
            },
            "safety": {
                "enabled": self.settings.ENABLE_CONTENT_FILTER,
                "is_ready": self.is_safety_ready(),
            },
            "gpu_enabled": self.settings.GPU_ENABLED,
            "device": "cuda" if torch.cuda.is_available() and self.settings.GPU_ENABLED else "cpu",
        }
    
    async def cleanup(self):
        """Cleanup all models"""
        logger.info("Cleaning up Model Manager...")
        
        cleanup_tasks = [
            self.llm_manager.cleanup(),
            self.embedding_manager.cleanup(),
            self.safety_classifier.cleanup(),
        ]
        
        await asyncio.gather(*cleanup_tasks, return_exceptions=True)
        logger.info("Model Manager cleanup complete")
