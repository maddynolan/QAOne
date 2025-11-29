"""
Requirements CRUD API Router
Handles all requirement operations including Gherkin conversion
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from app.utils.endpoint_helpers import ensure_default_org_project
from app.services.storage.database import get_database_client, create_requirement
from app.services.storage.postgres_direct import execute_query, get_postgres_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/requirements", tags=["requirements"])


@router.get("")
async def get_requirements(project_id: Optional[str] = None):
    """Get all requirements"""
    try:
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            return {"requirements": []}
        
        query = """
            SELECT id, project_id, source, source_ref, title, description, acceptance_criteria, raw_payload, created_at
            FROM requirements
            WHERE project_id = %s
            ORDER BY created_at DESC
        """
        results = await execute_query(query, (project_id,))
        
        requirements = []
        for row in results or []:
            requirements.append({
                "id": str(row.get("id", "")),
                "title": row.get("title", ""),
                "description": row.get("description", ""),
                "acceptance_criteria": row.get("acceptance_criteria", ""),
                "source": row.get("source", ""),
                "source_ref": row.get("source_ref", ""),
                "created_at": str(row.get("created_at", ""))
            })
        
        return {"requirements": requirements}
    except Exception as e:
        logger.error(f"Error getting requirements: {str(e)}")
        return {"requirements": []}


@router.post("")
async def create_requirement_endpoint(request: Request):
    """Create a new requirement"""
    try:
        org_id, project_id = await ensure_default_org_project()
        data = await request.json()
        
        requirement_id = await create_requirement(
            project_id=project_id,
            source=data.get("source", "manual"),
            title=data.get("title", ""),
            description=data.get("description", ""),
            source_ref=data.get("source_ref"),
            raw_payload=data.get("raw_payload"),
            acceptance_criteria=data.get("acceptance_criteria")
        )
        
        if not requirement_id:
            raise HTTPException(status_code=500, detail="Failed to create requirement")
        
        return {"id": requirement_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating requirement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/convert-to-gherkin/{requirement_id}")
async def convert_requirement_to_gherkin(requirement_id: str, request: Request):
    """Convert a requirement to Gherkin format using LLM"""
    try:
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        query = """
            SELECT id, project_id, source, source_ref, title, description, raw_payload
            FROM requirements 
            WHERE id = %s
        """
        results = await execute_query(query, (requirement_id,))
        
        if not results or len(results) == 0:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        req = results[0]
        title = req.get("title", "")
        description = req.get("description", "")
        source = req.get("source", "")
        
        # Create prompt for Gherkin generation
        prompt = f"""You are an expert QA engineer specializing in Behavior-Driven Development (BDD) and Gherkin syntax.

Convert the following requirement into a comprehensive Gherkin feature specification.

Original Requirement:
Title: {title}
Source: {source}
Description: {description}

Create a detailed Gherkin feature file that includes:

1. Feature Header with "As a... I want to... So that..." format
2. Background section (if applicable)
3. Multiple Scenarios (3-5 scenarios):
   - Happy path scenario
   - Edge cases
   - Error handling scenarios
   - Alternative flows
4. Use proper Given-When-Then-And-But keywords
5. Scenario Outline with Examples table (if applicable)

Return ONLY the Gherkin feature code. Do not include explanations or markdown formatting. Start with "Feature:" and provide complete scenarios.
"""
        
        # Use Ollama to generate Gherkin
        from app.services.llm.ollama_service import get_ollama_service
        import time
        
        start_time = time.time()
        try:
            ollama_service = get_ollama_service()
            result = await ollama_service.generate(prompt, mode="heavy", validate_json=False)
            gherkin_text = result.get("response", "")
            
            # Extract Gherkin from response
            if "Feature:" in gherkin_text:
                feature_idx = gherkin_text.find("Feature:")
                gherkin = gherkin_text[feature_idx:].strip()
                
                # Clean up any markdown code blocks
                if "```" in gherkin:
                    parts = gherkin.split("```")
                    for part in parts:
                        if "Feature:" in part:
                            gherkin = part.strip()
                            break
            else:
                # Fallback: create basic Gherkin
                gherkin = f"""Feature: {title}
  As a user
  I want to {description.lower()}
  So that I can efficiently accomplish my task

  Background:
    Given I am on the {source} application
    And I have valid access credentials

  Scenario: Successful {title}
    Given I am on the {source} application
    When I perform the action: {description}
    Then I should see the expected result
    And the operation should complete successfully

  Scenario: Error handling for {title}
    Given I am on the {source} application
    When I perform the action with invalid data
    Then I should see an appropriate error message
    And the system should handle the error gracefully
