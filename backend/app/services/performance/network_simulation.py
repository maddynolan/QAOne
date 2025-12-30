"""
Network Simulation - Bandwidth throttling and network condition simulation
Simulates real-world network conditions
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class NetworkProfile(Enum):
    """Predefined network profiles"""
    FAST_3G = "fast_3g"
    SLOW_3G = "slow_3g"
    FAST_4G = "fast_4g"
    SLOW_4G = "slow_4g"
    CABLE = "cable"
    DSL = "dsl"
    DIAL_UP = "dial_up"
    CUSTOM = "custom"


@dataclass
class NetworkConditions:
    """Network condition configuration"""
    bandwidth_mbps: float  # Bandwidth in Mbps
    latency_ms: float  # Round-trip latency in ms
    packet_loss_percent: float  # Packet loss percentage
    jitter_ms: float  # Jitter (latency variance) in ms


class NetworkSimulator:
    """
    Network Simulator
    Simulates network conditions for realistic testing
    """
    
    # Predefined network profiles
    NETWORK_PROFILES = {
        NetworkProfile.FAST_3G: NetworkConditions(
            bandwidth_mbps=1.6,
            latency_ms=562,
            packet_loss_percent=0.0,
            jitter_ms=50
        ),
        NetworkProfile.SLOW_3G: NetworkConditions(
            bandwidth_mbps=0.4,
            latency_ms=2000,
            packet_loss_percent=0.0,
            jitter_ms=200
        ),
        NetworkProfile.FAST_4G: NetworkConditions(
            bandwidth_mbps=9.0,
            latency_ms=170,
            packet_loss_percent=0.0,
            jitter_ms=20
        ),
        NetworkProfile.SLOW_4G: NetworkConditions(
            bandwidth_mbps=1.5,
            latency_ms=500,
            packet_loss_percent=0.0,
            jitter_ms=50
        ),
        NetworkProfile.CABLE: NetworkConditions(
            bandwidth_mbps=5.0,
            latency_ms=28,
            packet_loss_percent=0.0,
            jitter_ms=5
        ),
        NetworkProfile.DSL: NetworkConditions(
            bandwidth_mbps=1.5,
            latency_ms=50,
            packet_loss_percent=0.0,
            jitter_ms=10
        ),
        NetworkProfile.DIAL_UP: NetworkConditions(
            bandwidth_mbps=0.056,  # 56kbps
            latency_ms=200,
            packet_loss_percent=0.0,
            jitter_ms=50
        )
    }
    
    def __init__(self):
        self.active_conditions: Optional[NetworkConditions] = None
        self.enabled: bool = False
    
    def set_network_profile(self, profile: NetworkProfile):
        """Set network conditions from predefined profile"""
        if profile not in self.NETWORK_PROFILES:
            raise ValueError(f"Unknown network profile: {profile}")
        
        self.active_conditions = self.NETWORK_PROFILES[profile]
        self.enabled = True
        logger.info(f"Set network profile: {profile.value}")
    
    def set_custom_conditions(
        self,
        bandwidth_mbps: float,
        latency_ms: float = 0,
        packet_loss_percent: float = 0,
        jitter_ms: float = 0
    ):
        """Set custom network conditions"""
        self.active_conditions = NetworkConditions(
            bandwidth_mbps=bandwidth_mbps,
            latency_ms=latency_ms,
            packet_loss_percent=packet_loss_percent,
            jitter_ms=jitter_ms
        )
        self.enabled = True
        logger.info(f"Set custom network conditions: {bandwidth_mbps}Mbps, {latency_ms}ms latency")
    
    async def apply_network_delay(self, data_size_bytes: int) -> float:
        """
        Apply network delay based on bandwidth and latency
        
        Args:
            data_size_bytes: Size of data to transfer in bytes
            
        Returns:
            Delay in seconds
        """
        if not self.enabled or not self.active_conditions:
            return 0.0
        
        # Calculate transmission time based on bandwidth
        bandwidth_bps = self.active_conditions.bandwidth_mbps * 1_000_000 / 8  # Convert to bytes per second
        transmission_time = data_size_bytes / bandwidth_bps if bandwidth_bps > 0 else 0
        
        # Add base latency
        total_delay = transmission_time + (self.active_conditions.latency_ms / 1000.0)
        
        # Add jitter (random variance)
        if self.active_conditions.jitter_ms > 0:
            import random
            jitter = random.uniform(-self.active_conditions.jitter_ms, self.active_conditions.jitter_ms) / 1000.0
            total_delay += jitter
        
        # Simulate packet loss
        if self.active_conditions.packet_loss_percent > 0:
            import random
            if random.random() < (self.active_conditions.packet_loss_percent / 100.0):
                # Simulate packet loss by throwing an exception or returning error
                raise ConnectionError("Simulated packet loss")
        
        return max(0.0, total_delay)
    
    def get_conditions(self) -> Optional[Dict[str, Any]]:
        """Get current network conditions"""
        if not self.active_conditions:
            return None
        
        return {
            "bandwidth_mbps": self.active_conditions.bandwidth_mbps,
            "latency_ms": self.active_conditions.latency_ms,
            "packet_loss_percent": self.active_conditions.packet_loss_percent,
            "jitter_ms": self.active_conditions.jitter_ms,
            "enabled": self.enabled
        }
    
    def disable(self):
        """Disable network simulation"""
        self.enabled = False
        self.active_conditions = None
        logger.info("Network simulation disabled")




