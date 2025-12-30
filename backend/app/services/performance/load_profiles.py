"""
Advanced Load Profiles - Enterprise-grade load patterns
Supports spike, stress, endurance, capacity planning, and custom patterns
"""

import logging
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import math
import time

logger = logging.getLogger(__name__)


class LoadProfileType(Enum):
    """Types of load profiles"""
    LINEAR = "linear"  # Linear ramp-up
    STEP = "step"  # Step-wise ramp-up
    SPIKE = "spike"  # Sudden spike test
    STRESS = "stress"  # Stress test (gradual increase until failure)
    ENDURANCE = "endurance"  # Long-running stability test
    CAPACITY = "capacity"  # Capacity planning test
    CUSTOM = "custom"  # Custom pattern


@dataclass
class LoadProfile:
    """Advanced load profile configuration"""
    profile_type: LoadProfileType
    initial_vus: int = 1
    peak_vus: int = 100
    duration_seconds: int = 300
    ramp_up_seconds: int = 60
    ramp_down_seconds: int = 30
    hold_seconds: int = 0  # Hold at peak before ramp-down
    
    # Step profile
    step_size: int = 10
    step_duration_seconds: int = 30
    
    # Spike profile
    spike_vus: int = 500
    spike_duration_seconds: int = 10
    spike_interval_seconds: int = 60
    
    # Stress test
    stress_increment: int = 10
    stress_interval_seconds: int = 30
    stress_max_vus: int = 1000
    
    # Endurance test
    endurance_duration_hours: int = 24
    
    # Custom pattern
    custom_pattern: Optional[List[Dict[str, Any]]] = None  # List of {time: seconds, vus: count}
    
    # Advanced settings
    think_time_ms: int = 2000
    think_time_variance: float = 0.3
    pacing_ms: Optional[int] = None  # Control request rate
    bandwidth_throttle_mbps: Optional[float] = None  # Simulate network conditions
    
    def get_vus_at_time(self, elapsed_seconds: float) -> int:
        """Calculate virtual users at a given time"""
        if elapsed_seconds < 0:
            return self.initial_vus
        
        if self.profile_type == LoadProfileType.LINEAR:
            return self._linear_ramp(elapsed_seconds)
        elif self.profile_type == LoadProfileType.STEP:
            return self._step_ramp(elapsed_seconds)
        elif self.profile_type == LoadProfileType.SPIKE:
            return self._spike_pattern(elapsed_seconds)
        elif self.profile_type == LoadProfileType.STRESS:
            return self._stress_pattern(elapsed_seconds)
        elif self.profile_type == LoadProfileType.ENDURANCE:
            return self._endurance_pattern(elapsed_seconds)
        elif self.profile_type == LoadProfileType.CAPACITY:
            return self._capacity_pattern(elapsed_seconds)
        elif self.profile_type == LoadProfileType.CUSTOM:
            return self._custom_pattern(elapsed_seconds)
        else:
            return self.initial_vus
    
    def _linear_ramp(self, elapsed: float) -> int:
        """Linear ramp-up and ramp-down"""
        if elapsed < self.ramp_up_seconds:
            # Ramp up
            progress = elapsed / self.ramp_up_seconds
            return int(self.initial_vus + (self.peak_vus - self.initial_vus) * progress)
        elif elapsed < self.ramp_up_seconds + self.hold_seconds:
            # Hold at peak
            return self.peak_vus
        elif elapsed < self.ramp_up_seconds + self.hold_seconds + self.ramp_down_seconds:
            # Ramp down
            ramp_down_start = self.ramp_up_seconds + self.hold_seconds
            progress = (elapsed - ramp_down_start) / self.ramp_down_seconds
            return int(self.peak_vus - (self.peak_vus - self.initial_vus) * progress)
        else:
            return self.initial_vus
    
    def _step_ramp(self, elapsed: float) -> int:
        """Step-wise ramp-up"""
        if elapsed < self.ramp_up_seconds:
            steps = int(elapsed / self.step_duration_seconds)
            vus = self.initial_vus + (steps * self.step_size)
            return min(vus, self.peak_vus)
        elif elapsed < self.ramp_up_seconds + self.hold_seconds:
            return self.peak_vus
        elif elapsed < self.ramp_up_seconds + self.hold_seconds + self.ramp_down_seconds:
            ramp_down_start = self.ramp_up_seconds + self.hold_seconds
            steps = int((elapsed - ramp_down_start) / self.step_duration_seconds)
            vus = self.peak_vus - (steps * self.step_size)
            return max(vus, self.initial_vus)
        else:
            return self.initial_vus
    
    def _spike_pattern(self, elapsed: float) -> int:
        """Spike test pattern"""
        # Base load
        base_vus = self.initial_vus
        
        # Check if we're in a spike
        spike_cycle = elapsed % self.spike_interval_seconds
        if spike_cycle < self.spike_duration_seconds:
            # In spike
            return self.spike_vus
        else:
            # Normal load
            return base_vus
    
    def _stress_pattern(self, elapsed: float) -> int:
        """Stress test - gradually increase until failure"""
        if elapsed < self.ramp_up_seconds:
            # Initial ramp-up
            progress = elapsed / self.ramp_up_seconds
            return int(self.initial_vus + (self.peak_vus - self.initial_vus) * progress)
        else:
            # Continue increasing
            stress_cycles = int((elapsed - self.ramp_up_seconds) / self.stress_interval_seconds)
            additional_vus = stress_cycles * self.stress_increment
            return min(self.peak_vus + additional_vus, self.stress_max_vus)
    
    def _endurance_pattern(self, elapsed: float) -> int:
        """Endurance test - maintain steady load"""
        if elapsed < self.ramp_up_seconds:
            progress = elapsed / self.ramp_up_seconds
            return int(self.initial_vus + (self.peak_vus - self.initial_vus) * progress)
        else:
            return self.peak_vus
    
    def _capacity_pattern(self, elapsed: float) -> int:
        """Capacity planning - find maximum sustainable load"""
        # Start low, gradually increase, then decrease to find optimal
        if elapsed < self.ramp_up_seconds:
            progress = elapsed / self.ramp_up_seconds
            return int(self.initial_vus + (self.peak_vus - self.initial_vus) * progress)
        elif elapsed < self.ramp_up_seconds + self.hold_seconds:
            return self.peak_vus
        else:
            # Gradually decrease to find breaking point
            ramp_down_start = self.ramp_up_seconds + self.hold_seconds
            progress = (elapsed - ramp_down_start) / self.ramp_down_seconds
            return int(self.peak_vus - (self.peak_vus - self.initial_vus) * progress)
    
    def _custom_pattern(self, elapsed: float) -> int:
        """Custom pattern from user-defined points"""
        if not self.custom_pattern:
            return self.initial_vus
        
        # Find the two points that bracket elapsed time
        for i in range(len(self.custom_pattern) - 1):
            t1 = self.custom_pattern[i]["time"]
            t2 = self.custom_pattern[i + 1]["time"]
            
            if t1 <= elapsed < t2:
                # Interpolate between points
                v1 = self.custom_pattern[i]["vus"]
                v2 = self.custom_pattern[i + 1]["vus"]
                progress = (elapsed - t1) / (t2 - t1) if t2 > t1 else 0
                return int(v1 + (v2 - v1) * progress)
        
        # Use last point if beyond pattern
        return self.custom_pattern[-1]["vus"]


