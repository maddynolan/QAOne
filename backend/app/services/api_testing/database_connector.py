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
    
    async def list_tables(self, connection_id: str) -> List[Dict[str, Any]]:
        """
        List all tables/collections in the connected database

        Returns:
            List of dicts with table_name, table_type (table/view), row_count (estimated)
        """
        if connection_id not in self.connections:
            raise ValueError(f"Connection {connection_id} not found")

        connection_info = self.connections[connection_id]
        db_type = connection_info["type"]
        connection = connection_info["connection"]

        try:
            if db_type == "postgresql":
                rows = await self._execute_postgresql(connection, """
                    SELECT table_name, table_type,
                           (SELECT reltuples::bigint FROM pg_class WHERE relname = t.table_name) AS estimated_rows
                    FROM information_schema.tables t
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """, None)
                return [{"table_name": r["table_name"], "table_type": r.get("table_type", "BASE TABLE"), "estimated_rows": r.get("estimated_rows", 0)} for r in rows]

            elif db_type == "mysql":
                rows = await self._execute_mysql(connection, """
                    SELECT table_name, table_type, table_rows AS estimated_rows
                    FROM information_schema.tables
                    WHERE table_schema = DATABASE()
                    ORDER BY table_name
                """, None)
                return [{"table_name": r["table_name"], "table_type": r.get("table_type", "BASE TABLE"), "estimated_rows": r.get("estimated_rows", 0)} for r in rows]

            elif db_type == "sqlite":
                rows = await self._execute_sqlite(connection, """
                    SELECT name AS table_name, type AS table_type
                    FROM sqlite_master
                    WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
                    ORDER BY name
                """, None)
                result = []
                for r in rows:
                    try:
                        count_rows = await self._execute_sqlite(connection, f'SELECT COUNT(*) as cnt FROM "{r["table_name"]}"', None)
                        est = count_rows[0]["cnt"] if count_rows else 0
                    except Exception:
                        est = 0
                    result.append({"table_name": r["table_name"], "table_type": r.get("table_type", "table"), "estimated_rows": est})
                return result

            elif db_type == "mongodb":
                db_name = connection_info["config"].get("database", "test")
                db = connection[db_name]
                collections = db.list_collection_names()
                result = []
                for coll_name in sorted(collections):
                    try:
                        est = db[coll_name].estimated_document_count()
                    except Exception:
                        est = 0
                    result.append({"table_name": coll_name, "table_type": "collection", "estimated_rows": est})
                return result

            elif db_type == "mssql":
                rows = await self._execute_mssql(connection, """
                    SELECT t.name AS table_name,
                           CASE WHEN t.type = 'U' THEN 'BASE TABLE' ELSE 'VIEW' END AS table_type,
                           SUM(p.rows) AS estimated_rows
                    FROM sys.tables t
                    LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
                    GROUP BY t.name, t.type
                    ORDER BY t.name
                """, None)
                return [{"table_name": r["table_name"], "table_type": r.get("table_type", "BASE TABLE"), "estimated_rows": r.get("estimated_rows", 0)} for r in rows]

            else:
                return []

        except Exception as e:
            logger.error(f"List tables failed for {connection_id}: {e}", exc_info=True)
            raise

    async def get_table_columns(self, connection_id: str, table_name: str) -> List[Dict[str, Any]]:
        """
        Get column metadata for a specific table

        Returns:
            List of dicts with column_name, data_type, is_nullable, column_default, is_primary_key
        """
        if connection_id not in self.connections:
            raise ValueError(f"Connection {connection_id} not found")

        connection_info = self.connections[connection_id]
        db_type = connection_info["type"]
        connection = connection_info["connection"]

        try:
            if db_type == "postgresql":
                rows = await self._execute_postgresql(connection, """
                    SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
                           CASE WHEN kcu.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END AS is_primary_key
                    FROM information_schema.columns c
                    LEFT JOIN information_schema.key_column_usage kcu
                        ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
                        AND kcu.constraint_name IN (
                            SELECT constraint_name FROM information_schema.table_constraints
                            WHERE constraint_type = 'PRIMARY KEY' AND table_name = c.table_name
                        )
                    WHERE c.table_schema = 'public' AND c.table_name = %s
                    ORDER BY c.ordinal_position
                """, {"table_name": table_name})
                return [{"column_name": r["column_name"], "data_type": r["data_type"], "is_nullable": r["is_nullable"], "column_default": r.get("column_default"), "is_primary_key": r.get("is_primary_key", "NO") == "YES"} for r in rows]

            elif db_type == "mysql":
                rows = await self._execute_mysql(connection, f"""
                    SELECT column_name, data_type, is_nullable, column_default, column_key
                    FROM information_schema.columns
                    WHERE table_schema = DATABASE() AND table_name = %s
                    ORDER BY ordinal_position
                """, {"table_name": table_name})
                return [{"column_name": r["column_name"], "data_type": r["data_type"], "is_nullable": r["is_nullable"], "column_default": r.get("column_default"), "is_primary_key": r.get("column_key") == "PRI"} for r in rows]

            elif db_type == "sqlite":
                rows = await self._execute_sqlite(connection, f'PRAGMA table_info("{table_name}")', None)
                return [{"column_name": r.get("name", ""), "data_type": r.get("type", "TEXT"), "is_nullable": r.get("notnull", 0) == 0, "column_default": r.get("dflt_value"), "is_primary_key": r.get("pk", 0) == 1} for r in rows]

            elif db_type == "mongodb":
                # For MongoDB, sample a document to infer fields
                db_name = connection_info["config"].get("database", "test")
                db = connection[db_name]
                sample = db[table_name].find_one()
                if sample:
                    columns = []
                    for key, value in sample.items():
                        columns.append({
                            "column_name": key,
                            "data_type": type(value).__name__,
                            "is_nullable": True,
                            "column_default": None,
                            "is_primary_key": key == "_id"
                        })
                    return columns
                return []

            elif db_type == "mssql":
                rows = await self._execute_mssql(connection, f"""
                    SELECT c.name AS column_name, t.name AS data_type, c.is_nullable,
                           dc.definition AS column_default,
                           CASE WHEN ic.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
                    FROM sys.columns c
                    JOIN sys.types t ON c.user_type_id = t.user_type_id
                    LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
                    LEFT JOIN sys.index_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                        AND ic.index_id = (SELECT TOP 1 index_id FROM sys.indexes WHERE object_id = c.object_id AND is_primary_key = 1)
                    WHERE c.object_id = OBJECT_ID(%s)
                    ORDER BY c.column_id
                """, {"table_name": table_name})
                return [{"column_name": r["column_name"], "data_type": r["data_type"], "is_nullable": bool(r.get("is_nullable")), "column_default": r.get("column_default"), "is_primary_key": bool(r.get("is_primary_key"))} for r in rows]

            else:
                return []

        except Exception as e:
            logger.error(f"Get columns failed for {connection_id}/{table_name}: {e}", exc_info=True)
            raise

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




