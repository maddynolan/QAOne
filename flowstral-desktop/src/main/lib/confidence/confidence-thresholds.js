/**
 * Confidence Thresholds - Constants
 * 
 * Defines the scoring thresholds and impact values for confidence calculation.
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

module.exports = {
  // Score thresholds for confidence levels
  HIGH_THRESHOLD: 90,    // 90-100% = HIGH confidence
  MEDIUM_THRESHOLD: 70,  // 70-89% = MEDIUM confidence
                         // <70% = LOW confidence
  
  // Base score to start with
  BASE_SCORE: 50,
  
  // Score impacts (positive = good, negative = bad)
  SCORES: {
    // Positive factors
    UNIQUE_TESTID: 40,           // Has unique data-testid
    SINGLE_MATCH: 30,            // Only one element matched
    EXACT_TEXT_MATCH: 20,        // Text matches exactly
    RELATED_LIST_CONTEXT: 15,    // Has Salesforce relatedList context
    ROLE_TEXT_MATCH: 10,         // Used role+text strategy
    HAS_ARIA_LABEL: 5,           // Has aria-label
    
    // Negative factors (these are negative numbers)
    POSITION_FALLBACK: -20,      // Used position-based selection
    MULTIPLE_MATCHES: -15,       // Multiple elements matched
    AI_VISION_FALLBACK: -30,     // Used AI vision to find element
    COORDINATE_CLICK: -40,       // Used coordinate-based click
    TEXT_PARTIAL_MATCH: -10,     // Text only partially matched
    NO_UNIQUE_IDENTIFIER: -5,    // No testId, id, or unique aria-label
  },
  
  // Level names
  LEVELS: {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
  },
  
  // Execution modes
  EXECUTION_MODES: {
    NORMAL: 'normal',     // Fail on LOW confidence
    STRICT: 'strict',     // Fail on MEDIUM or LOW
    LENIENT: 'lenient'    // Warn but continue
  }
};
