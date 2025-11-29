"""
Additional methods for API Test Engine
Postman and REST Assured generators
"""

import json
from typing import Dict, Any


def generate_postman_collection(test_suite: Dict[str, Any]) -> str:
    """Generate Postman collection JSON"""
    base_url = test_suite.get("base_url", "{{base_url}}")
    test_cases = test_suite.get("test_cases", [])
    
    collection = {
        "info": {
            "name": "Generated API Tests",
            "description": "Auto-generated API test collection",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": []
    }
    
    for test_case in test_cases[:50]:  # Limit to 50 tests
        method = test_case.get("method", "GET")
        path = test_case.get("path", "")
        request = test_case.get("request", {})
        title = test_case.get("title", "API Test")
        
        item = {
            "name": title,
            "request": {
                "method": method,
                "header": [],
                "url": {
                    "raw": f"{base_url}{path}",
                    "host": [base_url],
                    "path": path.split("/")[1:] if path.startswith("/") else path.split("/")
                }
            },
            "response": []
        }
        
        # Add headers
        if request.get("headers"):
            for k, v in request["headers"].items():
                item["request"]["header"].append({
                    "key": k,
                    "value": v,
                    "type": "text"
                })
        
        # Add body
        if request.get("body"):
            item["request"]["body"] = {
                "mode": "raw",
                "raw": json.dumps(request["body"], indent=2),
                "options": {
                    "raw": {
                        "language": "json"
                    }
                }
            }
        
        # Add test script
        expected_status = test_case.get("expected_status", 200)
        item["event"] = [{
            "listen": "test",
            "script": {
                "exec": [
                    f"pm.test('Status code is {expected_status}', function () {{",
                    f"    pm.response.to.have.status({expected_status});",
                    "});",
                    "pm.test('Response time is less than 2000ms', function () {",
                    "    pm.expect(pm.response.responseTime).to.be.below(2000);",
                    "});"
                ],
                "type": "text/javascript"
            }
        }]
        
        collection["item"].append(item)
    
    return json.dumps(collection, indent=2)


def generate_rest_assured_tests(test_suite: Dict[str, Any]) -> str:
    """Generate REST Assured (Java) test code"""
    base_url = test_suite.get("base_url", "")
    test_cases = test_suite.get("test_cases", [])
    
    code_lines = [
        "package com.example.api.tests;",
        "",
        "import io.restassured.RestAssured;",
        "import io.restassured.http.ContentType;",
        "import org.junit.jupiter.api.BeforeAll;",
        "import org.junit.jupiter.api.Test;",
        "import static io.restassured.RestAssured.given;",
        "import static org.hamcrest.Matchers.*;",
        "",
        "public class APITests {",
        "",
        f"    private static final String BASE_URL = \"{base_url}\";",
        "",
        "    @BeforeAll",
        "    public static void setup() {",
        "        RestAssured.baseURI = BASE_URL;",
        "    }",
        ""
    ]
    
    for test_case in test_cases[:30]:  # Limit to 30 tests
        title = test_case.get("title", "API Test")
        method = test_case.get("method", "GET")
        path = test_case.get("path", "")
        request = test_case.get("request", {})
        expected_status = test_case.get("expected_status", 200)
        
        func_name = title.lower().replace(" ", "_").replace("-", "_").replace(":", "")
        code_lines.append(f"    @Test")
        code_lines.append(f"    public void test_{func_name}() {{")
        
        # Build request
        request_builder = "given()"
        
        # Add headers
        if request.get("headers"):
            for k, v in request["headers"].items():
                request_builder += f'\n            .header("{k}", "{v}")'
        
        # Add body
        if request.get("body"):
            body_json = json.dumps(request["body"])
            request_builder += f'\n            .contentType(ContentType.JSON)'
            request_builder += f'\n            .body({body_json})'
        
        # Add method and path
        request_builder += f'\n        .when()\n            .{method.lower()}("{path}")'
        
        # Add assertions
        request_builder += f'\n        .then()\n            .statusCode({expected_status})'
        
        code_lines.append(request_builder + ";")
        code_lines.append("    }")
        code_lines.append("")
    
    code_lines.append("}")
    
    return "\n".join(code_lines)


