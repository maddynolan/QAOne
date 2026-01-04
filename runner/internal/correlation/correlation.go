// Package correlation provides automatic value extraction and substitution
package correlation

import (
	"encoding/json"
	"regexp"
	"strings"
	"sync"

	"github.com/tidwall/gjson"

	"github.com/aristrace/runner/pkg/scenario"
)

// Engine handles correlation (extraction and substitution) for virtual users
type Engine struct {
	mu        sync.RWMutex
	variables map[string]interface{}
	
	// Auto-detection patterns
	autoPatterns map[string][]*regexp.Regexp
}

// NewEngine creates a new correlation engine
func NewEngine() *Engine {
	return &Engine{
		variables: make(map[string]interface{}),
		autoPatterns: map[string][]*regexp.Regexp{
			"session_id": {
				regexp.MustCompile(`"session[_-]?id"\s*:\s*"([^"]+)"`),
				regexp.MustCompile(`session[_-]?id=([^;&\s]+)`),
			},
			"csrf_token": {
				regexp.MustCompile(`"csrf[_-]?token"\s*:\s*"([^"]+)"`),
				regexp.MustCompile(`csrf[_-]?token=([^;&\s]+)`),
				regexp.MustCompile(`<input[^>]*name=["']csrf[_-]?token["'][^>]*value=["']([^"']+)["']`),
				regexp.MustCompile(`<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']`),
			},
			"auth_token": {
				regexp.MustCompile(`"token"\s*:\s*"([^"]+)"`),
				regexp.MustCompile(`"access[_-]?token"\s*:\s*"([^"]+)"`),
				regexp.MustCompile(`"auth[_-]?token"\s*:\s*"([^"]+)"`),
			},
		},
	}
}

// Clone creates a copy of the engine for a new VU
func (e *Engine) Clone() *Engine {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	newEngine := NewEngine()
	for k, v := range e.variables {
		newEngine.variables[k] = v
	}
	return newEngine
}

// SetVariable sets a correlation variable
func (e *Engine) SetVariable(name string, value interface{}) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.variables[name] = value
}

// GetVariable gets a correlation variable
func (e *Engine) GetVariable(name string) interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.variables[name]
}

// GetVariableString gets a variable as a string
func (e *Engine) GetVariableString(name string) string {
	val := e.GetVariable(name)
	if val == nil {
		return ""
	}
	switch v := val.(type) {
	case string:
		return v
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}

// Extract extracts values from a response based on extractors
func (e *Engine) Extract(body []byte, headers map[string][]string, statusCode int, extractors []scenario.Extractor) map[string]interface{} {
	e.mu.Lock()
	defer e.mu.Unlock()
	
	extracted := make(map[string]interface{})
	bodyStr := string(body)
	
	for _, ext := range extractors {
		var value interface{}
		
		switch ext.From {
		case "json":
			value = e.extractJSON(body, ext.Path)
		case "header":
			if vals, ok := headers[ext.Key]; ok && len(vals) > 0 {
				value = vals[0]
			}
		case "cookie":
			value = e.extractCookie(headers, ext.Key)
		case "regex":
			value = e.extractRegex(bodyStr, ext.Regex)
		case "body":
			value = bodyStr
		case "status":
			value = statusCode
		}
		
		if value != nil {
			e.variables[ext.Name] = value
			extracted[ext.Name] = value
		} else if ext.Default != "" {
			e.variables[ext.Name] = ext.Default
			extracted[ext.Name] = ext.Default
		}
	}
	
	return extracted
}

// AutoDetect automatically detects common correlation patterns
func (e *Engine) AutoDetect(body []byte, headers map[string][]string) map[string]interface{} {
	e.mu.Lock()
	defer e.mu.Unlock()
	
	detected := make(map[string]interface{})
	bodyStr := string(body)
	
	// Auto-detect from body
	for varName, patterns := range e.autoPatterns {
		for _, pattern := range patterns {
			if match := pattern.FindStringSubmatch(bodyStr); len(match) > 1 {
				e.variables[varName] = match[1]
				detected[varName] = match[1]
				break
			}
		}
	}
	
	// Auto-detect Bearer token from Authorization header
	if auths, ok := headers["Authorization"]; ok && len(auths) > 0 {
		auth := auths[0]
		if strings.HasPrefix(auth, "Bearer ") {
			e.variables["bearer_token"] = auth[7:]
			detected["bearer_token"] = auth[7:]
		}
	}
	
	// Auto-detect from Set-Cookie
	if cookies, ok := headers["Set-Cookie"]; ok {
		cookieNames := []string{"sessionid", "JSESSIONID", "PHPSESSID", "ASP.NET_SessionId"}
		for _, cookie := range cookies {
			for _, name := range cookieNames {
				if val := e.parseCookieValue(cookie, name); val != "" {
					e.variables[strings.ToLower(name)] = val
					detected[strings.ToLower(name)] = val
					break
				}
			}
		}
	}
	
	return detected
}

// Substitute replaces variables in a string
func (e *Engine) Substitute(text string) string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	result := text
	for name, value := range e.variables {
		strVal := e.toString(value)
		// Replace ${var_name}
		result = strings.ReplaceAll(result, "${"+name+"}", strVal)
		// Replace {var_name}
		result = strings.ReplaceAll(result, "{"+name+"}", strVal)
		// Replace {{var_name}}
		result = strings.ReplaceAll(result, "{{"+name+"}}", strVal)
	}
	return result
}

// SubstituteMap applies variable substitution to all string values in a map
func (e *Engine) SubstituteMap(m map[string]string) map[string]string {
	result := make(map[string]string, len(m))
	for k, v := range m {
		result[k] = e.Substitute(v)
	}
	return result
}

// extractJSON extracts a value using JSONPath (via gjson)
func (e *Engine) extractJSON(body []byte, path string) interface{} {
	// Clean up the path (gjson uses different syntax)
	path = strings.TrimPrefix(path, "$.")
	path = strings.TrimPrefix(path, "$")
	
	result := gjson.GetBytes(body, path)
	if !result.Exists() {
		return nil
	}
	return result.Value()
}

// extractRegex extracts a value using regex
func (e *Engine) extractRegex(text, pattern string) interface{} {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil
	}
	match := re.FindStringSubmatch(text)
	if len(match) > 1 {
		return match[1]
	} else if len(match) == 1 {
		return match[0]
	}
	return nil
}

// extractCookie extracts a cookie value from headers
func (e *Engine) extractCookie(headers map[string][]string, name string) interface{} {
	cookies, ok := headers["Set-Cookie"]
	if !ok {
		return nil
	}
	
	for _, cookie := range cookies {
		if val := e.parseCookieValue(cookie, name); val != "" {
			return val
		}
	}
	return nil
}

// parseCookieValue parses a cookie value from a Set-Cookie header
func (e *Engine) parseCookieValue(setCookie, name string) string {
	re := regexp.MustCompile(name + `=([^;]+)`)
	if match := re.FindStringSubmatch(setCookie); len(match) > 1 {
		return match[1]
	}
	return ""
}

// toString converts a value to string
func (e *Engine) toString(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case int:
		return string(rune(val))
	case float64:
		return strings.TrimRight(strings.TrimRight(string(rune(int(val))), "0"), ".")
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}

// GetAllVariables returns all current variables
func (e *Engine) GetAllVariables() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	result := make(map[string]interface{}, len(e.variables))
	for k, v := range e.variables {
		result[k] = v
	}
	return result
}

// Clear clears all variables
func (e *Engine) Clear() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.variables = make(map[string]interface{})
}

