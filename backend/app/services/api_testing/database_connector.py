"""
Database Connector for API Testing
Supports data-driven testing, database assertions, and data extraction
"""

import logging
from typing import Dict, List, Any, Optional
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class DatabaseConnector:
    """
    Database connector for API testing
    Supports PostgreSQL, MySQL, SQLite, MongoDB, and more
    """
    
    def __init__(self):
        self.connections: Dict[str, Any] = {}
        self.supported_databases = [
            "postgresql", "mysql", "sqlite", "mongodb", 
            "mssql", "oracle", "redis", "cassandra"
        ]
    
    async def connect(
        self,
        connection_id: str,
        db_type: str,
        connection_config: Dict[str, Any]
    ) -> bool:
        """
        Connect to a database
        
        Args:
            connection_id: Unique identifier for this connection
            db_type: Database type (postgresql, mysql, etc.)
            connection_config: Connection configuration
            
        Returns:
            True if connection successful
        """
        try:
            if db_type == "postgresql":
                connection = await self._connect_postgresql(connection_config)
            elif db_type == "mysql":
                connection = await self._connect_mysql(connection_config)
            elif db_type == "sqlite":
                connection = await self._connect_sqlite(connection_config)
            elif db_type == "mongodb":
                connection = await self._connect_mongodb(connection_config)
            elif db_type == "mssql":
                connection = await self._connect_mssql(connection_config)
            else:
                raise ValueError(f"Unsupported database type: {db_type}")
            
            self.connections[connection_id] = {
                "type": db_type,
                "connection": connection,
                "config": connection_config,
                "connected_at": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Connected to {db_type} database: {connection_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to {db_type}: {e}", exc_info=True)
            return False
    
    async def _connect_postgresql(self, config: Dict[str, Any]) -> Any:
        """Connect to PostgreSQL"""
        try:
            from app.services.storage.postgres_direct import get_postgres_pool
            pool = get_postgres_pool()
            if pool:
                return pool
            else:
                # Try direct connection
                import psycopg2
                return psycopg2.connect(
                    host=config.get("host", "localhost"),
                    port=config.get("port", 5432),
                    database=config.get("database"),
                    user=config.get("user"),
                    password=config.get("password")
                )
        except Exception as e:
            logger.error(f"PostgreSQL connection failed: {e}")
            raise
    
    async def _connect_mysql(self, config: Dict[str, Any]) -> Any:
        """Connect to MySQL"""
        try:
            import mysql.connector
            return mysql.connector.connect(
                host=config.get("host", "localhost"),
                port=config.get("port", 3306),
                database=config.get("database"),
                user=config.get("user"),
                password=config.get("password")
            )
        except ImportError:
            raise ImportError("mysql-connector-python not installed. Install with: pip install mysql-connector-python")
        except Exception as e:
            logger.error(f"MySQL connection failed: {e}")
            raise
    
    async def _connect_sqlite(self, config: Dict[str, Any]) -> Any:
        """Connect to SQLite"""
        try:
            import sqlite3
            db_path = config.get("database") or config.get("path", ":memory:")
            return sqlite3.connect(db_path)
        except Exception as e:
            logger.error(f"SQLite connection failed: {e}")
            raise
    
    async def _connect_mongodb(self, config: Dict[str, Any]) -> Any:
        """Connect to MongoDB"""
        try:
            from pymongo import MongoClient
            connection_string = config.get("connection_string") or \
                f"mongodb://{config.get('host', 'localhost')}:{config.get('port', 27017)}"
            return MongoClient(connection_string)
        except ImportError:
            raise ImportError("pymongo not installed. Install with: pip install pymongo")
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            raise
    
    async def _connect_mssql(self, config: Dict[str, Any]) -> Any:
        """Connect to Microsoft SQL Server"""
        try:
            import pyodbc
            connection_string = config.get("connection_string") or \
                f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.get('host')};DATABASE={config.get('database')};UID={config.get('user')};PWD={config.get('password')}"
            return pyodbc.connect(connection_string)
        except ImportError:
            raise ImportError("pyodbc not installed. Install with: pip install pyodbc")
        except Exception as e:
            logger.error(f"MSSQL connection failed: {e}")
            raise
    
    async def execute_query(
        self,
        connection_id: str,
        query: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute a query and return results
        
        Args:
            connection_id: Connection identifier
            query: SQL query or database query
            parameters: Query parameters
            
        Returns:
            List of result rows as dictionaries
        """
        if connection_id not in self.connections:
            raise ValueError(f"Connection {connection_id} not found")
        
        connection_info = self.connections[connection_id]
        db_type = connection_info["type"]
        connection = connection_info["connection"]
        
        try:
            if db_type == "postgresql":
                return await self._execute_postgresql(connection, query, parameters)
            elif db_type == "mysql":
                return await self._execute_mysql(connection, query, parameters)
            elif db_type == "sqlite":
                return await self._execute_sqlite(connection, query, parameters)
            elif db_type == "mongodb":
                return await self._execute_mongodb(connection, query, parameters)
            elif db_type == "mssql":
                return await self._execute_mssql(connection, query, parameters)
            else:
                raise ValueError(f"Unsupported database type: {db_type}")
                
        except Exception as e:
            logger.error(f"Query execution failed: {e}", exc_info=True)
            raise
    
    async def _execute_postgresql(
        self,
        connection: Any,
        query: str,
        parameters: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Execute PostgreSQL query"""
        # Check if it's a pool
        if hasattr(connection, 'getconn'):
            conn = connection.getconn()
            try:
                with conn.cursor() as cur:
                    if parameters:
                        cur.execute(query, tuple(parameters.values()))
                    else:
                        cur.execute(query)
                    
                    if cur.description:
                        columns = [desc[0] for desc in cur.description]
                        rows = cur.fetchall()
                        return [dict(zip(columns, row)) for row in rows]
                    return []
            finally:
                connection.putconn(conn)
        else:
            # Direct connection
            with connection.cursor() as cur:
                if parameters:
                    cur.execute(query, tuple(parameters.values()))
                else:
                    cur.execute(query)
                
                if cur.description:
                    columns = [desc[0] for desc in cur.description]
                    rows = cur.fetchall()
                    return [dict(zip(columns, row)) for row in rows]
                return []
    
    async def _execute_mysql(
        self,
        connection: Any,
        query: str,
        parameters: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Execute MySQL query"""
        cursor = connection.cursor(dictionary=True)
        try:
            if parameters:
                cursor.execute(query, tuple(parameters.values()))
            else:
                cursor.execute(query)
            return cursor.fetchall()
        finally:
            cursor.close()
    
    async def _execute_sqlite(
        self,
        connection: Any,
        query: str,
        parameters: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Execute SQLite query"""
        connection.row_factory = lambda cursor, row: {
            col[0]: row[idx] for idx, col in enumerate(cursor.description)
        } if cursor.description else {}
        cursor = connection.cursor()
        try:
            if parameters:
                cursor.execute(query, tuple(parameters.values()))
            else:
                cursor.execute(query)
            return cursor.fetchall()
        finally:
            cursor.close()
    
    async def _execute_mongodb(
        self,
        connection: Any,
        query: str,
        parameters: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Execute MongoDB query"""
        # MongoDB queries are JSON
        query_dict = json.loads(query) if isinstance(query, str) else query
        db_name = parameters.get("database") if parameters else "test"
        collection_name = parameters.get("collection") if parameters else "test"
        
        db = connection[db_name]
        collection = db[collection_name]
        return list(collection.find(query_dict))
    
    async def _execute_mssql(
        self,
        connection: Any,
        query: str,
        parameters: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Execute MSSQL query"""
        cursor = connection.cursor()
        try:
            if parameters:
                cursor.execute(query, tuple(parameters.values()))
            else:
                cursor.execute(query)
            
            columns = [column[0] for column in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            return [dict(zip(columns, row)) for row in rows]
        finally:
            cursor.close()
    
    async def assert_database_state(
        self,
        connection_id: str,
        assertion: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Assert database state after API call
        
        Args:
            connection_id: Connection identifier
            assertion: Assertion configuration
            
        Returns:
            Assertion result
        """
        query = assertion.get("query")
        expected_result = assertion.get("expected_result")
        comparison = assertion.get("comparison", "equals")
        
        try:
            result = await self.execute_query(connection_id, query)
            
            passed = False
            if comparison == "equals":
                passed = result == expected_result
            elif comparison == "contains":
                passed = any(expected_result in str(r) for r in result)
            elif comparison == "count":
                expected_count = expected_result
                passed = len(result) == expected_count
            elif comparison == "greater_than":
                passed = len(result) > expected_result
            elif comparison == "less_than":
                passed = len(result) < expected_result
            
            return {
                "passed": passed,
                "actual_result": result,
                "expected_result": expected_result,
                "comparison": comparison,
                "message": f"Assertion {'passed' if passed else 'failed'}"
            }
            
        except Exception as e:
            return {
                "passed": False,
                "error": str(e),
                "message": f"Assertion failed with error: {e}"
            }
    
    async def extract_test_data(
        self,
        connection_id: str,
        query: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Extract test data from database for data-driven testing
        
        Args:
            connection_id: Connection identifier
            query: Query to extract data
            limit: Maximum number of rows
            
        Returns:
            List of test data rows
        """
        query_with_limit = f"{query} LIMIT {limit}" if "LIMIT" not in query.upper() else query
        return await self.execute_query(connection_id, query_with_limit)
    
    async def disconnect(self, connection_id: str) -> bool:
        """Disconnect from database"""
        if connection_id in self.connections:
            connection_info = self.connections[connection_id]
            connection = connection_info["connection"]
            
            try:
                if hasattr(connection, 'close'):
                    connection.close()
                elif hasattr(connection, 'closeall'):
                    connection.closeall()
                
                del self.connections[connection_id]
                logger.info(f"Disconnected from database: {connection_id}")
                return True
            except Exception as e:
                logger.error(f"Error disconnecting: {e}")
                return False
        
        return False
    
    def list_connections(self) -> List[Dict[str, Any]]:
        """List all active connections"""
        return [
            {
                "connection_id": conn_id,
                "type": info["type"],
                "connected_at": info["connected_at"]
            }
            for conn_id, info in self.connections.items()
        ]


# Global instance
_database_connector = None

def get_database_connector() -> DatabaseConnector:
    """Get or create global DatabaseConnector instance"""
    global _database_connector
    if _database_connector is None:
        _database_connector = DatabaseConnector()
    return _database_connector




