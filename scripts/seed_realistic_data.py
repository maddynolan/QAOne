#!/usr/bin/env python3
"""
Script to seed realistic test cases and requirements from demo testing websites.
Creates 50 requirements and 50 test cases covering Manual, API, and Automation scenarios.
"""

import asyncio
import json
import requests
import uuid
from datetime import datetime
from typing import List, Dict, Any

# Backend API base URL
BASE_URL = "http://localhost:8000"

# Default IDs matching backend constants
DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000000"
DEFAULT_PROJECT_ID = "11111111-1111-1111-1111-111111111111"
DEFAULT_USER_ID = "22222222-2222-2222-2222-222222222222"

# Requirements data based on demo websites
REQUIREMENTS_DATA = [
    # E-commerce (SauceDemo, QA-Practice, AutomationExercise, etc.)
    {"source": "SauceDemo", "source_ref": "REQ-ECO-001", "title": "User Login Functionality", "description": "As a user, I should be able to log in with valid credentials to access my account."},
    {"source": "SauceDemo", "source_ref": "REQ-ECO-002", "title": "Product Catalog Display", "description": "As a user, I should be able to view all available products in the catalog with their details."},
    {"source": "SauceDemo", "source_ref": "REQ-ECO-003", "title": "Add Product to Cart", "description": "As a user, I should be able to add products to my shopping cart."},
    {"source": "SauceDemo", "source_ref": "REQ-ECO-004", "title": "Shopping Cart Management", "description": "As a user, I should be able to view, update, and remove items from my shopping cart."},
    {"source": "SauceDemo", "source_ref": "REQ-ECO-005", "title": "Checkout Process", "description": "As a user, I should be able to complete the checkout process with valid information."},
    {"source": "QA-Practice", "source_ref": "REQ-ECO-006", "title": "Product Search Functionality", "description": "As a user, I should be able to search for products by name or category."},
    {"source": "QA-Practice", "source_ref": "REQ-ECO-007", "title": "Product Filtering", "description": "As a user, I should be able to filter products by price, category, or rating."},
    {"source": "AutomationExercise", "source_ref": "REQ-ECO-008", "title": "User Registration", "description": "As a new user, I should be able to register for an account with valid information."},
    {"source": "AutomationExercise", "source_ref": "REQ-ECO-009", "title": "Product Reviews", "description": "As a user, I should be able to view and submit product reviews."},
    {"source": "GreenKart", "source_ref": "REQ-ECO-010", "title": "Quantity Update in Cart", "description": "As a user, I should be able to update the quantity of items in my cart."},
    
    # API Testing (REQRES, PetStore, JSONPlaceholder)
    {"source": "REQRES API", "source_ref": "REQ-API-001", "title": "User List Retrieval", "description": "As a system, I should be able to retrieve a list of users via GET endpoint."},
    {"source": "REQRES API", "source_ref": "REQ-API-002", "title": "Single User Retrieval", "description": "As a system, I should be able to retrieve a single user by ID via GET endpoint."},
    {"source": "REQRES API", "source_ref": "REQ-API-003", "title": "User Creation", "description": "As a system, I should be able to create a new user via POST endpoint."},
    {"source": "REQRES API", "source_ref": "REQ-API-004", "title": "User Update", "description": "As a system, I should be able to update an existing user via PUT endpoint."},
    {"source": "REQRES API", "source_ref": "REQ-API-005", "title": "User Deletion", "description": "As a system, I should be able to delete a user via DELETE endpoint."},
    {"source": "PetStore Swagger", "source_ref": "REQ-API-006", "title": "Pet Creation", "description": "As a system, I should be able to create a new pet record via POST endpoint."},
    {"source": "PetStore Swagger", "source_ref": "REQ-API-007", "title": "Pet Status Update", "description": "As a system, I should be able to update pet status via PUT endpoint."},
    {"source": "PetStore Swagger", "source_ref": "REQ-API-008", "title": "Pet Retrieval by Status", "description": "As a system, I should be able to retrieve pets by status (available, pending, sold)."},
    {"source": "JSONPlaceholder", "source_ref": "REQ-API-009", "title": "Post Creation", "description": "As a system, I should be able to create a new post via POST endpoint."},
    {"source": "JSONPlaceholder", "source_ref": "REQ-API-010", "title": "Comment Retrieval", "description": "As a system, I should be able to retrieve comments for a specific post."},
    
    # Todo Applications (TodoMVC)
    {"source": "TodoMVC", "source_ref": "REQ-TODO-001", "title": "Create Todo Item", "description": "As a user, I should be able to create a new todo item."},
    {"source": "TodoMVC", "source_ref": "REQ-TODO-002", "title": "Mark Todo as Complete", "description": "As a user, I should be able to mark a todo item as completed."},
    {"source": "TodoMVC", "source_ref": "REQ-TODO-003", "title": "Edit Todo Item", "description": "As a user, I should be able to edit an existing todo item."},
    {"source": "TodoMVC", "source_ref": "REQ-TODO-004", "title": "Delete Todo Item", "description": "As a user, I should be able to delete a todo item."},
    {"source": "TodoMVC", "source_ref": "REQ-TODO-005", "title": "Filter Todos", "description": "As a user, I should be able to filter todos by status (All, Active, Completed)."},
    {"source": "TodoMVC", "source_ref": "REQ-TODO-006", "title": "Clear Completed Todos", "description": "As a user, I should be able to clear all completed todos at once."},
    
    # Banking (XYZ Bank)
    {"source": "XYZ Bank", "source_ref": "REQ-BANK-001", "title": "Account Login", "description": "As a customer, I should be able to log in to my bank account with valid credentials."},
    {"source": "XYZ Bank", "source_ref": "REQ-BANK-002", "title": "Account Balance Inquiry", "description": "As a customer, I should be able to view my account balance."},
    {"source": "XYZ Bank", "source_ref": "REQ-BANK-003", "title": "Transaction History", "description": "As a customer, I should be able to view my transaction history."},
    {"source": "XYZ Bank", "source_ref": "REQ-BANK-004", "title": "Add Customer Account", "description": "As a bank manager, I should be able to add a new customer account."},
    {"source": "XYZ Bank", "source_ref": "REQ-BANK-005", "title": "Open Account", "description": "As a bank manager, I should be able to open a new account for a customer."},
    
    # Medical (Katalon Cura)
    {"source": "Katalon Cura", "source_ref": "REQ-MED-001", "title": "Appointment Booking", "description": "As a patient, I should be able to book a medical appointment."},
    {"source": "Katalon Cura", "source_ref": "REQ-MED-002", "title": "Appointment History", "description": "As a patient, I should be able to view my appointment history."},
    {"source": "Katalon Cura", "source_ref": "REQ-MED-003", "title": "Appointment Cancellation", "description": "As a patient, I should be able to cancel an existing appointment."},
    
    # Travel (Blazedemo)
    {"source": "Blazedemo", "source_ref": "REQ-TRAVEL-001", "title": "Flight Search", "description": "As a user, I should be able to search for available flights."},
    {"source": "Blazedemo", "source_ref": "REQ-TRAVEL-002", "title": "Flight Selection", "description": "As a user, I should be able to select a flight from search results."},
    {"source": "Blazedemo", "source_ref": "REQ-TRAVEL-003", "title": "Purchase Flight", "description": "As a user, I should be able to purchase a selected flight ticket."},
    
    # Form Testing (QA-Practice)
    {"source": "QA-Practice", "source_ref": "REQ-FORM-001", "title": "Contact Form Submission", "description": "As a user, I should be able to submit a contact form with valid data."},
    {"source": "QA-Practice", "source_ref": "REQ-FORM-002", "title": "Form Validation", "description": "As a system, I should validate form inputs and show appropriate error messages."},
    {"source": "QA-Practice", "source_ref": "REQ-FORM-003", "title": "File Upload", "description": "As a user, I should be able to upload a file through a form."},
    
    # Additional mixed scenarios
    {"source": "ExpandTesting", "source_ref": "REQ-GEN-001", "title": "Web Element Interaction", "description": "As a user, I should be able to interact with common web elements (buttons, links, dropdowns)."},
    {"source": "ExpandTesting", "source_ref": "REQ-GEN-002", "title": "Multi-Tab Navigation", "description": "As a user, I should be able to navigate between multiple tabs/windows."},
    {"source": "BrowserStackDemo", "source_ref": "REQ-GEN-003", "title": "Responsive Design Testing", "description": "As a user, I should experience a responsive design across different screen sizes."},
    {"source": "TestSmith", "source_ref": "REQ-GEN-004", "title": "Product Sorting", "description": "As a user, I should be able to sort products by price, name, or rating."},
    {"source": "JPetStore", "source_ref": "REQ-GEN-005", "title": "Category Navigation", "description": "As a user, I should be able to navigate through product categories."},
    {"source": "Deck of Cards API", "source_ref": "REQ-API-011", "title": "Deck Creation", "description": "As a system, I should be able to create a new deck of cards via API."},
    {"source": "Deck of Cards API", "source_ref": "REQ-API-012", "title": "Card Drawing", "description": "As a system, I should be able to draw cards from a deck via API."},
    {"source": "Chuck Norris API", "source_ref": "REQ-API-013", "title": "Random Joke Retrieval", "description": "As a system, I should be able to retrieve random jokes via GET endpoint."},
    {"source": "K6 Test API", "source_ref": "REQ-API-014", "title": "WebSocket Connection", "description": "As a system, I should be able to establish and maintain WebSocket connections."},
]

