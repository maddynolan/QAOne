"""
Flowstral Integration Service
Integrates autonomous exploration with Flowstral recorder.
Uses Flowstral action graphs to enhance capability maps.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from app.services.flowstral.flowstral_action_graph import ActionGraph
from app.services.exploration import CapabilityMapBuilder
from app.services.storage.capability_map_storage import get_capability_map_storage

logger = logging.getLogger(__name__)


class FlowstralIntegration:
    """
    Integrates Flowstral recorder data with autonomous exploration.
    Enhances capability maps with user-recorded flows.
    """
    
    def __init__(self):
        self.capability_builder = CapabilityMapBuilder()
        self.storage = get_capability_map_storage()
    
    async def enhance_capability_map_from_flowstral(
        self,
        capability_map_id: str,
        action_graph: ActionGraph,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Enhance an existing capability map with data from a Flowstral session.
        
        Args:
            capability_map_id: ID of existing capability map
            action_graph: Action graph from Flowstral session
            session_id: Optional Flowstral session ID
        
        Returns:
            Enhanced capability map
        """
        logger.info(f"Enhancing capability map {capability_map_id} with Flowstral data")
        
        # Get existing capability map
        existing_map = await self.storage.get_capability_map(capability_map_id)
        if not existing_map:
            raise ValueError(f"Capability map {capability_map_id} not found")
        
        # Convert action graph to exploration-like format
        exploration_result = self._action_graph_to_exploration_result(action_graph)
        
        # Build capabilities from action graph
        flowstral_capabilities = await self.capability_builder.build_capability_map(exploration_result)
        
        # Merge with existing capability map
        enhanced_map = self._merge_capability_maps(
            existing_map['capability_data'],
            flowstral_capabilities
        )
        
        # Update capability map (could create new version)
        # For now, we'll just return the enhanced version
        # In production, you might want to version control this
        
        return enhanced_map
    
    def _action_graph_to_exploration_result(self, action_graph: ActionGraph) -> Dict[str, Any]:
        """Convert Flowstral action graph to exploration result format."""
        pages = []
        visited_urls = set()
        
        for node in action_graph.nodes:
            url = node.url or node.url_pattern or ""
            if not url or url in visited_urls:
                continue
            
            visited_urls.add(url)
            
            # Extract page information from node
            page_data = {
                'id': f"flowstral_{node.id}",
                'url': url,
                'url_pattern': node.url_pattern,
                'title': node.metadata.get('title', '') if node.metadata else '',
                'headings': [],
                'entities': [],
                'actions': [],
                'forms': [],
                'buttons': [],
                'links': [],
                'tables': [],
                'metadata': {
                    'source': 'flowstral',
                    'event_type': node.event_type,
                    'timestamp': node.timestamp.isoformat() if hasattr(node, 'timestamp') else None
                }
            }
            
            # Infer entities and actions from event type and metadata
            if node.event_type == 'click':
                page_data['actions'].append('Click')
            elif node.event_type == 'type' or node.event_type == 'input':
                page_data['actions'].append('Input')
            elif node.event_type == 'navigate':
                page_data['actions'].append('Navigate')
            
            # Extract entity hints from URL patterns
            if url:
                # Common patterns: /users, /products, /orders
                url_lower = url.lower()
                if '/user' in url_lower:
                    page_data['entities'].append('User')
                if '/product' in url_lower:
                    page_data['entities'].append('Product')
                if '/order' in url_lower:
                    page_data['entities'].append('Order')
            
            pages.append(page_data)
        
        return {
            'base_url': action_graph.base_url if hasattr(action_graph, 'base_url') else '',
            'exploration_date': datetime.utcnow().isoformat(),
            'total_pages': len(pages),
            'pages': pages
        }
    
    def _merge_capability_maps(
        self,
        existing_map: Dict[str, Any],
        new_map: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Merge two capability maps, preferring new data for conflicts."""
        existing_entities = {e.get('entity'): e for e in existing_map.get('entities', [])}
        new_entities = {e.get('entity'): e for e in new_map.get('entities', [])}
        
        # Merge entities
        merged_entities = []
        all_entity_names = set(existing_entities.keys()) | set(new_entities.keys())
        
        for entity_name in all_entity_names:
            existing_entity = existing_entities.get(entity_name)
            new_entity = new_entities.get(entity_name)
            
            if existing_entity and new_entity:
                # Merge operations
                existing_ops = {op.get('operation'): op for op in existing_entity.get('operations', [])}
                new_ops = {op.get('operation'): op for op in new_entity.get('operations', [])}
                
                merged_ops = []
                all_ops = set(existing_ops.keys()) | set(new_ops.keys())
                for op_name in all_ops:
                    if op_name in new_ops:
                        merged_ops.append(new_ops[op_name])  # Prefer new
                    else:
                        merged_ops.append(existing_ops[op_name])
                
                merged_entity = {
                    **existing_entity,
                    **new_entity,
                    'operations': merged_ops,
                    'metadata': {
                        **existing_entity.get('metadata', {}),
                        **new_entity.get('metadata', {}),
                        'sources': ['exploration', 'flowstral']
                    }
                }
            elif new_entity:
                merged_entity = {
                    **new_entity,
                    'metadata': {
                        **new_entity.get('metadata', {}),
                        'sources': ['flowstral']
                    }
                }
            else:
                merged_entity = {
                    **existing_entity,
                    'metadata': {
                        **existing_entity.get('metadata', {}),
                        'sources': ['exploration']
                    }
                }
            
            merged_entities.append(merged_entity)
        
        # Merge pages
        existing_pages = {p.get('id'): p for p in existing_map.get('pages', [])}
        new_pages = {p.get('id'): p for p in new_map.get('pages', [])}
        
        merged_pages = []
        all_page_ids = set(existing_pages.keys()) | set(new_pages.keys())
        for page_id in all_page_ids:
            if page_id in new_pages:
                merged_pages.append(new_pages[page_id])  # Prefer new
            else:
                merged_pages.append(existing_pages[page_id])
        
        return {
            'base_url': new_map.get('base_url') or existing_map.get('base_url'),
            'exploration_date': new_map.get('exploration_date'),
            'total_pages': len(merged_pages),
            'entities': merged_entities,
            'pages': merged_pages
        }







