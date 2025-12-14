"""
Distributed Controller - Manage distributed load generation
Similar to Neoload/LoadRunner distributed testing
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class LoadGeneratorNode:
    """Represents a load generator node"""
    node_id: str
    host: str
    port: int
    status: str = "offline"  # offline, online, running
    capacity: int = 100  # Max virtual users
    current_load: int = 0
    last_heartbeat: Optional[datetime] = None


class DistributedController:
    """
    Distributed Controller - Manages multiple load generator nodes
    Distributes virtual users across nodes for scalability
    """
    
    def __init__(self):
        self.nodes: Dict[str, LoadGeneratorNode] = {}
        self.node_tasks: Dict[str, asyncio.Task] = {}
        self.is_distributed: bool = False
    
    def register_node(
        self,
        node_id: str,
        host: str,
        port: int,
        capacity: int = 100
    ):
        """Register a load generator node"""
        node = LoadGeneratorNode(
            node_id=node_id,
            host=host,
            port=port,
            capacity=capacity,
            status="online"
        )
        
        self.nodes[node_id] = node
        logger.info(f"Registered load generator node: {node_id} ({host}:{port})")
    
    def unregister_node(self, node_id: str):
        """Unregister a node"""
        if node_id in self.nodes:
            del self.nodes[node_id]
            logger.info(f"Unregistered node: {node_id}")
    
    def get_available_nodes(self) -> List[LoadGeneratorNode]:
        """Get list of available nodes"""
        return [
            node for node in self.nodes.values()
            if node.status == "online" and node.current_load < node.capacity
        ]
    
    def distribute_virtual_users(
        self,
        total_vus: int,
        scenario_name: str
    ) -> Dict[str, int]:
        """
        Distribute virtual users across available nodes
        
        Args:
            total_vus: Total number of virtual users needed
            scenario_name: Name of the scenario
            
        Returns:
            Dictionary mapping node_id to number of VUs
        """
        available_nodes = self.get_available_nodes()
        
        if not available_nodes:
            logger.warning("No available nodes for load distribution")
            return {}
        
        # Simple round-robin distribution
        # In production, would use more sophisticated algorithms
        distribution = {}
        vus_per_node = total_vus // len(available_nodes)
        remainder = total_vus % len(available_nodes)
        
        for i, node in enumerate(available_nodes):
            vus = vus_per_node + (1 if i < remainder else 0)
            distribution[node.node_id] = vus
            node.current_load += vus
        
        logger.info(f"Distributed {total_vus} VUs across {len(available_nodes)} nodes")
        return distribution
    
    async def start_distributed_test(
        self,
        scenario_config: Dict[str, Any],
        nodes: Optional[List[str]] = None
    ) -> str:
        """
        Start a distributed load test
        
        Args:
            scenario_config: Scenario configuration
            nodes: List of node IDs to use (None = all available)
            
        Returns:
            Test run ID
        """
        if nodes is None:
            nodes = [node.node_id for node in self.get_available_nodes()]
        
        if not nodes:
            raise RuntimeError("No available nodes for distributed test")
        
        self.is_distributed = True
        test_id = f"distributed_{int(datetime.utcnow().timestamp())}"
        
        # Distribute load across nodes
        total_vus = scenario_config.get("virtual_users", 100)
        distribution = self.distribute_virtual_users(total_vus, scenario_config.get("name", "test"))
        
        # Start test on each node
        tasks = []
        for node_id, vus in distribution.items():
            if node_id in self.nodes:
                node = self.nodes[node_id]
                task = asyncio.create_task(
                    self._start_node_test(node, scenario_config, vus, test_id)
                )
                tasks.append(task)
                self.node_tasks[node_id] = task
        
        # Wait for all nodes to complete
        await asyncio.gather(*tasks, return_exceptions=True)
        
        return test_id
    
    async def _start_node_test(
        self,
        node: LoadGeneratorNode,
        scenario_config: Dict[str, Any],
        virtual_users: int,
        test_id: str
    ):
        """Start test on a specific node"""
        node.status = "running"
        
        try:
            # In production, this would communicate with the node via gRPC/HTTP
            # For now, this is a placeholder
            logger.info(f"Starting test on node {node.node_id} with {virtual_users} VUs")
            
            # Simulate test execution
            await asyncio.sleep(1)
            
        except Exception as e:
            logger.error(f"Error starting test on node {node.node_id}: {e}")
        finally:
            node.status = "online"
            node.current_load = 0
    
    def get_node_status(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific node"""
        if node_id not in self.nodes:
            return None
        
        node = self.nodes[node_id]
        return {
            "node_id": node.node_id,
            "host": node.host,
            "port": node.port,
            "status": node.status,
            "capacity": node.capacity,
            "current_load": node.current_load,
            "utilization": (node.current_load / node.capacity * 100) if node.capacity > 0 else 0,
            "last_heartbeat": node.last_heartbeat.isoformat() if node.last_heartbeat else None
        }
    
    def get_all_nodes_status(self) -> List[Dict[str, Any]]:
        """Get status of all nodes"""
        return [
            self.get_node_status(node_id)
            for node_id in self.nodes.keys()
        ]
    
    async def stop_distributed_test(self, test_id: str):
        """Stop a distributed test"""
        # Cancel all node tasks
        for task in self.node_tasks.values():
            task.cancel()
        
        # Wait for cancellation
        await asyncio.gather(*self.node_tasks.values(), return_exceptions=True)
        
        # Reset node status
        for node in self.nodes.values():
            if node.status == "running":
                node.status = "online"
                node.current_load = 0
        
        self.node_tasks.clear()
        self.is_distributed = False
        
        logger.info(f"Stopped distributed test: {test_id}")




