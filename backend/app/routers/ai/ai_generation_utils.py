"""
Utility functions for the AI Generation API
"""


def _query_usage_sync(pool, query, params):
    """Synchronous database query"""
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            results = [dict(zip(columns, row)) for row in cur.fetchall()]
            return results
    finally:
        pool.putconn(conn)
