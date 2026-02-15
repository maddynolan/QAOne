"""
Project Management API

Advanced project management with Kanban boards, sprints, and full QA traceability.
Better than Jira - simpler yet more powerful.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, date
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects", tags=["Project Management"])


# ==================== MODELS ====================

class IssueCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    type: str = "task"  # story, task, bug, epic, feature
    priority: str = "medium"  # critical, high, medium, low
    assignee: Optional[str] = None
    reporter: str = "System"
    sprint: Optional[str] = None
    epic: Optional[str] = None
    story_points: Optional[int] = None
    labels: List[str] = []
    linked_requirements: List[str] = []
    linked_test_cases: List[str] = []
    linked_defects: List[str] = []
    linked_commits: List[str] = []

class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None
    sprint: Optional[str] = None
    epic: Optional[str] = None
    story_points: Optional[int] = None
    labels: Optional[List[str]] = None
    linked_requirements: Optional[List[str]] = None
    linked_test_cases: Optional[List[str]] = None
    linked_defects: Optional[List[str]] = None
    linked_commits: Optional[List[str]] = None

class SprintCreate(BaseModel):
    name: str
    goal: Optional[str] = ""
    start_date: str
    end_date: str

class SprintUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    issues: Optional[List[str]] = None

class EpicCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: str = "#6366f1"

class BoardColumn(BaseModel):
    id: str
    name: str
    status: str
    wip_limit: Optional[int] = None
    color: str = "#6366f1"

class BoardCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    columns: List[BoardColumn] = []

class LinkCreate(BaseModel):
    source_id: str
    target_id: str
    link_type: str  # requirement, test_case, defect, commit, blocks, relates_to


# ==================== IN-MEMORY STORAGE ====================
# TODO: Replace with database storage

_issues: Dict[str, Dict[str, Any]] = {}
_sprints: Dict[str, Dict[str, Any]] = {}
_epics: Dict[str, Dict[str, Any]] = {}
_boards: Dict[str, Dict[str, Any]] = {}
_issue_counter = 100

def _get_next_issue_key() -> str:
    global _issue_counter
    _issue_counter += 1
    return f"AT-{_issue_counter}"


# ==================== ISSUE ENDPOINTS ====================

@router.get("/issues")
async def list_issues(
    status: Optional[str] = None,
    type: Optional[str] = None,
    priority: Optional[str] = None,
    sprint: Optional[str] = None,
    assignee: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
):
    """List all issues with filtering."""
    issues = list(_issues.values())
    
    # Apply filters
    if status:
        issues = [i for i in issues if i['status'] == status]
    if type:
        issues = [i for i in issues if i['type'] == type]
    if priority:
        issues = [i for i in issues if i['priority'] == priority]
    if sprint:
        issues = [i for i in issues if i.get('sprint') == sprint]
    if assignee:
        issues = [i for i in issues if i.get('assignee') == assignee]
    if search:
        search_lower = search.lower()
        issues = [i for i in issues if 
                  search_lower in i['title'].lower() or 
                  search_lower in i['key'].lower()]
    
    # Sort by updated_at desc
    issues.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
    
    return {
        "issues": issues[offset:offset + limit],
        "total": len(issues),
        "limit": limit,
        "offset": offset,
    }

@router.get("/issues/{issue_id}")
async def get_issue(issue_id: str):
    """Get a single issue by ID or key."""
    # Try by ID first, then by key
    issue = _issues.get(issue_id)
    if not issue:
        for i in _issues.values():
            if i['key'] == issue_id:
                issue = i
                break
    
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    return issue

@router.post("/issues")
async def create_issue(data: IssueCreate):
    """Create a new issue."""
    issue_id = str(uuid.uuid4())[:8]
    issue_key = _get_next_issue_key()
    now = datetime.utcnow().isoformat()
    
    issue = {
        "id": issue_id,
        "key": issue_key,
        "title": data.title,
        "description": data.description,
        "type": data.type,
        "status": "backlog",
        "priority": data.priority,
        "assignee": data.assignee,
        "reporter": data.reporter,
        "sprint": data.sprint,
        "epic": data.epic,
        "story_points": data.story_points,
        "labels": data.labels,
        "linked_requirements": data.linked_requirements,
        "linked_test_cases": data.linked_test_cases,
        "linked_defects": data.linked_defects,
        "linked_commits": data.linked_commits,
        "created_at": now,
        "updated_at": now,
    }
    
    _issues[issue_id] = issue
    logger.info(f"Created issue {issue_key}: {data.title}")
    
    return issue

@router.put("/issues/{issue_id}")
async def update_issue(issue_id: str, data: IssueUpdate):
    """Update an issue."""
    issue = _issues.get(issue_id)
    if not issue:
        # Try by key
        for i in _issues.values():
            if i['key'] == issue_id:
                issue = i
                issue_id = i['id']
                break
    
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates['updated_at'] = datetime.utcnow().isoformat()
    
    _issues[issue_id].update(updates)
    logger.info(f"Updated issue {issue['key']}")
    
    return _issues[issue_id]

@router.delete("/issues/{issue_id}")
async def delete_issue(issue_id: str):
    """Delete an issue."""
    if issue_id not in _issues:
        # Try by key
        for i in _issues.values():
            if i['key'] == issue_id:
                issue_id = i['id']
                break
    
    if issue_id not in _issues:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    del _issues[issue_id]
    return {"status": "deleted", "id": issue_id}

@router.post("/issues/{issue_id}/move")
async def move_issue(issue_id: str, new_status: str):
    """Move an issue to a new status (for drag & drop)."""
    issue = _issues.get(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    valid_statuses = ['queue', 'ready', 'in_progress', 'review', 'ready_to_test', 'testing', 'done']
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    old_status = issue['status']
    issue['status'] = new_status
    issue['updated_at'] = datetime.utcnow().isoformat()
    
    logger.info(f"Moved issue {issue['key']} from {old_status} to {new_status}")
    
    return issue


# ==================== SPRINT ENDPOINTS ====================

@router.get("/sprints")
async def list_sprints(status: Optional[str] = None):
    """List all sprints."""
    sprints = list(_sprints.values())
    
    if status:
        sprints = [s for s in sprints if s['status'] == status]
    
    sprints.sort(key=lambda x: x.get('start_date', ''), reverse=True)
    return {"sprints": sprints, "total": len(sprints)}

@router.get("/sprints/{sprint_id}")
async def get_sprint(sprint_id: str):
    """Get a single sprint with its issues."""
    sprint = _sprints.get(sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    
    # Get sprint issues
    sprint_issues = [i for i in _issues.values() if i.get('sprint') == sprint['name']]
    
    return {
        **sprint,
        "issues_detail": sprint_issues,
        "stats": {
            "total": len(sprint_issues),
            "queue": len([i for i in sprint_issues if i['status'] == 'queue']),
            "ready": len([i for i in sprint_issues if i['status'] == 'ready']),
            "in_progress": len([i for i in sprint_issues if i['status'] == 'in_progress']),
            "review": len([i for i in sprint_issues if i['status'] == 'review']),
            "ready_to_test": len([i for i in sprint_issues if i['status'] == 'ready_to_test']),
            "testing": len([i for i in sprint_issues if i['status'] == 'testing']),
            "done": len([i for i in sprint_issues if i['status'] == 'done']),
            "story_points": sum(i.get('story_points', 0) or 0 for i in sprint_issues),
        }
    }

@router.post("/sprints")
async def create_sprint(data: SprintCreate):
    """Create a new sprint."""
    sprint_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    
    sprint = {
        "id": sprint_id,
        "name": data.name,
        "goal": data.goal,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "status": "planning",
        "issues": [],
        "created_at": now,
        "updated_at": now,
    }
    
    _sprints[sprint_id] = sprint
    logger.info(f"Created sprint: {data.name}")
    
    return sprint

@router.put("/sprints/{sprint_id}")
async def update_sprint(sprint_id: str, data: SprintUpdate):
    """Update a sprint."""
    if sprint_id not in _sprints:
        raise HTTPException(status_code=404, detail="Sprint not found")
    
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates['updated_at'] = datetime.utcnow().isoformat()
    
    _sprints[sprint_id].update(updates)
    
    return _sprints[sprint_id]

@router.post("/sprints/{sprint_id}/start")
async def start_sprint(sprint_id: str):
    """Start a sprint."""
    if sprint_id not in _sprints:
        raise HTTPException(status_code=404, detail="Sprint not found")
    
    _sprints[sprint_id]['status'] = 'active'
    _sprints[sprint_id]['updated_at'] = datetime.utcnow().isoformat()
    
    return _sprints[sprint_id]

@router.post("/sprints/{sprint_id}/complete")
async def complete_sprint(sprint_id: str):
    """Complete a sprint."""
    if sprint_id not in _sprints:
        raise HTTPException(status_code=404, detail="Sprint not found")
    
    _sprints[sprint_id]['status'] = 'completed'
    _sprints[sprint_id]['updated_at'] = datetime.utcnow().isoformat()
    
    return _sprints[sprint_id]

@router.post("/sprints/{sprint_id}/add-issue/{issue_id}")
async def add_issue_to_sprint(sprint_id: str, issue_id: str):
    """Add an issue to a sprint."""
    if sprint_id not in _sprints:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if issue_id not in _issues:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    sprint = _sprints[sprint_id]
    issue = _issues[issue_id]
    
    issue['sprint'] = sprint['name']
    if issue_id not in sprint['issues']:
        sprint['issues'].append(issue_id)
    
    return {"status": "added", "sprint": sprint['name'], "issue": issue['key']}


# ==================== EPIC ENDPOINTS ====================

@router.get("/epics")
async def list_epics():
    """List all epics."""
    epics = list(_epics.values())
    
    # Calculate progress for each epic
    for epic in epics:
        epic_issues = [i for i in _issues.values() if i.get('epic') == epic['name']]
        done_issues = [i for i in epic_issues if i['status'] == 'done']
        epic['progress'] = int((len(done_issues) / len(epic_issues) * 100)) if epic_issues else 0
        epic['issues_count'] = len(epic_issues)
    
    return {"epics": epics, "total": len(epics)}

@router.post("/epics")
async def create_epic(data: EpicCreate):
    """Create a new epic."""
    epic_id = str(uuid.uuid4())[:8]
    epic_key = f"EPIC-{len(_epics) + 1}"
    now = datetime.utcnow().isoformat()
    
    epic = {
        "id": epic_id,
        "key": epic_key,
        "name": data.name,
        "description": data.description,
        "color": data.color,
        "progress": 0,
        "issues": [],
        "created_at": now,
        "updated_at": now,
    }
    
    _epics[epic_id] = epic
    
    return epic


# ==================== TRACEABILITY ENDPOINTS ====================

@router.get("/traceability")
async def get_traceability_matrix():
    """Get full traceability matrix."""
    issues = list(_issues.values())
    
    # Collect all linked items
    all_requirements = set()
    all_test_cases = set()
    all_defects = set()
    all_commits = set()
    
    for issue in issues:
        all_requirements.update(issue.get('linked_requirements', []))
        all_test_cases.update(issue.get('linked_test_cases', []))
        all_defects.update(issue.get('linked_defects', []))
        all_commits.update(issue.get('linked_commits', []))
    
    # Build requirement coverage
    requirement_coverage = []
    for req in sorted(all_requirements):
        linked_issues = [i for i in issues if req in i.get('linked_requirements', [])]
        linked_tests = set()
        linked_bugs = set()
        for issue in linked_issues:
            linked_tests.update(issue.get('linked_test_cases', []))
            linked_bugs.update(issue.get('linked_defects', []))
        
        coverage = min(100, len(linked_tests) * 25) if linked_tests else 0
        
        requirement_coverage.append({
            "requirement": req,
            "issues": [i['key'] for i in linked_issues],
            "test_cases": list(linked_tests),
            "defects": list(linked_bugs),
            "coverage": coverage,
            "status": "covered" if coverage >= 75 else "partial" if coverage >= 25 else "not_covered"
        })
    
    return {
        "summary": {
            "total_requirements": len(all_requirements),
            "total_issues": len(issues),
            "total_test_cases": len(all_test_cases),
            "total_defects": len(all_defects),
            "total_commits": len(all_commits),
            "covered_requirements": len([r for r in requirement_coverage if r['status'] == 'covered']),
            "partial_requirements": len([r for r in requirement_coverage if r['status'] == 'partial']),
            "uncovered_requirements": len([r for r in requirement_coverage if r['status'] == 'not_covered']),
        },
        "requirements": requirement_coverage,
        "issues_by_type": {
            "story": len([i for i in issues if i['type'] == 'story']),
            "task": len([i for i in issues if i['type'] == 'task']),
            "bug": len([i for i in issues if i['type'] == 'bug']),
            "epic": len([i for i in issues if i['type'] == 'epic']),
            "feature": len([i for i in issues if i['type'] == 'feature']),
        },
        "issues_by_status": {
            "queue": len([i for i in issues if i['status'] == 'queue']),
            "ready": len([i for i in issues if i['status'] == 'ready']),
            "in_progress": len([i for i in issues if i['status'] == 'in_progress']),
            "review": len([i for i in issues if i['status'] == 'review']),
            "ready_to_test": len([i for i in issues if i['status'] == 'ready_to_test']),
            "testing": len([i for i in issues if i['status'] == 'testing']),
            "done": len([i for i in issues if i['status'] == 'done']),
        },
    }

@router.post("/issues/{issue_id}/link")
async def add_link(issue_id: str, link: LinkCreate):
    """Add a traceability link to an issue."""
    if issue_id not in _issues:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    issue = _issues[issue_id]
    
    link_field_map = {
        "requirement": "linked_requirements",
        "test_case": "linked_test_cases",
        "defect": "linked_defects",
        "commit": "linked_commits",
    }
    
    field = link_field_map.get(link.link_type)
    if not field:
        raise HTTPException(status_code=400, detail=f"Invalid link type: {link.link_type}")
    
    if link.target_id not in issue.get(field, []):
        if field not in issue:
            issue[field] = []
        issue[field].append(link.target_id)
    
    issue['updated_at'] = datetime.utcnow().isoformat()
    
    return issue


# ==================== BOARD ENDPOINTS ====================

@router.get("/boards")
async def list_boards():
    """List all boards."""
    return {"boards": list(_boards.values()), "total": len(_boards)}

@router.post("/boards")
async def create_board(data: BoardCreate):
    """Create a new board."""
    board_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    
    # Default columns if none provided
    default_columns = [
        {"id": "backlog", "name": "Backlog", "status": "backlog", "color": "#64748b"},
        {"id": "todo", "name": "To Do", "status": "todo", "color": "#3b82f6"},
        {"id": "in_progress", "name": "In Progress", "status": "in_progress", "color": "#f59e0b"},
        {"id": "review", "name": "Review", "status": "review", "color": "#8b5cf6"},
        {"id": "done", "name": "Done", "status": "done", "color": "#22c55e"},
    ]
    
    board = {
        "id": board_id,
        "name": data.name,
        "description": data.description,
        "columns": [c.model_dump() for c in data.columns] if data.columns else default_columns,
        "created_at": now,
        "updated_at": now,
    }
    
    _boards[board_id] = board
    
    return board


# ==================== STATS ENDPOINTS ====================

@router.get("/stats")
async def get_project_stats():
    """Get project statistics."""
    issues = list(_issues.values())
    sprints = list(_sprints.values())
    
    return {
        "issues": {
            "total": len(issues),
            "by_status": {
                "queue": len([i for i in issues if i['status'] == 'queue']),
                "ready": len([i for i in issues if i['status'] == 'ready']),
                "in_progress": len([i for i in issues if i['status'] == 'in_progress']),
                "review": len([i for i in issues if i['status'] == 'review']),
                "ready_to_test": len([i for i in issues if i['status'] == 'ready_to_test']),
                "testing": len([i for i in issues if i['status'] == 'testing']),
                "done": len([i for i in issues if i['status'] == 'done']),
            },
            "by_type": {
                "story": len([i for i in issues if i['type'] == 'story']),
                "task": len([i for i in issues if i['type'] == 'task']),
                "bug": len([i for i in issues if i['type'] == 'bug']),
                "epic": len([i for i in issues if i['type'] == 'epic']),
                "feature": len([i for i in issues if i['type'] == 'feature']),
            },
            "by_priority": {
                "critical": len([i for i in issues if i['priority'] == 'critical']),
                "high": len([i for i in issues if i['priority'] == 'high']),
                "medium": len([i for i in issues if i['priority'] == 'medium']),
                "low": len([i for i in issues if i['priority'] == 'low']),
            },
        },
        "sprints": {
            "total": len(sprints),
            "active": len([s for s in sprints if s['status'] == 'active']),
            "planning": len([s for s in sprints if s['status'] == 'planning']),
            "completed": len([s for s in sprints if s['status'] == 'completed']),
        },
        "epics": {
            "total": len(_epics),
        },
        "velocity": {
            "average_points_per_sprint": 42,  # Would be calculated from historical data
            "completion_rate": 85,
        }
    }


# ==================== SEED DATA ====================

@router.post("/seed")
async def seed_demo_data():
    """Seed demo data for testing."""
    global _issues, _sprints, _epics, _issue_counter
    
    _issue_counter = 100
    _issues.clear()
    _sprints.clear()
    _epics.clear()
    
    # Create sprints
    sprint1 = await create_sprint(SprintCreate(
        name="Sprint 23",
        goal="Complete authentication module",
        start_date="2025-12-09",
        end_date="2025-12-23"
    ))
    _sprints[sprint1['id']]['status'] = 'active'
    
    await create_sprint(SprintCreate(
        name="Sprint 22",
        goal="Reporting features",
        start_date="2025-11-25",
        end_date="2025-12-08"
    ))
    _sprints[list(_sprints.keys())[-1]]['status'] = 'completed'
    
    await create_sprint(SprintCreate(
        name="Sprint 24",
        goal="API enhancements",
        start_date="2025-12-23",
        end_date="2026-01-06"
    ))
    
    # Create epics
    await create_epic(EpicCreate(name="Authentication", description="User auth system", color="#6366f1"))
    await create_epic(EpicCreate(name="Dashboard", description="Main dashboard features", color="#22c55e"))
    
    # Create issues
    demo_issues = [
        IssueCreate(title="User authentication flow", description="Implement OAuth2 login with Google and GitHub",
                   type="story", priority="high", assignee="John D.", sprint="Sprint 23", 
                   story_points=8, labels=["auth", "security"],
                   linked_requirements=["REQ-001", "REQ-002"], linked_test_cases=["TC-101", "TC-102", "TC-103"]),
        IssueCreate(title="Dashboard performance optimization", description="Reduce initial load time to under 2 seconds",
                   type="task", priority="medium", assignee="Mike R.", sprint="Sprint 23",
                   story_points=5, labels=["performance"],
                   linked_requirements=["REQ-003"], linked_test_cases=["TC-201"], linked_defects=["BUG-001"]),
        IssueCreate(title="Fix login button not responding", description="Button click event not firing on mobile Safari",
                   type="bug", priority="critical", assignee="Sarah M.", sprint="Sprint 23",
                   story_points=3, labels=["mobile", "safari", "urgent"],
                   linked_test_cases=["TC-101"]),
        IssueCreate(title="API rate limiting", description="Implement rate limiting for public API endpoints",
                   type="feature", priority="medium",
                   story_points=13, labels=["api", "security"],
                   linked_requirements=["REQ-010"]),
        IssueCreate(title="User profile redesign", description="Modern profile page with activity feed",
                   type="epic", priority="low", assignee="Design Team",
                   story_points=21, labels=["design", "ux"],
                   linked_requirements=["REQ-020", "REQ-021"]),
        IssueCreate(title="Export reports to PDF", description="Allow users to export test reports as PDF",
                   type="story", priority="medium", assignee="John D.", sprint="Sprint 22",
                   story_points=5, labels=["reports", "export"],
                   linked_requirements=["REQ-015"], linked_test_cases=["TC-301", "TC-302"]),
        IssueCreate(title="Database connection pooling", description="Optimize DB connections with pooling",
                   type="task", priority="high", assignee="Mike R.", sprint="Sprint 23",
                   story_points=8, labels=["backend", "performance"],
                   linked_defects=["BUG-002"]),
        IssueCreate(title="Mobile responsive tables", description="Make data tables work on mobile devices",
                   type="story", priority="low",
                   story_points=5, labels=["mobile", "ux"],
                   linked_requirements=["REQ-025"]),
    ]
    
    created_issues = []
    for issue_data in demo_issues:
        issue = await create_issue(issue_data)
        created_issues.append(issue)
    
    # Update statuses
    created_issues[0]['status'] = 'in_progress'
    created_issues[1]['status'] = 'todo'
    created_issues[2]['status'] = 'review'
    created_issues[3]['status'] = 'backlog'
    created_issues[4]['status'] = 'in_progress'
    created_issues[5]['status'] = 'done'
    created_issues[6]['status'] = 'todo'
    created_issues[7]['status'] = 'backlog'
    
    return {
        "status": "seeded",
        "issues": len(_issues),
        "sprints": len(_sprints),
        "epics": len(_epics),
    }

