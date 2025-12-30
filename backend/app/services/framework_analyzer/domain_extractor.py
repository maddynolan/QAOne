"""
Domain Extractor

Uses code analysis and LLM to extract:
- Business domain (e-commerce, banking, etc.)
- Entities (User, Product, Order, etc.)
- User flows and journeys
- Business rules from assertions
"""

import re
import logging
import json
from typing import List, Dict, Any, Optional
from collections import Counter, defaultdict

from .models import (
    DomainModel, PageObject, TestMethod, UserFlow, BusinessRule,
    Locator, Assertion, AssertionType, FrameworkInfo
)
from .code_parser import ParsedFile

logger = logging.getLogger(__name__)


class DomainExtractor:
    """
    Extracts domain model from parsed automation code.
    Combines static analysis with LLM-powered understanding.
    """
    
    # Domain indicators
    DOMAIN_KEYWORDS = {
        "e-commerce": [
            "cart", "checkout", "product", "shop", "store", "buy", "purchase",
            "order", "payment", "price", "item", "catalog", "wishlist", "inventory"
        ],
        "banking": [
            "account", "transfer", "balance", "transaction", "deposit", "withdraw",
            "loan", "credit", "debit", "bank", "payment", "statement", "mortgage"
        ],
        "healthcare": [
            "patient", "doctor", "appointment", "medical", "health", "hospital",
            "prescription", "diagnosis", "treatment", "insurance", "claim"
        ],
        "social-media": [
            "post", "friend", "follow", "like", "share", "comment", "profile",
            "feed", "message", "notification", "timeline", "story"
        ],
        "crm": [
            "customer", "contact", "lead", "opportunity", "account", "campaign",
            "sales", "pipeline", "deal", "activity", "task"
        ],
        "hr": [
            "employee", "payroll", "leave", "attendance", "recruitment", "candidate",
            "job", "interview", "onboarding", "performance", "review"
        ],
        "education": [
            "student", "course", "lesson", "grade", "assignment", "teacher",
            "class", "exam", "quiz", "enrollment", "certificate"
        ],
        "travel": [
            "flight", "hotel", "booking", "reservation", "trip", "destination",
            "passenger", "itinerary", "travel", "vacation"
        ],
    }
    
    # Entity extraction patterns
    ENTITY_PATTERNS = {
        "from_page_name": r"(\w+)(?:Page|Screen|View|Component)",
        "from_method_name": r"(?:create|add|update|delete|get|find|search|verify)(\w+)",
        "from_class_name": r"(\w+)(?:Service|Repository|Controller|Manager)",
    }
    
    def __init__(self, llm_client=None):
        """
        Initialize domain extractor.
        
        Args:
            llm_client: Optional LLM client for advanced analysis.
                        If None, uses static analysis only.
        """
        self.llm_client = llm_client
    
    def extract_domain_model(
        self,
        parsed_files: List[ParsedFile],
        framework_info: FrameworkInfo,
        use_llm: bool = True
    ) -> DomainModel:
        """
        Extract complete domain model from parsed files.
        """
        domain_model = DomainModel()
        
        # Step 1: Extract pages and entities from Page Objects
        pages, entities = self._extract_pages_and_entities(parsed_files)
        domain_model.pages = pages
        domain_model.entities = list(set(entities))
        
        # Step 2: Extract test methods
        test_methods = self._extract_test_methods(parsed_files)
        domain_model.test_methods = test_methods
        
        # Step 3: Extract all locators
        locators = self._extract_all_locators(parsed_files)
        domain_model.all_locators = locators
        
        # Step 4: Infer user flows from test methods
        flows = self._infer_user_flows(test_methods, pages)
        domain_model.user_flows = flows
        
        # Step 5: Extract business rules from assertions
        rules = self._extract_business_rules(test_methods)
        domain_model.business_rules = rules
        
        # Step 6: Determine domain
        domain = self._determine_domain(domain_model)
        domain_model.domain = domain
        
        # Step 7: Map operations to entities
        operations = self._map_operations_to_entities(pages, test_methods)
        domain_model.operations = operations
        
        # Step 8: Calculate statistics
        domain_model.total_tests = len(test_methods)
        domain_model.total_pages = len(pages)
        domain_model.total_locators = len(locators)
        domain_model.total_assertions = sum(len(t.assertions) for t in test_methods)
        
        # Step 9: Use LLM for enhanced understanding (if available)
        if use_llm and self.llm_client:
            domain_model = self._enhance_with_llm(domain_model, parsed_files)
        
        return domain_model
    
    def _extract_pages_and_entities(
        self, parsed_files: List[ParsedFile]
    ) -> tuple[List[PageObject], List[str]]:
        """Extract Page Objects and infer entities from them."""
        pages = []
        entities = []
        
        for pf in parsed_files:
            for po in pf.page_objects:
                pages.append(po)
                entity = po.infer_entity()
                if entity:
                    entities.append(entity)
        
        return pages, entities
    
    def _extract_test_methods(self, parsed_files: List[ParsedFile]) -> List[TestMethod]:
        """Extract all test methods from parsed files."""
        test_methods = []
        
        for pf in parsed_files:
            test_methods.extend(pf.test_methods)
        
        return test_methods
    
    def _extract_all_locators(self, parsed_files: List[ParsedFile]) -> List[Locator]:
        """Extract all locators from parsed files."""
        locators = []
        
        for pf in parsed_files:
            locators.extend(pf.locators)
            for po in pf.page_objects:
                locators.extend(po.locators)
        
        return locators
    
    def _infer_user_flows(
        self, test_methods: List[TestMethod], pages: List[PageObject]
    ) -> List[UserFlow]:
        """Infer user flows from test methods."""
        flows = []
        page_names = {p.name for p in pages}
        
        for test in test_methods:
            # Create a flow for each test
            flow = UserFlow(
                name=test.to_test_case_title(),
                description=test.description,
                priority=test.priority,
                source_tests=[test.name],
            )
            
            # Try to identify pages involved
            # Look for page references in the test name and steps
            for page in pages:
                page_lower = page.name.lower().replace("page", "")
                if page_lower in test.name.lower():
                    flow.pages.append(page.name)
            
            # Copy steps and assertions
            flow.steps = test.steps.copy()
            
            # Infer preconditions
            if any("login" in test.name.lower() for t in [test]):
                flow.preconditions.append("User is logged in")
            
            flows.append(flow)
        
        return flows
    
    def _extract_business_rules(self, test_methods: List[TestMethod]) -> List[BusinessRule]:
        """Extract business rules from test assertions."""
        rules = []
        rule_counter = 0
        
        for test in test_methods:
            for assertion in test.assertions:
                rule_counter += 1
                rule = BusinessRule(
                    rule_id=f"BR-{rule_counter:03d}",
                    description=assertion.description or assertion.to_requirement(),
                    category=self._categorize_assertion(assertion),
                    source_assertions=[assertion],
                    source_tests=[test.name],
                    requirement_text=assertion.to_requirement(),
                )
                rules.append(rule)
        
        # Also extract rules from test names/descriptions
        for test in test_methods:
            # Look for validation patterns in test names
            if any(word in test.name.lower() for word in ['valid', 'invalid', 'required', 'mandatory']):
                rule_counter += 1
                rule = BusinessRule(
                    rule_id=f"BR-{rule_counter:03d}",
                    description=f"Validation rule: {test.to_test_case_title()}",
                    category="Validation",
                    source_tests=[test.name],
                    requirement_text=f"System shall validate: {test.to_test_case_title()}",
                )
                rules.append(rule)
        
        return rules
    
    def _categorize_assertion(self, assertion: Assertion) -> str:
        """Categorize an assertion into a business rule category."""
        if assertion.assertion_type in [AssertionType.VISIBLE, AssertionType.NOT_VISIBLE, AssertionType.EXISTS]:
            return "UI Display"
        elif assertion.assertion_type in [AssertionType.EQUALS, AssertionType.NOT_EQUALS]:
            return "Data Validation"
        elif assertion.assertion_type == AssertionType.URL:
            return "Navigation"
        elif assertion.assertion_type == AssertionType.ENABLED:
            return "Access Control"
        else:
            return "Business Logic"
    
    def _determine_domain(self, domain_model: DomainModel) -> str:
        """Determine the business domain from extracted information."""
        # Collect all text to analyze
        all_text = []
        
        for page in domain_model.pages:
            all_text.append(page.name.lower())
            all_text.extend([m.lower() for m in page.action_methods])
        
        for test in domain_model.test_methods:
            all_text.append(test.name.lower())
            if test.description:
                all_text.append(test.description.lower())
        
        all_text.extend([e.lower() for e in domain_model.entities])
        
        combined_text = ' '.join(all_text)
        
        # Score each domain
        domain_scores = Counter()
        for domain, keywords in self.DOMAIN_KEYWORDS.items():
            for keyword in keywords:
                count = combined_text.count(keyword)
                domain_scores[domain] += count
        
        if domain_scores:
            return domain_scores.most_common(1)[0][0]
        return "general"
    
    def _map_operations_to_entities(
        self, pages: List[PageObject], test_methods: List[TestMethod]
    ) -> Dict[str, List[str]]:
        """Map CRUD operations to entities."""
        operations = defaultdict(set)
        
        # From page methods
        for page in pages:
            entity = page.entity
            for method in page.action_methods:
                method_lower = method.lower()
                if any(word in method_lower for word in ['create', 'add', 'new', 'register']):
                    operations[entity].add("Create")
                if any(word in method_lower for word in ['get', 'view', 'read', 'display', 'show']):
                    operations[entity].add("Read")
                if any(word in method_lower for word in ['update', 'edit', 'modify', 'change']):
                    operations[entity].add("Update")
                if any(word in method_lower for word in ['delete', 'remove', 'cancel']):
                    operations[entity].add("Delete")
                if any(word in method_lower for word in ['search', 'find', 'filter']):
                    operations[entity].add("Search")
        
        # From test names
        for test in test_methods:
            name_lower = test.name.lower()
            # Try to identify entity and operation from test name
            for entity in operations.keys():
                if entity.lower() in name_lower:
                    if 'create' in name_lower or 'add' in name_lower:
                        operations[entity].add("Create")
                    if 'view' in name_lower or 'get' in name_lower:
                        operations[entity].add("Read")
                    if 'update' in name_lower or 'edit' in name_lower:
                        operations[entity].add("Update")
                    if 'delete' in name_lower:
                        operations[entity].add("Delete")
        
        # Convert sets to lists
        return {k: list(v) for k, v in operations.items()}
    
    def _enhance_with_llm(
        self, domain_model: DomainModel, parsed_files: List[ParsedFile]
    ) -> DomainModel:
        """Use LLM to enhance domain understanding."""
        if not self.llm_client:
            return domain_model
        
        try:
            # Prepare context for LLM
            context = self._prepare_llm_context(domain_model, parsed_files)
            
            prompt = f"""
            Analyze this automation test framework and provide insights:
            
            {context}
            
            Please provide:
            1. Application domain (e-commerce, banking, healthcare, etc.)
            2. Main business entities with their relationships
            3. Critical user flows that should be tested
            4. Business rules inferred from assertions
            5. Potential test coverage gaps
            6. Recommended additional test cases
            
            Format your response as JSON with keys:
            - domain: string
            - entities: list of {{name, description, relationships}}
            - critical_flows: list of {{name, description, priority, steps}}
            - business_rules: list of {{id, description, category}}
            - coverage_gaps: list of strings
            - recommended_tests: list of {{name, description, priority}}
            """
            
            # Call LLM
            response = self.llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert QA automation analyst."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            llm_analysis = json.loads(response.choices[0].message.content)
            
            # Enhance domain model with LLM insights
            if llm_analysis.get("domain"):
                domain_model.domain = llm_analysis["domain"]
                domain_model.domain_confidence = 0.9
            
            # Add additional user flows from LLM
            for flow_data in llm_analysis.get("critical_flows", []):
                flow = UserFlow(
                    name=flow_data.get("name", ""),
                    description=flow_data.get("description", ""),
                    priority=flow_data.get("priority", "medium"),
                )
                if flow.name not in [f.name for f in domain_model.user_flows]:
                    domain_model.user_flows.append(flow)
            
            logger.info("Enhanced domain model with LLM analysis")
            
        except Exception as e:
            logger.warning(f"LLM enhancement failed: {e}")
        
        return domain_model
    
    def _prepare_llm_context(
        self, domain_model: DomainModel, parsed_files: List[ParsedFile]
    ) -> str:
        """Prepare context string for LLM analysis."""
        context_parts = []
        
        # Pages
        context_parts.append("PAGES:")
        for page in domain_model.pages[:20]:  # Limit to 20 pages
            methods = ', '.join(page.action_methods[:5])
            context_parts.append(f"  - {page.name}: {methods}")
        
        # Test methods
        context_parts.append("\nTEST METHODS:")
        for test in domain_model.test_methods[:30]:  # Limit to 30 tests
            context_parts.append(f"  - {test.name}")
        
        # Entities
        context_parts.append(f"\nENTITIES: {', '.join(domain_model.entities[:15])}")
        
        # Business rules
        context_parts.append("\nBUSINESS RULES FROM ASSERTIONS:")
        for rule in domain_model.business_rules[:15]:
            context_parts.append(f"  - {rule.description}")
        
        return '\n'.join(context_parts)
    
    def get_domain_summary(self, domain_model: DomainModel) -> Dict[str, Any]:
        """Get a summary of the extracted domain model."""
        return {
            "domain": domain_model.domain,
            "confidence": domain_model.domain_confidence,
            "entities": domain_model.entities,
            "operations": domain_model.operations,
            "pages_count": len(domain_model.pages),
            "tests_count": len(domain_model.test_methods),
            "flows_count": len(domain_model.user_flows),
            "rules_count": len(domain_model.business_rules),
            "locators_count": len(domain_model.all_locators),
            "coverage": domain_model.get_coverage_summary(),
        }

