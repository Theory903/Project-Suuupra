"""
Service for Managing Conversations
"""

import os
from sqlalchemy.future import select
from .. import models
from .. import schemas
from uuid import uuid4
from datetime import datetime
from .retriever import HybridRetriever
from .safety_service import SafetyService
from langchain.vectorstores import Milvus
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.retrievers import BM25Retriever
from langchain.chat_models import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain
from langchain.prompts import PromptTemplate
from langchain.schema.messages import HumanMessage, AIMessage
from langchain.memory.chat_message_histories import RedisChatMessageHistory
import openai

# --- vLLM Configuration ---
VLLM_HOST = os.environ.get("VLLM_HOST", "http://localhost:8000")
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = os.environ.get("REDIS_PORT", 6379)

class ConversationManager:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.retriever = self._init_retriever()
        self.llm_client = openai.AsyncOpenAI(base_url=VLLM_HOST)
        self.safety_service = SafetyService()

    def _init_retriever(self):
        """Initializes the hybrid retriever."""
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        vector_store = Milvus(
            embeddings,
            connection_args={"host": "localhost", "port": "19530"},
            collection_name="llm_tutor_content"
        )
        bm25_retriever = BM25Retriever.from_texts([])
        return HybridRetriever(vector_store, bm25_retriever)

    async def create_conversation(self, user_id: str, subject: str = None):
        """Creates a new conversation."""
        conversation_id = str(uuid4())
        created_at = datetime.utcnow()

        new_conversation = models.Conversation(
            id=conversation_id,
            user_id=user_id,
            subject=subject,
            created_at=created_at,
            updated_at=created_at,
        )
        self.db.add(new_conversation)
        await self.db.commit()
        return conversation_id, created_at

    async def post_message(self, user_id: str, conversation_id: str, message: schemas.MessageInput):
        """Posts a message to a conversation and gets a response."""
        # 1. Check input safety
        if not self.safety_service.is_input_safe(message.text):
            return schemas.MessageOutput(text="I'm sorry, I can't respond to that. Let's talk about something else.")

        chat_history = self._get_chat_history(conversation_id)

        # 2. Retrieve relevant documents
        retrieved_docs = self.retriever.get_relevant_documents(message.text)

        # 3. Format the prompt
        prompt = self._format_prompt_with_history(message.text, retrieved_docs, chat_history.messages)

        # 4. Generate a response
        response = await self.llm_client.completions.create(
            model="/mnt/models/mistral-7b-instruct-v0.2",
            prompt=prompt,
            max_tokens=512,
            temperature=0.7,
        )
        response_text = response.choices[0].text.strip()

        # 5. Check output safety
        if not self.safety_service.is_output_safe(response_text):
            return schemas.MessageOutput(text="I'm sorry, I can't provide a response to that. Let's talk about something else.")

        # 6. Update chat history
        chat_history.add_user_message(message.text)
        chat_history.add_ai_message(response_text)

        # 7. Update learning progress
        await self.update_learning_progress(user_id, message.text, response_text)

        return schemas.MessageOutput(text=response_text)

    async def update_learning_progress(self, user_id: str, user_message: str, bot_response: str):
        """Updates the user's learning progress."""
        # This is a placeholder implementation.
        # In a real implementation, we would use a more sophisticated method to assess the user's understanding.
        is_correct = "correct" in bot_response.lower()

        learning_progress = await self.db.execute(
            select(models.LearningProgress).where(models.LearningProgress.user_id == user_id)
        )
        learning_progress = learning_progress.scalar_one_or_none()

        if learning_progress:
            learning_progress.update_progress(is_correct, 10.0)
            await self.db.commit()

    def _get_chat_history(self, conversation_id: str):
        """Gets the chat history from Redis."""
        return RedisChatMessageHistory(conversation_id, url=f"redis://{REDIS_HOST}:{REDIS_PORT}/0")

    def _format_prompt_with_history(self, query: str, documents: list, history: list):
        """Formats the prompt for the language model with chat history."""
        context = "\n".join([doc.page_content for doc in documents])
        history_str = "\n".join([f"{msg.type}: {msg.content}" for msg in history])

        prompt = f"""**Chat History:**
{history_str}

**Context:**
{context}

**Question:**
{query}

**Answer:**
"""
        return prompt

    async def get_conversation_history(self, conversation_id: str, limit: int, offset: int):
        """Gets the history of a conversation."""
        chat_history = self._get_chat_history(conversation_id)
        return [schemas.ConversationMessage(sender=msg.type, message=schemas.MessageOutput(text=msg.content), timestamp=datetime.utcnow()) for msg in chat_history.messages]
