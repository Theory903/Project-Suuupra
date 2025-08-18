"""
Service for Content Safety
"""

class SafetyService:
    def __init__(self):
        self.blocked_keywords = ["harmful", "dangerous", "illegal"]

    def is_input_safe(self, text: str) -> bool:
        """Checks if the input text is safe."""
        for keyword in self.blocked_keywords:
            if keyword in text.lower():
                return False
        return True

    def is_output_safe(self, text: str) -> bool:
        """Checks if the output text is safe."""
        # For now, we'll use the same checks as the input
        return self.is_input_safe(text)
