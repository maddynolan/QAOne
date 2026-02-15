"""
Pydantic models for the Playwright Recorder API
"""

from typing import Dict, List, Any
from pydantic import BaseModel


class GenerateScriptRequest(BaseModel):
    actions: List[Dict[str, Any]]
    metadata: Dict[str, Any] = {}
    options: Dict[str, Any] = {}
