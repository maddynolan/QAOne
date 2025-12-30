"""
Output Generator for Framework Analyzer

Generates various outputs from the domain model:
- Requirements Document (Markdown, JSON)
- Test Cases (ISTQB, Gherkin, Markdown)
- Domain Documentation
- Coverage Analysis Report
- Element Repository
"""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from .models import (
    DomainModel, PageObject, TestMethod, UserFlow, BusinessRule,
    Locator, FrameworkInfo
)

logger = logging.getLogger(__name__)


class OutputGenerator:
    """
    Generates various output formats from the analyzed domain model.
    """
    
    def __init__(self, domain_model: DomainModel, framework_info: FrameworkInfo):
        self.domain_model = domain_model
        self.framework_info = framework_info
    
    # ==================== REQUIREMENTS GENERATION ====================
    
    def generate_requirements_document(self, format: str = "markdown") -> str:
        """
        Generate a requirements document from the domain model.
        
        Args:
            format: Output format ("markdown", "json", "html")
        """
        if format == "markdown":
            return self._generate_requirements_markdown()
        elif format == "json":
            return self._generate_requirements_json()
        elif format == "html":
            return self._generate_requirements_html()
        else:
            return self._generate_requirements_markdown()
    
    def _generate_requirements_markdown(self) -> str:
        """Generate requirements in Markdown format."""
        lines = []
        
        # Header
        lines.append(f"# Requirements Specification")
        lines.append(f"\n**Application Domain:** {self.domain_model.domain.title()}")
        lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"**Source Framework:** {self.framework_info.framework_type.value}")
        lines.append("")
        
        # Table of Contents
        lines.append("## Table of Contents")
        lines.append("1. [Overview](#overview)")
        lines.append("2. [Functional Requirements](#functional-requirements)")
        lines.append("3. [User Flows](#user-flows)")
        lines.append("4. [Business Rules](#business-rules)")
        lines.append("5. [Entity Model](#entity-model)")
        lines.append("")
        
        # Overview
        lines.append("## Overview")
        lines.append(f"\nThis document describes the requirements extracted from an existing {self.framework_info.framework_type.value} automation test suite.")
        lines.append(f"\n- **Total Tests Analyzed:** {self.domain_model.total_tests}")
        lines.append(f"- **Pages/Screens:** {self.domain_model.total_pages}")
        lines.append(f"- **Business Entities:** {len(self.domain_model.entities)}")
        lines.append(f"- **User Flows:** {len(self.domain_model.user_flows)}")
        lines.append(f"- **Business Rules:** {len(self.domain_model.business_rules)}")
        lines.append("")
        
        # Functional Requirements (from assertions and business rules)
        lines.append("## Functional Requirements")
        lines.append("")
        
        req_counter = 0
        for entity in self.domain_model.entities:
            operations = self.domain_model.operations.get(entity, [])
            if operations:
                lines.append(f"### {entity} Management")
                lines.append("")
                for op in operations:
                    req_counter += 1
                    lines.append(f"**REQ-{req_counter:03d}:** System shall support {op.lower()} operation for {entity}.")
                    lines.append("")
        
        # Requirements from business rules
        lines.append("### Business Rule Requirements")
        lines.append("")
        for rule in self.domain_model.business_rules:
            req_counter += 1
            lines.append(f"**REQ-{req_counter:03d}:** {rule.requirement_text}")
            lines.append(f"  - *Category:* {rule.category}")
            lines.append(f"  - *Source:* {', '.join(rule.source_tests)}")
            lines.append("")
        
        # User Flows
        lines.append("## User Flows")
        lines.append("")
        for i, flow in enumerate(self.domain_model.user_flows, 1):
            lines.append(f"### {i}. {flow.name}")
            lines.append(f"\n**Priority:** {flow.priority.title()}")
            if flow.description:
                lines.append(f"\n**Description:** {flow.description}")
            if flow.pages:
                lines.append(f"\n**Pages Involved:** {' → '.join(flow.pages)}")
            if flow.preconditions:
                lines.append("\n**Preconditions:**")
                for pre in flow.preconditions:
                    lines.append(f"- {pre}")
            if flow.steps:
                lines.append("\n**Steps:**")
                for j, step in enumerate(flow.steps, 1):
                    lines.append(f"{j}. {step.description or step.action}")
            lines.append("")
        
        # Business Rules
        lines.append("## Business Rules")
        lines.append("")
        lines.append("| ID | Description | Category |")
        lines.append("|-----|-------------|----------|")
        for rule in self.domain_model.business_rules:
            lines.append(f"| {rule.rule_id} | {rule.description[:50]}... | {rule.category} |")
        lines.append("")
        
        # Entity Model
        lines.append("## Entity Model")
        lines.append("")
        for entity in self.domain_model.entities:
            operations = self.domain_model.operations.get(entity, [])
            lines.append(f"### {entity}")
            lines.append(f"\n**Operations:** {', '.join(operations) if operations else 'N/A'}")
            
            # Find related pages
            related_pages = [p.name for p in self.domain_model.pages if entity.lower() in p.name.lower()]
            if related_pages:
                lines.append(f"\n**Related Pages:** {', '.join(related_pages)}")
            lines.append("")
        
        return '\n'.join(lines)
    
    def _generate_requirements_json(self) -> str:
        """Generate requirements in JSON format."""
        requirements = {
            "metadata": {
                "domain": self.domain_model.domain,
                "generated_at": datetime.now().isoformat(),
                "source_framework": self.framework_info.framework_type.value,
                "total_tests": self.domain_model.total_tests,
            },
            "entities": [
                {
                    "name": entity,
                    "operations": self.domain_model.operations.get(entity, [])
                }
                for entity in self.domain_model.entities
            ],
            "functional_requirements": [
                {
                    "id": f"REQ-{i:03d}",
                    "description": rule.requirement_text,
                    "category": rule.category,
                    "priority": "medium",
                    "source_tests": rule.source_tests,
                }
                for i, rule in enumerate(self.domain_model.business_rules, 1)
            ],
            "user_flows": [
                {
                    "name": flow.name,
                    "description": flow.description,
                    "priority": flow.priority,
                    "pages": flow.pages,
                    "preconditions": flow.preconditions,
                    "steps": [{"action": s.action, "description": s.description} for s in flow.steps],
                }
                for flow in self.domain_model.user_flows
            ],
            "business_rules": [
                {
                    "id": rule.rule_id,
                    "description": rule.description,
                    "category": rule.category,
                }
                for rule in self.domain_model.business_rules
            ],
        }
        
        return json.dumps(requirements, indent=2)
    
    def _generate_requirements_html(self) -> str:
        """Generate requirements in HTML format."""
        md_content = self._generate_requirements_markdown()
        # Simple HTML conversion (could use a proper markdown parser)
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Requirements Specification</title>
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }}
                h1 {{ color: #333; }}
                h2 {{ color: #555; border-bottom: 1px solid #ddd; padding-bottom: 10px; }}
                h3 {{ color: #666; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f4f4f4; }}
                pre {{ background-color: #f4f4f4; padding: 10px; overflow-x: auto; }}
            </style>
        </head>
        <body>
            <pre>{md_content}</pre>
        </body>
        </html>
        """
        return html
    
    # ==================== TEST CASE GENERATION ====================
    
    def generate_test_cases(self, format: str = "istqb") -> str:
        """
        Generate test cases from the domain model.
        
        Args:
            format: Output format ("istqb", "gherkin", "markdown", "json")
        """
        if format == "istqb":
            return self._generate_test_cases_istqb()
        elif format == "gherkin":
            return self._generate_test_cases_gherkin()
        elif format == "markdown":
            return self._generate_test_cases_markdown()
        elif format == "json":
            return self._generate_test_cases_json()
        else:
            return self._generate_test_cases_istqb()
    
    def _generate_test_cases_istqb(self) -> str:
        """Generate test cases in ISTQB format."""
        lines = []
        
        lines.append("# Test Case Specification")
        lines.append(f"\n**Project:** {self.domain_model.domain.title()} Application")
        lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"**Total Test Cases:** {len(self.domain_model.test_methods)}")
        lines.append("")
        
        for i, test in enumerate(self.domain_model.test_methods, 1):
            lines.append("---")
            lines.append(f"## TC-{i:03d}: {test.to_test_case_title()}")
            lines.append("")
            lines.append(f"**Test Case ID:** TC-{i:03d}")
            lines.append(f"**Test Case Name:** {test.to_test_case_title()}")
            lines.append(f"**Priority:** {test.priority.title()}")
            lines.append(f"**Test Type:** {'Automated' if test.annotations else 'Manual'}")
            
            if test.tags:
                lines.append(f"**Tags:** {', '.join(test.tags)}")
            
            lines.append("")
            lines.append("### Preconditions")
            lines.append("1. Application is accessible")
            lines.append("2. Test data is available")
            if 'login' not in test.name.lower():
                lines.append("3. User is authenticated (if required)")
            
            lines.append("")
            lines.append("### Test Steps")
            lines.append("")
            lines.append("| Step | Action | Expected Result |")
            lines.append("|------|--------|-----------------|")
            
            if test.steps:
                for j, step in enumerate(test.steps, 1):
                    action = step.description or step.action
                    expected = step.wait_condition or "Action completes successfully"
                    lines.append(f"| {j} | {action} | {expected} |")
            else:
                # Generate generic steps from test name
                lines.append(f"| 1 | Navigate to relevant page | Page loads successfully |")
                lines.append(f"| 2 | Perform {test.to_test_case_title()} | Action completes |")
                lines.append(f"| 3 | Verify results | Expected outcome achieved |")
            
            lines.append("")
            lines.append("### Expected Results")
            if test.assertions:
                for assertion in test.assertions:
                    lines.append(f"- {assertion.to_requirement()}")
            else:
                lines.append(f"- {test.to_test_case_title()} completes successfully")
            
            lines.append("")
        
        return '\n'.join(lines)
    
    def _generate_test_cases_gherkin(self) -> str:
        """Generate test cases in Gherkin/Cucumber format."""
        lines = []
        
        # Group tests by entity/feature
        feature_name = f"{self.domain_model.domain.title()} Application Tests"
        
        lines.append(f"Feature: {feature_name}")
        lines.append(f"  As a user of the {self.domain_model.domain} application")
        lines.append("  I want to perform various operations")
        lines.append("  So that I can accomplish my tasks")
        lines.append("")
        
        for test in self.domain_model.test_methods:
            scenario_name = test.to_test_case_title()
            
            lines.append(f"  @{test.priority}")
            if test.tags:
                lines.append(f"  @{' @'.join(test.tags)}")
            
            lines.append(f"  Scenario: {scenario_name}")
            
            # Generate Given-When-Then
            # Given (preconditions)
            lines.append("    Given the user is on the application")
            if 'login' not in test.name.lower():
                lines.append("    And the user is authenticated")
            
            # When (actions)
            if test.steps:
                for step in test.steps:
                    action = step.description or step.action
                    lines.append(f"    When the user {action.lower()}")
            else:
                lines.append(f"    When the user performs {scenario_name.lower()}")
            
            # Then (assertions)
            if test.assertions:
                for i, assertion in enumerate(test.assertions):
                    prefix = "Then" if i == 0 else "And"
                    lines.append(f"    {prefix} {assertion.to_requirement().lower()}")
            else:
                lines.append(f"    Then the operation should complete successfully")
            
            lines.append("")
        
        return '\n'.join(lines)
    
    def _generate_test_cases_markdown(self) -> str:
        """Generate test cases in simple Markdown format."""
        lines = []
        
        lines.append("# Test Cases")
        lines.append(f"\n**Total:** {len(self.domain_model.test_methods)} test cases")
        lines.append("")
        
        for i, test in enumerate(self.domain_model.test_methods, 1):
            lines.append(f"## {i}. {test.to_test_case_title()}")
            lines.append(f"\n- **Priority:** {test.priority}")
            lines.append(f"- **Source:** `{test.file_path}`")
            
            if test.description:
                lines.append(f"\n**Description:** {test.description}")
            
            if test.steps:
                lines.append("\n**Steps:**")
                for j, step in enumerate(test.steps, 1):
                    lines.append(f"{j}. {step.description or step.action}")
            
            if test.assertions:
                lines.append("\n**Verifications:**")
                for assertion in test.assertions:
                    lines.append(f"- {assertion.to_requirement()}")
            
            lines.append("")
        
        return '\n'.join(lines)
    
    def _generate_test_cases_json(self) -> str:
        """Generate test cases in JSON format."""
        test_cases = [
            {
                "id": f"TC-{i:03d}",
                "name": test.to_test_case_title(),
                "original_name": test.name,
                "priority": test.priority,
                "tags": test.tags,
                "file_path": test.file_path,
                "steps": [
                    {"action": s.action, "description": s.description, "expected": s.wait_condition}
                    for s in test.steps
                ],
                "assertions": [
                    {"type": a.assertion_type.value, "expected": a.expected_value, "requirement": a.to_requirement()}
                    for a in test.assertions
                ],
            }
            for i, test in enumerate(self.domain_model.test_methods, 1)
        ]
        
        return json.dumps({"test_cases": test_cases, "total": len(test_cases)}, indent=2)
    
    # ==================== DOMAIN DOCUMENTATION ====================
    
    def generate_domain_documentation(self) -> str:
        """Generate comprehensive domain documentation."""
        lines = []
        
        lines.append("# Domain Model Documentation")
        lines.append(f"\n**Domain:** {self.domain_model.domain.title()}")
        lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append("")
        
        # Executive Summary
        lines.append("## Executive Summary")
        lines.append(f"\nThis documentation describes the domain model extracted from an existing test automation framework.")
        lines.append(f"\n### Key Metrics")
        lines.append(f"- **Business Entities:** {len(self.domain_model.entities)}")
        lines.append(f"- **Application Pages:** {self.domain_model.total_pages}")
        lines.append(f"- **Test Coverage:** {self.domain_model.total_tests} tests")
        lines.append(f"- **UI Elements:** {self.domain_model.total_locators} locators")
        lines.append(f"- **Business Rules:** {len(self.domain_model.business_rules)}")
        lines.append("")
        
        # Entity Model
        lines.append("## Entity Model")
        lines.append("")
        for entity in self.domain_model.entities:
            operations = self.domain_model.operations.get(entity, [])
            lines.append(f"### {entity}")
            lines.append(f"\n**CRUD Operations:** {', '.join(operations) if operations else 'Not determined'}")
            
            # Related pages
            related_pages = [p for p in self.domain_model.pages if entity.lower() in p.name.lower()]
            if related_pages:
                lines.append("\n**Related Screens:**")
                for page in related_pages:
                    lines.append(f"- {page.name}")
                    if page.action_methods:
                        lines.append(f"  - Actions: {', '.join(page.action_methods[:5])}")
            lines.append("")
        
        # Page/Screen Catalog
        lines.append("## Screen Catalog")
        lines.append("")
        for page in self.domain_model.pages:
            lines.append(f"### {page.name}")
            lines.append(f"\n**Entity:** {page.entity}")
            lines.append(f"**File:** `{page.file_path}`")
            
            if page.action_methods:
                lines.append("\n**Actions:**")
                for method in page.action_methods[:10]:
                    lines.append(f"- {method}")
            
            if page.verification_methods:
                lines.append("\n**Verifications:**")
                for method in page.verification_methods[:10]:
                    lines.append(f"- {method}")
            
            if page.locators:
                lines.append(f"\n**Elements:** {len(page.locators)} locators defined")
            lines.append("")
        
        # Critical Flows
        lines.append("## Critical User Flows")
        lines.append("")
        critical_flows = [f for f in self.domain_model.user_flows if f.priority in ["critical", "high"]]
        for flow in critical_flows[:10]:
            lines.append(f"### {flow.name}")
            lines.append(f"\n**Priority:** {flow.priority.title()}")
            if flow.pages:
                lines.append(f"**Path:** {' → '.join(flow.pages)}")
            lines.append("")
        
        return '\n'.join(lines)
    
    # ==================== ELEMENT REPOSITORY ====================
    
    def generate_element_repository(self, format: str = "json") -> str:
        """
        Generate an element repository from all locators.
        
        Args:
            format: Output format ("json", "csv", "markdown")
        """
        if format == "json":
            return self._generate_element_repository_json()
        elif format == "csv":
            return self._generate_element_repository_csv()
        elif format == "markdown":
            return self._generate_element_repository_markdown()
        else:
            return self._generate_element_repository_json()
    
    def _generate_element_repository_json(self) -> str:
        """Generate element repository in JSON format."""
        elements = [
            {
                "id": f"EL-{i:04d}",
                "name": loc.name,
                "locator_type": loc.locator_type.value,
                "locator_value": loc.value,
                "page": loc.page_name,
                "description": loc.element_description,
                "file_path": loc.file_path,
                "confidence": loc.confidence,
            }
            for i, loc in enumerate(self.domain_model.all_locators, 1)
        ]
        
        return json.dumps({
            "element_repository": elements,
            "total_elements": len(elements),
            "by_type": self._count_by_type(),
        }, indent=2)
    
    def _generate_element_repository_csv(self) -> str:
        """Generate element repository in CSV format."""
        lines = ["ID,Name,Type,Value,Page,Description"]
        
        for i, loc in enumerate(self.domain_model.all_locators, 1):
            # Escape CSV values
            value = loc.value.replace('"', '""')
            desc = (loc.element_description or "").replace('"', '""')
            lines.append(f'EL-{i:04d},"{loc.name}",{loc.locator_type.value},"{value}","{loc.page_name}","{desc}"')
        
        return '\n'.join(lines)
    
    def _generate_element_repository_markdown(self) -> str:
        """Generate element repository in Markdown format."""
        lines = []
        
        lines.append("# Element Repository")
        lines.append(f"\n**Total Elements:** {len(self.domain_model.all_locators)}")
        lines.append("")
        
        # Group by page
        by_page = {}
        for loc in self.domain_model.all_locators:
            page = loc.page_name or "Unassigned"
            if page not in by_page:
                by_page[page] = []
            by_page[page].append(loc)
        
        for page, locators in by_page.items():
            lines.append(f"## {page}")
            lines.append("")
            lines.append("| Name | Type | Value |")
            lines.append("|------|------|-------|")
            for loc in locators[:20]:  # Limit per page
                value = loc.value[:50] + "..." if len(loc.value) > 50 else loc.value
                lines.append(f"| {loc.name} | {loc.locator_type.value} | `{value}` |")
            lines.append("")
        
        return '\n'.join(lines)
    
    def _count_by_type(self) -> Dict[str, int]:
        """Count locators by type."""
        counts = {}
        for loc in self.domain_model.all_locators:
            loc_type = loc.locator_type.value
            counts[loc_type] = counts.get(loc_type, 0) + 1
        return counts
    
    # ==================== COVERAGE ANALYSIS ====================
    
    def generate_coverage_report(self) -> str:
        """Generate a test coverage analysis report."""
        lines = []
        
        lines.append("# Test Coverage Analysis Report")
        lines.append(f"\n**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"**Framework:** {self.framework_info.framework_type.value}")
        lines.append("")
        
        # Coverage Summary
        lines.append("## Coverage Summary")
        lines.append("")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Total Tests | {self.domain_model.total_tests} |")
        lines.append(f"| Pages Covered | {self.domain_model.total_pages} |")
        lines.append(f"| Entities Identified | {len(self.domain_model.entities)} |")
        lines.append(f"| User Flows | {len(self.domain_model.user_flows)} |")
        lines.append(f"| Business Rules | {len(self.domain_model.business_rules)} |")
        lines.append(f"| UI Elements | {self.domain_model.total_locators} |")
        lines.append("")
        
        # Entity Coverage
        lines.append("## Entity Coverage")
        lines.append("")
        lines.append("| Entity | Operations Covered | Test Count |")
        lines.append("|--------|-------------------|------------|")
        
        for entity in self.domain_model.entities:
            operations = self.domain_model.operations.get(entity, [])
            # Count tests for this entity
            test_count = sum(1 for t in self.domain_model.test_methods if entity.lower() in t.name.lower())
            lines.append(f"| {entity} | {', '.join(operations) if operations else 'N/A'} | {test_count} |")
        
        lines.append("")
        
        # Potential Gaps
        lines.append("## Potential Coverage Gaps")
        lines.append("")
        
        # Check for entities without CRUD coverage
        for entity in self.domain_model.entities:
            operations = set(self.domain_model.operations.get(entity, []))
            missing = {"Create", "Read", "Update", "Delete"} - operations
            if missing:
                lines.append(f"- **{entity}:** Missing operations - {', '.join(missing)}")
        
        # Check for pages without tests
        tested_pages = set()
        for test in self.domain_model.test_methods:
            for page in self.domain_model.pages:
                if page.name.lower().replace("page", "") in test.name.lower():
                    tested_pages.add(page.name)
        
        untested_pages = [p.name for p in self.domain_model.pages if p.name not in tested_pages]
        if untested_pages:
            lines.append(f"\n- **Untested Pages:** {', '.join(untested_pages[:10])}")
        
        lines.append("")
        
        # Recommendations
        lines.append("## Recommendations")
        lines.append("")
        lines.append("Based on the analysis, consider adding tests for:")
        lines.append("")
        
        recommendations = []
        for entity in self.domain_model.entities[:5]:
            operations = self.domain_model.operations.get(entity, [])
            if "Delete" not in operations:
                recommendations.append(f"- {entity} deletion scenarios")
            if "Update" not in operations:
                recommendations.append(f"- {entity} update/edit scenarios")
        
        if recommendations:
            lines.extend(recommendations)
        else:
            lines.append("- Good coverage! Consider edge cases and error scenarios.")
        
        return '\n'.join(lines)

