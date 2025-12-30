"""
Data Parameterization - CSV/JSON data sources for test data
Supports data pools, unique values, sequential/random access
"""

import logging
import csv
import json
import random
from typing import Dict, List, Any, Optional, Iterator
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
import asyncio

logger = logging.getLogger(__name__)


class DataAccessMode(Enum):
    """How to access data from the pool"""
    SEQUENTIAL = "sequential"  # Read in order, wrap around
    RANDOM = "random"  # Random selection
    UNIQUE = "unique"  # Each VU gets unique data, no repeats
    SHARED = "shared"  # All VUs share same data pool


@dataclass
class DataPool:
    """Data pool configuration"""
    pool_id: str
    name: str
    data_source: str  # Path to CSV/JSON file
    access_mode: DataAccessMode
    columns: List[str]  # Column names to use
    current_index: int = 0
    used_indices: set = None  # For unique mode
    data: List[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.used_indices is None:
            self.used_indices = set()
        if self.data is None:
            self.data = []


class DataParameterizationEngine:
    """
    Data Parameterization Engine
    Manages data pools and provides parameterized values to virtual users
    """
    
    def __init__(self):
        self.pools: Dict[str, DataPool] = {}
        self.pool_locks: Dict[str, asyncio.Lock] = {}
    
    async def create_pool(
        self,
        pool_id: str,
        name: str,
        data_source: str,
        access_mode: DataAccessMode = DataAccessMode.SEQUENTIAL,
        columns: Optional[List[str]] = None
    ) -> DataPool:
        """Create a new data pool from CSV/JSON file"""
        pool = DataPool(
            pool_id=pool_id,
            name=name,
            data_source=data_source,
            access_mode=access_mode,
            columns=columns or []
        )
        
        # Load data
        await self._load_data(pool)
        
        self.pools[pool_id] = pool
        self.pool_locks[pool_id] = asyncio.Lock()
        
        logger.info(f"Created data pool: {name} with {len(pool.data)} rows")
        return pool
    
    async def _load_data(self, pool: DataPool):
        """Load data from CSV or JSON file"""
        path = Path(pool.data_source)
        
        if not path.exists():
            raise FileNotFoundError(f"Data source not found: {pool.data_source}")
        
        if path.suffix.lower() == '.csv':
            await self._load_csv(pool, path)
        elif path.suffix.lower() == '.json':
            await self._load_json(pool, path)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")
    
    async def _load_csv(self, pool: DataPool, path: Path):
        """Load data from CSV file"""
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            pool.data = [row for row in reader]
        
        # Set columns if not specified
        if not pool.columns and pool.data:
            pool.columns = list(pool.data[0].keys())
    
    async def _load_json(self, pool: DataPool, path: Path):
        """Load data from JSON file"""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle different JSON structures
        if isinstance(data, list):
            pool.data = data
        elif isinstance(data, dict):
            # Assume it's {rows: [...]} or similar
            if "rows" in data:
                pool.data = data["rows"]
            elif "data" in data:
                pool.data = data["data"]
            else:
                # Single object, wrap in list
                pool.data = [data]
        else:
            raise ValueError("Invalid JSON structure")
        
        # Set columns if not specified
        if not pool.columns and pool.data and isinstance(pool.data[0], dict):
            pool.columns = list(pool.data[0].keys())
    
    async def get_data(
        self,
        pool_id: str,
        vu_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get parameterized data for a virtual user
        
        Args:
            pool_id: Data pool ID
            vu_id: Virtual user ID (for unique mode)
            
        Returns:
            Dictionary of parameterized values
        """
        if pool_id not in self.pools:
            raise ValueError(f"Data pool not found: {pool_id}")
        
        pool = self.pools[pool_id]
        
        if not pool.data:
            return {}
        
        async with self.pool_locks[pool_id]:
            if pool.access_mode == DataAccessMode.SEQUENTIAL:
                data = pool.data[pool.current_index % len(pool.data)]
                pool.current_index += 1
                return data.copy()
            
            elif pool.access_mode == DataAccessMode.RANDOM:
                index = random.randint(0, len(pool.data) - 1)
                return pool.data[index].copy()
            
            elif pool.access_mode == DataAccessMode.UNIQUE:
                # Each VU gets unique data
                if vu_id:
                    vu_hash = hash(vu_id) % len(pool.data)
                    return pool.data[vu_hash].copy()
                else:
                    # Fallback to sequential
                    data = pool.data[pool.current_index % len(pool.data)]
                    pool.current_index += 1
                    return data.copy()
            
            elif pool.access_mode == DataAccessMode.SHARED:
                # All VUs share same data (round-robin)
                data = pool.data[pool.current_index % len(pool.data)]
                pool.current_index += 1
                return data.copy()
            
            else:
                return {}
    
    async def get_value(
        self,
        pool_id: str,
        column: str,
        vu_id: Optional[str] = None
    ) -> Any:
        """Get a specific column value from data pool"""
        data = await self.get_data(pool_id, vu_id)
        return data.get(column)
    
    def apply_parameterization(
        self,
        text: str,
        parameterized_data: Dict[str, Any]
    ) -> str:
        """
        Apply parameterized data to text template
        
        Args:
            text: Text with placeholders like ${username} or {email}
            parameterized_data: Dictionary of parameter values
            
        Returns:
            Text with placeholders replaced
        """
        result = text
        
        for key, value in parameterized_data.items():
            # Replace ${key} and {key} patterns
            result = result.replace(f"${{{key}}}", str(value))
            result = result.replace(f"{{{key}}}", str(value))
        
        return result
    
    def apply_parameterization_dict(
        self,
        data: Dict[str, Any],
        parameterized_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Apply parameterization to dictionary recursively"""
        result = {}
        
        for key, value in data.items():
            if isinstance(value, str):
                result[key] = self.apply_parameterization(value, parameterized_data)
            elif isinstance(value, dict):
                result[key] = self.apply_parameterization_dict(value, parameterized_data)
            elif isinstance(value, list):
                result[key] = [
                    self.apply_parameterization(item, parameterized_data) if isinstance(item, str)
                    else self.apply_parameterization_dict(item, parameterized_data) if isinstance(item, dict)
                    else item
                    for item in value
                ]
            else:
                result[key] = value
        
        return result
    
    def get_pool_info(self, pool_id: str) -> Dict[str, Any]:
        """Get information about a data pool"""
        if pool_id not in self.pools:
            return {}
        
        pool = self.pools[pool_id]
        return {
            "pool_id": pool.pool_id,
            "name": pool.name,
            "data_source": pool.data_source,
            "access_mode": pool.access_mode.value,
            "row_count": len(pool.data),
            "columns": pool.columns,
            "current_index": pool.current_index
        }
    
    def list_pools(self) -> List[Dict[str, Any]]:
        """List all data pools"""
        return [self.get_pool_info(pool_id) for pool_id in self.pools.keys()]
    
    def delete_pool(self, pool_id: str):
        """Delete a data pool"""
        if pool_id in self.pools:
            del self.pools[pool_id]
        if pool_id in self.pool_locks:
            del self.pool_locks[pool_id]
        logger.info(f"Deleted data pool: {pool_id}")