# Test Cases Data
TEST_CASES_DATA = [
    # E-commerce Manual Test Cases
    {
        "name": "TC-ECO-001: Valid User Login",
        "description": "Verify user can log in with valid credentials on SauceDemo",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Navigate to SauceDemo login page", "expectedResult": "Login page is displayed"},
            {"action": "Enter valid username (standard_user)", "expectedResult": "Username field is populated"},
            {"action": "Enter valid password (secret_sauce)", "expectedResult": "Password field is populated"},
            {"action": "Click Login button", "expectedResult": "User is redirected to products page"},
            {"action": "Verify products are displayed", "expectedResult": "Product catalog is visible"}
        ],
        "tags": ["login", "authentication", "e-commerce"],
        "requirement_ref": "REQ-ECO-001"
    },
    {
        "name": "TC-ECO-002: Invalid Login Credentials",
        "description": "Verify error message is displayed when login fails with invalid credentials",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Navigate to SauceDemo login page", "expectedResult": "Login page is displayed"},
            {"action": "Enter invalid username (invalid_user)", "expectedResult": "Username field is populated"},
            {"action": "Enter invalid password (wrong_pass)", "expectedResult": "Password field is populated"},
            {"action": "Click Login button", "expectedResult": "Error message is displayed: 'Username and password do not match'"}
        ],
        "tags": ["login", "validation", "error-handling"],
        "requirement_ref": "REQ-ECO-001"
    },
    {
        "name": "TC-ECO-003: View Product Catalog",
        "description": "Verify all products are displayed in the catalog",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Login to SauceDemo with valid credentials", "expectedResult": "User is logged in and on products page"},
            {"action": "Verify product images are displayed", "expectedResult": "All product images are visible"},
            {"action": "Verify product names are displayed", "expectedResult": "All product names are visible"},
            {"action": "Verify product prices are displayed", "expectedResult": "All product prices are visible"},
            {"action": "Verify Add to Cart buttons are present", "expectedResult": "Add to Cart buttons are visible for all products"}
        ],
        "tags": ["catalog", "display", "ui"],
        "requirement_ref": "REQ-ECO-002"
    },
    {
        "name": "TC-ECO-004: Add Product to Cart",
        "description": "Verify user can add a product to shopping cart",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Login to SauceDemo", "expectedResult": "User is logged in"},
            {"action": "Click Add to Cart button for a product", "expectedResult": "Button changes to 'Remove'"},
            {"action": "Verify cart icon shows item count", "expectedResult": "Cart icon displays '1'"},
            {"action": "Click on cart icon", "expectedResult": "Cart page is displayed"},
            {"action": "Verify product is in cart", "expectedResult": "Selected product is visible in cart"}
        ],
        "tags": ["cart", "shopping", "e-commerce"],
        "requirement_ref": "REQ-ECO-003"
    },
    {
        "name": "TC-ECO-005: Remove Product from Cart",
        "description": "Verify user can remove product from shopping cart",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Login to SauceDemo and add product to cart", "expectedResult": "Product is added to cart"},
            {"action": "Navigate to cart page", "expectedResult": "Cart page is displayed with product"},
            {"action": "Click Remove button for the product", "expectedResult": "Product is removed from cart"},
            {"action": "Verify cart is empty", "expectedResult": "Cart shows no items"},
            {"action": "Verify cart icon count is updated", "expectedResult": "Cart icon shows '0' or no count"}
        ],
        "tags": ["cart", "removal", "shopping"],
        "requirement_ref": "REQ-ECO-004"
    },
    {
        "name": "TC-ECO-006: Complete Checkout Process",
        "description": "Verify user can complete full checkout flow",
        "testType": "manual",
        "priority": "critical",
        "steps": [
            {"action": "Login to SauceDemo", "expectedResult": "User is logged in"},
            {"action": "Add product to cart", "expectedResult": "Product is in cart"},
            {"action": "Navigate to cart and click Checkout", "expectedResult": "Checkout information page is displayed"},
            {"action": "Enter first name, last name, and postal code", "expectedResult": "Fields are populated"},
            {"action": "Click Continue", "expectedResult": "Checkout overview page is displayed"},
            {"action": "Verify order summary is displayed", "expectedResult": "Order details are visible"},
            {"action": "Click Finish", "expectedResult": "Order confirmation page is displayed with success message"}
        ],
        "tags": ["checkout", "purchase", "e-commerce"],
        "requirement_ref": "REQ-ECO-005"
    },
    {
        "name": "TC-ECO-007: Product Search Functionality",
        "description": "Verify user can search for products",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Navigate to QA-Practice website", "expectedResult": "Homepage is displayed"},
            {"action": "Click on search icon", "expectedResult": "Search bar is displayed"},
            {"action": "Enter product name in search field", "expectedResult": "Search term is entered"},
            {"action": "Press Enter or click search button", "expectedResult": "Search results are displayed"},
            {"action": "Verify search results match the search term", "expectedResult": "Only relevant products are shown"}
        ],
        "tags": ["search", "filtering"],
        "requirement_ref": "REQ-ECO-006"
    },
    {
        "name": "TC-ECO-008: User Registration",
        "description": "Verify new user can register for an account",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Navigate to AutomationExercise registration page", "expectedResult": "Registration form is displayed"},
            {"action": "Enter name in Name field", "expectedResult": "Name field is populated"},
            {"action": "Enter valid email address", "expectedResult": "Email field is populated"},
            {"action": "Enter password", "expectedResult": "Password field is populated"},
            {"action": "Click Sign Up button", "expectedResult": "Account is created and user is logged in"}
        ],
        "tags": ["registration", "signup", "authentication"],
        "requirement_ref": "REQ-ECO-008"
    },
    {
        "name": "TC-ECO-009: Update Cart Quantity",
        "description": "Verify user can update quantity of items in cart",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Login to GreenKart and add product to cart", "expectedResult": "Product is added to cart"},
            {"action": "Navigate to cart page", "expectedResult": "Cart is displayed"},
            {"action": "Click quantity increase button", "expectedResult": "Quantity is increased by 1"},
            {"action": "Verify total price is updated", "expectedResult": "Total price reflects new quantity"},
            {"action": "Click quantity decrease button", "expectedResult": "Quantity is decreased by 1"}
        ],
        "tags": ["cart", "quantity", "update"],
        "requirement_ref": "REQ-ECO-010"
    },
    
    # API Test Cases
    {
        "name": "TC-API-001: GET User List",
        "description": "Verify GET /api/users endpoint returns list of users",
        "testType": "api",
        "priority": "high",
        "steps": [
            {"action": "Send GET request to https://reqres.in/api/users", "expectedResult": "HTTP 200 OK status is returned"},
            {"action": "Verify response contains 'data' array", "expectedResult": "Response JSON contains 'data' field with array"},
            {"action": "Verify each user has id, email, first_name, last_name fields", "expectedResult": "All required user fields are present"},
            {"action": "Verify response contains 'page' and 'per_page' fields", "expectedResult": "Pagination fields are present in response"}
        ],
        "tags": ["api", "get", "users"],
        "requirement_ref": "REQ-API-001"
    },
    {
        "name": "TC-API-002: GET Single User",
        "description": "Verify GET /api/users/{id} endpoint returns single user",
        "testType": "api",
        "priority": "high",
        "steps": [
            {"action": "Send GET request to https://reqres.in/api/users/2", "expectedResult": "HTTP 200 OK status is returned"},
            {"action": "Verify response contains 'data' object", "expectedResult": "Response JSON contains 'data' field with user object"},
            {"action": "Verify user id matches requested id", "expectedResult": "User id is 2"},
            {"action": "Verify user has email, first_name, last_name, avatar fields", "expectedResult": "All required fields are present"}
        ],
        "tags": ["api", "get", "single-user"],
        "requirement_ref": "REQ-API-002"
    },
    {
        "name": "TC-API-003: POST Create User",
        "description": "Verify POST /api/users endpoint creates a new user",
        "testType": "api",
        "priority": "high",
        "steps": [
            {"action": "Prepare JSON payload with name and job fields", "expectedResult": "Payload is created: {\"name\": \"John Doe\", \"job\": \"Engineer\"}"},
            {"action": "Send POST request to https://reqres.in/api/users with payload", "expectedResult": "HTTP 201 Created status is returned"},
            {"action": "Verify response contains 'id' field", "expectedResult": "Response contains generated user id"},
            {"action": "Verify response contains 'name' and 'job' fields matching request", "expectedResult": "Response matches request payload"},
            {"action": "Verify response contains 'createdAt' timestamp", "expectedResult": "Created timestamp is present"}
        ],
        "tags": ["api", "post", "create"],
        "requirement_ref": "REQ-API-003"
    },
    {
        "name": "TC-API-004: PUT Update User",
        "description": "Verify PUT /api/users/{id} endpoint updates existing user",
        "testType": "api",
        "priority": "high",
        "steps": [
            {"action": "Prepare JSON payload with updated name and job", "expectedResult": "Payload is created: {\"name\": \"Jane Doe\", \"job\": \"Developer\"}"},
            {"action": "Send PUT request to https://reqres.in/api/users/2 with payload", "expectedResult": "HTTP 200 OK status is returned"},
            {"action": "Verify response contains updated 'name' and 'job' fields", "expectedResult": "Response matches updated payload"},
            {"action": "Verify response contains 'updatedAt' timestamp", "expectedResult": "Updated timestamp is present"}
        ],
        "tags": ["api", "put", "update"],
        "requirement_ref": "REQ-API-004"
    },
    {
        "name": "TC-API-005: DELETE User",
        "description": "Verify DELETE /api/users/{id} endpoint deletes user",
        "testType": "api",
        "priority": "high",
        "steps": [
            {"action": "Send DELETE request to https://reqres.in/api/users/2", "expectedResult": "HTTP 204 No Content status is returned"},
            {"action": "Verify response body is empty", "expectedResult": "Response has no content"},
            {"action": "Send GET request to verify user is deleted", "expectedResult": "GET request returns 404 Not Found"}
        ],
        "tags": ["api", "delete", "removal"],
        "requirement_ref": "REQ-API-005"
    },
    {
        "name": "TC-API-006: POST Create Pet",
        "description": "Verify POST /pet endpoint creates a new pet",
        "testType": "api",
        "priority": "medium",
        "steps": [
            {"action": "Prepare JSON payload with pet details (id, name, status, category)", "expectedResult": "Payload is created with required fields"},
            {"action": "Send POST request to https://petstore.swagger.io/v2/pet", "expectedResult": "HTTP 200 OK status is returned"},
            {"action": "Verify response contains pet id", "expectedResult": "Response contains the pet id"},
            {"action": "Verify response matches request payload", "expectedResult": "All pet details match the request"}
        ],
        "tags": ["api", "post", "petstore"],
        "requirement_ref": "REQ-API-006"
    },
    {
        "name": "TC-API-007: GET Pets by Status",
        "description": "Verify GET /pet/findByStatus endpoint returns pets by status",
        "testType": "api",
        "priority": "medium",
        "steps": [
            {"action": "Send GET request to https://petstore.swagger.io/v2/pet/findByStatus?status=available", "expectedResult": "HTTP 200 OK status is returned"},
            {"action": "Verify response is an array", "expectedResult": "Response is a JSON array"},
            {"action": "Verify all pets have status='available'", "expectedResult": "All pets in response have status 'available'"},
            {"action": "Verify each pet has id, name, and status fields", "expectedResult": "All required fields are present"}
        ],
        "tags": ["api", "get", "filter"],
        "requirement_ref": "REQ-API-008"
    },
    {
        "name": "TC-API-008: GET Post by ID",
        "description": "Verify GET /posts/{id} endpoint returns a post",
        "testType": "api",
        "priority": "medium",
        "steps": [
            {"action": "Send GET request to https://jsonplaceholder.typicode.com/posts/1", "expectedResult": "HTTP 200 OK status is returned"},
            {"action": "Verify response contains userId, id, title, body fields", "expectedResult": "All required post fields are present"},
            {"action": "Verify post id matches requested id", "expectedResult": "Post id is 1"}
        ],
        "tags": ["api", "get", "jsonplaceholder"],
        "requirement_ref": "REQ-API-009"
    },
    {
        "name": "TC-API-009: POST Create Deck of Cards",
        "description": "Verify POST /deck/new endpoint creates a new deck",
        "testType": "api",
        "priority": "low",
        "steps": [
            {"action": "Send GET request to https://deckofcardsapi.com/api/deck/new/", "expectedResult": "HTTP 200 OK status is returned"},
            {"action": "Verify response contains 'deck_id' field", "expectedResult": "Deck ID is present in response"},
            {"action": "Verify response contains 'remaining' field with value 52", "expectedResult": "Remaining cards count is 52"},
            {"action": "Verify response contains 'shuffled' field", "expectedResult": "Shuffled status is present"}
        ],
        "tags": ["api", "get", "cards"],
        "requirement_ref": "REQ-API-011"
    },
    {
        "name": "TC-API-010: GET Draw Cards from Deck",
        "description": "Verify GET /deck/{deck_id}/draw endpoint draws cards",
        "testType": "api",
        "priority": "low",
        "steps": [
            {"action": "Create a new deck and get deck_id", "expectedResult": "Deck ID is obtained"},
            {"action": "Send GET request to https://deckofcardsapi.com/api/deck/{deck_id}/draw/?count=5", "expectedResult": "HTTP 200 OK status is returned"},
            {"action": "Verify response contains 'cards' array with 5 items", "expectedResult": "5 cards are returned"},
            {"action": "Verify each card has suit, value, and image fields", "expectedResult": "All card fields are present"},
            {"action": "Verify 'remaining' count is decreased by 5", "expectedResult": "Remaining count is 47"}
        ],
        "tags": ["api", "get", "draw"],
        "requirement_ref": "REQ-API-012"
    },
    
    # Todo Application Test Cases
    {
        "name": "TC-TODO-001: Create Todo Item",
        "description": "Verify user can create a new todo item in TodoMVC",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Navigate to TodoMVC application", "expectedResult": "Todo app is displayed"},
            {"action": "Click on input field at top", "expectedResult": "Input field is focused"},
            {"action": "Enter todo text: 'Buy groceries'", "expectedResult": "Text is entered in input field"},
            {"action": "Press Enter key", "expectedResult": "Todo item is added to list"},
            {"action": "Verify todo item appears in list", "expectedResult": "New todo is visible in the list"}
        ],
        "tags": ["todo", "create", "crud"],
        "requirement_ref": "REQ-TODO-001"
    },
    {
        "name": "TC-TODO-002: Mark Todo as Complete",
        "description": "Verify user can mark todo item as completed",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Create a todo item", "expectedResult": "Todo item exists in list"},
            {"action": "Click checkbox next to todo item", "expectedResult": "Checkbox is checked"},
            {"action": "Verify todo item has strikethrough styling", "expectedResult": "Todo text is crossed out"},
            {"action": "Verify todo count decreases", "expectedResult": "Active todos count is updated"}
        ],
        "tags": ["todo", "complete", "status"],
        "requirement_ref": "REQ-TODO-002"
    },
    {
        "name": "TC-TODO-003: Edit Todo Item",
        "description": "Verify user can edit existing todo item",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Create a todo item", "expectedResult": "Todo item exists"},
            {"action": "Double-click on todo text", "expectedResult": "Todo text becomes editable"},
            {"action": "Modify the text", "expectedResult": "Text is updated"},
            {"action": "Press Enter or click outside", "expectedResult": "Todo item is saved with new text"},
            {"action": "Verify updated text is displayed", "expectedResult": "New text is visible in list"}
        ],
        "tags": ["todo", "edit", "update"],
        "requirement_ref": "REQ-TODO-003"
    },
    {
        "name": "TC-TODO-004: Delete Todo Item",
        "description": "Verify user can delete a todo item",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Create a todo item", "expectedResult": "Todo item exists"},
            {"action": "Hover over todo item", "expectedResult": "Delete button (X) appears"},
            {"action": "Click delete button", "expectedResult": "Todo item is removed from list"},
            {"action": "Verify todo count is updated", "expectedResult": "Total todos count decreases"}
        ],
        "tags": ["todo", "delete", "removal"],
        "requirement_ref": "REQ-TODO-004"
    },
    {
        "name": "TC-TODO-005: Filter Todos by Status",
        "description": "Verify user can filter todos by All, Active, Completed",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Create multiple todos and mark some as complete", "expectedResult": "Mix of active and completed todos exist"},
            {"action": "Click 'Active' filter", "expectedResult": "Only active todos are displayed"},
            {"action": "Click 'Completed' filter", "expectedResult": "Only completed todos are displayed"},
            {"action": "Click 'All' filter", "expectedResult": "All todos are displayed"}
        ],
        "tags": ["todo", "filter", "status"],
        "requirement_ref": "REQ-TODO-005"
    },
    {
        "name": "TC-TODO-006: Clear Completed Todos",
        "description": "Verify user can clear all completed todos at once",
        "testType": "manual",
        "priority": "low",
        "steps": [
            {"action": "Create multiple todos and mark some as complete", "expectedResult": "Mix of active and completed todos exist"},
            {"action": "Click 'Clear completed' button", "expectedResult": "All completed todos are removed"},
            {"action": "Verify only active todos remain", "expectedResult": "Only active todos are visible"},
            {"action": "Verify todo count is updated", "expectedResult": "Total count reflects remaining todos"}
        ],
        "tags": ["todo", "clear", "bulk-action"],
        "requirement_ref": "REQ-TODO-006"
    },
    
    # Banking Test Cases
    {
        "name": "TC-BANK-001: Customer Login",
        "description": "Verify customer can log in to XYZ Bank",
        "testType": "manual",
        "priority": "critical",
        "steps": [
            {"action": "Navigate to XYZ Bank website", "expectedResult": "Homepage is displayed"},
            {"action": "Click Customer Login button", "expectedResult": "Customer login page is displayed"},
            {"action": "Select a customer from dropdown", "expectedResult": "Customer is selected"},
            {"action": "Click Login button", "expectedResult": "Customer is logged in and dashboard is displayed"}
        ],
        "tags": ["banking", "login", "authentication"],
        "requirement_ref": "REQ-BANK-001"
    },
    {
        "name": "TC-BANK-002: View Account Balance",
        "description": "Verify customer can view account balance",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Login as customer", "expectedResult": "Customer dashboard is displayed"},
            {"action": "Select an account", "expectedResult": "Account details are displayed"},
            {"action": "Verify account balance is visible", "expectedResult": "Balance amount is displayed"},
            {"action": "Verify account number is displayed", "expectedResult": "Account number is visible"}
        ],
        "tags": ["banking", "balance", "account"],
        "requirement_ref": "REQ-BANK-002"
    },
    {
        "name": "TC-BANK-003: View Transaction History",
        "description": "Verify customer can view transaction history",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Login as customer and select account", "expectedResult": "Account is selected"},
            {"action": "Click Transactions tab", "expectedResult": "Transaction history is displayed"},
            {"action": "Verify transaction list is displayed", "expectedResult": "Transactions are listed"},
            {"action": "Verify each transaction shows date, amount, type", "expectedResult": "Transaction details are visible"}
        ],
        "tags": ["banking", "transactions", "history"],
        "requirement_ref": "REQ-BANK-003"
    },
    {
        "name": "TC-BANK-004: Bank Manager Add Customer",
        "description": "Verify bank manager can add a new customer",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Login as Bank Manager", "expectedResult": "Manager dashboard is displayed"},
            {"action": "Click Add Customer button", "expectedResult": "Add Customer form is displayed"},
            {"action": "Enter first name, last name, post code", "expectedResult": "Form fields are populated"},
            {"action": "Click Add Customer button", "expectedResult": "Customer is added successfully"},
            {"action": "Verify customer appears in customer list", "expectedResult": "New customer is visible in list"}
        ],
        "tags": ["banking", "manager", "customer", "create"],
        "requirement_ref": "REQ-BANK-004"
    },
    
    # Medical Appointment Test Cases
    {
        "name": "TC-MED-001: Book Appointment",
        "description": "Verify patient can book a medical appointment",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Navigate to Katalon Cura website", "expectedResult": "Homepage is displayed"},
            {"action": "Click Make Appointment button", "expectedResult": "Login page is displayed"},
            {"action": "Login with valid credentials", "expectedResult": "User is logged in"},
            {"action": "Select facility from dropdown", "expectedResult": "Facility is selected"},
            {"action": "Check 'Apply for hospital readmission' if needed", "expectedResult": "Checkbox is checked"},
            {"action": "Select healthcare program", "expectedResult": "Program is selected"},
            {"action": "Select visit date", "expectedResult": "Date is selected"},
            {"action": "Enter comment", "expectedResult": "Comment is entered"},
            {"action": "Click Book Appointment button", "expectedResult": "Appointment is booked successfully"}
        ],
        "tags": ["medical", "appointment", "booking"],
        "requirement_ref": "REQ-MED-001"
    },
    {
        "name": "TC-MED-002: View Appointment History",
        "description": "Verify patient can view appointment history",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Login to Katalon Cura", "expectedResult": "User is logged in"},
            {"action": "Navigate to History section", "expectedResult": "History page is displayed"},
            {"action": "Verify past appointments are listed", "expectedResult": "Appointment list is displayed"},
            {"action": "Verify each appointment shows facility, date, comment", "expectedResult": "Appointment details are visible"}
        ],
        "tags": ["medical", "history", "appointments"],
        "requirement_ref": "REQ-MED-002"
    },
    
    # Travel Test Cases
    {
        "name": "TC-TRAVEL-001: Search for Flights",
        "description": "Verify user can search for flights",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Navigate to Blazedemo website", "expectedResult": "Homepage is displayed"},
            {"action": "Select departure city from dropdown", "expectedResult": "Departure city is selected"},
            {"action": "Select destination city from dropdown", "expectedResult": "Destination city is selected"},
            {"action": "Click Find Flights button", "expectedResult": "Flight search results are displayed"},
            {"action": "Verify flights are listed with prices", "expectedResult": "Flight options with prices are visible"}
        ],
        "tags": ["travel", "flight", "search"],
        "requirement_ref": "REQ-TRAVEL-001"
    },
    {
        "name": "TC-TRAVEL-002: Select Flight",
        "description": "Verify user can select a flight from search results",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Search for flights", "expectedResult": "Flight results are displayed"},
            {"action": "Click Choose This Flight button for a flight", "expectedResult": "Flight purchase page is displayed"},
            {"action": "Verify flight details are shown (airline, price, flight number)", "expectedResult": "Flight information is displayed"}
        ],
        "tags": ["travel", "flight", "selection"],
        "requirement_ref": "REQ-TRAVEL-002"
    },
    {
        "name": "TC-TRAVEL-003: Purchase Flight Ticket",
        "description": "Verify user can purchase a flight ticket",
        "testType": "manual",
        "priority": "critical",
        "steps": [
            {"action": "Select a flight", "expectedResult": "Purchase page is displayed"},
            {"action": "Enter name, address, city, state, zip code", "expectedResult": "Form fields are populated"},
            {"action": "Select card type", "expectedResult": "Card type is selected"},
            {"action": "Enter card number, month, year, name on card", "expectedResult": "Payment details are entered"},
            {"action": "Click Purchase Flight button", "expectedResult": "Confirmation page is displayed with order ID"}
        ],
        "tags": ["travel", "purchase", "checkout"],
        "requirement_ref": "REQ-TRAVEL-003"
    },
    
    # Form Testing
    {
        "name": "TC-FORM-001: Submit Contact Form",
        "description": "Verify user can submit contact form with valid data",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Navigate to QA-Practice contact form", "expectedResult": "Contact form is displayed"},
            {"action": "Enter name in Name field", "expectedResult": "Name field is populated"},
            {"action": "Enter email in Email field", "expectedResult": "Email field is populated"},
            {"action": "Enter message in Message field", "expectedResult": "Message field is populated"},
            {"action": "Click Submit button", "expectedResult": "Form is submitted successfully"},
            {"action": "Verify success message is displayed", "expectedResult": "Success confirmation is shown"}
        ],
        "tags": ["form", "contact", "submission"],
        "requirement_ref": "REQ-FORM-001"
    },
    {
        "name": "TC-FORM-002: Form Validation - Empty Fields",
        "description": "Verify form shows validation errors for empty required fields",
        "testType": "manual",
        "priority": "high",
        "steps": [
            {"action": "Navigate to contact form", "expectedResult": "Form is displayed"},
            {"action": "Leave all fields empty", "expectedResult": "Fields remain empty"},
            {"action": "Click Submit button", "expectedResult": "Validation errors are displayed"},
            {"action": "Verify error messages appear for each required field", "expectedResult": "Error messages are visible"}
        ],
        "tags": ["form", "validation", "error-handling"],
        "requirement_ref": "REQ-FORM-002"
    },
    {
        "name": "TC-FORM-003: File Upload",
        "description": "Verify user can upload a file through form",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Navigate to file upload form", "expectedResult": "File upload form is displayed"},
            {"action": "Click Choose File button", "expectedResult": "File picker dialog opens"},
            {"action": "Select a file (e.g., image or document)", "expectedResult": "File is selected"},
            {"action": "Click Upload button", "expectedResult": "File is uploaded"},
            {"action": "Verify success message and file name are displayed", "expectedResult": "Upload confirmation is shown"}
        ],
        "tags": ["form", "upload", "file"],
        "requirement_ref": "REQ-FORM-003"
    },
    
    # Automation Test Cases
    {
        "name": "TC-AUTO-001: Automated Login Flow",
        "description": "Automated test for user login functionality",
        "testType": "automated",
        "priority": "high",
        "steps": [
            {"action": "Navigate to SauceDemo login page", "expectedResult": "Page loads successfully"},
            {"action": "Enter username: standard_user", "expectedResult": "Username field is populated"},
            {"action": "Enter password: secret_sauce", "expectedResult": "Password field is populated"},
            {"action": "Click login button", "expectedResult": "User is redirected to products page"},
            {"action": "Verify products page URL", "expectedResult": "URL contains '/inventory.html'"},
            {"action": "Verify products are displayed", "expectedResult": "At least one product is visible"}
        ],
        "tags": ["automation", "login", "playwright"],
        "requirement_ref": "REQ-ECO-001"
    },
    {
        "name": "TC-AUTO-002: Automated Add to Cart",
        "description": "Automated test for adding product to cart",
        "testType": "automated",
        "priority": "high",
        "steps": [
            {"action": "Login to SauceDemo", "expectedResult": "User is logged in"},
            {"action": "Click Add to Cart for first product", "expectedResult": "Button text changes to 'Remove'"},
            {"action": "Verify cart badge shows '1'", "expectedResult": "Cart icon displays count of 1"},
            {"action": "Click cart icon", "expectedResult": "Cart page is displayed"},
            {"action": "Verify product is in cart", "expectedResult": "Product name is visible in cart"}
        ],
        "tags": ["automation", "cart", "playwright"],
        "requirement_ref": "REQ-ECO-003"
    },
    {
        "name": "TC-AUTO-003: Automated Checkout Flow",
        "description": "Automated end-to-end checkout process",
        "testType": "automated",
        "priority": "critical",
        "steps": [
            {"action": "Login and add product to cart", "expectedResult": "Product is in cart"},
            {"action": "Navigate to cart and click checkout", "expectedResult": "Checkout page is displayed"},
            {"action": "Fill in first name: John", "expectedResult": "First name field is populated"},
            {"action": "Fill in last name: Doe", "expectedResult": "Last name field is populated"},
            {"action": "Fill in postal code: 12345", "expectedResult": "Postal code field is populated"},
            {"action": "Click Continue", "expectedResult": "Overview page is displayed"},
            {"action": "Click Finish", "expectedResult": "Success page is displayed"},
            {"action": "Verify success message contains 'Thank you'", "expectedResult": "Success message is visible"}
        ],
        "tags": ["automation", "checkout", "e2e"],
        "requirement_ref": "REQ-ECO-005"
    },
    {
        "name": "TC-AUTO-004: Automated API Test - GET Users",
        "description": "Automated API test for GET users endpoint",
        "testType": "automated",
        "priority": "high",
        "steps": [
            {"action": "Send GET request to https://reqres.in/api/users", "expectedResult": "HTTP status 200 is returned"},
            {"action": "Parse JSON response", "expectedResult": "Response is valid JSON"},
            {"action": "Verify response.data is an array", "expectedResult": "Data field contains array"},
            {"action": "Verify array length is greater than 0", "expectedResult": "At least one user is returned"},
            {"action": "Verify first user has required fields (id, email, first_name, last_name)", "expectedResult": "All required fields are present"}
        ],
        "tags": ["automation", "api", "rest"],
        "requirement_ref": "REQ-API-001"
    },
    {
        "name": "TC-AUTO-005: Automated API Test - POST Create User",
        "description": "Automated API test for creating a user",
        "testType": "automated",
        "priority": "high",
        "steps": [
            {"action": "Prepare payload: {\"name\": \"Test User\", \"job\": \"QA Engineer\"}", "expectedResult": "Payload is created"},
            {"action": "Send POST request to https://reqres.in/api/users", "expectedResult": "HTTP status 201 is returned"},
            {"action": "Verify response contains 'id' field", "expectedResult": "User ID is generated"},
            {"action": "Verify response contains 'name' and 'job' matching request", "expectedResult": "Response matches request"},
            {"action": "Verify response contains 'createdAt' timestamp", "expectedResult": "Timestamp is present"}
        ],
        "tags": ["automation", "api", "post"],
        "requirement_ref": "REQ-API-003"
    },
    {
        "name": "TC-AUTO-006: Automated Todo Creation",
        "description": "Automated test for creating todo items",
        "testType": "automated",
        "priority": "medium",
        "steps": [
            {"action": "Navigate to TodoMVC application", "expectedResult": "App loads successfully"},
            {"action": "Enter todo text: 'Automated test todo'", "expectedResult": "Text is entered"},
            {"action": "Press Enter", "expectedResult": "Todo is added to list"},
            {"action": "Verify todo count increases", "expectedResult": "Count is updated"},
            {"action": "Verify todo text is visible in list", "expectedResult": "Todo appears in DOM"}
        ],
        "tags": ["automation", "todo", "crud"],
        "requirement_ref": "REQ-TODO-001"
    },
    
    # Additional mixed scenarios
    {
        "name": "TC-GEN-001: Web Element Interaction",
        "description": "Verify interaction with common web elements",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Navigate to ExpandTesting practice site", "expectedResult": "Page loads"},
            {"action": "Click on various buttons", "expectedResult": "Buttons respond to clicks"},
            {"action": "Click on links", "expectedResult": "Navigation occurs"},
            {"action": "Interact with dropdown menus", "expectedResult": "Dropdowns open and close"},
            {"action": "Interact with checkboxes and radio buttons", "expectedResult": "Elements toggle correctly"}
        ],
        "tags": ["web-elements", "interaction", "ui"],
        "requirement_ref": "REQ-GEN-001"
    },
    {
        "name": "TC-GEN-002: Product Sorting",
        "description": "Verify products can be sorted by different criteria",
        "testType": "manual",
        "priority": "medium",
        "steps": [
            {"action": "Navigate to TestSmith e-commerce site", "expectedResult": "Product page is displayed"},
            {"action": "Click Sort dropdown", "expectedResult": "Sort options are displayed"},
            {"action": "Select 'Price: Low to High'", "expectedResult": "Products are sorted by price ascending"},
            {"action": "Select 'Price: High to Low'", "expectedResult": "Products are sorted by price descending"},
            {"action": "Select 'Name: A to Z'", "expectedResult": "Products are sorted alphabetically"}
        ],
        "tags": ["sorting", "filtering", "e-commerce"],
        "requirement_ref": "REQ-GEN-004"
    },
    {
        "name": "TC-GEN-003: Category Navigation",
        "description": "Verify navigation through product categories",
        "testType": "manual",
        "priority": "low",
        "steps": [
            {"action": "Navigate to JPetStore", "expectedResult": "Homepage is displayed"},
            {"action": "Click on a category (e.g., Dogs)", "expectedResult": "Category page is displayed"},
            {"action": "Verify products in that category are shown", "expectedResult": "Relevant products are displayed"},
            {"action": "Click on another category", "expectedResult": "New category page is displayed"},
            {"action": "Verify products update to new category", "expectedResult": "Products change accordingly"}
        ],
        "tags": ["navigation", "categories", "browsing"],
        "requirement_ref": "REQ-GEN-005"
    },
    {
        "name": "TC-API-011: GET Random Joke",
        "description": "Verify GET endpoint returns random joke",
        "testType": "api",
        "priority": "low",
        "steps": [
            {"action": "Send GET request to https://api.chucknorris.io/jokes/random", "expectedResult": "HTTP 200 OK is returned"},
            {"action": "Verify response contains 'value' field with joke text", "expectedResult": "Joke text is present"},
            {"action": "Verify response contains 'id' field", "expectedResult": "Joke ID is present"},
            {"action": "Verify response contains 'url' field", "expectedResult": "Joke URL is present"}
        ],
        "tags": ["api", "get", "chuck-norris"],
        "requirement_ref": "REQ-API-013"
    },
]

