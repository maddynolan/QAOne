"""
Capability Map Builder
Converts exploration results into structured requirement-like capabilities.
Uses LLM to normalize discovered pages into machine-friendly requirement objects.
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

from app.services.llm.model_gateway import get_model_gateway, GenerationRequest

logger = logging.getLogger(__name__)


@dataclass
class EntityCapability:
    """Represents a capability for a specific entity."""
    entity: str
    operation: str  # Create, Read, Update, Delete, Search, Export, etc.
    preconditions: List[str] = field(default_factory=list)
    postconditions: List[str] = field(default_factory=list)
    fields: List[Dict[str, Any]] = field(default_factory=list)
    validations: List[Dict[str, Any]] = field(default_factory=list)
    source_pages: List[str] = field(default_factory=list)
    url_patterns: List[str] = field(default_factory=list)
    roles: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class CapabilityMapBuilder:
    """
    Converts exploration results into structured capability requirements.
    Uses LLM to infer entities, operations, and business rules from discovered pages.
    """
    
    def __init__(self):
        try:
            self.model_gateway = get_model_gateway()
        except Exception as e:
            logger.warning(f"Failed to initialize model gateway: {e}, LLM features will be disabled")
            self.model_gateway = None
    
    async def build_capability_map(self, exploration_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert exploration results into a structured capability map.
        
        Args:
            exploration_result: Output from AutonomousExplorer.explore()
        
        Returns:
            Dictionary with normalized capabilities grouped by entity
        """
        logger.info("Building capability map from exploration results")
        
        pages = exploration_result.get('pages', [])
        
        # Step 1: Extract entities and operations from pages
        entity_capabilities = await self._extract_entity_capabilities(pages)
        
        # Step 2: Use LLM to normalize and enrich capabilities
        normalized_capabilities = await self._normalize_with_llm(entity_capabilities, pages)
        
        # Step 3: Build final capability map
        capability_map = {
            'base_url': exploration_result.get('base_url'),
            'exploration_date': exploration_result.get('exploration_date'),
            'total_pages': exploration_result.get('total_pages'),
            'entities': normalized_capabilities,
            'pages': pages  # Keep original page data for reference
        }
        
        # Preserve LLM analysis fields if they exist in exploration_result
        # (These are added by AutonomousExplorer during exploration)
        if 'llm_analysis' in exploration_result:
            capability_map['llm_analysis'] = exploration_result['llm_analysis']
            logger.info("Preserved llm_analysis in capability map")
        if 'initial_analysis' in exploration_result:
            capability_map['initial_analysis'] = exploration_result['initial_analysis']
            logger.info("Preserved initial_analysis in capability map")
        
        logger.info(f"Capability map built: {len(normalized_capabilities)} entity capabilities")
        return capability_map
    
    async def _extract_entity_capabilities(self, pages: List[Dict[str, Any]]) -> List[EntityCapability]:
        """Extract entity capabilities from pages (heuristic-based)."""
        entity_capabilities = {}
        
        for page in pages:
            entities = page.get('entities', [])
            actions = page.get('actions', [])
            forms = page.get('forms', [])
            url = page.get('url', '')
            url_pattern = page.get('url_pattern', '')
            
            # Infer operations from URL patterns and actions
            operations = self._infer_operations(url, url_pattern, actions, forms)
            
            for entity in entities:
                if entity not in entity_capabilities:
                    entity_capabilities[entity] = {
                        'entity': entity,
                        'operations': set(),
                        'pages': [],
                        'forms': [],
                        'url_patterns': []
                    }
                
                entity_capabilities[entity]['operations'].update(operations)
                entity_capabilities[entity]['pages'].append(page.get('id'))
                entity_capabilities[entity]['url_patterns'].append(url_pattern or url)
                
                # Extract forms for this entity
                for form in forms:
                    entity_capabilities[entity]['forms'].append(form)
        
        # Convert to EntityCapability objects
        capabilities = []
        for entity, data in entity_capabilities.items():
            for operation in data['operations']:
                # Extract fields from forms
                fields = self._extract_fields_from_forms(data['forms'], operation)
                
                capabilities.append(EntityCapability(
                    entity=entity,
                    operation=operation,
                    fields=fields,
                    source_pages=data['pages'],
                    url_patterns=list(set(data['url_patterns'])),
                    metadata={'inferred': True}
                ))
        
        return capabilities
    
    def _infer_operations(self, url: str, url_pattern: str, actions: List[str], forms: List[Dict]) -> List[str]:
        """Infer CRUD operations from URL patterns, actions, and forms."""
        operations = []
        
        url_lower = url.lower()
        pattern_lower = (url_pattern or '').lower()
        
        # URL pattern-based inference
        if '/create' in url_lower or '/new' in url_lower or pattern_lower.endswith('/:id/new'):
            operations.append('Create')
        elif '/edit' in url_lower or pattern_lower.endswith('/:id/edit'):
            operations.append('Update')
        elif '/delete' in url_lower or '/remove' in url_lower:
            operations.append('Delete')
        elif '/list' in url_lower or '/index' in url_lower or '/search' in url_lower:
            operations.append('Read')
            operations.append('Search')
        elif '/export' in url_lower:
            operations.append('Export')
        elif '/import' in url_lower:
            operations.append('Import')
        elif '/view' in url_lower or '/show' in url_lower or pattern_lower.endswith('/:id'):
            operations.append('Read')
        # E-commerce specific patterns
        elif '/shop' in url_lower or '/product' in url_lower or '/item' in url_lower or '/deal' in url_lower:
            operations.append('Browse')
            operations.append('Read')
        elif '/cart' in url_lower:
            operations.append('Manage')
            operations.append('Update')
        elif '/order' in url_lower or '/checkout' in url_lower:
            operations.append('Create')
            operations.append('Read')
        elif '/account' in url_lower or '/profile' in url_lower:
            operations.append('Read')
            operations.append('Update')
        
        # Action-based inference
        for action in actions:
            if action.capitalize() not in operations:
                operations.append(action.capitalize())
        
        # Form-based inference
        if forms:
            # If form has action with /create or /new, it's Create
            for form in forms:
                form_action = form.get('action', '').lower()
                if '/create' in form_action or '/new' in form_action:
                    if 'Create' not in operations:
                        operations.append('Create')
                elif '/edit' in form_action or '/update' in form_action:
                    if 'Update' not in operations:
                        operations.append('Update')
        
        return operations if operations else ['Read']  # Default to Read if nothing found
    
    def _extract_fields_from_forms(self, forms: List[Dict], operation: str) -> List[Dict[str, Any]]:
        """Extract field definitions from forms."""
        fields = []
        
        for form in forms:
            form_fields = form.get('fields', [])
            for field in form_fields:
                # Skip if field already exists (by name)
                if any(f.get('name') == field.get('name') for f in fields):
                    continue
                
                fields.append({
                    'name': field.get('name', ''),
                    'label': field.get('label', ''),
                    'type': field.get('type', 'text'),
                    'required': field.get('required', False),
                    'options': field.get('options', []),
                    'placeholder': field.get('placeholder', '')
                })
        
        return fields
    
    async def _normalize_with_llm(self, capabilities: List[EntityCapability], pages: List[Dict]) -> List[Dict[str, Any]]:
        """Use LLM to normalize and enrich capabilities."""
        if not capabilities:
            return []
        
        # Skip LLM if model gateway is not available
        if not self.model_gateway:
            logger.warning("Model gateway not available, using heuristic data only")
            return [self._capability_to_dict(cap) for cap in capabilities]
        
        # Group capabilities by entity
        entity_groups = {}
        for cap in capabilities:
            if cap.entity not in entity_groups:
                entity_groups[cap.entity] = []
            entity_groups[cap.entity].append(cap)
        
        # Build prompt for LLM
        prompt = self._build_normalization_prompt(entity_groups, pages)
        
        try:
            # Combine system prompt and user message into a single prompt
            full_prompt = f"""You are an expert at analyzing application capabilities and converting them into structured requirement objects.

{prompt}"""
            
            request = GenerationRequest(
                prompt=full_prompt,
                max_tokens=4000,
                temperature=0.3
            )
            
            response = await self.model_gateway.generate(request)
            normalized = self._parse_llm_response(response)
            
            # Merge LLM insights with heuristic data
            return self._merge_capabilities(capabilities, normalized)
            
        except Exception as e:
            logger.warning(f"LLM normalization failed: {e}, using heuristic data only", exc_info=True)
            return [self._capability_to_dict(cap) for cap in capabilities]
    
    def _build_normalization_prompt(self, entity_groups: Dict[str, List[EntityCapability]], pages: List[Dict]) -> str:
        """Build prompt for LLM normalization."""
        prompt = f"""Analyze the following application exploration results and convert them into structured requirement objects.

EXPLORED PAGES:
{self._format_pages_summary(pages)}

DISCOVERED CAPABILITIES:
{self._format_capabilities_summary(entity_groups)}

For each entity and operation combination, provide:
1. Preconditions (what must be true before this operation)
2. Postconditions (what is true after this operation)
3. Field validations (required fields, value constraints)
4. Business rules (role-based access, data constraints)

Return JSON array of normalized capabilities in this format:
[
  {{
    "entity": "User",
    "operation": "Create",
    "preconditions": ["Admin is logged in"],
    "postconditions": ["New user record exists", "Confirmation message shown"],
    "fields": [
      {{"name": "first_name", "required": true, "type": "text"}},
      {{"name": "role", "required": true, "type": "select", "options": ["Admin", "Viewer"]}}
    ],
    "validations": [
      {{"field": "email", "type": "email_format"}},
      {{"field": "password", "type": "min_length", "value": 8}}
    ],
    "roles": ["Admin"],
    "source_pages": ["user_create"]
  }}
]

Focus on accuracy and completeness. Infer business rules from form fields, button labels, and page structure."""
        
        return prompt
    
    def _format_pages_summary(self, pages: List[Dict]) -> str:
        """Format pages for prompt."""
        summary = []
        for page in pages[:20]:  # Limit to first 20 pages
            summary.append(f"- {page.get('title', 'Untitled')} ({page.get('url')})")
            if page.get('entities'):
                summary.append(f"  Entities: {', '.join(page.get('entities', []))}")
            if page.get('actions'):
                summary.append(f"  Actions: {', '.join(page.get('actions', []))}")
        return '\n'.join(summary)
    
    def _format_capabilities_summary(self, entity_groups: Dict[str, List[EntityCapability]]) -> str:
        """Format capabilities for prompt."""
        summary = []
        for entity, caps in entity_groups.items():
            operations = [cap.operation for cap in caps]
            summary.append(f"- {entity}: {', '.join(operations)}")
            for cap in caps:
                if cap.fields:
                    field_names = [f.get('name', '') for f in cap.fields]
                    summary.append(f"  {cap.operation} fields: {', '.join(field_names)}")
        return '\n'.join(summary)
    
    def _parse_llm_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse LLM JSON response."""
        import json
        import re
        
        # Extract JSON from response
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except:
                pass
        
        # Fallback: try to parse entire response
        try:
            return json.loads(response)
        except:
            logger.warning("Failed to parse LLM response as JSON")
            return []
    
    def _merge_capabilities(self, heuristic_caps: List[EntityCapability], llm_caps: List[Dict]) -> List[Dict[str, Any]]:
        """Merge heuristic and LLM capabilities."""
        merged = []
        
        # Create lookup for LLM capabilities
        llm_lookup = {}
        for llm_cap in llm_caps:
            key = f"{llm_cap.get('entity')}_{llm_cap.get('operation')}"
            llm_lookup[key] = llm_cap
        
        # Merge each heuristic capability with LLM data
        for heuristic_cap in heuristic_caps:
            key = f"{heuristic_cap.entity}_{heuristic_cap.operation}"
            llm_cap = llm_lookup.get(key, {})
            
            merged_cap = {
                'entity': heuristic_cap.entity,
                'operation': heuristic_cap.operation,
                'preconditions': llm_cap.get('preconditions', heuristic_cap.preconditions),
                'postconditions': llm_cap.get('postconditions', heuristic_cap.postconditions),
                'fields': llm_cap.get('fields', heuristic_cap.fields),
                'validations': llm_cap.get('validations', heuristic_cap.validations),
                'roles': llm_cap.get('roles', heuristic_cap.roles),
                'source_pages': heuristic_cap.source_pages,
                'url_patterns': heuristic_cap.url_patterns,
                'metadata': {**heuristic_cap.metadata, 'llm_enriched': bool(llm_cap)}
            }
            
            merged.append(merged_cap)
        
        return merged
    
    def _capability_to_dict(self, cap: EntityCapability) -> Dict[str, Any]:
        """Convert EntityCapability to dictionary."""
        return {
            'entity': cap.entity,
            'operation': cap.operation,
            'preconditions': cap.preconditions,
            'postconditions': cap.postconditions,
            'fields': cap.fields,
            'validations': cap.validations,
            'roles': cap.roles,
            'source_pages': cap.source_pages,
            'url_patterns': cap.url_patterns,
            'metadata': cap.metadata
        }

