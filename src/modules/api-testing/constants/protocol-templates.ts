/**
 * Protocol templates for quick-start API testing using real public APIs.
 * Extracted from EnhancedAPITesting.tsx for code splitting.
 */

export const PROTOCOL_TEMPLATES = {
  rest_openapi: {
    name: "REST API (JSONPlaceholder)",
    icon: "\u{1F310}",
    protocol: "REST",
    format: "openapi",
    description: "JSONPlaceholder - Free REST API for testing (public, no auth required)",
    baseUrl: "https://jsonplaceholder.typicode.com",
    spec: {
      openapi: "3.1.0",
      info: { title: "JSONPlaceholder API", version: "1.0.0", description: "Free fake REST API for testing and prototyping" },
      servers: [{ url: "https://jsonplaceholder.typicode.com" }],
      paths: {
        "/posts": {
          get: { summary: "List all posts", operationId: "listPosts", responses: { "200": { description: "Array of posts", content: { "application/json": { schema: { type: "array", items: { type: "object", properties: { id: { type: "integer" }, userId: { type: "integer" }, title: { type: "string" }, body: { type: "string" } } } } } } } } },
          post: {
            summary: "Create a post", operationId: "createPost",
            requestBody: { content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" }, userId: { type: "integer" } }, required: ["title", "body", "userId"] } } } },
            responses: { "201": { description: "Post created" } }
          }
        },
        "/posts/{id}": {
          get: { summary: "Get post by ID", operationId: "getPost", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Post object" } } },
          put: { summary: "Update post", operationId: "updatePost", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" }, userId: { type: "integer" } } } } } }, responses: { "200": { description: "Post updated" } } },
          delete: { summary: "Delete post", operationId: "deletePost", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Post deleted" } } }
        },
        "/posts/{id}/comments": {
          get: { summary: "Get comments for a post", operationId: "getPostComments", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Array of comments" } } }
        },
        "/users": {
          get: { summary: "List all users", operationId: "listUsers", responses: { "200": { description: "Array of users" } } }
        },
        "/users/{id}": {
          get: { summary: "Get user by ID", operationId: "getUser", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "User object" } } }
        },
        "/comments": {
          get: { summary: "List comments (with filter)", operationId: "listComments", parameters: [{ name: "postId", in: "query", schema: { type: "integer" } }], responses: { "200": { description: "Array of comments" } } }
        }
      }
    }
  },
  graphql: {
    name: "GraphQL API (Countries)",
    icon: "\u2B22",
    protocol: "GraphQL",
    format: "graphql",
    description: "Countries GraphQL API - Query countries, continents, languages (public, no auth)",
    baseUrl: "https://countries.trevorblades.com/graphql",
    spec: `
type Query {
  countries(filter: CountryFilterInput): [Country!]!
  country(code: ID!): Country
  continents(filter: ContinentFilterInput): [Continent!]!
  continent(code: ID!): Continent
  languages(filter: LanguageFilterInput): [Language!]!
  language(code: ID!): Language
}

type Country {
  code: ID!
  name: String!
  native: String!
  phone: String!
  continent: Continent!
  capital: String
  currency: String
  languages: [Language!]!
  emoji: String!
  emojiU: String!
}

type Continent {
  code: ID!
  name: String!
  countries: [Country!]!
}

type Language {
  code: ID!
  name: String!
  native: String!
  rtl: Boolean!
}

input CountryFilterInput {
  code: StringQueryOperatorInput
  continent: StringQueryOperatorInput
}

input ContinentFilterInput {
  code: StringQueryOperatorInput
}

input LanguageFilterInput {
  code: StringQueryOperatorInput
}

input StringQueryOperatorInput {
  eq: String
  in: [String!]
}
`
  },
  soap: {
    name: "SOAP Service (CountryInfo)",
    icon: "\u{1F4E8}",
    protocol: "SOAP",
    format: "wsdl",
    description: "CountryInfo SOAP service - Get country details (public, no auth)",
    baseUrl: "http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso",
    spec: `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
             xmlns:tns="http://www.oorsprong.org/websamples.countryinfo"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema"
             targetNamespace="http://www.oorsprong.org/websamples.countryinfo">
  <types>
    <xsd:schema targetNamespace="http://www.oorsprong.org/websamples.countryinfo">
      <xsd:element name="CountryISOCode" type="xsd:string"/>
      <xsd:element name="FullCountryInfo" type="tns:tCountryInfo"/>
      <xsd:complexType name="tCountryInfo">
        <xsd:sequence>
          <xsd:element name="sISOCode" type="xsd:string"/>
          <xsd:element name="sName" type="xsd:string"/>
          <xsd:element name="sCapitalCity" type="xsd:string"/>
          <xsd:element name="sPhoneCode" type="xsd:string"/>
          <xsd:element name="sContinentCode" type="xsd:string"/>
          <xsd:element name="sCurrencyISOCode" type="xsd:string"/>
          <xsd:element name="sCountryFlag" type="xsd:string"/>
        </xsd:sequence>
      </xsd:complexType>
    </xsd:schema>
  </types>
  <message name="FullCountryInfoRequest">
    <part name="sCountryISOCode" element="tns:CountryISOCode"/>
  </message>
  <message name="FullCountryInfoResponse">
    <part name="FullCountryInfoResult" element="tns:FullCountryInfo"/>
  </message>
  <portType name="CountryInfoServiceSoap">
    <operation name="FullCountryInfo">
      <input message="tns:FullCountryInfoRequest"/>
      <output message="tns:FullCountryInfoResponse"/>
    </operation>
    <operation name="ListOfCountryNamesByCode">
      <input message="tns:FullCountryInfoRequest"/>
      <output message="tns:FullCountryInfoResponse"/>
    </operation>
  </portType>
  <service name="CountryInfoService">
    <port name="CountryInfoServiceSoap" binding="tns:CountryInfoServiceSoapBinding">
      <soap:address location="http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso"/>
    </port>
  </service>
</definitions>`
  },
};
