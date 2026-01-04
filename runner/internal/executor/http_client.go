// Package executor provides HTTP request execution with HTTP/1.1 and HTTP/2 support
package executor

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/http2"
)

// HTTPClient is a high-performance HTTP client for load testing
type HTTPClient struct {
	http1Client *http.Client
	http2Client *http.Client
	enableHTTP2 bool
	
	// Connection pool settings
	maxConnsPerHost     int
	maxIdleConnsPerHost int
	idleConnTimeout     time.Duration
	
	mu sync.RWMutex
}

// ClientConfig configures the HTTP client
type ClientConfig struct {
	EnableHTTP2         bool
	ConnectionTimeout   time.Duration
	RequestTimeout      time.Duration
	MaxConnsPerHost     int
	MaxIdleConnsPerHost int
	IdleConnTimeout     time.Duration
	InsecureSkipVerify  bool
}

// DefaultClientConfig returns default HTTP client configuration
func DefaultClientConfig() ClientConfig {
	return ClientConfig{
		EnableHTTP2:         true,
		ConnectionTimeout:   10 * time.Second,
		RequestTimeout:      30 * time.Second,
		MaxConnsPerHost:     100,
		MaxIdleConnsPerHost: 100,
		IdleConnTimeout:     90 * time.Second,
		InsecureSkipVerify:  false,
	}
}

// NewHTTPClient creates a new HTTP client with the given configuration
func NewHTTPClient(cfg ClientConfig) *HTTPClient {
	// TLS config
	tlsConfig := &tls.Config{
		InsecureSkipVerify: cfg.InsecureSkipVerify,
	}
	
	// Custom dialer
	dialer := &net.Dialer{
		Timeout:   cfg.ConnectionTimeout,
		KeepAlive: 30 * time.Second,
	}
	
	// HTTP/1.1 transport
	http1Transport := &http.Transport{
		DialContext:           dialer.DialContext,
		TLSClientConfig:       tlsConfig,
		MaxIdleConns:          cfg.MaxIdleConnsPerHost * 10,
		MaxIdleConnsPerHost:   cfg.MaxIdleConnsPerHost,
		MaxConnsPerHost:       cfg.MaxConnsPerHost,
		IdleConnTimeout:       cfg.IdleConnTimeout,
		DisableCompression:    false,
		ForceAttemptHTTP2:     false, // Force HTTP/1.1
	}
	
	// HTTP/2 transport
	var http2Transport http.RoundTripper
	if cfg.EnableHTTP2 {
		h2Transport := &http2.Transport{
			TLSClientConfig:    tlsConfig,
			DisableCompression: false,
			AllowHTTP:          false,
		}
		http2Transport = h2Transport
	}
	
	return &HTTPClient{
		http1Client: &http.Client{
			Transport: http1Transport,
			Timeout:   cfg.RequestTimeout,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 10 {
					return fmt.Errorf("too many redirects")
				}
				return nil
			},
		},
		http2Client: func() *http.Client {
			if cfg.EnableHTTP2 {
				return &http.Client{
					Transport: http2Transport,
					Timeout:   cfg.RequestTimeout,
				}
			}
			return nil
		}(),
		enableHTTP2:         cfg.EnableHTTP2,
		maxConnsPerHost:     cfg.MaxConnsPerHost,
		maxIdleConnsPerHost: cfg.MaxIdleConnsPerHost,
		idleConnTimeout:     cfg.IdleConnTimeout,
	}
}

// Request represents an HTTP request to execute
type Request struct {
	Method   string
	URL      string
	Headers  map[string]string
	Body     interface{}
	FormData map[string]string
}

// Response represents an HTTP response
type Response struct {
	StatusCode    int
	Headers       map[string][]string
	Body          []byte
	BodyString    string
	ContentLength int64
	Duration      time.Duration
	BytesSent     int64
	BytesReceived int64
	Protocol      string
	Error         error
}

// Execute executes an HTTP request and returns the response
func (c *HTTPClient) Execute(ctx context.Context, req *Request) *Response {
	start := time.Now()
	result := &Response{}
	
	// Build HTTP request
	httpReq, err := c.buildRequest(ctx, req)
	if err != nil {
		result.Error = err
		result.Duration = time.Since(start)
		return result
	}
	
	// Calculate bytes sent (approximate)
	result.BytesSent = c.estimateRequestSize(httpReq)
	
	// Select client based on URL scheme and HTTP/2 availability
	client := c.selectClient(req.URL)
	
	// Execute request
	resp, err := client.Do(httpReq)
	if err != nil {
		result.Error = err
		result.Duration = time.Since(start)
		return result
	}
	defer resp.Body.Close()
	
	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		result.Error = err
		result.Duration = time.Since(start)
		return result
	}
	
	result.StatusCode = resp.StatusCode
	result.Headers = resp.Header
	result.Body = body
	result.BodyString = string(body)
	result.ContentLength = resp.ContentLength
	result.Duration = time.Since(start)
	result.BytesReceived = int64(len(body)) + c.estimateHeaderSize(resp.Header)
	result.Protocol = resp.Proto
	
	return result
}

// buildRequest builds an http.Request from our Request struct
func (c *HTTPClient) buildRequest(ctx context.Context, req *Request) (*http.Request, error) {
	var bodyReader io.Reader
	
	// Handle body
	if req.Body != nil {
		switch b := req.Body.(type) {
		case string:
			bodyReader = strings.NewReader(b)
		case []byte:
			bodyReader = bytes.NewReader(b)
		default:
			// JSON encode other types
			jsonBody, err := json.Marshal(b)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal body: %w", err)
			}
			bodyReader = bytes.NewReader(jsonBody)
		}
	} else if req.FormData != nil {
		// Handle form data
		formValues := url.Values{}
		for k, v := range req.FormData {
			formValues.Set(k, v)
		}
		bodyReader = strings.NewReader(formValues.Encode())
	}
	
	httpReq, err := http.NewRequestWithContext(ctx, req.Method, req.URL, bodyReader)
	if err != nil {
		return nil, err
	}
	
	// Set headers
	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}
	
	// Set Content-Type if not specified
	if req.FormData != nil && httpReq.Header.Get("Content-Type") == "" {
		httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	
	return httpReq, nil
}

// selectClient selects HTTP/1.1 or HTTP/2 client based on URL
func (c *HTTPClient) selectClient(urlStr string) *http.Client {
	if !c.enableHTTP2 || c.http2Client == nil {
		return c.http1Client
	}
	
	// Use HTTP/2 only for HTTPS
	if strings.HasPrefix(urlStr, "https://") {
		return c.http2Client
	}
	
	return c.http1Client
}

// estimateRequestSize estimates the size of an HTTP request
func (c *HTTPClient) estimateRequestSize(req *http.Request) int64 {
	size := int64(len(req.Method) + len(req.URL.String()) + 12) // "GET /url HTTP/1.1\r\n"
	
	// Headers
	for k, v := range req.Header {
		for _, vv := range v {
			size += int64(len(k) + len(vv) + 4) // "Key: Value\r\n"
		}
	}
	
	// Body
	if req.ContentLength > 0 {
		size += req.ContentLength
	}
	
	return size
}

// estimateHeaderSize estimates response header size
func (c *HTTPClient) estimateHeaderSize(headers http.Header) int64 {
	size := int64(0)
	for k, v := range headers {
		for _, vv := range v {
			size += int64(len(k) + len(vv) + 4)
		}
	}
	return size
}

// Close closes the HTTP client
func (c *HTTPClient) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if transport, ok := c.http1Client.Transport.(*http.Transport); ok {
		transport.CloseIdleConnections()
	}
}

