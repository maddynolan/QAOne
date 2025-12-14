# How to Test Different Protocols and Formats in Apex

## 📋 Your Current Spec

**Your spec is: OpenAPI 3.1.0 (Swagger)**

- **Format**: OpenAPI/Swagger
- **Version**: 3.1.0
- **Protocol**: REST
- **Content Type**: JSON

OpenAPI (formerly Swagger) is the industry standard for REST API documentation. Your spec is perfect for REST API testing!

---

## 🎯 Supported Formats

Apex supports these API specification formats:

| Format | File Extensions | Protocol | Use Case |
|--------|----------------|----------|----------|
| **OpenAPI/Swagger** | `.json`, `.yaml`, `.yml` | REST | REST APIs (most common) |
| **WSDL** | `.wsdl`, `.xml` | SOAP | SOAP Web Services |
| **Postman Collection** | `.json` | REST | Postman collections |
| **GraphQL Schema** | `.graphql`, `.gql`, `.json` | GraphQL | GraphQL APIs |
| **AsyncAPI** | `.json`, `.yaml` | Async | Event-driven APIs |
| **Protobuf** | `.proto` | gRPC | gRPC services |
| **Avro** | `.avsc` | Kafka | Kafka message schemas |

---

## 🔌 Supported Protocols

Apex can test these protocols:

| Protocol | Format | Description |
|----------|--------|-------------|
| **REST** | OpenAPI, Postman | HTTP REST APIs (most common) |
| **SOAP** | WSDL | XML-based web services |
| **GraphQL** | GraphQL Schema | GraphQL query APIs |
| **gRPC** | Protobuf | High-performance RPC |
| **Kafka** | Avro, JSON Schema | Message queue testing |
| **MQTT** | JSON Schema | IoT message protocol |
| **WebSocket** | JSON Schema | Real-time bidirectional communication |
| **HTTP/2** | OpenAPI | HTTP/2 protocol testing |

---

## 📝 Step-by-Step: Testing Different Formats

### 1. REST API (OpenAPI/Swagger) - Your Current Setup ✅

**What you're doing now:**

1. **Go to "Import" tab**
2. **Protocol**: Select `REST`
3. **Format**: Select `OpenAPI/Swagger`
4. **Paste your spec** (the JSON you provided)
5. **Click "Import Specification"**
6. **Result**: 132 test cases generated

**Your spec structure:**
```json
{
  "openapi": "3.1.0",  // ← This confirms it's OpenAPI 3.1.0
  "info": {
    "title": "Test Website API",
    "version": "1.0.0"
  },
  "paths": {
    "/api/auth/register": {...},
    "/api/products": {...},
    // ... all your endpoints
  }
}
```

---

### 2. SOAP API (WSDL Format)

**When to use**: Testing SOAP web services

**Steps:**

1. **Go to "Import" tab**
2. **Protocol**: Select `SOAP`
3. **Format**: Select `WSDL`
4. **Upload WSDL file** or **Paste WSDL XML**:
   ```xml
   <?xml version="1.0"?>
   <definitions xmlns="http://schemas.xmlsoap.org/wsdl/">
     <types>
       <schema xmlns="http://www.w3.org/2001/XMLSchema">
         <!-- Your SOAP types -->
       </schema>
     </types>
     <message name="GetUserRequest">
       <!-- Request message -->
     </message>
     <portType name="UserService">
       <!-- Operations -->
     </portType>
     <binding name="UserServiceBinding" type="tns:UserService">
       <!-- SOAP binding -->
     </binding>
     <service name="UserService">
       <!-- Service definition -->
     </service>
   </definitions>
   ```
5. **Click "Import Specification"**
6. **Result**: SOAP test cases generated

**Example WSDL endpoints:**
- `http://localhost:8002/soap/user-service?wsdl`
- `http://localhost:8002/soap/order-service?wsdl`

---

### 3. GraphQL API

**When to use**: Testing GraphQL APIs

**Steps:**