class LoadProfileManager:
    """Manages load profiles and provides utilities"""
    
    @staticmethod
    def create_spike_profile(
        base_vus: int = 10,
        spike_vus: int = 500,
        spike_duration: int = 10,
        spike_interval: int = 60,
        duration: int = 300
    ) -> LoadProfile:
        """Create a spike test profile"""
        return LoadProfile(
            profile_type=LoadProfileType.SPIKE,
            initial_vus=base_vus,
            peak_vus=base_vus,
            spike_vus=spike_vus,
            spike_duration_seconds=spike_duration,
            spike_interval_seconds=spike_interval,
            duration_seconds=duration
        )
    
    @staticmethod
    def create_stress_profile(
        initial_vus: int = 10,
        peak_vus: int = 100,
        increment: int = 10,
        interval: int = 30,
        max_vus: int = 1000,
        ramp_up: int = 60
    ) -> LoadProfile:
        """Create a stress test profile"""
        return LoadProfile(
            profile_type=LoadProfileType.STRESS,
            initial_vus=initial_vus,
            peak_vus=peak_vus,
            ramp_up_seconds=ramp_up,
            stress_increment=increment,
            stress_interval_seconds=interval,
            stress_max_vus=max_vus,
            duration_seconds=3600  # 1 hour default
        )
    
    @staticmethod
    def create_endurance_profile(
        vus: int = 50,
        duration_hours: int = 24,
        ramp_up: int = 60
    ) -> LoadProfile:
        """Create an endurance test profile"""
        return LoadProfile(
            profile_type=LoadProfileType.ENDURANCE,
            initial_vus=1,
            peak_vus=vus,
            ramp_up_seconds=ramp_up,
            endurance_duration_hours=duration_hours,
            duration_seconds=duration_hours * 3600
        )
    
    @staticmethod
    def create_capacity_profile(
        initial_vus: int = 10,
        max_vus: int = 500,
        ramp_up: int = 300,
        hold: int = 600,
        ramp_down: int = 300
    ) -> LoadProfile:
        """Create a capacity planning profile"""
        return LoadProfile(
            profile_type=LoadProfileType.CAPACITY,
            initial_vus=initial_vus,
            peak_vus=max_vus,
            ramp_up_seconds=ramp_up,
            hold_seconds=hold,
            ramp_down_seconds=ramp_down,
            duration_seconds=ramp_up + hold + ramp_down
        )
    
    @staticmethod
    def create_step_profile(
        initial_vus: int = 10,
        peak_vus: int = 100,
        step_size: int = 10,
        step_duration: int = 30,
        hold: int = 60
    ) -> LoadProfile:
        """Create a step-wise ramp profile"""
        ramp_up_steps = (peak_vus - initial_vus) // step_size
        ramp_up_seconds = ramp_up_steps * step_duration
        
        return LoadProfile(
            profile_type=LoadProfileType.STEP,
            initial_vus=initial_vus,
            peak_vus=peak_vus,
            ramp_up_seconds=ramp_up_seconds,
            step_size=step_size,
            step_duration_seconds=step_duration,
            hold_seconds=hold,
            ramp_down_seconds=ramp_up_seconds,
            duration_seconds=ramp_up_seconds + hold + ramp_up_seconds
        )




