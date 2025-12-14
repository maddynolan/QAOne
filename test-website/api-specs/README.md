# API Specifications for All Protocols

This directory contains example API specifications for testing all protocols in Apex (Enhanced API Testing).

## 📁 Files

| File | Protocol | Format | Description |
|------|----------|--------|-------------|
| `soap-wsdl-example.xml` | SOAP | WSDL | SOAP web service specification |
| `graphql-schema-example.graphql` | GraphQL | GraphQL Schema | GraphQL API schema |
| `postman-collection-example.json` | REST | Postman | Postman collection for REST API |
| `grpc-proto-example.proto` | gRPC | Protobuf | gRPC service definitions |
| `kafka-avro-schema-example.json` | Kafka | Avro | Kafka message schemas |
| `mqtt-schema-example.json` | MQTT | JSON Schema | MQTT message schemas |
| `websocket-schema-example.json` | WebSocket | JSON Schema | WebSocket message schemas |

## 🚀 How to Use

### 1. REST API (OpenAPI/Swagger)
**You already have this!** Your OpenAPI 3.1.0 spec is perfect for REST testing.

### 2. SOAP (WSDL)
1. Go to Apex → Import tab
2. **Protocol**: Select `SOAP`
3. **Format**: Select `WSDL`
4. **Paste**: Copy contents of `soap-wsdl-example.xml`
5. Click "Import Specification"

### 3. GraphQL
1. Go to Apex → Import tab
2. **Protocol**: Select `GraphQL`
3. **Format**: Select `GraphQL Schema`
4. **Paste**: Copy contents of `graphql-schema-example.graphql`
5. Click "Import Specification"

### 4. Postman Collection
1. Go to Apex → Import tab
2. **Protocol**: Select `REST`
3. **Format**: Select `Postman`
4. **Paste**: Copy contents of `postman-collection-example.json`
5. Click "Import Specification"

### 5. gRPC (Protobuf)
1. Go to Apex → Import tab
2. **Protocol**: Select `gRPC`
3. **Format**: Select `Protobuf`
4. **Upload**: Upload `grpc-proto-example.proto` file
5. Click "Import Specification"

### 6. Kafka (Avro)
1. Go to Apex → Import tab
2. **Protocol**: Select `Kafka`
3. **Format**: Select `Avro`
4. **Paste**: Copy contents of `kafka-avro-schema-example.json`
5. Click "Import Specification"

### 7. MQTT
1. Go to Apex → Import tab
2. **Protocol**: Select `MQTT`
3. **Format**: Select `JSON Schema`
4. **Paste**: Copy contents of `mqtt-schema-example.json`
5. Click "Import Specification"

### 8. WebSocket
1. Go to Apex → Import tab
2. **Protocol**: Select `WebSocket`
3. **Format**: Select `JSON Schema`
4. **Paste**: Copy contents of `websocket-schema-example.json`
5. Click "Import Specification"

## 📝 Notes

- **All specs are designed for the test website** (`http://localhost:8002`)
- **Topics/endpoints match test website functionality** (products, orders, users, cart)
- **Test data is realistic** and matches your test website schema
- **All protocols use the same workflow**: Import → Generate → Execute → Results

## 🎯 Test Website Endpoints

These specs test the following test website features:
- ✅ Authentication (register, login)
- ✅ Products (CRUD operations)
- ✅ Categories
- ✅ Cart (add, update, remove, clear)
- ✅ Orders (create, list, get, update status)
- ✅ Users
- ✅ Real-time updates (WebSocket)
- ✅ Event streaming (Kafka, MQTT)

## 🔧 Customization

You can customize these specs:
- Change `localhost:8002` to your actual test website URL
- Add more endpoints/operations
- Modify test data
- Add authentication tokens

## ✅ Ready to Test!

All specs are ready to use. Just copy/paste into Apex and start testing!