1. **Go to "Import" tab**
2. **Protocol**: Select `GraphQL`
3. **Format**: Select `GraphQL Schema`
4. **Paste GraphQL Schema**:
   ```graphql
   type Query {
     products: [Product!]!
     product(id: ID!): Product
     categories: [Category!]!
   }
   
   type Mutation {
     createProduct(input: ProductInput!): Product!
     updateProduct(id: ID!, input: ProductInput!): Product!
   }
   
   type Product {
     id: ID!
     name: String!
     price: Float!
     category: Category!
   }
   
   input ProductInput {
     name: String!
     price: Float!
     categoryId: ID!
   }
   ```
5. **Click "Import Specification"**
6. **Result**: GraphQL query/mutation test cases generated

**Example GraphQL endpoint:**
- `http://localhost:8002/graphql`

---

### 4. Postman Collection

**When to use**: Import existing Postman collections

**Steps:**

1. **Go to "Import" tab**
2. **Protocol**: Select `REST`
3. **Format**: Select `Postman Collection`
4. **Upload Postman Collection JSON** or **Paste collection**:
   ```json
   {
     "info": {
       "name": "Test Website API",
       "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
     },
     "item": [
       {
         "name": "Register User",
         "request": {
           "method": "POST",
           "header": [],
           "url": {
             "raw": "http://localhost:8002/api/auth/register",
             "host": ["localhost"],
             "port": "8002",
             "path": ["api", "auth", "register"]
           },
           "body": {
             "mode": "raw",
             "raw": "{\n  \"email\": \"test@example.com\",\n  \"username\": \"testuser\",\n  \"password\": \"password123\"\n}"
           }
         }
       }
     ]
   }
   ```
5. **Click "Import Specification"**
6. **Result**: Test cases from Postman collection generated

---

### 5. gRPC (Protobuf)

**When to use**: Testing gRPC services

**Steps:**

1. **Go to "Import" tab**
2. **Protocol**: Select `gRPC`
3. **Format**: Select `Protobuf`
4. **Upload `.proto` file** or **Paste Protobuf definition**:
   ```protobuf
   syntax = "proto3";
   
   package testwebsite;
   
   service ProductService {
     rpc GetProduct(ProductRequest) returns (ProductResponse);
     rpc ListProducts(ListRequest) returns (ListResponse);
   }
   
   message ProductRequest {
     int32 id = 1;
   }
   
   message ProductResponse {
     int32 id = 1;
     string name = 2;
     double price = 3;
   }
   ```
5. **Click "Import Specification"**
6. **Result**: gRPC test cases generated

**Example gRPC endpoint:**
- `localhost:8002` (gRPC uses different port typically)

---

### 6. Kafka (Avro/JSON Schema)

**When to use**: Testing Kafka message queues

**Steps:**

1. **Go to "Import" tab**
2. **Protocol**: Select `Kafka`
3. **Format**: Select `Avro` or `JSON Schema`
4. **Paste Avro Schema**:
   ```json
   {
     "type": "record",
     "name": "OrderEvent",
     "fields": [
       {"name": "orderId", "type": "int"},
       {"name": "userId", "type": "int"},
       {"name": "totalAmount", "type": "double"},
       {"name": "status", "type": "string"}
     ]
   }
   ```
5. **Click "Import Specification"**
6. **Result**: Kafka message test cases generated

**Example Kafka topics:**
- `orders`
- `products`
- `users`

---

### 7. MQTT

**When to use**: Testing IoT/MQTT message protocols

**Steps:**

1. **Go to "Import" tab**
2. **Protocol**: Select `MQTT`
3. **Format**: Select `JSON Schema`
4. **Paste MQTT message schema**:
   ```json
   {
     "type": "object",
     "properties": {
       "deviceId": {"type": "string"},
       "temperature": {"type": "number"},
       "humidity": {"type": "number"},
       "timestamp": {"type": "string", "format": "date-time"}
     },
     "required": ["deviceId", "temperature"]
   }
   ```
5. **Click "Import Specification"**
6. **Result**: MQTT test cases generated

**Example MQTT topics:**
- `devices/sensor/data`
- `devices/actuator/commands`

---

### 8. WebSocket

**When to use**: Testing real-time WebSocket connections

**Steps:**

