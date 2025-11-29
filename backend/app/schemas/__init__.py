"""
Schemas package - Contains all Pydantic models
"""
# Import agent schemas
from app.schemas.agent_schemas import *  # Import agent schemas

# Import from schemas.py file (need to import the module directly)
import importlib.util
import os
schemas_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'schemas.py')
spec = importlib.util.spec_from_file_location("app_schemas", schemas_file)
app_schemas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_schemas)

# Re-export everything from app.schemas (the file)
for attr in dir(app_schemas):
    if not attr.startswith('_'):
        globals()[attr] = getattr(app_schemas, attr)