"""
        except Exception as e:
            logger.error(f"Error generating Gherkin: {str(e)}")
            # Fallback to basic Gherkin
            gherkin = f"""Feature: {title}
  As a user
  I want to {description.lower()}
  So that I can efficiently accomplish my task

  Background:
    Given I am on the {source} application
    And I have valid access credentials

  Scenario: Successful {title}
    Given I am on the {source} application
    When I perform the action: {description}
    Then I should see the expected result
    And the operation should complete successfully

  Scenario: Error handling for {title}
    Given I am on the {source} application
    When I perform the action with invalid data
    Then I should see an appropriate error message
    And the system should handle the error gracefully
"""
        
        # Update the requirement with Gherkin description
        pool = get_postgres_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    update_query = """
                        UPDATE requirements 
                        SET description = %s, updated_at = NOW()
                        WHERE id = %s
                        RETURNING id
                    """
                    cur.execute(update_query, (gherkin, requirement_id))
                    result = cur.fetchone()
                    conn.commit()
                    
                    if result:
                        return {
                            "id": str(result[0]),
                            "gherkin": gherkin,
                            "status": "success"
                        }
            finally:
                pool.putconn(conn)
        
        return {
            "id": requirement_id,
            "gherkin": gherkin,
            "status": "generated"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error converting requirement to Gherkin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{requirement_id}")
async def get_requirement(requirement_id: str):
    """Get a specific requirement"""
    try:
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        query = """
            SELECT id, project_id, source, source_ref, title, description, acceptance_criteria, raw_payload, created_at
            FROM requirements 
            WHERE id = %s
        """
        results = await execute_query(query, (requirement_id,))
        
        if not results or len(results) == 0:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        row = results[0]
        return {
            "id": str(row.get("id", "")),
            "title": row.get("title", ""),
            "description": row.get("description", ""),
            "acceptance_criteria": row.get("acceptance_criteria", ""),
            "source": row.get("source", ""),
            "source_ref": row.get("source_ref", ""),
            "created_at": str(row.get("created_at", ""))
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting requirement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{requirement_id}")
async def update_requirement(requirement_id: str, request: Request):
    """Update a requirement"""
    try:
        org_id, project_id = await ensure_default_org_project()
        data = await request.json()
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_fields = []
                update_values = []
                
                if data.get("title") is not None:
                    update_fields.append("title = %s")
                    update_values.append(data.get("title", ""))
                
                if data.get("description") is not None:
                    update_fields.append("description = %s")
                    update_values.append(data.get("description", ""))
                
                if data.get("acceptance_criteria") is not None:
                    update_fields.append("acceptance_criteria = %s")
                    update_values.append(data.get("acceptance_criteria", ""))
                
                if data.get("source") is not None:
                    update_fields.append("source = %s")
                    update_values.append(data.get("source", "manual"))
                
                if data.get("source_ref") is not None:
                    update_fields.append("source_ref = %s")
                    update_values.append(data.get("source_ref"))
                
                if not update_fields:
                    raise HTTPException(status_code=400, detail="No fields to update")
                
                update_fields.append("updated_at = NOW()")
                update_values.append(requirement_id)
                
                update_query = f"""
                    UPDATE requirements 
                    SET {", ".join(update_fields)}
                    WHERE id = %s
                    RETURNING id
                """
                cur.execute(update_query, tuple(update_values))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Requirement not found")
                
                return {"id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating requirement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