1. **Go to "Import" tab**
2. **Protocol**: Select `WebSocket`
3. **Format**: Select `JSON Schema`
4. **Paste WebSocket message schema**:
   ```json
   {
     "type": "object",
     "properties": {
       "action": {"type": "string", "enum": ["subscribe", "unsubscribe", "message"]},
       "channel": {"type": "string"},
       "data": {"type": "object"}
     },
     "required": ["action", "channel"]
   }
   ```
5. **Click "Import Specification"**
6. **Result**: WebSocket test cases generated

**Example WebSocket endpoint:**
- `ws://localhost:8002/ws`
- `wss://localhost:8002/ws`

---

## 🎨 UI Guide: Protocol and Format Selection

### In the Import Tab:

1. **Protocol Dropdown** (top of Import tab):
   - REST
   - SOAP
   - GraphQL
   - gRPC
   - Kafka
   - MQTT
   - WebSocket
   - HTTP/2

2. **Format Dropdown** (below Protocol):
   - OpenAPI/Swagger (for REST)
   - WSDL (for SOAP)
   - GraphQL Schema (for GraphQL)
   - Postman Collection (for REST)
   - Protobuf (for gRPC)
   - Avro (for Kafka)
   - JSON Schema (for MQTT/WebSocket)

3. **Import Options**:
   - **Upload File**: Click to upload a file
   - **Or Paste Specification**: Paste spec content directly

---

## 🔄 Converting Your Current Spec to Other Formats

### Your Current Spec (OpenAPI 3.1.0) → Other Formats

**To Postman Collection:**
- Apex can export your test cases to Postman format
- Go to "Results" tab → "Export" → "Postman Collection"

**To WSDL (for SOAP):**
- If you need SOAP, you'll need a WSDL file
- WSDL is XML-based and different from OpenAPI
- You can't directly convert OpenAPI to WSDL (different protocols)

**To GraphQL Schema:**
- If you want to test GraphQL, you need a GraphQL schema file
- OpenAPI (REST) and GraphQL are different protocols
- You'll need a separate GraphQL schema

---

## 📊 Test Case Generation by Protocol

| Protocol | Test Types Generated |
|----------|---------------------|
| **REST** | GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD |
| **SOAP** | SOAP Request/Response, XML validation |
| **GraphQL** | Query, Mutation, Subscription |
| **gRPC** | Unary, Server Streaming, Client Streaming, Bidirectional |
| **Kafka** | Producer, Consumer, Message validation |
| **MQTT** | Publish, Subscribe, Message validation |
| **WebSocket** | Connect, Send, Receive, Close |

---

## 🎯 Quick Reference: What Format for What?

| Your API Type | Use Format | Protocol |
|--------------|------------|----------|
| REST API (like your test website) | OpenAPI/Swagger | REST |
| SOAP Web Service | WSDL | SOAP |
| GraphQL API | GraphQL Schema | GraphQL |
| gRPC Service | Protobuf | gRPC |
| Kafka Producer/Consumer | Avro/JSON Schema | Kafka |
| MQTT Broker | JSON Schema | MQTT |
| WebSocket Server | JSON Schema | WebSocket |
| Postman Collection | Postman Collection | REST |

---

## ✅ Summary

**Your spec:**
- ✅ **Format**: OpenAPI 3.1.0 (Swagger)
- ✅ **Protocol**: REST
- ✅ **Status**: Perfect for REST API testing!

**To test other protocols:**
1. Select different **Protocol** in Import tab
2. Select matching **Format**
3. Provide spec in that format
4. Import and generate test cases

**All protocols work the same way:**
- Import spec → Generate test cases → Select tests → Execute → View results

---

## 🚀 Next Steps

1. **Test REST** (your current setup) ✅
2. **Try SOAP**: Get a WSDL file and test SOAP endpoints
3. **Try GraphQL**: If you have a GraphQL API, test it
4. **Try gRPC**: Test high-performance RPC services
5. **Try Kafka/MQTT**: Test message queue systems
6. **Try WebSocket**: Test real-time connections

All protocols use the same workflow - just change the Protocol and Format dropdowns!