def create_requirement(req_data: Dict[str, Any]) -> str:
    """Create a requirement via API"""
    url = f"{BASE_URL}/requirements"
    payload = {
        "project_id": DEFAULT_PROJECT_ID,
        "source": req_data["source"],
        "source_ref": req_data["source_ref"],
        "title": req_data["title"],
        "description": req_data["description"]
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        return result.get("id", "")
    except Exception as e:
        print(f"Error creating requirement {req_data['source_ref']}: {e}")
        return ""

def create_test_case(tc_data: Dict[str, Any], requirement_id: str = None) -> str:
    """Create a test case via API"""
    url = f"{BASE_URL}/test-cases"
    payload = {
        "project_id": DEFAULT_PROJECT_ID,
        "name": tc_data["name"],
        "description": tc_data["description"],
        "testType": tc_data["testType"],
        "priority": tc_data["priority"],
        "steps": tc_data["steps"],
        "tags": tc_data.get("tags", []),
        "preconditions": [],
        "testData": {},
        "estimatedTime": 15
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        test_case_id = result.get("id", "")
        
        # Link to requirement if provided
        if requirement_id and test_case_id:
            link_url = f"{BASE_URL}/test-cases/{test_case_id}/link-requirement"
            link_payload = {"requirement_id": requirement_id}
            try:
                requests.post(link_url, json=link_payload)
            except Exception as e:
                print(f"Warning: Could not link requirement to test case: {e}")
        
        return test_case_id
    except Exception as e:
        print(f"Error creating test case {tc_data['name']}: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response: {e.response.text}")
        return ""

def main():
    """Main function to seed database"""
    print("=" * 60)
    print("Seeding Realistic Test Data from Demo Websites")
    print("=" * 60)
    
    # Check if backend is running
    try:
        health_check = requests.get(f"{BASE_URL}/health")
        if health_check.status_code != 200:
            print(f"ERROR: Backend is not responding correctly at {BASE_URL}")
            print("Please ensure the backend server is running on port 8001")
            return
    except Exception as e:
        print(f"ERROR: Cannot connect to backend at {BASE_URL}")
        print("Please ensure the backend server is running on port 8001")
        print(f"Error: {e}")
        return
    
    print(f"\n[OK] Backend is running at {BASE_URL}\n")
    
    # Create requirements
    print("Creating Requirements...")
    requirement_map = {}  # Map source_ref to requirement_id
    created_reqs = 0
    
    for req_data in REQUIREMENTS_DATA:
        req_id = create_requirement(req_data)
        if req_id:
            requirement_map[req_data["source_ref"]] = req_id
            created_reqs += 1
            print(f"  [OK] Created requirement: {req_data['source_ref']} - {req_data['title']}")
        else:
            print(f"  [FAIL] Failed to create requirement: {req_data['source_ref']}")
    
    print(f"\n[OK] Created {created_reqs}/{len(REQUIREMENTS_DATA)} requirements\n")
    
    # Create test cases
    print("Creating Test Cases...")
    created_tcs = 0
    
    for tc_data in TEST_CASES_DATA:
        req_ref = tc_data.get("requirement_ref", "")
        req_id = requirement_map.get(req_ref, None)
        
        tc_id = create_test_case(tc_data, req_id)
        if tc_id:
            created_tcs += 1
            print(f"  [OK] Created test case: {tc_data['name']} ({tc_data['testType']})")
        else:
            print(f"  [FAIL] Failed to create test case: {tc_data['name']}")
    
    print(f"\n[OK] Created {created_tcs}/{len(TEST_CASES_DATA)} test cases\n")
    
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Requirements created: {created_reqs}/{len(REQUIREMENTS_DATA)}")
    print(f"Test cases created: {created_tcs}/{len(TEST_CASES_DATA)}")
    print(f"\nTest case breakdown:")
    
    # Count by type
    manual_count = sum(1 for tc in TEST_CASES_DATA if tc.get("testType") == "manual")
    api_count = sum(1 for tc in TEST_CASES_DATA if tc.get("testType") == "api")
    auto_count = sum(1 for tc in TEST_CASES_DATA if tc.get("testType") in ["automation", "automated"])
    
    print(f"  - Manual: {manual_count}")
    print(f"  - API: {api_count}")
    print(f"  - Automation: {auto_count}")
    
    print("\n[OK] Seeding complete!")
    print("\nYou can now view the test cases and requirements in the application.")

if __name__ == "__main__":
    main()

